import { useState } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { ToolFrame } from '@/components/ToolFrame';
import { DropZone } from '@/components/DropZone';
import { JobStatus } from '@/components/JobStatus';
import { ResultActions } from '@/components/ResultActions';
import { useJob } from '@/hooks/useJob';
import { formatBytes } from '@/lib/util';
import { toolBySlug } from '../registry';

export default function PdfMerge() {
  const tool = toolBySlug('pdf-merge')!;
  const [files, setFiles] = useState<File[]>([]);
  const job = useJob<{ blob: Blob; pages: number }>();
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
      const out = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        progress(i / files.length, `Adding ${files[i].name}`);
        const src = await PDFDocument.load(await files[i].arrayBuffer(), { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      progress(1, 'Saving');
      return { blob: new Blob([(await out.save()) as BlobPart], { type: 'application/pdf' }), pages: out.getPageCount() };
    }, 'Merging');
  const out = job.state.status === 'done' ? job.state.result : null;
  return (
    <ToolFrame
      tool={tool}
      options={
        <>
          <p className="m-0 muted">Add the PDFs, put them in order with the arrows, then merge.</p>
          <button type="button" className="btn btn-lg" disabled={files.length < 2 || job.state.status === 'running'} onClick={run}>
            Merge {files.length || ''} PDFs
          </button>
        </>
      }
    >
      <DropZone accept="application/pdf,.pdf" multiple compact={files.length > 0} onFiles={(f) => set([...files, ...f])} hint="Your PDFs are joined on this device." />
      {files.length > 0 && (
        <ol className="rows" aria-label="PDFs in order">
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
      {out && <ResultActions blob={out.blob} filename="merged.pdf" tool="pdf-merge" note={`${out.pages} pages`} />}
    </ToolFrame>
  );
}
