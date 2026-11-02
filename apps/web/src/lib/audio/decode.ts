import { fromAudioBuffer, type Pcm } from './pcm';

let ctx: AudioContext | null = null;
function audioCtx() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/**
 * Decode any audio (or the audio track of a video) the browser understands.
 * Falls back to ffmpeg.wasm for containers the browser cannot read (e.g. some WMA/AMR/MKV).
 */
export async function decodeFile(file: Blob, onFallback?: () => void): Promise<Pcm> {
  const data = await file.arrayBuffer();
  try {
    const buf = await audioCtx().decodeAudioData(data.slice(0));
    return fromAudioBuffer(buf);
  } catch {
    onFallback?.();
    const { transcode } = await import('../ffmpeg');
    const wav = await transcode(file, 'wav', ['-vn', '-acodec', 'pcm_s16le']);
    const buf = await audioCtx().decodeAudioData(await wav.arrayBuffer());
    return fromAudioBuffer(buf);
  }
}
