import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { ToolFrame } from '@/components/ToolFrame';
import { Toggle } from '@/components/Toggle';
import { AudioPreview, type Take } from '@/components/AudioPreview';
import { ResultActions } from '@/components/ResultActions';
import { JobStatus } from '@/components/JobStatus';
import { useJob } from '@/hooks/useJob';
import { decodeFile } from '@/lib/audio/decode';
import { encodeAudio, extFor, type AudioFormat } from '@/lib/audio/encode';
import { denoise } from '@/lib/audio/engines';
import { normaliseLoudness } from '@/lib/audio/enhance';
import { formatTime } from '@/lib/util';
import { FormatPicker, makeTake } from './shared';
import { toolBySlug } from '../registry';

type Out = { blob: Blob; filename: string; take: Take };

export default function VoiceRecorder() {
  const tool = toolBySlug('voice-recorder')!;
  const [live, setLive] = useState(true);
  const [clean, setClean] = useState(true);
  const [format, setFormat] = useState<AudioFormat>('mp3');
  const [kbps, setKbps] = useState(128);
  const [rec, setRec] = useState<{ t0: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const media = useRef<{ mr: MediaRecorder; stream: MediaStream; ctx: AudioContext } | null>(null);
  const job = useJob<Out>();

  useEffect(() => () => stopAll(), []); // eslint-disable-line react-hooks/exhaustive-deps
  function stopAll() {
    media.current?.stream.getTracks().forEach((t) => t.stop());
    void media.current?.ctx.close();
    media.current = null;
  }

  const start = async () => {
    setErr(null);
    job.reset();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: live, echoCancellation: live, autoGainControl: live } });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      const data = new Float32Array(an.fftSize);
      const t0 = performance.now();
      const tick = () => {
        if (!media.current) return;
        an.getFloatTimeDomainData(data);
        let m = 0;
        for (const v of data) m = Math.max(m, Math.abs(v));
        setLevel(m);
        setElapsed((performance.now() - t0) / 1000);
        requestAnimationFrame(tick);
      };
      const chunks: Blob[] = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = () => {
        const raw = new Blob(chunks, { type: mr.mimeType });
        stopAll();
        void job.run(async ({ progress, signal }) => {
          progress(null, 'Reading the recording');
          let pcm = await decodeFile(raw);
          if (clean) pcm = await denoise(pcm, 0.9, (v) => progress(v, 'Cleaning the recording'), signal);
          normaliseLoudness(pcm, -16);
          const blob = await encodeAudio(pcm, format, { kbps });
          const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
          return { blob, filename: `recording-${stamp}.${extFor(format)}`, take: makeTake('Recording', pcm, blob) };
        }, 'Saving');
      };
      media.current = { mr, stream, ctx };
      mr.start(1000);
      setRec({ t0 });
      requestAnimationFrame(tick);
    } catch (e) {
      setErr(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Microphone access was blocked. Allow it in the address bar and try again.' : 'No microphone was found.');
    }
  };
  const stop = () => {
    media.current?.mr.stop();
    setRec(null);
    setLevel(0);
  };
  const out = job.state.status === 'done' ? job.state.result : null;
  return (
    <ToolFrame
      tool={tool}
      options={
        <>
          <Toggle label="Live noise suppression" description="Uses your browser's built-in filter while recording." checked={live} onChange={setLive} />
          <Toggle label="Clean after recording" description="Runs the RNNoise model on the finished take." checked={clean} onChange={setClean} />
          <FormatPicker value={format} onChange={setFormat} kbps={kbps} onKbps={setKbps} />
        </>
      }
    >
      <div className="rec" data-ui>
        <button type="button" className={rec ? 'rec-btn rec-on' : 'rec-btn'} onClick={rec ? stop : start} aria-pressed={!!rec}>
          {rec ? <Square size={26} fill="currentColor" /> : <Mic size={30} />}
          <span className="sr-only">{rec ? 'Stop recording' : 'Start recording'}</span>
        </button>
        <div className="grid gap-2">
          <span className="rec-time readout">{formatTime(rec ? elapsed : 0)}</span>
          <div className="progress w-64" aria-hidden="true">
            <span style={{ width: `${Math.min(100, level * 140)}%` }} />
          </div>
          <span className="small muted">{rec ? 'Recording. Press the button to stop.' : 'Press the button and allow the microphone.'}</span>
        </div>
      </div>
      {err && <p className="field-error m-0">{err}</p>}
      <JobStatus state={job.state} onCancel={job.cancel} />
      {out && (
        <>
          <AudioPreview takes={[out.take]} />
          <ResultActions blob={out.blob} filename={out.filename} tool="voice-recorder" />
        </>
      )}
    </ToolFrame>
  );
}
