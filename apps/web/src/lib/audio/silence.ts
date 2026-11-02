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
    let m = 0;
    const s = w * win, e = Math.min(len, s + win);
    for (const ch of p.channels) for (let i = s; i < e; i++) { const v = Math.abs(ch[i]); if (v > m) m = v; }
    loud[w] = m >= thr ? 1 : 0;
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
