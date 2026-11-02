import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';
import type { Sql } from './db.ts';
import { config } from './config.ts';
import { rateLimit, sha256, token } from './security.ts';
import { deleteObject } from './storage.ts';

export const COOKIE = 'ondevo_session';
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 }; // OWASP minimum for Argon2id, light on RAM

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  created_at: Date;
}
const pub = (u: UserRow) => ({ id: u.id, email: u.email, name: u.name, createdAt: u.created_at.toISOString() });

export async function currentUser(c: Context, sql: Sql): Promise<UserRow | null> {
  const t = getCookie(c, COOKIE);
  if (!t) return null;
  const rows = await sql<UserRow[]>`
    select u.id, u.email, u.name, u.created_at from sessions s join users u on u.id = s.user_id
    where s.id = ${sha256(t)} and s.expires_at > now()`;
  return rows[0] ?? null;
}

async function startSession(c: Context, sql: Sql, userId: string) {
  const t = token();
  const expires = new Date(Date.now() + config.sessionDays * 86400_000);
  await sql`insert into sessions (id, user_id, expires_at) values (${sha256(t)}, ${userId}, ${expires})`;
  setCookie(c, COOKIE, t, { httpOnly: true, secure: config.production, sameSite: 'Lax', path: '/', expires });
}

const Email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);
const Password = z.string().min(10, 'Use at least 10 characters.').max(200, 'That password is too long.');

function bad(c: Context, e: z.ZodError) {
  const i = e.issues[0];
  return c.json({ error: i.message, field: String(i.path[0] ?? '') }, 400);
}

export function authRoutes(sql: Sql) {
  const r = new Hono();
  const limit = rateLimit('auth', 10, 10);

  r.get('/me', async (c) => {
    const u = await currentUser(c, sql);
    return c.json({ user: u ? pub(u) : null });
  });

  r.post('/signup', limit, async (c) => {
    const p = z.object({ email: Email, password: Password, name: z.string().trim().max(80).optional() }).safeParse(await c.req.json().catch(() => ({})));
    if (!p.success) return bad(c, p.error);
    const exists = await sql`select 1 from users where lower(email) = ${p.data.email}`;
    if (exists.length) return c.json({ error: 'An account with this email already exists. Log in instead.', field: 'email' }, 409);
    const password_hash = await hash(p.data.password, ARGON);
    const [u] = await sql<UserRow[]>`insert into users (email, name, password_hash) values (${p.data.email}, ${p.data.name || null}, ${password_hash}) returning id, email, name, created_at`;
    await startSession(c, sql, u.id);
    return c.json({ user: pub(u) }, 201);
  });

  r.post('/login', limit, async (c) => {
    const p = z.object({ email: Email, password: z.string().min(1).max(200) }).safeParse(await c.req.json().catch(() => ({})));
    if (!p.success) return c.json({ error: 'Enter your email and password.' }, 400);
    const [u] = await sql<(UserRow & { password_hash: string })[]>`select id, email, name, created_at, password_hash from users where lower(email) = ${p.data.email}`;
    // Verify against a dummy hash when the user does not exist, so timing does not reveal accounts.
    const ok = u ? await verify(u.password_hash, p.data.password) : (await verify(await dummyHash(), p.data.password), false);
    if (!u || !ok) return c.json({ error: 'That email and password do not match.', field: 'password' }, 401);
    await startSession(c, sql, u.id);
    return c.json({ user: pub(u) });
  });

  r.post('/logout', async (c) => {
    const t = getCookie(c, COOKIE);
    if (t) await sql`delete from sessions where id = ${sha256(t)}`;
    deleteCookie(c, COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  r.patch('/profile', async (c) => {
    const u = await currentUser(c, sql);
    if (!u) return c.json({ error: 'Log in first.' }, 401);
    const p = z.object({ name: z.string().trim().max(80) }).safeParse(await c.req.json().catch(() => ({})));
    if (!p.success) return bad(c, p.error);
    const [n] = await sql<UserRow[]>`update users set name = ${p.data.name || null} where id = ${u.id} returning id, email, name, created_at`;
    return c.json({ user: pub(n) });
  });

  r.post('/password', limit, async (c) => {
    const u = await currentUser(c, sql);
    if (!u) return c.json({ error: 'Log in first.' }, 401);
    const p = z.object({ current: z.string().min(1), next: Password }).safeParse(await c.req.json().catch(() => ({})));
    if (!p.success) return bad(c, p.error);
    const [row] = await sql<{ password_hash: string }[]>`select password_hash from users where id = ${u.id}`;
    if (!(await verify(row.password_hash, p.data.current))) return c.json({ error: 'Your current password is not right.' }, 401);
    await sql`update users set password_hash = ${await hash(p.data.next, ARGON)} where id = ${u.id}`;
    const t = getCookie(c, COOKIE)!;
    await sql`delete from sessions where user_id = ${u.id} and id <> ${sha256(t)}`;
    return c.json({ ok: true });
  });

  r.delete('/account', limit, async (c) => {
    const u = await currentUser(c, sql);
    if (!u) return c.json({ error: 'Log in first.' }, 401);
    const p = z.object({ password: z.string().min(1) }).safeParse(await c.req.json().catch(() => ({})));
    if (!p.success) return c.json({ error: 'Enter your password.' }, 400);
    const [row] = await sql<{ password_hash: string }[]>`select password_hash from users where id = ${u.id}`;
    if (!(await verify(row.password_hash, p.data.password))) return c.json({ error: 'That password is not right.' }, 401);
    const shares = await sql<{ object_key: string }[]>`select object_key from shares where user_id = ${u.id}`;
    await Promise.allSettled(shares.map((s) => deleteObject(s.object_key)));
    await sql`delete from users where id = ${u.id}`;
    deleteCookie(c, COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  return r;
}

// Hash of a random string, used only to equalise login timing for unknown emails.
let dummy: Promise<string> | null = null;
const dummyHash = () => (dummy ??= hash(token(), ARGON));
