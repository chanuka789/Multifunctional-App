import { useCallback, useRef, useState } from 'react';

export type JobState<T> =
  | { status: 'idle' }
  | { status: 'running'; progress: number | null; label: string }
  | { status: 'done'; result: T; ms: number }
  | { status: 'error'; message: string };

export type JobCtx = { progress: (v: number | null, label?: string) => void; signal: AbortSignal };

/** Runs one heavy job at a time with progress, timing, cancel and friendly errors. */
export function useJob<T>() {
  const [state, setState] = useState<JobState<T>>({ status: 'idle' });
  const ctrl = useRef<AbortController | null>(null);
  const labelRef = useRef('Working');

  const run = useCallback(async (fn: (ctx: JobCtx) => Promise<T>, firstLabel = 'Working') => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    labelRef.current = firstLabel;
    const t0 = performance.now();
    setState({ status: 'running', progress: null, label: firstLabel });
    let last = 0;
    const progress = (v: number | null, label?: string) => {
      if (c.signal.aborted) return;
      if (label) labelRef.current = label;
      const now = performance.now();
      if (now - last < 60 && v !== 1) return;
      last = now;
      setState({ status: 'running', progress: v, label: labelRef.current });
    };
    try {
      const result = await fn({ progress, signal: c.signal });
      if (c.signal.aborted) return;
      setState({ status: 'done', result, ms: performance.now() - t0 });
      return result;
    } catch (e) {
      if (c.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
        setState({ status: 'idle' });
        return;
      }
      console.error(e);
      setState({ status: 'error', message: friendly(e) });
    }
  }, []);

  const cancel = useCallback(() => {
    ctrl.current?.abort();
    setState({ status: 'idle' });
  }, []);
  const reset = useCallback(() => setState({ status: 'idle' }), []);
  return { state, run, cancel, reset };
}

function friendly(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (/memory|allocation|out of bounds/i.test(m)) return 'Your device ran out of memory for this file. Try a shorter file or close other tabs.';
  if (/decode|EncodingError|unable to decode/i.test(m)) return 'This file could not be read. It may be damaged or in a format we do not support.';
  if (/fetch|network|Failed to load/i.test(m)) return 'A one-time download failed. Check your connection and try again.';
  return m || 'Something went wrong.';
}
