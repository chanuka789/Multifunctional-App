import { useState } from 'react';
import { AudioTool } from './shared';
import { Slider } from '@/components/Slider';
import { Segmented } from '@/components/Segmented';
import { Toggle } from '@/components/Toggle';
import { denoise } from '@/lib/audio/engines';
import { enhanceVoice, normaliseLoudness, type EnhancePreset } from '@/lib/audio/enhance';
import { resample } from '@/lib/audio/resample';
import { integratedLufs } from '@/lib/audio/loudness';

export default function NoiseRemover() {
  const [strength, setStrength] = useState(90);
  const [enhance, setEnhance] = useState(true);
  const [preset, setPreset] = useState<EnhancePreset>('studio');
  const [target, setTarget] = useState(-16);
  return (
    <AudioTool
      slug="noise-remover"
      suffix="clean"
      actionLabel="Clean the audio"
      deps={[strength, enhance, preset, target]}
      options={
        <>
          <Slider
            label="Noise reduction"
            value={strength}
            min={0}
            max={100}
            step={5}
            onChange={setStrength}
            format={(v) => `${v}%`}
            hint="Lower it if the voice starts to sound watery."
          />
          <Toggle label="Enhance the voice" description="EQ, de-ess, gentle compression and even loudness." checked={enhance} onChange={setEnhance} />
          {enhance && (
            <Segmented
              label="Voice style"
              value={preset}
              onChange={setPreset}
              options={[
                { value: 'light', label: 'Natural' },
                { value: 'studio', label: 'Studio' },
                { value: 'podcast', label: 'Broadcast' },
              ]}
            />
          )}
          <Segmented
            label="Loudness"
            value={target}
            onChange={setTarget}
            options={[
              { value: -14, label: '−14 LUFS', hint: 'YouTube, Spotify' },
              { value: -16, label: '−16', hint: 'Podcasts' },
              { value: -19, label: '−19', hint: 'Quiet, mono speech' },
            ]}
            hint="−16 LUFS suits podcasts and voice notes."
          />
        </>
      }
      process={async (pcm, { progress, signal }) => {
        const before = integratedLufs(pcm);
        progress(null, 'Loading the noise model');
        let out = await denoise(pcm, strength / 100, (v) => progress(v * 0.85, 'Removing noise'), signal);
        if (enhance) {
          progress(0.88, 'Enhancing the voice');
          out = await enhanceVoice(out, { preset, target });
        } else normaliseLoudness(out, target);
        if (out.sampleRate !== pcm.sampleRate && pcm.sampleRate >= 44100) out = await resample(out, pcm.sampleRate);
        const after = integratedLufs(out);
        return {
          pcm: out,
          stats: [
            { label: 'Loudness before', value: Number.isFinite(before) ? `${before.toFixed(1)} LUFS` : '—' },
            { label: 'Loudness after', value: Number.isFinite(after) ? `${after.toFixed(1)} LUFS` : '—' },
          ],
        };
      }}
    />
  );
}
