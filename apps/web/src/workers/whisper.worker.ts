/// <reference lib="webworker" />
import { serveWorker } from '../lib/worker-rpc';

type Pipe = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string; chunks?: { timestamp: [number, number | null]; text: string }[] }>;
const cache = new Map<string, Promise<Pipe>>();

async function getPipe(model: string, progress: (v: number, l?: string) => void): Promise<Pipe> {
  const key = model;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const { pipeline, env } = await import('@huggingface/transformers');
        env.allowLocalModels = false;
        // Load the ONNX runtime from the public CDN so our own server never serves the 21 MB file.
        if (env.backends?.onnx?.wasm) env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/';
        const gpu = 'gpu' in navigator && !!(await (navigator as any).gpu?.requestAdapter?.().catch(() => null));
        const files = new Map<string, { loaded: number; total: number }>();
        const p = await pipeline('automatic-speech-recognition', model, {
          device: gpu ? 'webgpu' : 'wasm',
          dtype: gpu ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
          progress_callback: (e: any) => {
            if (e.status === 'progress' && e.total) {
              files.set(e.file, { loaded: e.loaded, total: e.total });
              let l = 0, t = 0;
              files.forEach((f) => ((l += f.loaded), (t += f.total)));
              progress(l / t, `Downloading the speech model (${Math.round(t / 1e6)} MB, one time)`);
            }
          },
        } as any);
        return p as unknown as Pipe;
      })(),
    );
  }
  return cache.get(key)!;
}

serveWorker(async (msg, progress) => {
  const pipe = await getPipe(msg.model, progress);
  progress(0, 'Listening');
  const audio: Float32Array = msg.audio;
  const total = audio.length / 16000;
  // Process in 30 s windows ourselves so we can report progress and keep memory low.
  const WIN = 30;
  const chunks: { start: number; end: number; text: string }[] = [];
  for (let s = 0; s < total; s += WIN) {
    const part = audio.subarray(Math.floor(s * 16000), Math.floor(Math.min(total, s + WIN) * 16000));
    const r = await pipe(part, {
      language: msg.language === 'auto' ? undefined : msg.language,
      task: msg.task,
      return_timestamps: true,
    });
    for (const c of r.chunks ?? [{ timestamp: [0, part.length / 16000] as [number, number], text: r.text }]) {
      const a = s + (c.timestamp[0] ?? 0);
      const b = s + (c.timestamp[1] ?? Math.min(WIN, part.length / 16000));
      if (c.text.trim()) chunks.push({ start: a, end: Math.max(a + 0.2, b), text: c.text.trim() });
    }
    progress(Math.min(1, (s + WIN) / total), 'Listening');
  }
  return { result: chunks };
});
