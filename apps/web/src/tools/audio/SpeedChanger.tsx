import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { AudioTool } from './shared';
import { Slider } from '@/components/Slider';
import { Toggle } from '@/components/Toggle';
import { stretch, varispeed } from '@/lib/audio/engines';
import { pcmDuration } from '@/lib/audio/pcm';
import { clamp, formatTime } from '@/lib/util';

const QUICK = [0.75, 1.1, 1.2, 1.25, 1.3, 1.5, 1.75, 2];

export default function SpeedChanger() {
  const [params] = useSearchParams();
  const [rate, setRate] = useState(() => clamp(parseFloat(params.get('rate') ?? '') || 1.25, 0.5, 3));
  const [keepPitch, setKeepPitch] = useState(true);
  return (
    <AudioTool
      slug="speed"
      suffix={`${rate}x`}
      actionLabel={`Make it ${rate}×`}
      deps={[rate, keepPitch]}
      options={
        <>
          <Slider label="Speed" value={rate} min={0.5} max={3} step={0.05} onChange={(v) => setRate(Math.round(v * 100) / 100)} format={(v) => `${v.toFixed(2)}×`} />
          <div className="seg" role="group" aria-label="Quick speeds">
            {QUICK.map((q) => (
              <button key={q} type="button" aria-pressed={q === rate} onClick={() => setRate(q)}>
                {q}×
              </button>
            ))}
          </div>
          <Toggle label="Keep the voice natural" description="Off gives the old tape effect: faster and higher." checked={keepPitch} onChange={setKeepPitch} />
        </>
      }
      extra={(src) => (
        <p className="m-0">
          New length: <strong className="readout">{formatTime(pcmDuration(src.pcm) / rate)}</strong>{' '}
          <span className="muted">
            ({rate > 1 ? `saves ${formatTime(pcmDuration(src.pcm) - pcmDuration(src.pcm) / rate)}` : `adds ${formatTime(pcmDuration(src.pcm) / rate - pcmDuration(src.pcm))}`})
          </span>
        </p>
      )}
      process={async (pcm, { progress, signal }) => {
        if (rate === 1) return { pcm };
        const out = keepPitch ? await stretch(pcm, { tempo: rate }, (v) => progress(v, 'Changing speed'), signal) : await varispeed(pcm, rate);
        return { pcm: out };
      }}
    />
  );
}
