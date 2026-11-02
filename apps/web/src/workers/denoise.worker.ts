/// <reference lib="webworker" />
import { serveWorker } from '../lib/worker-rpc';

const CDN = 'https://cdn.jsdelivr.net/npm/@shiguredo/rnnoise-wasm@2025.1.5/dist/rnnoise.js';

type RnnoiseMod = typeof import('@shiguredo/rnnoise-wasm');
let mod: Promise<RnnoiseMod> | null = null;
function load(): Promise<RnnoiseMod> {
  // Prefer the public CDN (keeps our own server's bandwidth near zero); fall back to the bundled copy.
  mod ??= import(/* @vite-ignore */ CDN).catch(() => import('@shiguredo/rnnoise-wasm')) as Promise<RnnoiseMod>;
  return mod;
}

/**
 * RNNoise at 48 kHz. `strength` 0..1 mixes the denoised signal with the original
 * (1 = fully denoised). Input channels must already be 48 kHz.
 */
serveWorker(async (msg, progress) => {
  const { Rnnoise } = await load();
  const rn = await Rnnoise.load();
  const channels: Float32Array[] = msg.channels;
  const strength: number = msg.strength ?? 1;
  const frame = rn.frameSize; // 480
  const total = channels.length * channels[0].length;
  let done = 0;
  const out: Float32Array[] = [];
  for (const ch of channels) {
    const state = rn.createDenoiseState();
    const res = new Float32Array(ch.length);
    const buf = new Float32Array(frame);
    for (let s = 0; s < ch.length; s += frame) {
      buf.fill(0);
      const n = Math.min(frame, ch.length - s);
      for (let i = 0; i < n; i++) buf[i] = ch[s + i] * 32768;
      state.processFrame(buf);
      for (let i = 0; i < n; i++) {
        const wet = buf[i] / 32768;
        res[s + i] = strength >= 1 ? wet : wet * strength + ch[s + i] * (1 - strength);
      }
      done += n;
      if ((s / frame) % 400 === 0) progress(done / total);
    }
    state.destroy();
    out.push(res);
  }
  return { result: out, transfer: out.map((c) => c.buffer) };
});
