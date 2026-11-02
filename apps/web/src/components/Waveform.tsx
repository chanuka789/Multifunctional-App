import { useEffect, useRef } from 'react';

/**
 * Canvas waveform from precomputed peaks. Click or arrow keys to seek.
 * `progress` 0..1 draws the played part in ink and the rest in the soft tone.
 */
export function Waveform(props: {
  peaks: Float32Array;
  progress?: number;
  height?: number;
  onSeek?: (fraction: number) => void;
  label: string;
  tone?: 'ink' | 'accent';
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const h = props.height ?? 96;
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      c.width = Math.max(1, Math.floor(w * dpr));
      c.height = Math.floor(h * dpr);
      const g = c.getContext('2d')!;
      g.scale(dpr, dpr);
      const css = getComputedStyle(c);
      const played = props.tone === 'accent' ? css.getPropertyValue('--data-2') : css.getPropertyValue('--data-1');
      const rest = css.getPropertyValue('--data-soft');
      const bar = 3, gap = 2;
      const n = Math.max(1, Math.floor(w / (bar + gap)));
      const p = props.peaks;
      let max = 0;
      for (let i = 0; i < p.length; i++) max = Math.max(max, p[i]);
      max = max || 1;
      const mid = h / 2;
      for (let i = 0; i < n; i++) {
        const a = Math.floor((i / n) * p.length), b = Math.max(a + 1, Math.floor(((i + 1) / n) * p.length));
        let m = 0;
        for (let j = a; j < b; j++) m = Math.max(m, p[j] ?? 0);
        const bh = Math.max(2, (m / max) * (h - 8));
        g.fillStyle = (i + 0.5) / n <= (props.progress ?? 0) ? played : rest;
        g.beginPath();
        g.roundRect(i * (bar + gap), mid - bh / 2, bar, bh, 1.5);
        g.fill();
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [props.peaks, props.progress, h, props.tone]);

  return (
    <canvas
      ref={canvas}
      className="waveform"
      style={{ height: h }}
      role="slider"
      tabIndex={props.onSeek ? 0 : -1}
      aria-label={props.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((props.progress ?? 0) * 100)}
      onClick={(e) => {
        if (!props.onSeek) return;
        const r = e.currentTarget.getBoundingClientRect();
        props.onSeek((e.clientX - r.left) / r.width);
      }}
      onKeyDown={(e) => {
        if (!props.onSeek) return;
        const p = props.progress ?? 0;
        if (e.key === 'ArrowRight') props.onSeek(Math.min(1, p + 0.02));
        if (e.key === 'ArrowLeft') props.onSeek(Math.max(0, p - 0.02));
      }}
    />
  );
}
