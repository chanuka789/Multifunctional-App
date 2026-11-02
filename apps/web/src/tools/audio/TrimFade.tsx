import { useEffect, useState } from 'react';
import * as RS from '@radix-ui/react-slider';
import { AudioTool } from './shared';
import { Slider } from '@/components/Slider';
import { clonePcm, fade, pcmDuration, slicePcm } from '@/lib/audio/pcm';
import { formatTime } from '@/lib/util';

function Range({ duration, value, onChange }: { duration: number; value: [number, number]; onChange: (v: [number, number]) => void }) {
  return (
    <div className="field">
      <div className="flex items-baseline justify-between">
        <span className="field-label">Keep from … to</span>
        <output className="readout">
          {formatTime(value[0])} – {formatTime(value[1])}
        </output>
      </div>
      <RS.Root className="slider" min={0} max={duration} step={Math.max(0.01, duration / 2000)} value={value} minStepsBetweenThumbs={1} onValueChange={(v) => onChange([v[0], v[1]])}>
        <RS.Track className="slider-track">
          <RS.Range className="slider-range" />
        </RS.Track>
        <RS.Thumb className="slider-thumb" aria-label="Start" />
        <RS.Thumb className="slider-thumb" aria-label="End" />
      </RS.Root>
      <span className="field-hint">Kept part: {formatTime(value[1] - value[0])}. Use arrow keys on a handle for fine steps.</span>
    </div>
  );
}

export default function TrimFade() {
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [dur, setDur] = useState(0);
  const [fadeIn, setFadeIn] = useState(0.5);
  const [fadeOut, setFadeOut] = useState(1.5);
  return (
    <AudioTool
      slug="trim"
      suffix="trim"
      actionLabel="Trim and save"
      deps={[range[0], range[1], fadeIn, fadeOut]}
      options={(src) => {
        const d = src ? pcmDuration(src.pcm) : 0;
        return (
          <>
            <SyncDuration d={d} dur={dur} setDur={setDur} setRange={setRange} />
            {src ? <Range duration={d} value={range} onChange={setRange} /> : <p className="muted m-0">Add a file to choose the part to keep.</p>}
            <Slider label="Fade in" value={fadeIn} min={0} max={10} step={0.1} onChange={setFadeIn} format={(v) => `${v.toFixed(1)} s`} />
            <Slider label="Fade out" value={fadeOut} min={0} max={10} step={0.1} onChange={setFadeOut} format={(v) => `${v.toFixed(1)} s`} />
          </>
        );
      }}
      process={async (pcm) => {
        const out = clonePcm(slicePcm(pcm, range[0], range[1] || pcmDuration(pcm)));
        fade(out, fadeIn, fadeOut);
        return { pcm: out };
      }}
    />
  );
}

function SyncDuration({ d, dur, setDur, setRange }: { d: number; dur: number; setDur: (n: number) => void; setRange: (r: [number, number]) => void }) {
  useEffect(() => {
    if (d !== dur) {
      setDur(d);
      setRange([0, d]);
    }
  }, [d, dur, setDur, setRange]);
  return null;
}
