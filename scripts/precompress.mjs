// Write .br and .gz next to text assets so the server sends compressed files without spending CPU.
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const root = process.argv[2] ?? 'apps/web/dist';
const exts = /\.(js|mjs|css|html|svg|json|webmanifest|wasm|txt)$/;
let n = 0;
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (exts.test(e.name) && (await stat(p)).size > 1024) {
      const buf = await readFile(p);
      await writeFile(p + '.br', brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 10 } }));
      await writeFile(p + '.gz', gzipSync(buf, { level: 9 }));
      n++;
    }
  }
}
await walk(root);
console.log(`precompressed ${n} files in ${root}`);
