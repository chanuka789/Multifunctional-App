import type { Pcm } from './pcm';
import { callWorker, type Progress } from '../worker-rpc';

export type AudioFormat = 'wav' | 'mp3' | 'm4a' | 'ogg' | 'opus' | 'flac';

export const FORMATS: { id: AudioFormat; label: string; note: string; mime: string }[] = [
  { id: 'mp3', label: 'MP3', note: 'Plays everywhere', mime: 'audio/mpeg' },
  { id: 'wav', label: 'WAV', note: 'Lossless, large', mime: 'audio/wav' },
  { id: 'm4a', label: 'M4A', note: 'Apple, small', mime: 'audio/mp4' },
  { id: 'ogg', label: 'OGG', note: 'Vorbis, open', mime: 'audio/ogg' },
  { id: 'opus', label: 'Opus', note: 'Best for voice', mime: 'audio/ogg' },
  { id: 'flac', label: 'FLAC', note: 'Lossless, smaller', mime: 'audio/flac' },
];

export function encodeWav(p: Pcm): Blob {
  const nCh = p.channels.length;
  const len = p.channels[0].length;
  const bytes = 44 + len * nCh * 2;
  const buf = new ArrayBuffer(bytes);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, bytes - 8, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nCh, true);
  v.setUint32(24, p.sampleRate, true); v.setUint32(28, p.sampleRate * nCh * 2, true);
  v.setUint16(32, nCh * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, len * nCh * 2, true);
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nCh; c++) {
      const s = Math.max(-1, Math.min(1, p.channels[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

export async function encodeAudio(p: Pcm, format: AudioFormat, opts: { kbps?: number; onProgress?: Progress } = {}): Promise<Blob> {
  if (format === 'wav') return encodeWav(p);
  if (format === 'mp3') {
    const worker = new Worker(new URL('../../workers/mp3.worker.ts', import.meta.url), { type: 'module' });
    try {
      const channels = p.channels.map((c) => new Float32Array(c));
      return await callWorker<Blob>(worker, { channels, sampleRate: p.sampleRate, kbps: opts.kbps ?? 192 }, {
        transfer: channels.map((c) => c.buffer),
        onProgress: opts.onProgress,
      });
    } finally {
      worker.terminate();
    }
  }
  const { transcode } = await import('../ffmpeg');
  const wav = encodeWav(p);
  const kbps = opts.kbps ?? 160;
  const args: Record<Exclude<AudioFormat, 'wav' | 'mp3'>, string[]> = {
    m4a: ['-c:a', 'aac', '-b:a', `${kbps}k`],
    ogg: ['-c:a', 'libvorbis', '-b:a', `${kbps}k`],
    opus: ['-c:a', 'libopus', '-b:a', `${Math.min(kbps, 128)}k`],
    flac: ['-c:a', 'flac'],
  };
  return transcode(wav, format, args[format], opts.onProgress);
}

export function extFor(format: AudioFormat) {
  return format === 'opus' ? 'opus' : format;
}
