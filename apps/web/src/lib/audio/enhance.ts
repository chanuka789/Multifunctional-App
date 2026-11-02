import { toAudioBuffer, fromAudioBuffer, type Pcm, peakLevel, gainPcm, limitPcm } from './pcm';
import { integratedLufs } from './loudness';

export type EnhancePreset = 'light' | 'studio' | 'podcast';

export interface EnhanceOptions {
  preset: EnhancePreset;
  /** Target loudness in LUFS. */
  target: number;
}

const PRESETS: Record<EnhancePreset, { mud: number; presence: number; air: number; deEss: number; ratio: number; threshold: number }> = {
  light: { mud: -1.5, presence: 1.5, air: 1, deEss: -1, ratio: 2, threshold: -20 },
  studio: { mud: -3, presence: 3, air: 2, deEss: -2.5, ratio: 3, threshold: -24 },
  podcast: { mud: -4, presence: 4, air: 2.5, deEss: -3.5, ratio: 4.5, threshold: -28 },
};

/** Voice EQ + compression rendered by the browser's audio engine, then loudness normalised. */
export async function enhanceVoice(p: Pcm, opts: EnhanceOptions): Promise<Pcm> {
  const s = PRESETS[opts.preset];
  const src = toAudioBuffer(p);
  const ctx = new OfflineAudioContext(src.numberOfChannels, src.length, src.sampleRate);
  const node = ctx.createBufferSource();
  node.buffer = src;

  const hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 80, Q: 0.707 });
  const mud = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 300, Q: 1.0, gain: s.mud });
  const presence = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 3500, Q: 0.8, gain: s.presence });
  const deEss = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 7200, Q: 2.5, gain: s.deEss });
  const air = new BiquadFilterNode(ctx, { type: 'highshelf', frequency: 10000, gain: s.air });
  const comp = new DynamicsCompressorNode(ctx, { threshold: s.threshold, ratio: s.ratio, knee: 10, attack: 0.006, release: 0.18 });

  node.connect(hp).connect(mud).connect(presence).connect(deEss).connect(air).connect(comp).connect(ctx.destination);
  node.start();
  const out = fromAudioBuffer(await ctx.startRendering());
  normaliseLoudness(out, opts.target);
  return out;
}

/** Gain to reach `target` LUFS, then soft-limit to -0.3 dBFS. Returns the gain applied in dB. */
export function normaliseLoudness(p: Pcm, target: number, ceilingDb = -1) {
  const now = integratedLufs(p);
  if (!Number.isFinite(now)) return 0;
  const gainDb = target - now;
  gainPcm(p, 10 ** (gainDb / 20));
  const ceiling = 10 ** (ceilingDb / 20);
  if (peakLevel(p) > ceiling) limitPcm(p, ceiling);
  return gainDb;
}
