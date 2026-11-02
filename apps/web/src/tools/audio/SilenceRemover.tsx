import { useState } from 'react';
import { AudioTool } from './shared';
import { Slider } from '@/components/Slider';
import { removeSilence } from '@/lib/audio/silence';
import { formatTime } from '@/lib/util';

export default function SilenceRemover() {
  const [threshold, setThreshold] = useState(-42);
  const [minGap, setMinGap] = useState(0.7);
  const [keep, setKeep] = useState(0.2);
  return (
    <AudioTool
      slug="silence-remover"
      suffix="tight"
      actionLabel="Remove the pauses"
      deps={[threshold, minGap, keep]}
      options={
        <>
          <Slider label="Counts as silence below" value={threshold} min={-70} max={-20} step={1} onChange={setThreshold} format={(v) => `${v} dB`} hint="Raise it for noisy rooms." />
          <Slider label="Shortest pause to cut" value={minGap} min={0.2} max={3} step={0.1} onChange={setMinGap} format={(v) => `${v.toFixed(1)} s`} />
          <Slider label="Pause left in place" value={keep} min={0} max={1} step={0.05} onChange={setKeep} format={(v) => `${v.toFixed(2)} s`} hint="A little air keeps speech natural." />
        </>
      }
      process={async (pcm, { progress }) => {
        progress(null, 'Finding the pauses');
        const r = removeSilence(pcm, { thresholdDb: threshold, minSilence: minGap, keep });
        return {
          pcm: r.pcm,
          stats: [
            { label: 'Pauses cut', value: String(r.cuts) },
            { label: 'Time saved', value: formatTime(r.removed) },
          ],
        };
      }}
    />
  );
}
