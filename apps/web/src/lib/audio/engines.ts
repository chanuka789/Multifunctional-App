import { callWorker, type Progress } from '../worker-rpc';
import { resample } from './resample';
import type { Pcm } from './pcm';

/** RNNoise needs 48 kHz; we resample in and back out so the result matches the source. */
export async function denoise(p: Pcm, strength: number, onProgress?: Progress, signal?: AbortSignal): Promise<Pcm> {
  const at48 = await resample(p, 48000);
  const worker = new Worker(new URL('../../workers/denoise.worker.ts', import.meta.url), { type: 'module' });
  try {
    const channels = at48.channels.map((c) => new Float32Array(c));
    const out = await callWorker<Float32Array[]>(worker, { channels, strength }, { transfer: channels.map((c) => c.buffer), onProgress, signal });
    return { sampleRate: 48000, channels: out };
  } finally {
    worker.terminate();
  }
}

export async function stretch(p: Pcm, opts: { tempo?: number; semitones?: number }, onProgress?: Progress, signal?: AbortSignal): Promise<Pcm> {
  const worker = new Worker(new URL('../../workers/stretch.worker.ts', import.meta.url), { type: 'module' });
  try {
    const channels = p.channels.map((c) => new Float32Array(c));
    const out = await callWorker<Float32Array[]>(worker, { channels, tempo: opts.tempo ?? 1, semitones: opts.semitones ?? 0 }, {
      transfer: channels.map((c) => c.buffer),
      onProgress,
      signal,
    });
    return { sampleRate: p.sampleRate, channels: out };
  } finally {
    worker.terminate();
  }
}

/** Speed change without keeping pitch (tape style): just play the samples at another rate. */
export async function varispeed(p: Pcm, rate: number): Promise<Pcm> {
  const len = Math.floor(p.channels[0].length / rate);
  const ctx = new OfflineAudioContext(p.channels.length, Math.max(1, len), p.sampleRate);
  const buf = new AudioBuffer({ length: p.channels[0].length, numberOfChannels: p.channels.length, sampleRate: p.sampleRate });
  p.channels.forEach((c, i) => buf.copyToChannel(c as Float32Array<ArrayBuffer>, i));
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  src.connect(ctx.destination);
  src.start();
  const out = await ctx.startRendering();
  return { sampleRate: p.sampleRate, channels: Array.from({ length: out.numberOfChannels }, (_, i) => new Float32Array(out.getChannelData(i))) };
}
