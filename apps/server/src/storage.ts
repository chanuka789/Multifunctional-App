import { AwsClient } from 'aws4fetch';
import { config, storageReady } from './config.ts';

let client: AwsClient | null = null;
function aws() {
  client ??= new AwsClient({ accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey, region: config.s3.region, service: 's3' });
  return client;
}

function objectUrl(key = '') {
  const ep = new URL(config.s3.endpoint);
  const path = key ? '/' + key.split('/').map(encodeURIComponent).join('/') : '/';
  if (config.s3.pathStyle) return `${ep.origin}/${config.s3.bucket}${path}`;
  return `${ep.protocol}//${config.s3.bucket}.${ep.host}${path}`;
}

/** Pre-signed PUT: the browser uploads straight to the bucket. Length and type are part of the signature. */
export async function presignPut(key: string, contentType: string, size: number, expiresSec = 900) {
  const url = new URL(objectUrl(key));
  url.searchParams.set('X-Amz-Expires', String(expiresSec));
  const signed = await aws().sign(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Content-Length': String(size) },
    aws: { signQuery: true, allHeaders: true },
  });
  // Browsers set Content-Length themselves; only Content-Type must be sent explicitly.
  return { url: signed.url, headers: { 'Content-Type': contentType } };
}

export async function presignGet(key: string, filename: string, expiresSec: number) {
  const url = new URL(objectUrl(key));
  url.searchParams.set('X-Amz-Expires', String(Math.max(60, Math.min(expiresSec, 7200))));
  url.searchParams.set('response-content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  const signed = await aws().sign(url.toString(), { method: 'GET', aws: { signQuery: true } });
  return signed.url;
}

export async function headObject(key: string): Promise<{ size: number } | null> {
  const r = await aws().fetch(objectUrl(key), { method: 'HEAD' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HEAD ${r.status}`);
  return { size: Number(r.headers.get('content-length') ?? 0) };
}

export async function deleteObject(key: string) {
  const r = await aws().fetch(objectUrl(key), { method: 'DELETE' });
  if (!r.ok && r.status !== 404) throw new Error(`DELETE ${r.status}`);
}

/** List keys under a prefix (used to sweep orphans). */
export async function listKeys(prefix: string): Promise<{ key: string; lastModified: Date }[]> {
  const out: { key: string; lastModified: Date }[] = [];
  let token = '';
  for (let page = 0; page < 50; page++) {
    const u = new URL(objectUrl());
    u.searchParams.set('list-type', '2');
    u.searchParams.set('prefix', prefix);
    if (token) u.searchParams.set('continuation-token', token);
    const r = await aws().fetch(u.toString());
    if (!r.ok) throw new Error(`LIST ${r.status}`);
    const xml = await r.text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = m[1].match(/<Key>([\s\S]*?)<\/Key>/)?.[1];
      const lm = m[1].match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1];
      if (key) out.push({ key: decodeXml(key), lastModified: new Date(lm ?? 0) });
    }
    token = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? '';
    if (!/<IsTruncated>true<\/IsTruncated>/.test(xml) || !token) break;
  }
  return out;
}

const decodeXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Allow browser uploads from our own origin (best effort; can also be set with the AWS CLI). */
export async function ensureCors(origins: string[]) {
  if (!storageReady() || !origins.length) return;
  const body = `<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration>${`<CORSRule>${origins.map((o) => `<AllowedOrigin>${o}</AllowedOrigin>`).join('')}<AllowedMethod>PUT</AllowedMethod><AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule>`}</CORSConfiguration>`;
  const u = new URL(objectUrl());
  u.searchParams.set('cors', '');
  const md5 = await import('node:crypto').then((c) => c.createHash('md5').update(body).digest('base64'));
  const r = await aws().fetch(u.toString().replace('cors=', 'cors'), { method: 'PUT', body, headers: { 'Content-Type': 'application/xml', 'Content-MD5': md5 } });
  if (!r.ok) console.warn(`[storage] could not set bucket CORS (${r.status}). Set it once with the AWS CLI; see README.`);
  else console.log(`[storage] bucket CORS allows ${origins.join(', ')}`);
}

export { storageReady };
