# Ondevo — audio and document tools that run on your device

Ondevo is a web app with 19 tools for sound and paper. **Every tool runs inside the visitor's browser**, on their own processor. The server only serves the app, handles accounts, and signs share links, so it needs very little RAM and CPU.

- Works without an account. Email + password sign-up is optional.
- Files are never uploaded, except when someone presses **Get a share link**. Shared files are deleted **2 hours** after upload.

## Tools

| Audio | Documents and PDF |
| --- | --- |
| Noise remover and voice enhancer (RNNoise + EQ, de-ess, compression, loudness) | Document OCR: scans, photos, PDFs → Word (DOCX) with the layout rebuilt, searchable PDF, TXT, Markdown, HTML. 100+ languages incl. English, Sinhala, Tamil |
| Speed changer 0.5×–3× (1.1, 1.2, 1.25, 1.3 … quick picks), voice kept natural | Merge PDF |
| Pitch shifter ±12 semitones | Split PDF (ranges like `1-3, 7, 10-`) |
| Trim and fade | Organise PDF pages (rotate, reorder, delete) |
| Silence remover (threshold set from the file's own noise) | Images to PDF (A4, Letter, fit) |
| Loudness normaliser (−9 / −14 / −16 / −23 LUFS) | PDF to images (PNG/JPG, 96–300 dpi) |
| Audio converter (MP3, WAV, M4A, OGG, Opus, FLAC) | Compress PDF |
| Extract audio from video | Image resize and convert (WEBP, JPG, PNG) |
| Audio joiner with crossfade | |
| Voice recorder with noise suppression | |
| Speech to text (Whisper) → TXT, SRT, VTT, 90+ languages | |

### How OCR keeps the layout
1. Tesseract reads the page (English + any languages you choose).
2. Ondevo re-reads what Tesseract skipped (very large titles, bold headers) and reads each ruled table cell separately.
3. The layout engine (`apps/web/src/lib/ocr/layout.ts`) finds reading order and columns (XY-cut by widest whitespace), headings by size, alignment, indents, lists, bold (ink density), colour, tables (ruled lines) and pictures.
4. Exports: **Word** (rebuilt, editable), **searchable PDF** (the original page image with invisible text — looks exactly like the original), TXT, Markdown, HTML. A side-by-side review editor lets people fix uncertain words (marked yellow) before saving.

Limits, honestly: handwriting, unusual decorative fonts, tables without ruled lines, and merged table cells across rows may need manual fixes in the review editor.

## Architecture

```
apps/web     Vite + React 19 + TypeScript + Tailwind 4   → static files
apps/server  Node + Hono (≈60–90 MB RAM)                 → /api/auth, /api/shares, cleanup job, static hosting
```

- Heavy engines load **from public CDNs on first use** and are cached by the browser (service worker): RNNoise (jsDelivr), ffmpeg.wasm core (~31 MB, jsDelivr), Tesseract language data (jsDelivr), Whisper models (Hugging Face) and the ONNX runtime (jsDelivr). Your Railway service does not serve them.
- Share uploads go **straight from the browser to the bucket** with a pre-signed URL (size and type are part of the signature). The server never touches the file bytes.
- **2-hour deletion:** each share row has `expires_at = upload + 2 h`. The download endpoint refuses expired links immediately, and a cleanup job (every 5 minutes) deletes expired objects from the bucket and their rows, then sweeps any orphan objects older than 2 hours. Railway buckets do not support lifecycle rules yet, so this is done in the app.
- Security: Argon2id passwords, http-only SameSite session cookie, same-origin + header check on writes (CSRF), per-IP rate limits, CSP, COOP/COEP (for multi-threaded WASM), files from risky types (HTML, SVG, JS) are stored as plain downloads.

## Run locally

Requirements: Node 22, and optionally PostgreSQL and any S3-compatible storage for accounts/sharing.

```bash
npm ci
```

```bash
npm run build
```

```bash
cp .env.example .env   # fill in DATABASE_URL and bucket values, or leave them empty
```

```bash
set -a; . ./.env; set +a; npm start   # http://localhost:8080
```

For front-end work with hot reload, run `npm run dev` (Vite on :5173, proxies `/api` to :8080) next to `npm run dev:server`.

Tests: `npm test` (layout engine, page ranges, loudness meter, silence remover, joiner).

## Deploy on Railway

1. **New project → Deploy from GitHub repo** → pick this repository and branch. `railway.json` sets the build (`npm ci && npm run build`), start command, and the `/healthz` health check.
2. **Add PostgreSQL** to the project (+ New → Database → PostgreSQL). In the app service's **Variables**, add `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`.
3. **Add a Bucket** (+ New → Bucket). In the app service's Variables, add references to the bucket's variables:
   `BUCKET=${{Bucket.BUCKET}}`, `ENDPOINT=${{Bucket.ENDPOINT}}`, `REGION=${{Bucket.REGION}}`, `ACCESS_KEY_ID=${{Bucket.ACCESS_KEY_ID}}`, `SECRET_ACCESS_KEY=${{Bucket.SECRET_ACCESS_KEY}}` (use your bucket service's real name).
4. Add `NODE_ENV=production` and a random `IP_SALT`.
5. **Settings → Networking → Generate domain.** The app reads `RAILWAY_PUBLIC_DOMAIN` automatically; set `PUBLIC_ORIGIN` only if you add a custom domain.
6. Deploy. On start the server creates its tables and tries to set the bucket's CORS rule for your domain. If the log says it could not, set it once with the AWS CLI:

```bash
aws s3api put-bucket-cors --bucket YOUR_BUCKET --endpoint-url https://t3.storageapi.dev --cors-configuration '{"CORSRules":[{"AllowedOrigins":["https://YOUR-DOMAIN"],"AllowedMethods":["PUT","GET","HEAD"],"AllowedHeaders":["*"],"MaxAgeSeconds":3600}]}'
```

Without the database or bucket variables, the site still works fully; only accounts and share links are switched off.

### Keeping Railway usage low
- One small Node process; no file processing on the server.
- Static files are pre-compressed (Brotli/gzip) at build time and cached for a year.
- Engines and models come from public CDNs; downloads of shared files come straight from the bucket (bucket egress is free on Railway; service egress is not).

## Not included yet
- Password reset by email (needs an email service such as Resend — add an API key and it can be wired in).
- Payments or usage plans.

## Credits
RNNoise (BSD), SoundTouch (LGPL, via soundtouchjs), Tesseract (Apache-2.0, via tesseract.js), Whisper (MIT, via Transformers.js), pdf.js (Apache-2.0), pdf-lib (MIT), ffmpeg.wasm (MIT; ffmpeg core LGPL/GPL), lamejs (LGPL), docx (MIT), Archivo typeface (OFL). Design direction drafted with the taste-skill (Leonxlnx/taste-skill).
