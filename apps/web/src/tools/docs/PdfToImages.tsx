import { useState } from 'react';
import JSZip from 'jszip';
import { ToolFrame } from '@/components/ToolFrame';
import { DropZone, FileChip } from '@/components/DropZone';
import { JobStatus } from '@/components/JobStatus';
import { ResultActions } from '@/components/ResultActions';
import { Segmented } from '@/components/Segmented';
import { useJob } from '@/hooks/useJob';
import { canvasToBlob, openPdf, renderPage } from '@/lib/pdf';
import { baseName } from '@/lib/util';
import { toolBySlug } from '../registry';

export default function PdfToImages() {
  const tool = toolBySlug('pdf-to-images')!;
  const [file, setFile] = useState<File | null>(null);
  const [fmt, setFmt] = useState<'png' | 'jpeg'>('png');
  const [dpi, setDpi] = useState(150);
  const job = useJob<{ blob: Blob; filename: string; thumbs: string[]; n: number }>();
  const run = () =>
    file &&
    job.run(async ({ progress }) => {
      const doc = await openPdf(await file.arrayBuffer());
      const zip = new JSZip();
      const thumbs: string[] = [];
      const name = baseName(file.name);
      let single: Blob | null = null;
      for (let i = 1; i <= doc.numPages; i++) {
        progress((i - 1) / doc.numPages, `Page ${i} of ${doc.numPages}`);
        const c = await renderPage(doc, i, dpi / 72);
        const b = await canvasToBlob(c, `image/${fmt}`, 0.9);
        if (doc.numPages === 1) single = b;
        zip.file(`${name}-page-${String(i).padStart(3, '0')}.${fmt === 'jpeg' ? 'jpg' : 'png'}`, b);
        if (i <= 12) {
          const t = document.createElement('canvas');
          const s = 220 / c.width;
          t.width = 220;
          t.height = Math.round(c.height * s);
          t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height);
          thumbs.push(t.toDataURL('image/jpeg', 0.7));
        }
      }
      const ext = fmt === 'jpeg' ? 'jpg' : 'png';
      return single
        ? { blob: single, filename: `${name}.${ext}`, thumbs, n: 1 }
        : { blob: await zip.generateAsync({ type: 'blob' }), filename: `${name}-${ext}.zip`, thumbs, n: doc.numPages };
    }, 'Opening the PDF');
  const out = job.state.status === 'done' ? job.state.result : null;
  return (
    <ToolFrame
      tool={tool}
      options={
        <>
          <Segmented label="Format" value={fmt} onChange={(v) => (setFmt(v), job.reset())} options={[{ value: 'png', label: 'PNG', hint: 'Sharp text' }, { value: 'jpeg', label: 'JPG', hint: 'Smaller' }]} />
          <Segmented
            label="Sharpness"
            value={dpi}
            onChange={(v) => (setDpi(v), job.reset())}
            options={[
              { value: 96, label: 'Screen' },
              { value: 150, label: 'Standard' },
              { value: 300, label: 'Print' },
            ]}
            hint={`${dpi} dpi`}
          />
          <button type="button" className="btn btn-lg" disabled={!file || job.state.status === 'running'} onClick={run}>
            Make images
          </button>
        </>
      }
    >
      {!file ? <DropZone accept="application/pdf,.pdf" onFiles={(f) => (setFile(f[0]), job.reset())} hint="One PDF. Pages are drawn on this device." /> : <FileChip file={file} onClear={() => (setFile(null), job.reset())} />}
      <JobStatus state={job.state} onCancel={job.cancel} onRetry={run} />
      {out && (
        <>
          <ul className="thumbs" aria-label="Preview of the first pages">
            {out.thumbs.map((t, i) => (
              <li key={i} className="thumb">
                <img src={t} alt={`Page ${i + 1}`} />
              </li>
            ))}
          </ul>
          <ResultActions blob={out.blob} filename={out.filename} tool="pdf-to-images" note={out.n > 1 ? `${out.n} images in a ZIP` : undefined} />
        </>
      )}
    </ToolFrame>
  );
}
