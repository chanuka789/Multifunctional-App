import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { ToolFrame } from '@/components/ToolFrame';
import { DropZone } from '@/components/DropZone';
import { JobStatus } from '@/components/JobStatus';
import { ResultActions } from '@/components/ResultActions';
import { AudioPreview, type Take } from '@/components/AudioPreview';
import { Slider } from '@/components/Slider';
import { useJob } from '@/hooks/useJob';
import { decodeFile } from '@/lib/audio/decode';
import { resample } from '@/lib/audio/resample';
import { concatPcm } from '@/lib/audio/pcm';
import { encodeAudio, extFor, type AudioFormat } from '@/lib/audio/encode';
import { formatBytes, formatTime } from '@/lib/util';
import { AUDIO_ACCEPT, FormatPicker, makeTake } from './shared';
import { toolBySlug } from '../registry';

type Out = { blob: Blob; filename: string; take: Take };

export default function AudioJoiner() {
  const tool = toolBySlug('audio-joiner')!;
  const [files, setFiles] = useState<File[]>([]);
  const [xfade, setXfade] = useState(0);
  const [format, setFormat] = useState<AudioFormat>('mp3');
  const [kbps, setKbps] = useState(192);
  const job = useJob<Out>();
  useEffect(() => job.reset(), [files, xfade, format, kbps]); // eslint-disable-line react-hooks/exhaustive-deps
  const move = (i: number, d: number) =>
    setFiles((f) => {
      const n = [...f];
      const [x] = n.splice(i, 1);
      n.splice(i + d, 0, x);
      return n;
    });
  const run = () =>
    job.run(async ({ progress }) => {
      const clips = [];
      for (let i = 0; i < files.length; i++) {
        progress(i / files.length / 2, `Reading ${files[i].name}`);
        clips.push(await decodeFile(files[i]));
      }
      const sr = Math.max(...clips.map((c) => c.sampleRate));
      const same = await Promise.all(clips.map((c) => resample(c, sr)));
      progress(0.6, 'Joining');
      const pcm = concatPcm(same, xfade);
      const blob = await encodeAudio(pcm, format, { kbps, onProgress: (v) => progress(0.6 + v * 0.4, `Saving as ${format.toUpperCase()}`) });
      return { blob, filename: `joined-${files.length}-clips.${extFor(format)}`, take: makeTake('Joined', pcm, blob) };
    }, 'Starting');
  const out = job.state.status === 'done' ? job.state.result : null;
  return (
    <ToolFrame
      tool={tool}
      options={
        <>
          <Slider label="Crossfade" value={xfade} min={0} max={5} step={0.1} onChange={setXfade} format={(v) => (v ? `${v.toFixed(1)} s` : 'None')} />
          <FormatPicker value={format} onChange={setFormat} kbps={kbps} onKbps={setKbps} />
          <button type="button" className="btn btn-lg" disabled={files.length < 2 || job.state.status === 'running'} onClick={run}>
            Join {files.length || ''} clips
          </button>
        </>
      }
    >
      <DropZone accept={AUDIO_ACCEPT} multiple compact={files.length > 0} onFiles={(f) => setFiles((x) => [...x, ...f])} hint="Add clips in any order, then arrange them below." />
      {files.length > 0 && (
        <ol className="rows" aria-label="Clips in order">
          {files.map((f, i) => (
            <li key={f.name + i} className="row">
              <span className="readout w-6">{i + 1}</span>
              <span className="row-name">{f.name}</span>
              <span className="small muted">{formatBytes(f.size)}</span>
              <button type="button" className="icon-btn" aria-label={`Move ${f.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={16} />
              </button>
              <button type="button" className="icon-btn" aria-label={`Move ${f.name} down`} disabled={i === files.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown size={16} />
              </button>
              <button type="button" className="icon-btn" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                <X size={16} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <JobStatus state={job.state} onCancel={job.cancel} onRetry={run} />
      {out && (
        <>
          <AudioPreview takes={[out.take]} />
          <p className="m-0 small muted">Total length {formatTime(out.take.duration)}</p>
          <ResultActions blob={out.blob} filename={out.filename} tool="audio-joiner" />
        </>
      )}
    </ToolFrame>
  );
}
