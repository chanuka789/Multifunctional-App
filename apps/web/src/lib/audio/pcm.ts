/** Plain PCM container that can cross into workers (AudioBuffer cannot). */
export interface Pcm {
  sampleRate: number;
  channels: Float32Array[];
}

export const pcmLength = (p: Pcm) => p.channels[0]?.length ?? 0;
export const pcmDuration = (p: Pcm) => pcmLength(p) / p.sampleRate;

export function fromAudioBuffer(buf: AudioBuffer): Pcm {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buf.numberOfChannels; c++) channels.push(new Float32Array(buf.getChannelData(c)));
  return { sampleRate: buf.sampleRate, channels };
}

export function toAudioBuffer(p: Pcm): AudioBuffer {
  const buf = new AudioBuffer({ length: Math.max(1, pcmLength(p)), numberOfChannels: p.channels.length, sampleRate: p.sampleRate });
  p.channels.forEach((ch, i) => buf.copyToChannel(ch as Float32Array<ArrayBuffer>, i));
  return buf;
}

export function transferList(p: Pcm): Transferable[] {
  return p.channels.map((c) => c.buffer as ArrayBuffer);
}

export function clonePcm(p: Pcm): Pcm {
  return { sampleRate: p.sampleRate, channels: p.channels.map((c) => new Float32Array(c)) };
}

export function slicePcm(p: Pcm, startSec: number, endSec: number): Pcm {
  const a = Math.max(0, Math.floor(startSec * p.sampleRate));
  const b = Math.min(pcmLength(p), Math.floor(endSec * p.sampleRate));
  return { sampleRate: p.sampleRate, channels: p.channels.map((c) => c.slice(a, Math.max(a, b))) };
}

/** Peak (max abs) per bucket, for drawing a waveform. Mixes channels. */
export function peaks(p: Pcm, buckets: number): Float32Array {
  const len = pcmLength(p);
  const out = new Float32Array(buckets);
  if (!len) return out;
  const step = len / buckets;
  for (let b = 0; b < buckets; b++) {
    const s = Math.floor(b * step);
    const e = Math.min(len, Math.floor((b + 1) * step));
    let m = 0;
    for (const ch of p.channels) {
      for (let i = s; i < e; i += 4) {
        const v = Math.abs(ch[i]);
        if (v > m) m = v;
      }
    }
    out[b] = m;
  }
  return out;
}

export function peakLevel(p: Pcm) {
  let m = 0;
  for (const ch of p.channels) for (let i = 0; i < ch.length; i++) {
    const v = Math.abs(ch[i]);
    if (v > m) m = v;
  }
  return m;
}

export function gainPcm(p: Pcm, gain: number) {
  for (const ch of p.channels) for (let i = 0; i < ch.length; i++) ch[i] *= gain;
}

/** Soft limiter that keeps peaks under `ceiling` (linear). */
export function limitPcm(p: Pcm, ceiling = 0.97) {
  const knee = ceiling * 0.8;
  for (const ch of p.channels) {
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i];
      const a = Math.abs(v);
      if (a > knee) {
        const over = (a - knee) / (ceiling - knee);
        ch[i] = Math.sign(v) * (knee + (ceiling - knee) * Math.tanh(over));
      }
    }
  }
}

export function fade(p: Pcm, inSec: number, outSec: number) {
  const len = pcmLength(p);
  const fi = Math.min(len, Math.floor(inSec * p.sampleRate));
  const fo = Math.min(len, Math.floor(outSec * p.sampleRate));
  for (const ch of p.channels) {
    for (let i = 0; i < fi; i++) ch[i] *= Math.sin(((i / fi) * Math.PI) / 2) ** 2;
    for (let i = 0; i < fo; i++) ch[len - 1 - i] *= Math.sin(((i / fo) * Math.PI) / 2) ** 2;
  }
}

/** Join clips with an equal-power crossfade (seconds). All clips must share sample rate. */
export function concatPcm(clips: Pcm[], crossfadeSec = 0): Pcm {
  const sr = clips[0].sampleRate;
  const nCh = Math.max(...clips.map((c) => c.channels.length));
  const xf = Math.floor(crossfadeSec * sr);
  let total = 0;
  clips.forEach((c, i) => (total += pcmLength(c) - (i > 0 ? Math.min(xf, pcmLength(c), pcmLength(clips[i - 1])) : 0)));
  const out = Array.from({ length: nCh }, () => new Float32Array(total));
  let pos = 0;
  clips.forEach((clip, idx) => {
    const len = pcmLength(clip);
    const overlap = idx > 0 ? Math.min(xf, len, pcmLength(clips[idx - 1])) : 0;
    const start = pos - overlap;
    for (let c = 0; c < nCh; c++) {
      const src = clip.channels[Math.min(c, clip.channels.length - 1)];
      const dst = out[c];
      for (let i = 0; i < len; i++) {
        if (i < overlap) {
          const t = i / overlap;
          dst[start + i] = dst[start + i] * Math.cos((t * Math.PI) / 2) + src[i] * Math.sin((t * Math.PI) / 2);
        } else dst[start + i] = src[i];
      }
    }
    pos = start + len;
  });
  return { sampleRate: sr, channels: out };
}

export function toMono(p: Pcm): Pcm {
  if (p.channels.length === 1) return p;
  const len = pcmLength(p);
  const m = new Float32Array(len);
  for (const ch of p.channels) for (let i = 0; i < len; i++) m[i] += ch[i] / p.channels.length;
  return { sampleRate: p.sampleRate, channels: [m] };
}
