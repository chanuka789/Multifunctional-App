import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { ToolFrame } from '@/components/ToolFrame';
import { DropZone, FileChip } from '@/components/DropZone';
import { JobStatus } from '@/components/JobStatus';
import { ResultActions } from '@/components/ResultActions';
import { Segmented } from '@/components/Segmented';
import { useJob } from '@/hooks/useJob';
import { canvasToBlob, openPdf, renderPage } from '@/lib/pdf';
import { baseName, formatBytes } from '@/lib/util';
import { toolBySlug } from '../registry';

const LEVELS = {
  light: { dpi: 150, q: 0.8, label: 'Light' },
  medium: { dpi: 120, q: 0.68, label: 'Medium' },
  strong: { dpi: 96, q: 0.55, label: 'Strong' },
};

export default function PdfCompress() {
  const tool = toolBySlug('pdf-compress')!;
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<keyof typeof LEVELS>('medium');
  const job = useJob<{ blob: Blob; before: number }>();
  const run = () =>
    file &&
    job.run(async ({ progress }) => {
      const { dpi, q } = LEVELS[level];
      const src = await openPdf(await file.arrayBuffer());
      const out = await PDFDocument.create();
      for (let i = 1; i <= src.numPages; i++) {
        progress((i - 1) / src.numPages, `Page ${i} of ${src.numPages}`);
        const pg = await src.getPage(i);
        const vp = pg.getViewport({ scale: 1 });
        const c = await renderPage(src, i, dpi / 72);
        const jpg = await out.embedJpg(new Uint8Array(await (await canvasToBlob(c, 'image/jpeg', q)).arrayBuffer()));
        out.addPage([vp.width, vp.height]).drawImage(jpg, { x: 0, y: 0, width: vp.width, height: vp.height });
      }
      return { blob: new Blob([(await out.save()) as BlobPart], { type: 'application/pdf' }), before: file.size };
    }, 'Compressing');
  const out = job.state.status === 'done' ? job.state.result : null;
  const smaller = out && out.blob.size < out.before;
  return (
    <ToolFrame
      tool={tool}
      options={
        <>
          <Segmented
            label="Compression"
            value={level}
            onChange={(v) => (setLevel(v), job.reset())}
            options={Object.entries(LEVELS).map(([value, l]) => ({ value: value as keyof typeof LEVELS, label: l.label }))}
            hint={`Pages are re-saved as images at ${LEVELS[level].dpi} dpi. Best for scans. Text in the result can no longer be selected; run Document OCR after if you need that.`}
          />
          <button type="button" className="btn btn-lg" disabled={!file || job.state.status === 'running'} onClick={run}>
            Compress
          </button>
        </>
      }
    >
      {!file ? <DropZone accept="application/pdf,.pdf" onFiles={(f) => (setFile(f[0]), job.reset())} hint="One PDF, compressed on this device." /> : <FileChip file={file} onClear={() => (setFile(null), job.reset())} />}
      <JobStatus state={job.state} onCancel={job.cancel} onRetry={run} />
      {out && (
        <>
          <dl className="stats">
            <div>
              <dt>Before</dt>
              <dd>{formatBytes(out.before)}</dd>
            </div>
            <div>
              <dt>After</dt>
              <dd>{formatBytes(out.blob.size)}</dd>
            </div>
            <div>
              <dt>Change</dt>
              <dd>{smaller ? `−${Math.round((1 - out.blob.size / out.before) * 100)}%` : `+${Math.round((out.blob.size / out.before - 1) * 100)}%`}</dd>
            </div>
          </dl>
          {!smaller && <p className="notice m-0"><strong>Not smaller.</strong> This PDF is already compact, mostly text. Keep the original.</p>}
          {smaller && file && <ResultActions blob={out.blob} filename={`${baseName(file.name)}-compressed.pdf`} tool="pdf-compress" />}
        </>
      )}
    </ToolFrame>
  );
}
