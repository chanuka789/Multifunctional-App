import { useMemo, useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { ToolFrame } from '@/components/ToolFrame';
import { DropZone, FileChip } from '@/components/DropZone';
import { JobStatus } from '@/components/JobStatus';
import { Segmented } from '@/components/Segmented';
import { ShareButton } from '@/components/ShareButton';
import { useJob } from '@/hooks/useJob';
import { decodeFile } from '@/lib/audio/decode';
import { resample } from '@/lib/audio/resample';
import { toMono } from '@/lib/audio/pcm';
import { callWorker } from '@/lib/worker-rpc';
import { baseName, downloadBlob, formatTime } from '@/lib/util';
import { AUDIO_ACCEPT } from './shared';
import { toolBySlug } from '../registry';

type Cue = { start: number; end: number; text: string };

const MODELS = [
  { value: 'onnx-community/whisper-tiny', label: 'Fast', hint: 'About 40 MB. Good for clear speech.' },
  { value: 'onnx-community/whisper-base', label: 'Balanced', hint: 'About 80 MB. Best for most files.' },
  { value: 'onnx-community/whisper-small', label: 'Accurate', hint: 'About 250 MB. Best for Sinhala, Tamil and noisy audio. Slower.' },
];
const LANGS: [string, string][] = [
  ['auto', 'Detect automatically'], ['english', 'English'], ['sinhala', 'Sinhala'], ['tamil', 'Tamil'], ['hindi', 'Hindi'],
  ['arabic', 'Arabic'], ['chinese', 'Chinese'], ['french', 'French'], ['german', 'German'], ['japanese', 'Japanese'],
  ['korean', 'Korean'], ['malay', 'Malay'], ['portuguese', 'Portuguese'], ['russian', 'Russian'], ['spanish', 'Spanish'],
  ['thai', 'Thai'], ['urdu', 'Urdu'], ['bengali', 'Bengali'], ['indonesian', 'Indonesian'], ['italian', 'Italian'], ['turkish', 'Turkish'], ['vietnamese', 'Vietnamese'],
];

const stamp = (s: number, sep: string) => {
  const ms = Math.round((s % 1) * 1000);
  const t = new Date(Math.floor(s) * 1000).toISOString().slice(11, 19);
  return `${t}${sep}${String(ms).padStart(3, '0')}`;
};
const toSrt = (c: Cue[]) => c.map((x, i) => `${i + 1}\n${stamp(x.start, ',')} --> ${stamp(x.end, ',')}\n${x.text}\n`).join('\n');
const toVtt = (c: Cue[]) => `WEBVTT\n\n${c.map((x) => `${stamp(x.start, '.')} --> ${stamp(x.end, '.')}\n${x.text}\n`).join('\n')}`;

export default function SpeechToText() {
  const tool = toolBySlug('speech-to-text')!;
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState(MODELS[1].value);
  const [lang, setLang] = useState('auto');
  const [task, setTask] = useState<'transcribe' | 'translate'>('transcribe');
  const [copied, setCopied] = useState(false);
  const job = useJob<Cue[]>();
  const run = () =>
    file &&
    job.run(async ({ progress, signal }) => {
      progress(null, 'Reading the audio');
      const pcm = toMono(await resample(await decodeFile(file), 16000));
      const worker = new Worker(new URL('../../workers/whisper.worker.ts', import.meta.url), { type: 'module' });
      try {
        const audio = pcm.channels[0];
        return await callWorker<Cue[]>(worker, { audio, model, language: lang, task }, { transfer: [audio.buffer], onProgress: progress, signal });
      } finally {
        worker.terminate();
      }
    }, 'Starting');
  const cues = job.state.status === 'done' ? job.state.result : null;
  const text = useMemo(() => cues?.map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim() ?? '', [cues]);
  const name = file ? baseName(file.name) : 'transcript';
  const srt = useMemo(() => (cues ? new Blob([toSrt(cues)], { type: 'application/x-subrip' }) : null), [cues]);
  return (
    <ToolFrame
      tool={tool}
      options={
        <>
          <div className="field">
            <label className="field-label" htmlFor="stt-lang">
              Spoken language
            </label>
            <select id="stt-lang" className="select" value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <Segmented label="Model" value={model} onChange={setModel} options={MODELS} hint={MODELS.find((m) => m.value === model)?.hint} />
          <Segmented
            label="Output"
            value={task}
            onChange={setTask}
            options={[
              { value: 'transcribe', label: 'Same language' },
              { value: 'translate', label: 'Translate to English' },
            ]}
          />
          <button type="button" className="btn btn-lg" disabled={!file || job.state.status === 'running'} onClick={run}>
            Transcribe
          </button>
        </>
      }
    >
      {!file ? (
        <DropZone accept={AUDIO_ACCEPT} onFiles={(f) => setFile(f[0])} hint={`${tool.accepts}. The model runs on your graphics chip when it can, otherwise on the processor.`} />
      ) : (
        <FileChip
          file={file}
          onClear={() => {
            setFile(null);
            job.reset();
          }}
        />
      )}
      <JobStatus state={job.state} onCancel={job.cancel} onRetry={run} />
      {cues && (
        <>
          <div className="transcript" data-ui>
            {cues.length === 0 && <p className="muted m-0">No speech was found in this file.</p>}
            {cues.map((c, i) => (
              <p key={i} className="cue">
                <span className="readout muted small">{formatTime(c.start)}</span>
                <span>{c.text}</span>
              </p>
            ))}
          </div>
          <div className="result-actions">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-accent" onClick={() => downloadBlob(new Blob([text], { type: 'text/plain' }), `${name}.txt`)}>
                <Download size={18} /> TXT
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => downloadBlob(new Blob([toSrt(cues)], { type: 'application/x-subrip' }), `${name}.srt`)}>
                SRT subtitles
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => downloadBlob(new Blob([toVtt(cues)], { type: 'text/vtt' }), `${name}.vtt`)}>
                VTT subtitles
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={async () => {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                <Copy size={18} /> {copied ? 'Copied' : 'Copy text'}
              </button>
            </div>
            {srt && <ShareButton blob={srt} filename={`${name}.srt`} tool="speech-to-text" />}
          </div>
        </>
      )}
    </ToolFrame>
  );
}
