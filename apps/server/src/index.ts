import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { config, storageReady } from './config.ts';
import { db, migrate } from './db.ts';
import { authRoutes } from './auth.ts';
import { presetRoutes, shareRoutes } from './shares.ts';
import { startCleanup } from './cleanup.ts';
import { sameOrigin } from './security.ts';
import { ensureCors } from './storage.ts';

const app = new Hono();

const CSP = [
  "default-src 'self'",
  // WASM engines (Tesseract, ffmpeg, ONNX) and their workers load from public CDNs.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net https://unpkg.com",
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  `connect-src 'self' blob: data: https:${config.production ? '' : ' http://localhost:*'}`,
  "img-src 'self' data: blob:",
  "media-src 'self' blob: data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

app.use('*', async (c, next) => {
  await next();
  c.header('Cross-Origin-Opener-Policy', 'same-origin');
  c.header('Cross-Origin-Embedder-Policy', 'credentialless');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
  if (config.production) c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if ((c.res.headers.get('content-type') ?? '').includes('text/html')) c.header('Content-Security-Policy', CSP);
});

app.get('/healthz', (c) => c.json({ ok: true, db: !!db(), storage: storageReady() }));

const sql = db();
const api = new Hono();
api.use('*', sameOrigin(() => [config.publicOrigin].filter(Boolean)));
if (sql) {
  api.route('/auth', authRoutes(sql));
  api.route('/shares', shareRoutes(sql));
  api.route('/presets', presetRoutes(sql));
} else {
  // Without a database the tools still work fully; accounts and sharing are off.
  api.all('*', (c) => c.json({ error: 'Accounts and sharing are not set up on this server.' }, 503));
}
api.notFound((c) => c.json({ error: 'Not found' }, 404));
api.onError((e, c) => {
  console.error('[api]', e);
  return c.json({ error: 'Something went wrong on our side. Try again.' }, 500);
});
app.route('/api', api);

/* ---------- The web app ---------- */
const root = relative(process.cwd(), config.webDist) || '.';
// Hashed assets never change: cache for a year. Everything else revalidates.
app.use('/assets/*', async (c, next) => {
  await next();
  if (c.res.status === 200) c.header('Cache-Control', 'public, max-age=31536000, immutable');
});
app.use('*', serveStatic({ root, precompressed: true }));
let indexHtml: string | null = null;
app.get('*', async (c) => {
  indexHtml ??= existsSync(join(config.webDist, 'index.html')) ? await readFile(join(config.webDist, 'index.html'), 'utf8') : '<h1>Build the web app first: npm run build</h1>';
  c.header('Cache-Control', 'no-cache');
  return c.html(indexHtml);
});

async function main() {
  if (sql) {
    await migrate(sql);
    startCleanup(sql);
    console.log('[db] ready');
  } else console.warn('[db] DATABASE_URL not set: accounts and share links are off; all tools still work.');
  if (storageReady()) await ensureCors([config.publicOrigin, 'http://localhost:5173', 'http://localhost:8080'].filter(Boolean)).catch(() => {});
  else console.warn('[storage] bucket variables not set: share links are off.');
  serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, (i) => console.log(`[ondevo] listening on :${i.port}`));
}

void main();

for (const sig of ['SIGTERM', 'SIGINT'] as const)
  process.on(sig, async () => {
    await sql?.end({ timeout: 5 }).catch(() => {});
    process.exit(0);
  });

export { app };
