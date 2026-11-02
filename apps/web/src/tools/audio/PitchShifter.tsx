import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { AudioTool } from './shared';
import { Slider } from '@/components/Slider';
import { stretch } from '@/lib/audio/engines';
import { clamp } from '@/lib/util';

export default function PitchShifter() {
  const [params] = useSearchParams();
  const [semis, setSemis] = useState(() => clamp(parseInt(params.get('semitones') ?? '') || -2, -12, 12));
  const label = (v: number) => (v === 0 ? 'No change' : `${v > 0 ? '+' : '−'}${Math.abs(v)} semitone${Math.abs(v) === 1 ? '' : 's'}`);
  return (
    <AudioTool
      slug="pitch"
      suffix={`pitch${semis >= 0 ? '+' : ''}${semis}`}
      actionLabel="Shift the pitch"
      deps={[semis]}
      options={
        <>
          <Slider label="Pitch" value={semis} min={-12} max={12} step={1} onChange={setSemis} format={label} hint="12 semitones is one octave. Speed stays the same." />
          <div className="seg" role="group" aria-label="Quick choices">
            {[-12, -5, -2, 2, 5, 12].map((q) => (
              <button key={q} type="button" aria-pressed={q === semis} onClick={() => setSemis(q)}>
                {q > 0 ? `+${q}` : `−${-q}`}
              </button>
            ))}
          </div>
        </>
      }
      process={async (pcm, { progress, signal }) => {
        if (semis === 0) return { pcm };
        return { pcm: await stretch(pcm, { semitones: semis }, (v) => progress(v, 'Shifting the pitch'), signal) };
      }}
    />
  );
}
