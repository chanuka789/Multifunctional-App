import { useEffect, useState } from 'react';

export function remaining(to: string | number) {
  return Math.max(0, new Date(to).getTime() - Date.now());
}

export function formatRemaining(ms: number) {
  if (ms <= 0) return 'now';
  const m = Math.ceil(ms / 60000);
  if (m >= 60) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
  if (m > 1) return `${m} min`;
  return `${Math.ceil(ms / 1000)} s`;
}

export function Countdown({ to, onEnd }: { to: string; onEnd?: () => void }) {
  const [ms, setMs] = useState(() => remaining(to));
  useEffect(() => {
    const t = setInterval(() => {
      const r = remaining(to);
      setMs(r);
      if (r <= 0) {
        clearInterval(t);
        onEnd?.();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [to, onEnd]);
  return <time dateTime={to}>{formatRemaining(ms)}</time>;
}
