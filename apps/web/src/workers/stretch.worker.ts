/// <reference lib="webworker" />
import { serveWorker } from '../lib/worker-rpc';
// @ts-expect-error - soundtouchjs ships without types
import { SoundTouch, SimpleFilter } from 'soundtouchjs';

/**
 * Time-stretch / pitch-shift with SoundTouch (WSOLA).
 * tempo: 1.25 = 25% faster, pitch: semitones.
 */
serveWorker(async (msg, progress) => {
  const channels: Float32Array[] = msg.channels;
  const tempo: number = msg.tempo ?? 1;
  const semitones: number = msg.semitones ?? 0;
  const left = channels[0];
  const right = channels[1] ?? channels[0];
  const len = left.length;

  const st = new SoundTouch();
  st.tempo = tempo;
  st.pitchSemitones = semitones;
  const source = {
    extract(target: Float32Array, numFrames: number, position: number) {
      const n = Math.max(0, Math.min(numFrames, len - position));
      for (let i = 0; i < n; i++) {
        target[i * 2] = left[position + i];
        target[i * 2 + 1] = right[position + i];
      }
      return n;
    },
  };
  const filter = new SimpleFilter(source, st);
  const expected = Math.ceil(len / tempo) + 8192;
  const outL = new Float32Array(expected);
  const outR = new Float32Array(expected);
  const BLOCK = 8192;
  const tmp = new Float32Array(BLOCK * 2);
  let written = 0;
  let iter = 0;
  for (;;) {
    const got = filter.extract(tmp, BLOCK);
    if (got === 0) break;
    const n = Math.min(got, expected - written);
    for (let i = 0; i < n; i++) {
      outL[written + i] = tmp[i * 2];
      outR[written + i] = tmp[i * 2 + 1];
    }
    written += n;
    if (written >= expected) break;
    if (++iter % 20 === 0) progress(Math.min(0.99, filter.sourcePosition / len));
  }
  const res = channels.length > 1 ? [outL.slice(0, written), outR.slice(0, written)] : [outL.slice(0, written)];
  return { result: res, transfer: res.map((c) => c.buffer) };
});
