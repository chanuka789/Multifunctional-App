import type { PDFDocumentProxy } from 'pdfjs-dist';

let lib: Promise<typeof import('pdfjs-dist')> | null = null;
export function pdfjs() {
  lib ??= (async () => {
    const m = await import('pdfjs-dist');
    m.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    return m;
  })();
  return lib;
}

export async function openPdf(data: ArrayBuffer | Uint8Array): Promise<PDFDocumentProxy> {
  const m = await pdfjs();
  return m.getDocument({
    data: data instanceof Uint8Array ? data : new Uint8Array(data),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/standard_fonts/',
  }).promise;
}

/** Render one page (1-based) to a canvas at the given scale (1 = 72 dpi). */
export async function renderPage(doc: PDFDocumentProxy, pageNo: number, scale: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNo);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp, canvas } as any).promise;
  page.cleanup();
  return canvas;
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/png', quality?: number) {
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode image'))), type, quality));
}

export async function fileToCanvas(file: Blob, maxSide = 4200): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}
