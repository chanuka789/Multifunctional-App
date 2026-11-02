import type { PDFDocumentProxy } from 'pdfjs-dist';
import type Tesseract from 'tesseract.js';
import { binarize, detectPictures, detectTables, markBold, otsu, sampleColor, toGray, uncoveredText, type Pixels } from './image';
import type { Box, OcrLine, OcrPara, OcrWord, RawPage } from './types';
import { pdfjs } from '../pdf';

export type OcrProgress = (v: number | null, label: string) => void;

/** Start one Tesseract worker for the chosen languages (data comes from the public CDN, cached after). */
export async function createOcr(langs: string[], onProgress?: OcrProgress) {
  const { createWorker } = await import('tesseract.js');
  let phase = '';
  const worker = await createWorker(langs, 1, {
    logger: (m: Tesseract.LoggerMessage) => {
      if (m.status.includes('loading language')) phase = 'Downloading language data (one time)';
      else if (m.status.includes('initializ')) phase = 'Starting the OCR engine';
      else if (m.status.includes('recognizing')) phase = 'Reading the text';
      else return;
      onProgress?.(m.progress, phase);
    },
  });
  await worker.setParameters({ user_defined_dpi: '300', preserve_interword_spaces: '0' });
  return worker;
}

function bboxOf(b: Tesseract.Bbox): Box {
  return { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 };
}

type Reader = (box: Box, psm: '6' | '7') => Promise<OcrWord[]>;

/** An extra invisible text layer for a region read a second time (source pixels). */
export interface TextLayer {
  pdf: Uint8Array;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Group loose words into lines (same baseline band, left to right). */
function wordsToLines(words: OcrWord[]): OcrLine[] {
  const sorted = [...words].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const lines: OcrLine[] = [];
  for (const w of sorted) {
    const cy = (w.y0 + w.y1) / 2;
    const l = lines.find((ln) => cy > ln.y0 && cy < ln.y1 && w.x0 - ln.x1 < (w.y1 - w.y0) * 3);
    if (l) {
      l.words.push(w);
      l.x0 = Math.min(l.x0, w.x0);
      l.x1 = Math.max(l.x1, w.x1);
      l.y0 = Math.min(l.y0, w.y0);
      l.y1 = Math.max(l.y1, w.y1);
    } else lines.push({ x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1, words: [w] });
  }
  lines.forEach((l) => l.words.sort((a, b) => a.x0 - b.x0));
  return lines;
}

/** Extract words/lines/paragraphs and look at the pixels for tables, bold and colour. */
async function analyse(paras: OcrPara[], images: Box[], canvas: HTMLCanvasElement, read?: Reader): Promise<RawPage> {
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = g.getImageData(0, 0, canvas.width, canvas.height);
  const px: Pixels = { data: img.data, width: img.width, height: img.height };
  const gray = toGray(px);
  const thr = otsu(gray);
  const bin = binarize(gray, thr);
  const tables = detectTables(bin, px.width, px.height);

  if (read) {
    // 1. Table cells: Tesseract often misses text boxed in by rules, so read each cell on its own.
    const cellCount = tables.reduce((n, t) => n + (t.rows.length - 1) * (t.cols.length - 1), 0);
    if (cellCount && cellCount <= 240) {
      const inTable = (w: Box) => tables.some((t) => (w.x0 + w.x1) / 2 > t.x0 && (w.x0 + w.x1) / 2 < t.x1 && (w.y0 + w.y1) / 2 > t.y0 && (w.y0 + w.y1) / 2 < t.y1);
      for (const p of paras) for (const l of p.lines) l.words = l.words.filter((w) => !inTable(w));
      const cellWords: OcrWord[] = [];
      for (const t of tables)
        for (let r = 0; r < t.rows.length - 1; r++)
          for (let c = 0; c < t.cols.length - 1; c++) {
            const span = t.spans[r]?.[c] ?? 1;
            if (!span) continue;
            const box = { x0: t.cols[c] + 5, x1: t.cols[c + span] - 5, y0: t.rows[r] + 5, y1: t.rows[r + 1] - 5 };
            if (box.x1 - box.x0 < 8 || box.y1 - box.y0 < 8) continue;
            cellWords.push(...(await read(box, '6')));
          }
      if (cellWords.length) paras.push(...wordsToLines(cellWords).map((l) => ({ ...l, lines: [l] })));
      for (const p of paras) p.lines = p.lines.filter((l) => l.words.length);
    }
    // 2. Ink nobody read: very large titles, light or bold text. Read those regions again.
    const covered = paras.flatMap((p) => p.lines.flatMap((l) => l.words));
    const regions = uncoveredText(bin, px.width, px.height, covered, [...tables, ...images]).slice(0, 40);
    const found: OcrWord[] = [];
    for (const r of regions) {
      const words = (await read(r, r.y1 - r.y0 < 260 ? '7' : '6')).filter((w) => w.conf >= 55 && /[\p{L}\p{N}]/u.test(w.text));
      found.push(...words);
    }
    if (found.length) paras.push(...wordsToLines(found).map((l) => ({ ...l, lines: [l] })));
  }

  const words = paras.flatMap((p) => p.lines.flatMap((l) => l.words));
  markBold(words, bin, px.width);
  for (const p of paras)
    for (const l of p.lines) {
      const c = sampleColor(px, gray, thr, l);
      if (c) l.words.forEach((w) => (w.color = sampleColor(px, gray, thr, w) ?? c));
    }
  const textBoxes = paras.flatMap((p) => p.lines);
  const pictures = images.length ? images : detectPictures(gray, px.width, px.height, textBoxes, tables);
  return { width: px.width, height: px.height, paras: paras.filter((p) => p.lines.length), images: pictures, tables };
}

/** Read one region again, scaled so its text sits near the size Tesseract reads best. */
function regionReader(worker: Tesseract.Worker, canvas: HTMLCanvasElement, layers: TextLayer[]): Reader {
  return async (box, psm) => {
    const bw = Math.round(box.x1 - box.x0), bh = Math.round(box.y1 - box.y0);
    // single lines: aim for about 48 px tall text; blocks keep their scale
    const s = psm === '7' ? Math.max(0.25, Math.min(2.5, 64 / bh)) : bh < 40 ? 2 : 1;
    const pad = 16;
    const c = document.createElement('canvas');
    c.width = Math.round(bw * s) + pad * 2;
    c.height = Math.round(bh * s) + pad * 2;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.imageSmoothingQuality = 'high';
    g.drawImage(canvas, box.x0, box.y0, bw, bh, pad, pad, bw * s, bh * s);
    await worker.setParameters({ tessedit_pageseg_mode: psm as any });
    try {
      const { data } = await worker.recognize(c, { pdfTextOnly: true }, { blocks: true, text: false, pdf: true } as any);
      const out: OcrWord[] = [];
      for (const b of data.blocks ?? [])
        for (const p of b.paragraphs)
          for (const l of p.lines)
            for (const w of l.words) {
              if (!w.text.trim()) continue;
              out.push({
                text: w.text.trim(),
                conf: w.confidence,
                x0: box.x0 + (w.bbox.x0 - pad) / s,
                x1: box.x0 + (w.bbox.x1 - pad) / s,
                y0: box.y0 + (w.bbox.y0 - pad) / s,
                y1: box.y0 + (w.bbox.y1 - pad) / s,
              });
            }
      if (data.pdf && out.some((w) => w.conf >= 55)) layers.push({ pdf: new Uint8Array(data.pdf), x: box.x0 - pad / s, y: box.y0 - pad / s, w: c.width / s, h: c.height / s });
      return out;
    } finally {
      await worker.setParameters({ tessedit_pageseg_mode: '3' as any });
    }
  };
}

export interface PageResult {
  raw: RawPage;
  /** The page image the boxes refer to (deskewed when Tesseract rotated it). */
  canvas: HTMLCanvasElement;
  /** Text-only PDF page from Tesseract: invisible text placed over the picture. Works for any script. */
  textPdf: Uint8Array | null;
  /** Text layers for regions read again (titles, table cells). */
  layers: TextLayer[];
  confidence: number;
}

async function urlToCanvas(url: string): Promise<HTMLCanvasElement> {
  const im = new Image();
  im.src = url;
  await im.decode();
  const c = document.createElement('canvas');
  c.width = im.naturalWidth;
  c.height = im.naturalHeight;
  c.getContext('2d')!.drawImage(im, 0, 0);
  return c;
}

export async function ocrCanvas(worker: Tesseract.Worker, canvas: HTMLCanvasElement): Promise<PageResult> {
  const { data } = await worker.recognize(canvas, { rotateAuto: true, pdfTextOnly: true }, { blocks: true, pdf: true, imageColor: true, text: false } as any);
  const rotated = data.rotateRadians && Math.abs(data.rotateRadians) > 0.0005 && data.imageColor ? await urlToCanvas(data.imageColor) : canvas;
  const paras: OcrPara[] = [];
  const images: Box[] = [];
  for (const b of data.blocks ?? []) {
    if (/IMAGE/i.test(b.blocktype ?? '')) {
      const box = bboxOf(b.bbox);
      if ((box.x1 - box.x0) * (box.y1 - box.y0) > rotated.width * rotated.height * 0.01) images.push(box);
      continue;
    }
    for (const p of b.paragraphs) {
      const lines: OcrLine[] = [];
      for (const l of p.lines) {
        const words: OcrWord[] = l.words
          .filter((w) => w.text.trim() && !(w.confidence < 20 && w.text.length <= 2 && /^[^\p{L}\p{N}]+$/u.test(w.text)))
          .map((w) => ({ ...bboxOf(w.bbox), text: w.text.trim(), conf: w.confidence }));
        if (words.length) lines.push({ ...bboxOf(l.bbox), words });
      }
      if (lines.length) paras.push({ ...bboxOf(p.bbox), lines });
    }
  }
  const layers: TextLayer[] = [];
  const raw = await analyse(paras, images, rotated, regionReader(worker, rotated, layers));
  return { raw, canvas: rotated, textPdf: data.pdf ? new Uint8Array(data.pdf) : null, layers, confidence: data.confidence };
}

/* ---------- PDFs that already contain text ---------- */

export async function pdfHasText(doc: PDFDocumentProxy, pageNo: number) {
  const page = await doc.getPage(pageNo);
  const tc = await page.getTextContent();
  const chars = tc.items.reduce((n, it) => n + ('str' in it ? it.str.trim().length : 0), 0);
  return chars > 40;
}

/** Read the PDF's own text with positions; render the page for tables and pictures. */
export async function pdfTextPage(doc: PDFDocumentProxy, pageNo: number, canvas: HTMLCanvasElement, scale: number): Promise<RawPage> {
  const { Util } = await pdfjs();
  const page = await doc.getPage(pageNo);
  const vp = page.getViewport({ scale });
  const tc = await page.getTextContent();
  const words: (OcrWord & { base: number; size: number })[] = [];
  for (const it of tc.items) {
    if (!('str' in it) || !it.str.trim()) continue;
    const t = Util.transform(vp.transform, it.transform);
    const size = Math.hypot(t[2], t[3]);
    const x = t[4], base = t[5];
    const width = it.width * scale;
    let bold = false;
    try {
      const f = page.commonObjs.get(it.fontName) as { name?: string; black?: boolean; bold?: boolean } | undefined;
      bold = !!(f && (f.bold || f.black || /bold|black|heavy|semibold|demi/i.test(f.name ?? '')));
    } catch {
      /* font not loaded yet */
    }
    const parts = it.str.split(/(\s+)/);
    const total = it.str.length || 1;
    let off = 0;
    for (const part of parts) {
      const w = (part.length / total) * width;
      if (part.trim()) words.push({ text: part, x0: x + off, x1: x + off + w, y0: base - size * 0.82, y1: base + size * 0.22, conf: 99, bold, base, size });
      off += w;
    }
  }
  // lines: same baseline
  words.sort((a, b) => a.base - b.base || a.x0 - b.x0);
  const lines: (OcrLine & { size: number })[] = [];
  for (const w of words) {
    const l = lines.find((ln) => Math.abs((ln.y1 - ln.size * 0.22) - w.base) < w.size * 0.4 && w.x0 - ln.x1 < w.size * 3 && w.x0 >= ln.x0 - 1);
    if (l) {
      l.words.push(w);
      l.x1 = Math.max(l.x1, w.x1);
      l.y0 = Math.min(l.y0, w.y0);
      l.y1 = Math.max(l.y1, w.y1);
    } else lines.push({ x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1, words: [w], size: w.size });
  }
  lines.forEach((l) => l.words.sort((a, b) => a.x0 - b.x0));
  lines.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  // paragraphs: line directly under another, overlapping horizontally, similar size
  const paras: (OcrPara & { size: number })[] = [];
  for (const l of lines) {
    const p = paras.find((pp) => {
      const last = pp.lines[pp.lines.length - 1];
      const overlap = Math.min(last.x1, l.x1) - Math.max(last.x0, l.x0);
      return l.y0 - last.y1 < l.size * 0.9 && l.y0 >= last.y0 && overlap > Math.min(l.x1 - l.x0, last.x1 - last.x0) * 0.3 && Math.abs(pp.size - l.size) / pp.size < 0.15;
    });
    if (p) {
      p.lines.push(l);
      p.x0 = Math.min(p.x0, l.x0);
      p.x1 = Math.max(p.x1, l.x1);
      p.y1 = Math.max(p.y1, l.y1);
    } else paras.push({ x0: l.x0, x1: l.x1, y0: l.y0, y1: l.y1, lines: [l], size: l.size });
  }
  page.cleanup();
  return analyse(paras, [], canvas);
}
