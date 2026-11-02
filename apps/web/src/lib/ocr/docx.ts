import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
  type IParagraphOptions,
} from 'docx';
import type { Align, DocNode, DocPage, ParaNode, Run } from './types';
import { joinLines } from './layout';

const TW = 20; // twips per point
const ALIGN: Record<Align, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};
const HEADING = { h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3 } as const;

function textRuns(runs: Run[], sizePt: number, breakBefore = false): TextRun[] {
  return runs.map(
    (r, i) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italic,
        color: r.color?.slice(1),
        size: Math.round(sizePt * 2),
        break: breakBefore && i === 0 ? 1 : undefined,
      }),
  );
}

function para(n: ParaNode): Paragraph {
  const children: TextRun[] = n.keepBreaks ? n.lines.flatMap((l, i) => textRuns(l, n.fontPt, i > 0)) : textRuns(joinLines(n.lines), n.fontPt);
  const opts: { -readonly [K in keyof IParagraphOptions]: IParagraphOptions[K] } = {
    children,
    alignment: ALIGN[n.align],
    spacing: { before: Math.round(Math.min(n.spaceBeforePt, 72) * TW), after: 0, line: 276 },
    indent: n.list ? undefined : { left: Math.round(n.leftPt * TW), firstLine: n.firstLinePt ? Math.round(n.firstLinePt * TW) : undefined },
    heading: n.role === 'h1' || n.role === 'h2' || n.role === 'h3' ? HEADING[n.role] : undefined,
    numbering: n.list === 'bullet' ? { reference: 'ondevo-bullets', level: 0 } : undefined,
  };
  if (n.list === 'number') opts.indent = { left: Math.round((n.leftPt + 18) * TW), hanging: 18 * TW };
  return new Paragraph(opts);
}

function dataUrlBytes(url: string): Uint8Array {
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

function nodes(list: DocNode[], maxWidthPt: number): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const n of list) {
    if (n.type === 'para') out.push(para(n));
    else if (n.type === 'image') {
      const ratio = Math.min(1, maxWidthPt / n.widthPt);
      out.push(
        new Paragraph({
          alignment: ALIGN[n.align],
          spacing: { before: Math.round(Math.min(n.spaceBeforePt, 72) * TW) },
          children: [
            new ImageRun({
              type: 'png',
              data: dataUrlBytes(n.dataUrl),
              // docx sizes images in pixels at 96 dpi
              transformation: { width: Math.round(n.widthPt * ratio * (96 / 72)), height: Math.round(n.heightPt * ratio * (96 / 72)) },
            }),
          ],
        }),
      );
    } else if (n.type === 'table') {
      const total = n.colWidthsPt.reduce((a, b) => a + b, 0);
      const k = Math.min(1, maxWidthPt / total);
      if (n.spaceBeforePt > 4) out.push(new Paragraph({ spacing: { before: Math.round(Math.min(n.spaceBeforePt, 72) * TW) - 240, after: 0 }, children: [] }));
      out.push(
        new Table({
          columnWidths: n.colWidthsPt.map((w) => Math.round(w * k * TW)),
          width: { size: Math.round(total * k * TW), type: WidthType.DXA },
          rows: n.rows.map(
            (r) =>
              new TableRow({
                height: { value: Math.round(r.heightPt * TW), rule: 'atLeast' as any },
                children: (() => {
                  let c = 0;
                  return r.cells.map((cell) => {
                    const w = n.colWidthsPt.slice(c, c + cell.span).reduce((a, b) => a + b, 0) * k;
                    c += cell.span;
                    return new TableCell({
                      columnSpan: cell.span > 1 ? cell.span : undefined,
                      width: { size: Math.round(w * TW), type: WidthType.DXA },
                      margins: { top: 40, bottom: 40, left: 80, right: 80 },
                      children: cell.paras.length ? cell.paras.map(para) : [new Paragraph('')],
                    });
                  });
                })(),
              }),
          ),
        }),
      );
    } else {
      // Columns: a borderless table keeps each column's text exactly where it was.
      const widths = n.cols.map((c) => c.widthPt);
      const total = widths.reduce((a, b) => a + b, 0) + n.gapPt * (n.cols.length - 1);
      const k = Math.min(1, maxWidthPt / total);
      const cells: TableCell[] = [];
      n.cols.forEach((c, i) => {
        cells.push(
          new TableCell({
            width: { size: Math.round(c.widthPt * k * TW), type: WidthType.DXA },
            borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: (() => {
              const inner = nodes(c.nodes, c.widthPt * k);
              return inner.length ? inner : [new Paragraph('')];
            })(),
          }),
        );
        if (i < n.cols.length - 1)
          cells.push(new TableCell({ width: { size: Math.round(n.gapPt * k * TW), type: WidthType.DXA }, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, children: [new Paragraph('')] }));
      });
      if (n.spaceBeforePt > 2) out.push(new Paragraph({ spacing: { before: Math.round(Math.min(n.spaceBeforePt, 72) * TW), after: 0 }, children: [] }));
      out.push(
        new Table({
          borders: NO_BORDERS,
          width: { size: Math.round(total * k * TW), type: WidthType.DXA },
          columnWidths: cells.map((_, i) => Math.round((i % 2 === 0 ? n.cols[i / 2].widthPt : n.gapPt) * k * TW)),
          rows: [new TableRow({ children: cells })],
        }),
      );
    }
  }
  return out;
}

export async function pagesToDocx(pages: DocPage[], title: string): Promise<Blob> {
  const body = pages[0]?.nodes.find((n) => n.type === 'para' && n.role === 'p') as ParaNode | undefined;
  const bodyPt = body?.fontPt ?? 11;
  const sections: ISectionOptions[] = pages.map((p) => ({
    properties: {
      page: {
        size: { width: Math.round(p.widthPt * TW), height: Math.round(p.heightPt * TW) },
        margin: { top: Math.round(p.margin.top * TW), right: Math.round(p.margin.right * TW), bottom: Math.round(p.margin.bottom * TW), left: Math.round(p.margin.left * TW) },
      },
    },
    children: (() => {
      const c = nodes(p.nodes, p.widthPt - p.margin.left - p.margin.right);
      return c.length ? c : [new Paragraph('')];
    })(),
  }));
  const doc = new Document({
    title,
    creator: 'Ondevo',
    description: 'Made with Ondevo Document OCR, on the device.',
    styles: {
      default: { document: { run: { font: 'Calibri', size: Math.round(bodyPt * 2) } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { bold: true, color: '000000' }, paragraph: { spacing: { after: 60 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { bold: true, color: '000000' }, paragraph: { spacing: { after: 40 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', run: { bold: true, color: '000000' } },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'ondevo-bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
        },
      ],
    },
    sections,
  });
  return Packer.toBlob(doc);
}
