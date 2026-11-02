import type { Sql } from './db.ts';
import { config, storageReady } from './config.ts';
import { deleteObject, listKeys } from './storage.ts';

/**
 * Deletes every shared file older than the TTL (2 hours by default) from the bucket and the database.
 * The download endpoint already refuses expired links, so a late sweep never exposes a file.
 * A second pass removes bucket objects that have no database row (for example after a crash).
 */
export async function sweep(sql: Sql) {
  const expired = await sql<{ id: string; object_key: string }[]>`select id, object_key from shares where expires_at <= now() limit 500`;
  let removed = 0;
  for (const s of expired) {
    try {
      if (storageReady()) await deleteObject(s.object_key);
      await sql`delete from shares where id = ${s.id}`;
      removed++;
    } catch (e) {
      console.warn('[cleanup] could not delete', s.object_key, e);
    }
  }
  await sql`delete from sessions where expires_at <= now()`;

  let orphans = 0;
  if (storageReady()) {
    const cutoff = Date.now() - config.shareTtlMinutes * 60_000;
    const objects = await listKeys('shares/').catch(() => []);
    const old = objects.filter((o) => o.lastModified.getTime() < cutoff);
    if (old.length) {
      const known = new Set((await sql<{ object_key: string }[]>`select object_key from shares where object_key in ${sql(old.map((o) => o.key))}`).map((r) => r.object_key));
      for (const o of old) {
        if (known.has(o.key)) continue;
        await deleteObject(o.key).catch(() => {});
        orphans++;
      }
    }
  }
  if (removed || orphans) console.log(`[cleanup] removed ${removed} expired share(s), ${orphans} orphan object(s)`);
  return { removed, orphans };
}

export function startCleanup(sql: Sql) {
  const run = () => sweep(sql).catch((e) => console.warn('[cleanup] sweep failed', e));
  void run();
  return setInterval(run, config.cleanupEveryMs).unref();
}
