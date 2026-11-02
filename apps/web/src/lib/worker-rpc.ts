/**
 * Tiny promise wrapper around a dedicated worker.
 * Worker protocol: receives {id, ...payload}; posts {id, type:'progress', value}
 * then {id, type:'done', result} or {id, type:'error', message}.
 */
export type Progress = (value: number, label?: string) => void;

export function callWorker<T>(
  worker: Worker,
  payload: Record<string, unknown>,
  opts: { transfer?: Transferable[]; onProgress?: Progress; signal?: AbortSignal } = {},
): Promise<T> {
  const id = Math.random().toString(36).slice(2);
  return new Promise<T>((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.id !== id) return;
      if (d.type === 'progress') opts.onProgress?.(d.value, d.label);
      else if (d.type === 'done') {
        cleanup();
        resolve(d.result as T);
      } else if (d.type === 'error') {
        cleanup();
        reject(new Error(d.message));
      }
    };
    const onError = (e: ErrorEvent) => {
      cleanup();
      reject(new Error(e.message || 'Worker crashed'));
    };
    const onAbort = () => {
      cleanup();
      worker.terminate();
      reject(new DOMException('Cancelled', 'AbortError'));
    };
    function cleanup() {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      opts.signal?.removeEventListener('abort', onAbort);
    }
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    worker.postMessage({ id, ...payload }, opts.transfer ?? []);
  });
}

/** Helper used inside workers. */
export function serveWorker(
  handler: (msg: any, progress: (v: number, label?: string) => void) => Promise<{ result: unknown; transfer?: Transferable[] }>,
) {
  const scope = self as unknown as DedicatedWorkerGlobalScope;
  scope.onmessage = async (e: MessageEvent) => {
    const msg = e.data;
    const progress = (value: number, label?: string) => scope.postMessage({ id: msg.id, type: 'progress', value, label });
    try {
      const { result, transfer } = await handler(msg, progress);
      scope.postMessage({ id: msg.id, type: 'done', result }, transfer ?? []);
    } catch (err) {
      scope.postMessage({ id: msg.id, type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };
}
