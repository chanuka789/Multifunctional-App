import { useState } from 'react';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { ToolFrame } from '@/components/ToolFrame';
import { DropZone, FileChip } from '@/components/DropZone';
import { JobStatus } from '@/components/JobStatus';
import { ResultActions } from '@/components/ResultActions';
import { Segmented } from '@/components/Segmented';
import { useJob } from '@/hooks/useJob';
import { baseName } from '@/lib/util';
import { parseRanges } from './pages';
import { toolBySlug } from '../registry';

export default function PdfSplit() {
  const tool = toolBySlug('pdf-split')!;
  const [file, setFile] = useState<File | null>(null);
  const [count, setCount] = useState(0);
  const [mode, setMode] = useState<'range' | 'each'>('range');
  const [range, setRange] = useState('1-3');
  const job = useJob<{ blob: Blob; filename: string; note: string }>();
  const pick = async (f: File) => {
    setFile(f);
    job.reset();
    const d = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
    setCount(d.getPageCount());
    setRange(`1-${Math.min(3, d.getPageCount())}`);
  };
  const parsed = count ? parseRanges(range, count) : null;
  const run = () =>
    file &&
    job.run(async ({ progress }) => {
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const name = baseName(file.name);
      if (mode === 'range') {
        const out = await PDFDocument.create();
        (await out.copyPages(src, parsed!)).forEach((p) => out.addPage(p));
        return { blob: new Blob([(await out.save()) as BlobPart], { type: 'application/pdf' }), filename: `${name}-pages-${range.replace(/\s+/g, '')}.pdf`, note: `${parsed!.length} pages` };
      }
      const zip = new JSZip();
      for (let i = 0; i < count; i++) {
        progress(i / count, `Page ${i + 1} of ${count}`);
        const out = await PDFDocument.create();
        const [pg] = await out.copyPages(src, [i]);
        out.addPage(pg);
        zip.file(`${name}-page-${String(i + 1).padStart(3, '0')}.pdf`, await out.save());
      }
      return { blob: await zip.generateAsync({ type: 'blob' }), filename: `${name}-pages.zip`, note: `${count} PDFs in a ZIP` };
    }, 'Splitting');
  const out = job.state.status === 'done' ? job.state.result : null;
  return (
    <ToolFrame
      tool={tool}
      options={
        <>
          <Segmented
            label="How to split"
            value={mode}
            onChange={(m) => {
              setMode(m);
              job.reset();
            }}
            options={[
              { value: 'range', label: 'Pick pages' },
              { value: 'each', label: 'Every page' },
            ]}
          />
          {mode === 'range' && (
            <div className="field">
              <label className="field-label" htmlFor="ranges">
                Pages to keep
              </label>
              <input
                id="ranges"
                className="input"
                value={range}
                onChange={(e) => {
                  setRange(e.target.value);
                  job.reset();
                }}
                aria-invalid={!!count && !parsed}
                aria-describedby="ranges-hint"
              />
              <span className="field-hint" id="ranges-hint">
                {count ? `This PDF has ${count} pages. ` : ''}Examples: 1-3, 7, 10-
              </span>
              {!!count && !parsed && <span className="field-error">Use page numbers from 1 to {count}.</span>}
            </div>
          )}
          <button type="button" className="btn btn-lg" disabled={!file || (mode === 'range' && !parsed) || job.state.status === 'running'} onClick={run}>
            Split the PDF
          </button>
        </>
      }
    >
      {!file ? <DropZone accept="application/pdf,.pdf" onFiles={(f) => pick(f[0])} hint="One PDF. It stays on this device." /> : <FileChip file={file} onClear={() => setFile(null)} />}
      <JobStatus state={job.state} onCancel={job.cancel} onRetry={run} />
      {out && <ResultActions blob={out.blob} filename={out.filename} tool="pdf-split" note={out.note} />}
    </ToolFrame>
  );
}
