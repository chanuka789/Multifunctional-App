import { useEffect, useState } from 'react';
import JSZip from 'jszip';
import { ToolFrame } from '@/components/ToolFrame';
import { DropZone } from '@/components/DropZone';
import { JobStatus } from '@/components/JobStatus';
import { ResultActions } from '@/components/ResultActions';
import { Segmented } from '@/components/Segmented';
import { Slider } from '@/components/Slider';
import { useJob } from '@/hooks/useJob';
import { canvasToBlob, fileToCanvas } from '@/lib/pdf';
import { baseName, formatBytes } from '@/lib/util';
import { toolBySlug } from '../registry';

type Fmt = 'jpeg' | 'png' | 'webp';

export default function ImageTools() {
  const tool = toolBySlug('image-tools')!;
  const [files, setFiles] = useState<File[]>([]);
  const [fmt, setFmt] = useState<Fmt>('webp');
  const [quality, setQuality] = useState(80);
  const [maxW, setMaxW] = useState(1920);
  const job = useJob<{ blob: Blob; filename: string; before: number; preview: string }>();
  useEffect(() => job.reset(), [files, fmt, quality, maxW]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = () =>
    job.run(async ({ progress }) => {
      const zip = new JSZip();
      let before = 0;
      let first: Blob | null = null;
      let preview = '';
      const ext = fmt === 'jpeg' ? 'jpg' : fmt;
      for (let i = 0; i < files.length; i++) {
        progress(i / files.length, `Image ${i + 1} of ${files.length}`);
        before += files[i].size;
        const c = await fileToCanvas(files[i], 12000);
        let out = c;
        if (maxW && c.width > maxW) {
          out = document.createElement('canvas');
          out.width = maxW;
          out.height = Math.round((c.height * maxW) / c.width);
          const g = out.getContext('2d')!;
          g.imageSmoothingQuality = 'high';
          g.drawImage(c, 0, 0, out.width, out.height);
        }
        const b = await canvasToBlob(out, `image/${fmt}`, quality / 100);
        if (i === 0) {
          first = b;
          preview = URL.createObjectURL(b);
        }
        zip.file(`${baseName(files[i].name)}.${ext}`, b);
      }
      return files.length === 1
        ? { blob: first!, filename: `${baseName(files[0].name)}.${ext}`, before, preview }
        : { blob: await zip.generateAsync({ type: 'blob' }), filename: `images-${ext}.zip`, before, preview };
    }, 'Working');
  const out = job.state.status === 'done' ? job.state.result : null;
  return (
    <ToolFrame
      tool={tool}
      options={
        <>
          <Segmented
            label="Save as"
            value={fmt}
            onChange={setFmt}
            options={[
              { value: 'webp', label: 'WEBP', hint: 'Smallest, modern' },
              { value: 'jpeg', label: 'JPG', hint: 'Photos, everywhere' },
              { value: 'png', label: 'PNG', hint: 'Sharp, transparent' },
            ]}
          />
          {fmt !== 'png' && <Slider label="Quality" value={quality} min={30} max={100} step={5} onChange={setQuality} format={(v) => `${v}%`} />}
          <Segmented
            label="Largest width"
            value={maxW}
            onChange={setMaxW}
            options={[
              { value: 0, label: 'Keep' },
              { value: 3840, label: '3840' },
              { value: 1920, label: '1920' },
              { value: 1280, label: '1280' },
              { value: 800, label: '800' },
            ]}
            hint="In pixels. Height follows to keep the shape."
          />
          <button type="button" className="btn btn-lg" disabled={!files.length || job.state.status === 'running'} onClick={run}>
            Convert {files.length > 1 ? `${files.length} images` : ''}
          </button>
        </>
      }
    >
      <DropZone accept="image/*" multiple compact={files.length > 0} onFiles={(f) => setFiles((x) => [...x, ...f])} hint="JPG, PNG, WEBP, GIF or BMP. Many at once is fine." />
      {files.length > 0 && (
        <p className="m-0">
          {files.length} image{files.length > 1 ? 's' : ''}, {formatBytes(files.reduce((a, f) => a + f.size, 0))}{' '}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFiles([])}>
            Clear
          </button>
        </p>
      )}
      <JobStatus state={job.state} onCancel={job.cancel} onRetry={run} />
      {out && (
        <>
          <img src={out.preview} alt="Preview of the first converted image" className="max-h-80 w-auto self-start border border-[var(--sheet-edge)]" />
          <dl className="stats">
            <div>
              <dt>Before</dt>
              <dd>{formatBytes(out.before)}</dd>
            </div>
            <div>
              <dt>After</dt>
              <dd>{formatBytes(out.blob.size)}</dd>
            </div>
          </dl>
          <ResultActions blob={out.blob} filename={out.filename} tool="image-tools" />
        </>
      )}
    </ToolFrame>
  );
}
