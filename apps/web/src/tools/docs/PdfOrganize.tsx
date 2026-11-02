import { useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Trash2, Undo2 } from 'lucide-react';
import { PDFDocument, degrees } from 'pdf-lib';
import { ToolFrame } from '@/components/ToolFrame';
import { DropZone, FileChip } from '@/components/DropZone';
import { JobStatus } from '@/components/JobStatus';
import { ResultActions } from '@/components/ResultActions';
import { useJob } from '@/hooks/useJob';
import { openPdf, renderPage } from '@/lib/pdf';
import { baseName } from '@/lib/util';
import { toolBySlug } from '../registry';

type P = { index: number; thumb: string; rotate: number; removed: boolean };

export default function PdfOrganize() {
  const tool = toolBySlug('pdf-organize')!;
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<P[]>([]);
  const load = useJob<null>();
  const job = useJob<{ blob: Blob; n: number }>();
  const pick = (f: File) => {
    setFile(f);
    job.reset();
    void load.run(async ({ progress }) => {
      const doc = await openPdf(await f.arrayBuffer());
      const list: P[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        progress(i / doc.numPages, `Drawing page ${i} of ${doc.numPages}`);
        const c = await renderPage(doc, i, 0.35);
        list.push({ index: i - 1, thumb: c.toDataURL('image/jpeg', 0.7), rotate: 0, removed: false });
      }
      setPages(list);
      return null;
    }, 'Opening the PDF');
  };
  const update = (i: number, f: (p: P) => P) => {
    setPages((ps) => ps.map((p, j) => (j === i ? f(p) : p)));
    job.reset();
  };
  const move = (i: number, d: number) => {
    setPages((ps) => {
      const n = [...ps];
      const [x] = n.splice(i, 1);
      n.splice(i + d, 0, x);
      return n;
    });
    job.reset();
  };
  const run = () =>
    file &&
    job.run(async () => {
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const keep = pages.filter((p) => !p.removed);
      const copied = await out.copyPages(src, keep.map((p) => p.index));
      copied.forEach((pg, k) => {
        pg.setRotation(degrees((pg.getRotation().angle + keep[k].rotate) % 360));
        out.addPage(pg);
      });
      return { blob: new Blob([(await out.save()) as BlobPart], { type: 'application/pdf' }), n: keep.length };
    }, 'Saving');
  const out = job.state.status === 'done' ? job.state.result : null;
  const kept = pages.filter((p) => !p.removed).length;
  return (
    <ToolFrame
      tool={tool}
      wide
      options={
        <>
          <p className="m-0 muted">Rotate, move or remove pages. Nothing changes until you save.</p>
          <p className="m-0">
            <strong className="readout">{kept}</strong> of {pages.length} pages kept
          </p>
          <button type="button" className="btn btn-lg" disabled={!file || !kept || job.state.status === 'running'} onClick={run}>
            Save the PDF
          </button>
        </>
      }
    >
      {!file ? <DropZone accept="application/pdf,.pdf" onFiles={(f) => pick(f[0])} hint="One PDF. Pages are drawn on this device." /> : <FileChip file={file} onClear={() => (setFile(null), setPages([]))} />}
      <JobStatus state={load.state} />
      {pages.length > 0 && (
        <ul className="thumbs" aria-label="Pages">
          {pages.map((p, i) => (
            <li key={p.index} className={p.removed ? 'thumb thumb-off' : 'thumb'}>
              <img src={p.thumb} alt={`Page ${p.index + 1}`} style={{ transform: `rotate(${p.rotate}deg)` }} />
              <div className="flex items-center justify-between">
                <span className="small readout">Page {p.index + 1}</span>
                <span className="flex">
                  <button type="button" className="icon-btn" aria-label={`Move page ${p.index + 1} earlier`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowLeft size={15} />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Move page ${p.index + 1} later`} disabled={i === pages.length - 1} onClick={() => move(i, 1)}>
                    <ArrowRight size={15} />
                  </button>
                </span>
              </div>
              <div className="flex justify-between">
                <button type="button" className="icon-btn" aria-label={`Rotate page ${p.index + 1}`} onClick={() => update(i, (x) => ({ ...x, rotate: (x.rotate + 90) % 360 }))}>
                  <RotateCw size={15} />
                </button>
                <button type="button" className="icon-btn" aria-label={p.removed ? `Keep page ${p.index + 1}` : `Remove page ${p.index + 1}`} onClick={() => update(i, (x) => ({ ...x, removed: !x.removed }))}>
                  {p.removed ? <Undo2 size={15} /> : <Trash2 size={15} />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <JobStatus state={job.state} onRetry={run} />
      {out && file && <ResultActions blob={out.blob} filename={`${baseName(file.name)}-organised.pdf`} tool="pdf-organize" note={`${out.n} pages`} />}
    </ToolFrame>
  );
}
