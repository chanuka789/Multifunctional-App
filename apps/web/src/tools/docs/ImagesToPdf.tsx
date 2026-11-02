import { useState } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { ToolFrame } from '@/components/ToolFrame';
import { DropZone } from '@/components/DropZone';
import { JobStatus } from '@/components/JobStatus';
import { ResultActions } from '@/components/ResultActions';
import { Segmented } from '@/components/Segmented';
import { useJob } from '@/hooks/useJob';
import { canvasToBlob, fileToCanvas } from '@/lib/pdf';
import { formatBytes } from '@/lib/util';
import { toolBySlug } from '../registry';

const SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;

export default function ImagesToPdf() {
  const tool = toolBySlug('images-to-pdf')!;
  const [files, setFiles] = useState<File[]>([]);
  const [size, setSize] = useState<'a4' | 'letter' | 'fit'>('a4');
  const [margin, setMargin] = useState(24);
  const job = useJob<{ blob: Blob }>();
  const set = (f: File[]) => {
    setFiles(f);
    job.reset();
  };
  const move = (i: number, d: number) => {
    const n = [...files];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    set(n);
  };
  const run = () =>
    job.run(async ({ progress }) => {
      const doc = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        progress(i / files.length, `Adding ${files[i].name}`);
        const c = await fileToCanvas(files[i], 3000);
        const jpg = await doc.embedJpg(new Uint8Array(await (await canvasToBlob(c, 'image/jpeg', 0.88)).arrayBuffer()));
        if (size === 'fit') {
          const w = (c.width * 72) / 150, h = (c.height * 72) / 150;
          doc.addPage([w, h]).drawImage(jpg, { x: 0, y: 0, width: w, height: h });
        } else {
          let [pw, ph]: number[] = [...SIZES[size]];
          if (c.width > c.height) [pw, ph] = [ph, pw];
          const s = Math.min((pw - margin * 2) / c.width, (ph - margin * 2) / c.height);
          const w = c.width * s, h = c.height * s;
          doc.addPage([pw, ph]).drawImage(jpg, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
        }
      }
      return { blob: new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' }) };
    }, 'Building the PDF');
  const out = job.state.status === 'done' ? job.state.result : null;
  return (
    <ToolFrame
      tool={tool}
      options={
        <>
          <Segmented
            label="Page size"
            value={size}
            onChange={(v) => (setSize(v), job.reset())}
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'Letter' },
              { value: 'fit', label: 'Fit each image' },
            ]}
          />
          {size !== 'fit' && (
            <Segmented
              label="Margin"
              value={margin}
              onChange={(v) => (setMargin(v), job.reset())}
              options={[
                { value: 0, label: 'None' },
                { value: 24, label: 'Small' },
                { value: 54, label: 'Wide' },
              ]}
            />
          )}
          <button type="button" className="btn btn-lg" disabled={!files.length || job.state.status === 'running'} onClick={run}>
            Make the PDF
          </button>
        </>
      }
    >
      <DropZone accept="image/*" multiple compact={files.length > 0} onFiles={(f) => set([...files, ...f])} hint="JPG, PNG or WEBP. Phone photos are turned the right way up." />
      {files.length > 0 && (
        <ol className="rows" aria-label="Images in order">
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
              <button type="button" className="icon-btn" aria-label={`Remove ${f.name}`} onClick={() => set(files.filter((_, j) => j !== i))}>
                <X size={16} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <JobStatus state={job.state} onCancel={job.cancel} onRetry={run} />
      {out && <ResultActions blob={out.blob} filename="images.pdf" tool="images-to-pdf" note={`${files.length} pages`} />}
    </ToolFrame>
  );
}
