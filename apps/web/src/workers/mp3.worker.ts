/// <reference lib="webworker" />
import { serveWorker } from '../lib/worker-rpc';
import { Mp3Encoder } from '@breezystack/lamejs';

serveWorker(async (msg, progress) => {
  const channels: Float32Array[] = msg.channels;
  const sampleRate: number = msg.sampleRate;
  const kbps: number = msg.kbps ?? 192;
  const nCh = Math.min(2, channels.length);
  const enc = new Mp3Encoder(nCh, sampleRate, kbps);
  const toInt16 = (f: Float32Array) => {
    const o = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) {
      const s = Math.max(-1, Math.min(1, f[i]));
      o[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return o;
  };
  const L = toInt16(channels[0]);
  const R = nCh > 1 ? toInt16(channels[1]) : undefined;
  const parts: Uint8Array[] = [];
  const BLOCK = 1152 * 20;
  for (let i = 0; i < L.length; i += BLOCK) {
    const l = L.subarray(i, i + BLOCK);
    const chunk = R ? enc.encodeBuffer(l, R.subarray(i, i + BLOCK)) : enc.encodeBuffer(l);
    if (chunk.length) parts.push(new Uint8Array(chunk));
    if ((i / BLOCK) % 50 === 0) progress(i / L.length);
  }
  const end = enc.flush();
  if (end.length) parts.push(new Uint8Array(end));
  const blob = new Blob(parts as BlobPart[], { type: 'audio/mpeg' });
  return { result: blob };
});
