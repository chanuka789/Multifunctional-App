import type { JobState } from '@/hooks/useJob';

export function JobStatus<T>({ state, onCancel, onRetry }: { state: JobState<T>; onCancel?: () => void; onRetry?: () => void }) {
  if (state.status === 'running') {
    const pct = state.progress == null ? null : Math.round(state.progress * 100);
    return (
      <div className="job" role="status" aria-live="polite">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-semibold">{state.label}</span>
          <span className="readout">{pct == null ? '' : `${pct}%`}</span>
        </div>
        <div className="progress" data-indeterminate={pct == null} aria-hidden="true">
          <span style={{ width: `${pct ?? 0}%` }} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="small muted">Running on your device. Keep this tab open.</span>
          {onCancel && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="job job-error" role="alert">
        <span className="font-semibold">That did not work</span>
        <p className="m-0">{state.message}</p>
        {onRetry && (
          <button type="button" className="btn btn-quiet btn-sm self-start" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }
  return null;
}
