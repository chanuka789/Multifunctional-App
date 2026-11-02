import type { FFmpeg } from '@ffmpeg/ffmpeg';
import type { Progress } from './worker-rpc';

const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
let instance: Promise<FFmpeg> | null = null;

/** Load ffmpeg.wasm once (~31 MB from the public CDN, then cached by the service worker). */
export function loadFfmpeg(onProgress?: Progress): Promise<FFmpeg> {
  instance ??= (async () => {
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')]);
    const ff = new FFmpeg();
    onProgress?.(0, 'Downloading the converter (one time, about 31 MB)');
    await ff.load({
      coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    return ff;
  })();
  instance.catch(() => (instance = null));
  return instance;
}

let seq = 0;
/** Run ffmpeg on one input, return the output file as a Blob. */
export async function transcode(input: Blob, outExt: string, args: string[], onProgress?: Progress, preArgs: string[] = []): Promise<Blob> {
  const ff = await loadFfmpeg(onProgress);
  const id = ++seq;
  const inName = `in${id}${guessExt(input)}`;
  const outName = `out${id}.${outExt}`;
  const handler = ({ progress }: { progress: number }) => onProgress?.(Math.max(0, Math.min(1, progress)), 'Converting');
  ff.on('progress', handler);
  try {
    await ff.writeFile(inName, new Uint8Array(await input.arrayBuffer()));
    const code = await ff.exec([...preArgs, '-i', inName, ...args, '-y', outName]);
    if (code !== 0) throw new Error('The converter could not read this file.');
    const data = (await ff.readFile(outName)) as Uint8Array;
    return new Blob([data as BlobPart], { type: mimeFor(outExt) });
  } finally {
    ff.off('progress', handler);
    await ff.deleteFile(inName).catch(() => {});
    await ff.deleteFile(outName).catch(() => {});
  }
}

function guessExt(b: Blob) {
  const name = (b as File).name;
  if (name && name.includes('.')) return name.slice(name.lastIndexOf('.'));
  const t = b.type;
  if (t.includes('wav')) return '.wav';
  if (t.includes('mpeg')) return '.mp3';
  if (t.includes('mp4')) return '.mp4';
  if (t.includes('webm')) return '.webm';
  return '.bin';
}

export function mimeFor(ext: string) {
  return (
    {
      mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', opus: 'audio/ogg',
      flac: 'audio/flac', mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf',
    } as Record<string, string>
  )[ext] ?? 'application/octet-stream';
}
