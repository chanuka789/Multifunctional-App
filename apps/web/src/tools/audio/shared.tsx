import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DropZone, FileChip } from '@/components/DropZone';
import { AudioPreview, type Take } from '@/components/AudioPreview';
import { JobStatus } from '@/components/JobStatus';
import { ResultActions } from '@/components/ResultActions';
import { ToolFrame } from '@/components/ToolFrame';
import { Segmented } from '@/components/Segmented';
import { useJob, type JobCtx } from '@/hooks/useJob';
import { decodeFile } from '@/lib/audio/decode';
import { encodeAudio, encodeWav, extFor, FORMATS, type AudioFormat } from '@/lib/audio/encode';
import { peaks, pcmDuration, type Pcm } from '@/lib/audio/pcm';
import { baseName, formatTime } from '@/lib/util';
import { toolBySlug } from '../registry';

export const AUDIO_ACCEPT = 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.webm,.mp4,.mov,.mkv,.wma,.amr';

export interface Source {
  file: File;
  pcm: Pcm;
  take: Take;
}

export function makeTake(label: string, pcm: Pcm, blob?: Blob): Take {
  const url = URL.createObjectURL(blob ?? encodeWav(pcm));
  return { label, url, peaks: peaks(pcm, 1200), duration: pcmDuration(pcm) };
}

/** Load and decode one audio file; keeps the original playable for A/B. */
export function useAudioSource() {
  const [source, setSource] = useState<Source | null>(null);
  const job = useJob<Source>();
  useEffect(() => () => {
    if (source) URL.revokeObjectURL(source.take.url);
  }, [source]);
  const load = useCallback(
    (file: File) =>
      job.run(async ({ progress }) => {
        progress(null, `Reading ${file.name}`);
        const pcm = await decodeFile(file, () => progress(null, 'Unusual format, loading the converter'));
        const s = { file, pcm, take: makeTake('Before', pcm, file.type.startsWith('audio/') ? file : undefined) };
        setSource(s);
        return s;
      }, 'Reading the file'),
    [job],
  );
  const clear = useCallback(() => {
    setSource(null);
    job.reset();
  }, [job]);
  return { source, load, clear, loading: job.state };
}

export function FormatPicker({ value, onChange, kbps, onKbps }: { value: AudioFormat; onChange: (f: AudioFormat) => void; kbps?: number; onKbps?: (k: number) => void }) {
  const lossy = value !== 'wav' && value !== 'flac';
  return (
    <>
      <Segmented
        label="Save as"
        value={value}
        onChange={onChange}
        options={FORMATS.map((f) => ({ value: f.id, label: f.label, hint: f.note }))}
        hint={FORMATS.find((f) => f.id === value)?.note + (value !== 'wav' && value !== 'mp3' ? '. Uses the 31 MB converter.' : '')}
      />
      {lossy && onKbps && (
        <Segmented
          label="Quality"
          value={kbps ?? 192}
          onChange={onKbps}
          options={[
            { value: 96, label: '96 kbps', hint: 'Voice, smallest' },
            { value: 128, label: '128' },
            { value: 192, label: '192' },
            { value: 320, label: '320', hint: 'Music, best' },
          ]}
        />
      )}
    </>
  );
}

export interface Processed {
  pcm: Pcm;
  blob: Blob;
  filename: string;
  take: Take;
  note?: string;
  stats?: { label: string; value: string }[];
}

/**
 * The common audio tool: drop → options → Process → A/B preview → download/share.
 * `process` turns the decoded clip into a new clip; encoding to the picked format is handled here.
 */
export function AudioTool(props: {
  slug: string;
  options: ReactNode | ((src: Source | null) => ReactNode);
  process: (pcm: Pcm, ctx: JobCtx) => Promise<{ pcm: Pcm; note?: string; stats?: { label: string; value: string }[] }>;
  actionLabel: string;
  suffix: string;
  /** Changes to these values clear an old result so people never download stale output. */
  deps: unknown[];
  defaultFormat?: AudioFormat;
  extra?: (src: Source) => ReactNode;
}) {
  const tool = toolBySlug(props.slug)!;
  const { source, load, clear, loading } = useAudioSource();
  const [format, setFormat] = useState<AudioFormat>(props.defaultFormat ?? 'mp3');
  const [kbps, setKbps] = useState(192);
  const job = useJob<Processed>();
  const result = job.state.status === 'done' ? job.state.result : null;

  useEffect(() => {
    job.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, format, kbps, ...props.deps]);
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.take.url);
  }, [result]);

  const run = () =>
    source &&
    job.run(async (ctx) => {
      const out = await props.process(source.pcm, ctx);
      ctx.progress(null, `Saving as ${format.toUpperCase()}`);
      const blob = await encodeAudio(out.pcm, format, { kbps, onProgress: (v, l) => ctx.progress(v, l ?? `Saving as ${format.toUpperCase()}`) });
      const filename = `${baseName(source.file.name)}-${props.suffix}.${extFor(format)}`;
      return { ...out, blob, filename, take: makeTake('After', out.pcm, blob) };
    }, 'Starting');

  const takes = useMemo(() => (source ? (result ? [source.take, result.take] : [source.take]) : []), [source, result]);

  return (
    <ToolFrame
      tool={tool}
      options={
        <>
          {typeof props.options === 'function' ? props.options(source) : props.options}
          <FormatPicker value={format} onChange={setFormat} kbps={kbps} onKbps={setKbps} />
          <button type="button" className="btn btn-lg" disabled={!source || job.state.status === 'running'} onClick={run}>
            {props.actionLabel}
          </button>
        </>
      }
    >
      {!source && loading.status !== 'running' && (
        <DropZone accept={AUDIO_ACCEPT} onFiles={(f) => load(f[0])} hint={`${tool.accepts}. The file is opened on this device and never uploaded.`} />
      )}
      <JobStatus state={loading} />
      {source && (
        <>
          <FileChip file={source.file} onClear={clear} />
          <dl className="stats">
            <div>
              <dt>Length</dt>
              <dd>{formatTime(pcmDuration(source.pcm))}</dd>
            </div>
            <div>
              <dt>Channels</dt>
              <dd>{source.pcm.channels.length === 1 ? 'Mono' : 'Stereo'}</dd>
            </div>
            <div>
              <dt>Sample rate</dt>
              <dd>{(source.pcm.sampleRate / 1000).toFixed(1)} kHz</dd>
            </div>
            {result?.stats?.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
          {props.extra?.(source)}
          <AudioPreview takes={takes} />
          <JobStatus state={job.state} onCancel={job.cancel} onRetry={run} />
          {result && <ResultActions blob={result.blob} filename={result.filename} tool={props.slug} note={result.note ?? (job.state.status === 'done' ? `made in ${(job.state.ms / 1000).toFixed(1)} s` : undefined)} />}
        </>
      )}
    </ToolFrame>
  );
}
