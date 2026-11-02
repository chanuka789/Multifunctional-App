import { createHash, randomBytes } from 'node:crypto';
import type { Context, Next } from 'hono';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const token = (bytes = 32) => randomBytes(bytes).toString('base64url');
/** Short, unguessable share id (about 71 bits). */
export const shareId = () => randomBytes(9).toString('base64url');

export function clientIp(c: Context) {
  return (c.req.header('x-forwarded-for')?.split(',')[0] ?? c.req.header('x-real-ip') ?? 'local').trim();
}

/** Tiny in-memory token bucket per key. Enough for one small instance. */
export function rateLimit(name: string, perMinute: number, burst = perMinute) {
  const buckets = new Map<string, { tokens: number; at: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (now - b.at > 10 * 60_000) buckets.delete(k);
  }, 60_000).unref();
  return async (c: Context, next: Next) => {
    const key = `${name}:${clientIp(c)}`;
    const now = Date.now();
    const b = buckets.get(key) ?? { tokens: burst, at: now };
    b.tokens = Math.min(burst, b.tokens + ((now - b.at) / 60_000) * perMinute);
    b.at = now;
    if (b.tokens < 1) {
      buckets.set(key, b);
      return c.json({ error: 'Too many tries. Wait a minute and try again.' }, 429);
    }
    b.tokens -= 1;
    buckets.set(key, b);
    await next();
  };
}

/** CSRF guard for cookie-authenticated writes: same-origin Origin header + custom header. */
export function sameOrigin(allowed: () => string[]) {
  return async (c: Context, next: Next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) return next();
    const origin = c.req.header('origin');
    const host = c.req.header('host');
    const ok = !origin || allowed().includes(origin) || (host && (origin === `https://${host}` || origin === `http://${host}`));
    if (!ok || c.req.header('x-requested-with') !== 'ondevo') return c.json({ error: 'Request blocked.' }, 403);
    await next();
  };
}
