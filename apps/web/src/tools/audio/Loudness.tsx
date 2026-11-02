import { useState } from 'react';
import { AudioTool } from './shared';
import { Segmented } from '@/components/Segmented';
import { normaliseLoudness } from '@/lib/audio/enhance';
import { integratedLufs } from '@/lib/audio/loudness';
import { clonePcm, peakLevel } from '@/lib/audio/pcm';

export default function Loudness() {
  const [target, setTarget] = useState(-14);
  return (
    <AudioTool
      slug="loudness"
      suffix={`lufs${target}`}
      actionLabel="Set the loudness"
      deps={[target]}
      options={
        <Segmented
          label="Target"
          value={target}
          onChange={setTarget}
          options={[
            { value: -9, label: '−9 Club' },
            { value: -14, label: '−14 Streaming' },
            { value: -16, label: '−16 Podcast' },
            { value: -23, label: '−23 Broadcast' },
          ]}
          hint="Spotify and YouTube play at about −14 LUFS. EBU R128 broadcast uses −23."
        />
      }
      extra={(src) => {
        const now = integratedLufs(src.pcm);
        return (
          <p className="m-0">
            This file measures <strong className="readout">{Number.isFinite(now) ? `${now.toFixed(1)} LUFS` : 'silence'}</strong>, peak{' '}
            <strong className="readout">{(20 * Math.log10(peakLevel(src.pcm) || 1e-9)).toFixed(1)} dBFS</strong>.
          </p>
        );
      }}
      process={async (pcm, { progress }) => {
        progress(null, 'Measuring and adjusting');
        const out = clonePcm(pcm);
        const g = normaliseLoudness(out, target);
        const after = integratedLufs(out);
        return {
          pcm: out,
          stats: [
            { label: 'Gain', value: `${g >= 0 ? '+' : ''}${g.toFixed(1)} dB` },
            { label: 'Result', value: `${after.toFixed(1)} LUFS` },
          ],
        };
      }}
    />
  );
}
