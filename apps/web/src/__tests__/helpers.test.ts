import { describe, expect, it } from 'vitest';
import { parseRanges } from '../tools/docs/pages';
import { removeSilence } from '../lib/audio/silence';
import { integratedLufs } from '../lib/audio/loudness';
import { concatPcm } from '../lib/audio/pcm';

describe('page ranges', () => {
  it('parses lists and open ranges', () => {
    expect(parseRanges('1-3, 5', 10)).toEqual([0, 1, 2, 4]);
    expect(parseRanges('8-', 10)).toEqual([7, 8, 9]);
    expect(parseRanges('3-1', 5)).toEqual([2, 1, 0]);
    expect(parseRanges('0', 5)).toBeNull();
    expect(parseRanges('12', 5)).toBeNull();
    expect(parseRanges('abc', 5)).toBeNull();
  });
});

const sr = 48000;
const tone = (secs: number, amp: number, f = 440) => {
  const a = new Float32Array(Math.round(secs * sr));
  for (let i = 0; i < a.length; i++) a[i] = amp * Math.sin((2 * Math.PI * f * i) / sr);
  return a;
};

describe('loudness meter', () => {
  it('reads a full-scale 1 kHz sine near -3 LUFS (mono, BS.1770)', () => {
    const l = integratedLufs({ sampleRate: sr, channels: [tone(3, 1, 1000)] });
    expect(l).toBeGreaterThan(-3.8);
    expect(l).toBeLessThan(-2.2);
  });
  it('drops 20 dB when amplitude drops 10x', () => {
    const a = integratedLufs({ sampleRate: sr, channels: [tone(3, 0.5, 1000)] });
    const b = integratedLufs({ sampleRate: sr, channels: [tone(3, 0.05, 1000)] });
    expect(a - b).toBeCloseTo(20, 0);
  });
});

describe('silence remover', () => {
  it('cuts a long pause but keeps the requested air', () => {
    const ch = new Float32Array([...tone(1, 0.5), ...new Float32Array(3 * sr), ...tone(1, 0.5)]);
    const r = removeSilence({ sampleRate: sr, channels: [ch] }, { thresholdDb: -40, minSilence: 0.5, keep: 0.2 });
    expect(r.cuts).toBe(1);
    expect(r.removed).toBeGreaterThan(2.5);
    expect(r.removed).toBeLessThan(2.7);
  });
});

describe('joiner', () => {
  it('overlaps clips by the crossfade length', () => {
    const out = concatPcm([{ sampleRate: sr, channels: [tone(1, 0.5)] }, { sampleRate: sr, channels: [tone(1, 0.5)] }], 0.25);
    expect(out.channels[0].length).toBe(2 * sr - 0.25 * sr);
  });
});
