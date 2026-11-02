import type { Pcm } from './pcm';

/** Biquad coefficients for the ITU-R BS.1770 K-weighting at any sample rate. */
function kWeighting(fs: number) {
  const shelf = (() => {
    const G = 3.99984385397, Q = 0.7071752369554193, fc = 1681.9744509555319;
    const A = 10 ** (G / 40), w0 = (2 * Math.PI * fc) / fs, alpha = Math.sin(w0) / (2 * Q), cw = Math.cos(w0), sA = Math.sqrt(A);
    const a0 = A + 1 - (A - 1) * cw + 2 * sA * alpha;
    return {
      b: [A * (A + 1 + (A - 1) * cw + 2 * sA * alpha) / a0, (-2 * A * (A - 1 + (A + 1) * cw)) / a0, (A * (A + 1 + (A - 1) * cw - 2 * sA * alpha)) / a0],
      a: [(2 * (A - 1 - (A + 1) * cw)) / a0, (A + 1 - (A - 1) * cw - 2 * sA * alpha) / a0],
    };
  })();
  const hp = (() => {
    const Q = 0.5003270373253953, fc = 38.13547087613982;
    const w0 = (2 * Math.PI * fc) / fs, alpha = Math.sin(w0) / (2 * Q), cw = Math.cos(w0);
    const a0 = 1 + alpha;
    return { b: [(1 + cw) / 2 / a0, -(1 + cw) / a0, (1 + cw) / 2 / a0], a: [(-2 * cw) / a0, (1 - alpha) / a0] };
  })();
  return [shelf, hp];
}

function filter(x: Float32Array, f: { b: number[]; a: number[] }) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const [b0, b1, b2] = f.b, [a1, a2] = f.a;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/** Integrated loudness in LUFS (gated, BS.1770-4). Returns -Infinity for silence. */
export function integratedLufs(p: Pcm): number {
  const fs = p.sampleRate;
  const [shelf, hp] = kWeighting(fs);
  const weighted = p.channels.slice(0, 2).map((c) => filter(filter(c, shelf), hp));
  const block = Math.round(0.4 * fs), hop = Math.round(0.1 * fs);
  const len = weighted[0].length;
  const z: number[] = [];
  for (let s = 0; s + block <= len; s += hop) {
    let sum = 0;
    for (const ch of weighted) {
      let e = 0;
      for (let i = s; i < s + block; i++) e += ch[i] * ch[i];
      sum += e / block;
    }
    z.push(sum);
  }
  if (!z.length) {
    // Shorter than one block: ungated mean square.
    let sum = 0;
    for (const ch of weighted) { let e = 0; for (const v of ch) e += v * v; sum += e / Math.max(1, ch.length); }
    return sum > 0 ? -0.691 + 10 * Math.log10(sum) : -Infinity;
  }
  const lk = (v: number) => -0.691 + 10 * Math.log10(v);
  const abs = z.filter((v) => lk(v) > -70);
  if (!abs.length) return -Infinity;
  const relGate = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const rel = abs.filter((v) => lk(v) > relGate);
  if (!rel.length) return -Infinity;
  return lk(rel.reduce((a, b) => a + b, 0) / rel.length);
}

export function rmsDb(x: Float32Array) {
  let e = 0;
  for (let i = 0; i < x.length; i++) e += x[i] * x[i];
  return 10 * Math.log10(e / Math.max(1, x.length) + 1e-12);
}
