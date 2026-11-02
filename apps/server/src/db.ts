import postgres from 'postgres';
import { config } from './config.ts';

export type Sql = ReturnType<typeof postgres>;
let sql: Sql | null = null;

/** One small pool: this server does very little database work. */
export function db(): Sql | null {
  if (!config.databaseUrl) return null;
  sql ??= postgres(config.databaseUrl, { max: 4, idle_timeout: 30, connect_timeout: 10, onnotice: () => {} });
  return sql;
}

export async function migrate(sql: Sql) {
  await sql`
    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      email text not null,
      name text,
      password_hash text not null,
      created_at timestamptz not null default now()
    )`;
  await sql`create unique index if not exists users_email_key on users (lower(email))`;
  await sql`
    create table if not exists sessions (
      id text primary key,
      user_id uuid not null references users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )`;
  await sql`create index if not exists sessions_user_idx on sessions (user_id)`;
  await sql`
    create table if not exists shares (
      id text primary key,
      user_id uuid references users(id) on delete cascade,
      ip_hash text,
      object_key text not null,
      filename text not null,
      size bigint not null,
      content_type text not null,
      tool text,
      status text not null default 'pending',
      created_at timestamptz not null default now(),
      expires_at timestamptz not null
    )`;
  await sql`create index if not exists shares_expires_idx on shares (expires_at)`;
  await sql`create index if not exists shares_user_idx on shares (user_id)`;
  await sql`
    create table if not exists presets (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      tool text not null,
      name text not null,
      data jsonb not null,
      created_at timestamptz not null default now()
    )`;
  await sql`create index if not exists presets_user_tool_idx on presets (user_id, tool)`;
}
