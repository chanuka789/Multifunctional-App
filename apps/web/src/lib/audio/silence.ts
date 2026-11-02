import type { Pcm } from './pcm';

export interface SilenceOptions {
  thresholdDb: number; // e.g. -40
  minSilence: number; // seconds of quiet before we cut
  keep: number; // seconds of quiet to keep at each cut
}

/** Find quiet stretches and return a new clip without them, plus the seconds removed. */
export function removeSilence(p: Pcm, o: SilenceOptions): { pcm: Pcm; removed: number; cuts: number } {
  const sr = p.sampleRate;
  const win = Math.max(1, Math.round(0.01 * sr)); // 10 ms windows
  const len = p.channels[0].length;
  const n = Math.ceil(len / win);
  const thr = 10 ** (o.thresholdDb / 20);
  const loud = new Uint8Array(n);
  for (let w = 0; w < n; w++) {
    // RMS over 30 ms around this window: steady hiss stays low, speech rises well above it
    const s = Math.max(0, (w - 1) * win), e = Math.min(len, (w + 2) * win);
    let sum = 0;
    for (const ch of p.channels) for (let i = s; i < e; i++) sum += ch[i] * ch[i];
    const rms = Math.sqrt(sum / Math.max(1, (e - s) * p.channels.length));
    loud[w] = rms >= thr ? 1 : 0;
  }
  const minW = Math.round(o.minSilence / 0.01);
  const keepW = Math.round(o.keep / 0.01);
  const keepMask = new Uint8Array(n).fill(1);
  let cuts = 0;
  for (let w = 0; w < n; ) {
    if (loud[w]) { w++; continue; }
    let e = w;
    while (e < n && !loud[e]) e++;
    if (e - w >= minW) {
      const a = w === 0 ? 0 : w + keepW;
      const b = e === n ? n : e - keepW;
      for (let i = a; i < b; i++) keepMask[i] = 0;
      if (b > a) cuts++;
    }
    w = e;
  }
  let kept = 0;
  for (let w = 0; w < n; w++) if (keepMask[w]) kept += Math.min(win, len - w * win);
  const channels = p.channels.map(() => new Float32Array(kept));
  let pos = 0;
  for (let w = 0; w < n; w++) {
    if (!keepMask[w]) continue;
    const s = w * win, e = Math.min(len, s + win);
    p.channels.forEach((ch, c) => channels[c].set(ch.subarray(s, e), pos));
    pos += e - s;
  }
  return { pcm: { sampleRate: sr, channels }, removed: (len - kept) / sr, cuts };
}

/** Noise floor of a clip: the RMS level that the quietest 15% of 10 ms windows stay under (dBFS). */
export function noiseFloorDb(p: Pcm): number {
  const sr = p.sampleRate, win = Math.max(1, Math.round(0.01 * sr));
  const len = p.channels[0].length;
  const levels: number[] = [];
  for (let s = 0; s < len; s += win) {
    let sum = 0;
    const e = Math.min(len, s + win);
    for (const ch of p.channels) for (let i = s; i < e; i++) sum += ch[i] * ch[i];
    levels.push(Math.sqrt(sum / Math.max(1, (e - s) * p.channels.length)));
  }
  levels.sort((a, b) => a - b);
  const v = levels[Math.floor(levels.length * 0.15)] ?? 0;
  return 20 * Math.log10(v + 1e-6);
}
