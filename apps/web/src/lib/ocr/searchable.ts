import { PDFDocument } from 'pdf-lib';
import { canvasToBlob } from '../pdf';

export type SearchablePage =
  | { kind: 'ocr'; canvas: HTMLCanvasElement; textPdf: Uint8Array | null; widthPt: number; heightPt: number }
  | { kind: 'copy'; source: Uint8Array; index: number };

/**
 * Build a PDF that looks exactly like the original: the page picture, with the OCR text
 * placed invisibly on top so it can be searched, selected and copied.
 */
export async function buildSearchablePdf(pages: SearchablePage[], title: string, jpegQuality = 0.82): Promise<Blob> {
  const out = await PDFDocument.create();
  out.setTitle(title);
  out.setCreator('Ondevo Document OCR');
  out.setProducer('Ondevo (runs on your device)');
  const sources = new Map<Uint8Array, PDFDocument>();
  for (const p of pages) {
    if (p.kind === 'copy') {
      if (!sources.has(p.source)) sources.set(p.source, await PDFDocument.load(p.source, { ignoreEncryption: true }));
      const [pg] = await out.copyPages(sources.get(p.source)!, [p.index]);
      out.addPage(pg);
      continue;
    }
    const page = out.addPage([p.widthPt, p.heightPt]);
    const jpg = await out.embedJpg(new Uint8Array(await (await canvasToBlob(p.canvas, 'image/jpeg', jpegQuality)).arrayBuffer()));
    page.drawImage(jpg, { x: 0, y: 0, width: p.widthPt, height: p.heightPt });
    if (p.textPdf) {
      try {
        const [layer] = await out.embedPdf(p.textPdf, [0]);
        page.drawPage(layer, { x: 0, y: 0, width: p.widthPt, height: p.heightPt });
      } catch {
        /* text layer could not be embedded; the page picture is still correct */
      }
    }
  }
  const bytes = await out.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}
