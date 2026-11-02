import type { Pcm } from './pcm';

/** High quality resample using the browser's own resampler (OfflineAudioContext). */
export async function resample(p: Pcm, targetRate: number): Promise<Pcm> {
  if (p.sampleRate === targetRate) return p;
  const len = p.channels[0].length;
  const outLen = Math.max(1, Math.round((len * targetRate) / p.sampleRate));
  const ctx = new OfflineAudioContext(p.channels.length, outLen, targetRate);
  const src = new AudioBuffer({ length: len, numberOfChannels: p.channels.length, sampleRate: p.sampleRate });
  p.channels.forEach((c, i) => src.copyToChannel(c as Float32Array<ArrayBuffer>, i));
  const node = ctx.createBufferSource();
  node.buffer = src;
  node.connect(ctx.destination);
  node.start();
  const out = await ctx.startRendering();
  const channels: Float32Array[] = [];
  for (let c = 0; c < out.numberOfChannels; c++) channels.push(new Float32Array(out.getChannelData(c)));
  return { sampleRate: targetRate, channels };
}
