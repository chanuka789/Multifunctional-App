import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Bold, ChevronLeft, ChevronRight, Copy, Download, Heading1, Heading2, Pilcrow, X } from 'lucide-react';
import { ToolFrame } from '@/components/ToolFrame';
import { DropZone } from '@/components/DropZone';
import { JobStatus } from '@/components/JobStatus';
import { Toggle } from '@/components/Toggle';
import { ShareButton } from '@/components/ShareButton';
import { useJob } from '@/hooks/useJob';
import { createOcr, ocrCanvas, pdfHasText, pdfTextPage } from '@/lib/ocr/engine';
import { buildPage, pagesToText } from '@/lib/ocr/layout';
import { pageHtml, readPage } from '@/lib/ocr/html';
import { pagesToDocx } from '@/lib/ocr/docx';
import { buildSearchablePdf, type SearchablePage } from '@/lib/ocr/searchable';
import { MORE, PINNED, fromWord, langName } from '@/lib/ocr/languages';
import { fileToCanvas, openPdf, renderPage } from '@/lib/pdf';
import type { Box, DocPage } from '@/lib/ocr/types';
import { baseName, downloadBlob, formatBytes } from '@/lib/util';
import { toolBySlug } from '../registry';

interface OcrResult {
  pages: DocPage[];
  previews: string[];
  searchable: SearchablePage[];
  usedTextLayer: number;
  confidence: number | null;
}

const MAX_SIDE = 3300; // about 300 dpi on A4

function cropper(canvas: HTMLCanvasElement) {
  return (b: Box) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(b.x1 - b.x0));
    c.height = Math.max(1, Math.round(b.y1 - b.y0));
    c.getContext('2d')!.drawImage(canvas, b.x0, b.y0, c.width, c.height, 0, 0, c.width, c.height);
    // keep pictures light: at most 1400 px wide
    if (c.width > 1400) {
      const s = 1400 / c.width;
      const d = document.createElement('canvas');
      d.width = 1400;
      d.height = Math.round(c.height * s);
      d.getContext('2d')!.drawImage(c, 0, 0, d.width, d.height);
      return d.toDataURL('image/png');
    }
    return c.toDataURL('image/png');
  };
}

function preview(canvas: HTMLCanvasElement) {
  const s = Math.min(1, 1100 / canvas.width);
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * s);
  c.height = Math.round(canvas.height * s);
  c.getContext('2d')!.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

export default function Ocr() {
  const tool = toolBySlug('ocr')!;
  const [params] = useSearchParams();
  const [langs, setLangs] = useState<string[]>(() => {
    const l = params.get('lang');
    const code = l ? fromWord(l) : undefined;
    return code && code !== 'eng' ? ['eng', code] : ['eng'];
  });
  const [useTextLayer, setUseTextLayer] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const job = useJob<OcrResult>();
  const result = job.state.status === 'done' ? job.state.result : null;

  const toggleLang = (code: string) => setLangs((l) => (l.includes(code) ? (l.length > 1 ? l.filter((x) => x !== code) : l) : [...l, code]));

  const run = () =>
    job.run(async ({ progress, signal }) => {
      const pages: DocPage[] = [];
      const previews: string[] = [];
      const searchable: SearchablePage[] = [];
      let usedTextLayer = 0;
      const confs: number[] = [];
      let worker: Awaited<ReturnType<typeof createOcr>> | null = null;
      const getWorker = async () => (worker ??= await createOcr(langs, (v, l) => progress(v, l)));
      // Work out how many pages there are for the progress bar.
      type Src = { file: File; pdf?: Awaited<ReturnType<typeof openPdf>>; bytes?: Uint8Array; n: number };
      const srcs: Src[] = [];
      for (const f of files) {
        if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
          const bytes = new Uint8Array(await f.arrayBuffer());
          const pdf = await openPdf(bytes.slice());
          srcs.push({ file: f, pdf, bytes, n: pdf.numPages });
        } else srcs.push({ file: f, n: 1 });
      }
      const total = srcs.reduce((a, s) => a + s.n, 0);
      let done = 0;
      try {
        for (const s of srcs) {
          for (let i = 1; i <= s.n; i++) {
            if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
            const label = total > 1 ? `Page ${done + 1} of ${total}` : 'Reading the page';
            progress(done / total, label);
            if (s.pdf) {
              const vp = (await s.pdf.getPage(i)).getViewport({ scale: 1 });
              const scale = Math.min(300 / 72, MAX_SIDE / Math.max(vp.width, vp.height));
              const canvas = await renderPage(s.pdf, i, scale);
              if (useTextLayer && (await pdfHasText(s.pdf, i))) {
                const raw = await pdfTextPage(s.pdf, i, canvas, scale);
                const page = buildPage(raw, cropper(canvas));
                pages.push({ ...page, widthPt: vp.width, heightPt: vp.height });
                searchable.push({ kind: 'copy', source: s.bytes!, index: i - 1 });
                usedTextLayer++;
              } else {
                const w = await getWorker();
                progress(done / total, `${label}: reading the text`);
                const r = await ocrCanvas(w, canvas);
                confs.push(r.confidence);
                const page = buildPage(r.raw, cropper(r.canvas));
                pages.push({ ...page, widthPt: vp.width, heightPt: vp.height });
                searchable.push({ kind: 'ocr', canvas: r.canvas, textPdf: r.textPdf, widthPt: vp.width, heightPt: vp.height });
              }
              previews.push(preview(canvas));
            } else {
              const canvas = await fileToCanvas(s.file, MAX_SIDE);
              const w = await getWorker();
              progress(done / total, `${label}: reading the text`);
              const r = await ocrCanvas(w, canvas);
              confs.push(r.confidence);
              const page = buildPage(r.raw, cropper(r.canvas));
              pages.push(page);
              searchable.push({ kind: 'ocr', canvas: r.canvas, textPdf: r.textPdf, widthPt: page.widthPt, heightPt: page.heightPt });
              previews.push(preview(r.canvas));
            }
            done++;
          }
        }
      } finally {
        await (worker as Awaited<ReturnType<typeof createOcr>> | null)?.terminate();
      }
      progress(1, 'Rebuilding the layout');
      return { pages, previews, searchable, usedTextLayer, confidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null };
    }, 'Preparing');

  const busy = job.state.status === 'running';
  return (
    <ToolFrame
      tool={tool}
      wide
      options={
        <>
          <div className="field">
            <span className="field-label" id="ocr-langs">
              Languages in the document
            </span>
            <div className="seg" role="group" aria-labelledby="ocr-langs">
              {PINNED.map((l) => (
                <button key={l.code} type="button" aria-pressed={langs.includes(l.code)} onClick={() => toggleLang(l.code)}>
                  {l.name}
                </button>
              ))}
            </div>
            <select
              className="select"
              aria-label="Add another language"
              value=""
              onChange={(e) => {
                if (e.target.value) toggleLang(e.target.value);
              }}
            >
              <option value="">Add another language…</option>
              {MORE.filter((l) => !langs.includes(l.code)).map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              {langs
                .filter((c) => !PINNED.some((p) => p.code === c))
                .map((c) => (
                  <button key={c} type="button" className="pill" onClick={() => toggleLang(c)} aria-label={`Remove ${langName(c)}`}>
                    {langName(c)} <X size={12} />
                  </button>
                ))}
            </div>
            <span className="field-hint">Pick every language on the page. Each one downloads once (1–15 MB) and is kept for next time.</span>
          </div>
          <Toggle
            label="Use a PDF's own text"
            description="Exact and fast for PDFs made on a computer. Scanned pages are still read with OCR."
            checked={useTextLayer}
            onChange={setUseTextLayer}
          />
          <button type="button" className="btn btn-lg" disabled={!files.length || busy} onClick={run}>
            Read {files.length > 1 ? `${files.length} files` : 'the document'}
          </button>
        </>
      }
    >
      {!result && (
        <>
          <DropZone
            accept="image/*,application/pdf,.pdf"
            multiple
            compact={files.length > 0}
            onFiles={(f) => {
              setFiles((x) => [...x, ...f]);
              job.reset();
            }}
            hint="Photos, scans or PDFs. Add several images to make one document. Best results at 300 dpi, page flat and well lit."
          />
          {files.length > 0 && (
            <ul className="rows" aria-label="Files to read">
              {files.map((f, i) => (
                <li key={f.name + i} className="row">
                  <span className="row-name">{f.name}</span>
                  <span className="small muted">{formatBytes(f.size)}</span>
                  <button type="button" className="icon-btn" aria-label={`Remove ${f.name}`} disabled={busy} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <JobStatus state={job.state} onCancel={job.cancel} onRetry={run} />
      {result && (
        <Review
          result={result}
          name={baseName(files[0]?.name ?? 'document')}
          onRestart={() => {
            setFiles([]);
            job.reset();
          }}
        />
      )}
    </ToolFrame>
  );
}

function Review({ result, name, onRestart }: { result: OcrResult; name: string; onRestart: () => void }) {
  const [page, setPage] = useState(0);
  const editors = useRef<(HTMLDivElement | null)[]>([]);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [docx, setDocx] = useState<Blob | null>(null);
  const html = useMemo(() => result.pages.map(pageHtml), [result]);
  const n = result.pages.length;
  const lowCount = useMemo(() => html.reduce((a, h) => a + (h.match(/class="low"/g)?.length ?? 0), 0), [html]);

  const current = (): DocPage[] => result.pages.map((p, i) => (editors.current[i] ? readPage(editors.current[i]!, p) : p));

  useEffect(() => {
    editors.current.forEach((el, i) => {
      if (el && !el.dataset.ready) {
        el.innerHTML = html[i];
        el.dataset.ready = '1';
      }
    });
  }, [html]);

  const exportDocx = async () => {
    setBusy('docx');
    try {
      const blob = await pagesToDocx(current(), name);
      setDocx(blob);
      downloadBlob(blob, `${name}.docx`);
    } finally {
      setBusy(null);
    }
  };
  const exportPdf = async () => {
    setBusy('pdf');
    try {
      downloadBlob(await buildSearchablePdf(result.searchable, name), `${name}-searchable.pdf`);
    } finally {
      setBusy(null);
    }
  };
  const exec = (cmd: string, val?: string) => document.execCommand(cmd, false, val);

  return (
    <div className="grid gap-5">
      <dl className="stats">
        <div>
          <dt>Pages</dt>
          <dd>{n}</dd>
        </div>
        {result.confidence != null && (
          <div>
            <dt>OCR confidence</dt>
            <dd>{Math.round(result.confidence)}%</dd>
          </div>
        )}
        <div>
          <dt>Words to check</dt>
          <dd>{lowCount}</dd>
        </div>
        {result.usedTextLayer > 0 && (
          <div>
            <dt>Read from PDF text</dt>
            <dd>
              {result.usedTextLayer} of {n}
            </dd>
          </div>
        )}
      </dl>

      <div className="result-actions">
        <div className="grid gap-2">
          <button type="button" className="btn btn-accent btn-lg" onClick={exportDocx} disabled={!!busy}>
            <Download size={20} /> {busy === 'docx' ? 'Building…' : 'Word document (DOCX)'}
          </button>
          <span className="small muted">Editable, with headings, columns, tables and pictures rebuilt. Includes your edits.</span>
        </div>
        <div className="grid gap-2">
          <button type="button" className="btn btn-lg" onClick={exportPdf} disabled={!!busy}>
            <Download size={20} /> {busy === 'pdf' ? 'Building…' : 'Searchable PDF'}
          </button>
          <span className="small muted">Looks exactly like the original, with text you can search and copy.</span>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => downloadBlob(new Blob([pagesToText(current())], { type: 'text/plain' }), `${name}.txt`)}>
            TXT
          </button>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => downloadBlob(new Blob([pagesToText(current(), true)], { type: 'text/markdown' }), `${name}.md`)}>
            Markdown
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() =>
              downloadBlob(
                new Blob([`<!doctype html><meta charset="utf-8"><title>${name}</title><body style="font-family:Calibri,Arial,sans-serif;max-width:800px;margin:40px auto">${editors.current.map((e) => e?.innerHTML ?? '').join('<hr>')}</body>`], { type: 'text/html' }),
                `${name}.html`,
              )
            }
          >
            HTML
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              await navigator.clipboard.writeText(pagesToText(current()));
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Copy size={16} /> {copied ? 'Copied' : 'Copy all text'}
          </button>
        </div>
        {docx && <ShareButton blob={docx} filename={`${name}.docx`} tool="ocr" />}
      </div>

      <div className="review" data-ui>
        <div className="review-bar">
          <div className="flex items-center gap-1">
            <button type="button" className="icon-btn" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={18} />
            </button>
            <span className="readout small">
              Page {page + 1} of {n}
            </span>
            <button type="button" className="icon-btn" aria-label="Next page" disabled={page === n - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="flex items-center gap-1" role="toolbar" aria-label="Formatting">
            <button type="button" className="icon-btn" aria-label="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}>
              <Bold size={16} />
            </button>
            <button type="button" className="icon-btn" aria-label="Heading 1" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('formatBlock', 'h1')}>
              <Heading1 size={16} />
            </button>
            <button type="button" className="icon-btn" aria-label="Heading 2" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('formatBlock', 'h2')}>
              <Heading2 size={16} />
            </button>
            <button type="button" className="icon-btn" aria-label="Normal text" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('formatBlock', 'p')}>
              <Pilcrow size={16} />
            </button>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRestart}>
            Start again
          </button>
        </div>
        {result.pages.map((p, i) => (
          <div key={i} className="review-pair" hidden={i !== page}>
            <figure className="review-original">
              <img src={result.previews[i]} alt={`Original page ${i + 1}`} />
              <figcaption className="small muted">Original</figcaption>
            </figure>
            <div className="review-doc-wrap">
              <ZoomToFit widthPt={p.widthPt}>
                <div
                  className="review-doc"
                  style={{ width: `${p.widthPt}pt`, minHeight: `${p.heightPt}pt`, padding: `${p.margin.top}pt ${p.margin.right}pt ${p.margin.bottom}pt ${p.margin.left}pt` }}
                >
                  <div
                    ref={(el) => {
                      editors.current[i] = el;
                    }}
                    className="doc-content"
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck
                    aria-label={`Recognised text, page ${i + 1}. You can edit it.`}
                  />
                </div>
              </ZoomToFit>
              <p className="small muted m-0">Words with a yellow mark are uncertain. Click and type to fix anything.</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shows a page at its true point size, scaled down to fit the column. */
function ZoomToFit({ widthPt, children }: { widthPt: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setZoom(Math.min(1.25, el.clientWidth / ((widthPt * 96) / 72))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [widthPt]);
  return (
    <div ref={box} className="zoom-box">
      <div style={{ zoom }}>{children}</div>
    </div>
  );
}
