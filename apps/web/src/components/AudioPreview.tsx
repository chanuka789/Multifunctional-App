import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Waveform } from './Waveform';
import { formatTime } from '@/lib/util';

export interface Take {
  label: string;
  url: string;
  peaks: Float32Array;
  duration: number;
}

/**
 * Plays one or two takes (Before / After) on one shared timeline so people can A/B instantly.
 */
export function AudioPreview({ takes, initial = takes.length - 1 }: { takes: Take[]; initial?: number }) {
  const [active, setActive] = useState(Math.min(initial, takes.length - 1));
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const take = takes[Math.min(active, takes.length - 1)];

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const t = a.currentTime / (a.duration || 1);
    const wasPlaying = !a.paused;
    a.src = take.url;
    a.onloadedmetadata = () => {
      a.currentTime = Math.min(t * a.duration, a.duration - 0.05) || 0;
      if (wasPlaying) void a.play();
    };
  }, [take.url]);

  useEffect(() => {
    const a = audio.current!;
    let raf = 0;
    const tick = () => {
      setPos(a.currentTime / (a.duration || take.duration || 1));
      raf = requestAnimationFrame(tick);
    };
    const onPlay = () => {
      setPlaying(true);
      raf = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setPlaying(false);
      cancelAnimationFrame(raf);
      setPos(a.currentTime / (a.duration || 1));
    };
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onPause);
    return () => {
      cancelAnimationFrame(raf);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onPause);
    };
  }, [take.duration]);

  const toggle = () => {
    const a = audio.current!;
    if (a.paused) void a.play();
    else a.pause();
  };

  const timeNow = useMemo(() => formatTime(pos * take.duration), [pos, take.duration]);

  return (
    <div className="player" data-ui>
      <audio ref={audio} preload="metadata" src={take.url} />
      <div className="player-row">
        <button type="button" className="play-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
        {takes.length > 1 && (
          <div className="seg" role="radiogroup" aria-label="Which version to hear">
            {takes.map((t, i) => (
              <button key={t.label} type="button" role="radio" aria-checked={i === active} onClick={() => setActive(i)}>
                {t.label}
              </button>
            ))}
          </div>
        )}
        <span className="readout ml-auto">
          {timeNow} / {formatTime(take.duration)}
        </span>
      </div>
      <Waveform
        peaks={take.peaks}
        progress={pos}
        label={`${take.label} waveform, seek`}
        tone={active === takes.length - 1 && takes.length > 1 ? 'accent' : 'ink'}
        onSeek={(f) => {
          const a = audio.current!;
          a.currentTime = f * (a.duration || take.duration);
          setPos(f);
        }}
      />
    </div>
  );
}
