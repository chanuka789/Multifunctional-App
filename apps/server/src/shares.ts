import { Hono } from 'hono';
import { z } from 'zod';
import type { Sql } from './db.ts';
import { config, storageReady } from './config.ts';
import { currentUser } from './auth.ts';
import { clientIp, rateLimit, sha256, shareId } from './security.ts';
import { deleteObject, headObject, presignGet, presignPut } from './storage.ts';

interface ShareRow {
  id: string;
  user_id: string | null;
  ip_hash: string | null;
  object_key: string;
  filename: string;
  size: string | number;
  content_type: string;
  tool: string | null;
  status: 'pending' | 'ready';
  created_at: Date;
  expires_at: Date;
}
const pub = (s: ShareRow) => ({
  id: s.id,
  filename: s.filename,
  size: Number(s.size),
  contentType: s.content_type,
  tool: s.tool,
  status: s.status,
  createdAt: s.created_at.toISOString(),
  expiresAt: s.expires_at.toISOString(),
});

// Types a browser could run if opened from the bucket are stored as plain downloads.
const RISKY = /^(text\/html|application\/xhtml|image\/svg|text\/javascript|application\/javascript|application\/x-sh)/i;
const safeName = (n: string) => n.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^\.+/, '').slice(0, 160) || 'file';

export function shareRoutes(sql: Sql) {
  const r = new Hono();

  r.get('/limits', async (c) => {
    const u = await currentUser(c, sql);
    return c.json({ maxBytes: u ? config.userMaxBytes : config.guestMaxBytes, ttlMinutes: config.shareTtlMinutes, storage: storageReady() });
  });

  r.post('/', rateLimit('share', 12, 12), async (c) => {
    if (!storageReady()) return c.json({ error: 'Sharing is not set up on this server yet.' }, 503);
    const u = await currentUser(c, sql);
    const max = u ? config.userMaxBytes : config.guestMaxBytes;
    const p = z
      .object({
        filename: z.string().min(1).max(255),
        size: z.number().int().positive(),
        contentType: z.string().max(120).regex(/^[\w.+-]+\/[\w.+-]+$/).catch('application/octet-stream'),
        tool: z.string().max(40).optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!p.success) return c.json({ error: 'That file cannot be shared.' }, 400);
    if (p.data.size > max)
      return c.json({ error: `Share links take files up to ${Math.round(max / 1048576)} MB${u ? '' : '. Log in for larger files'}.` }, 413);
    const ipHash = sha256(clientIp(c) + (process.env.IP_SALT ?? 'ondevo'));
    if (!u) {
      const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from shares where ip_hash = ${ipHash} and expires_at > now()`;
      if (n >= 20) return c.json({ error: 'You have many live links already. Wait for some to expire or log in.' }, 429);
    }
    const id = shareId();
    const filename = safeName(p.data.filename);
    const contentType = RISKY.test(p.data.contentType) ? 'application/octet-stream' : p.data.contentType;
    const key = `shares/${id}/${filename}`;
    const expires = new Date(Date.now() + config.shareTtlMinutes * 60_000);
    const [row] = await sql<ShareRow[]>`
      insert into shares (id, user_id, ip_hash, object_key, filename, size, content_type, tool, expires_at)
      values (${id}, ${u?.id ?? null}, ${ipHash}, ${key}, ${filename}, ${p.data.size}, ${contentType}, ${p.data.tool ?? null}, ${expires})
      returning *`;
    const put = await presignPut(key, contentType, p.data.size);
    return c.json({ share: pub(row), uploadUrl: put.url, headers: put.headers }, 201);
  });

  r.post('/:id/complete', async (c) => {
    const [row] = await sql<ShareRow[]>`select * from shares where id = ${String(c.req.param('id'))} and expires_at > now()`;
    if (!row) return c.json({ error: 'This link has ended.' }, 404);
    const head = await headObject(row.object_key).catch(() => null);
    if (!head) return c.json({ error: 'The upload did not arrive. Try again.' }, 409);
    if (head.size !== Number(row.size)) {
      await deleteObject(row.object_key).catch(() => {});
      await sql`delete from shares where id = ${row.id}`;
      return c.json({ error: 'The upload was not complete. Try again.' }, 409);
    }
    const [done] = await sql<ShareRow[]>`update shares set status = 'ready' where id = ${row.id} returning *`;
    return c.json({ share: pub(done) });
  });

  r.get('/', async (c) => {
    const u = await currentUser(c, sql);
    if (!u) return c.json({ error: 'Log in first.' }, 401);
    const rows = await sql<ShareRow[]>`select * from shares where user_id = ${u.id} and status = 'ready' and expires_at > now() order by created_at desc limit 200`;
    return c.json({ shares: rows.map(pub) });
  });

  r.get('/:id', rateLimit('share-get', 60, 60), async (c) => {
    const [row] = await sql<ShareRow[]>`select * from shares where id = ${String(c.req.param('id'))} and expires_at > now()`;
    if (!row) return c.json({ error: 'This link has ended.' }, 404);
    const left = Math.floor((row.expires_at.getTime() - Date.now()) / 1000);
    const downloadUrl = row.status === 'ready' ? await presignGet(row.object_key, row.filename, left) : null;
    c.header('Cache-Control', 'no-store');
    return c.json({ share: pub(row), downloadUrl });
  });

  r.delete('/:id', async (c) => {
    const u = await currentUser(c, sql);
    if (!u) return c.json({ error: 'Log in first.' }, 401);
    const [row] = await sql<ShareRow[]>`select * from shares where id = ${String(c.req.param('id'))} and user_id = ${u.id}`;
    if (!row) return c.json({ error: 'Not found.' }, 404);
    await deleteObject(row.object_key).catch((e) => console.warn('[shares] delete failed', e));
    await sql`delete from shares where id = ${row.id}`;
    return c.json({ ok: true });
  });

  return r;
}

export function presetRoutes(sql: Sql) {
  const r = new Hono();
  r.get('/', async (c) => {
    const u = await currentUser(c, sql);
    if (!u) return c.json({ presets: [] });
    const rows = await sql`select id, name, data from presets where user_id = ${u.id} and tool = ${String(c.req.query('tool') ?? '')} order by created_at desc limit 50`;
    return c.json({ presets: rows });
  });
  r.post('/', async (c) => {
    const u = await currentUser(c, sql);
    if (!u) return c.json({ error: 'Log in first.' }, 401);
    const p = z.object({ tool: z.string().max(40), name: z.string().trim().min(1).max(60), data: z.record(z.unknown()) }).safeParse(await c.req.json().catch(() => ({})));
    if (!p.success || JSON.stringify(p.data.data).length > 8000) return c.json({ error: 'That preset cannot be saved.' }, 400);
    const [row] = await sql`insert into presets (user_id, tool, name, data) values (${u.id}, ${p.data.tool}, ${p.data.name}, ${sql.json(p.data.data as never)}) returning id`;
    return c.json({ preset: row }, 201);
  });
  r.delete('/:id', async (c) => {
    const u = await currentUser(c, sql);
    if (!u) return c.json({ error: 'Log in first.' }, 401);
    await sql`delete from presets where id = ${String(c.req.param('id'))} and user_id = ${u.id}`;
    return c.json({ ok: true });
  });
  return r;
}
