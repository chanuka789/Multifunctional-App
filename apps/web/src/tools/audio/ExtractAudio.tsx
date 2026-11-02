import { useState } from 'react';
import { ToolFrame } from '@/components/ToolFrame';
import { DropZone, FileChip } from '@/components/DropZone';
import { JobStatus } from '@/components/JobStatus';
import { ResultActions } from '@/components/ResultActions';
import { AudioPreview } from '@/components/AudioPreview';
import { useJob } from '@/hooks/useJob';
import { transcode } from '@/lib/ffmpeg';
import { decodeFile } from '@/lib/audio/decode';
import { baseName } from '@/lib/util';
import { Segmented } from '@/components/Segmented';
import { makeTake } from './shared';
import { toolBySlug } from '../registry';
import type { Take } from '@/components/AudioPreview';

type Out = { blob: Blob; filename: string; take: Take };

export default function ExtractAudio() {
  const tool = toolBySlug('extract-audio')!;
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<'mp3' | 'm4a' | 'wav' | 'copy'>('mp3');
  const job = useJob<Out>();
  const run = () =>
    file &&
    job.run(async ({ progress }) => {
      const args: Record<typeof format, [string, string[]]> = {
        mp3: ['mp3', ['-vn', '-c:a', 'libmp3lame', '-b:a', '192k']],
        m4a: ['m4a', ['-vn', '-c:a', 'aac', '-b:a', '192k']],
        wav: ['wav', ['-vn', '-c:a', 'pcm_s16le']],
        copy: ['m4a', ['-vn', '-c:a', 'copy']],
      };
      const [ext, a] = args[format];
      const blob = await transcode(file, ext, a, (v, l) => progress(v, l ?? 'Extracting'));
      progress(null, 'Preparing the preview');
      const pcm = await decodeFile(blob);
      return { blob, filename: `${baseName(file.name)}.${ext}`, take: makeTake('Audio', pcm, blob) };
    }, 'Loading the converter');
  const out = job.state.status === 'done' ? job.state.result : null;
  return (
    <ToolFrame
      tool={tool}
      options={
        <>
          <Segmented
            label="Save as"
            value={format}
            onChange={(f) => {
              setFormat(f);
              job.reset();
            }}
            options={[
              { value: 'mp3', label: 'MP3' },
              { value: 'm4a', label: 'M4A' },
              { value: 'wav', label: 'WAV' },
              { value: 'copy', label: 'Original track', hint: 'Fastest, no quality loss (AAC videos)' },
            ]}
          />
          <button type="button" className="btn btn-lg" disabled={!file || job.state.status === 'running'} onClick={run}>
            Extract the audio
          </button>
        </>
      }
    >
      {!file ? (
        <DropZone accept="video/*,.mkv,.avi,.mov,.mp4,.webm" onFiles={(f) => setFile(f[0])} hint={`${tool.accepts}. Large videos work too; they stay on this device.`} />
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
      {out && (
        <>
          <AudioPreview takes={[out.take]} />
          <ResultActions blob={out.blob} filename={out.filename} tool="extract-audio" />
        </>
      )}
    </ToolFrame>
  );
}
