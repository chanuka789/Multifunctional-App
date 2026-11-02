/** Geometry in source pixels, origin top-left. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord extends Box {
  text: string;
  conf: number; // 0..100
  bold?: boolean;
  italic?: boolean;
  color?: string; // #rrggbb when clearly coloured
}

export interface OcrLine extends Box {
  words: OcrWord[];
}

export interface OcrPara extends Box {
  lines: OcrLine[];
}

export interface RawPage {
  width: number;
  height: number;
  paras: OcrPara[];
  /** Picture regions (photos, logos) to crop back in. */
  images: Box[];
  /** Ruled tables found on the page image. */
  tables: TableGrid[];
}

export interface TableGrid extends Box {
  rows: number[]; // y boundaries, sorted, length = nRows + 1
  cols: number[]; // x boundaries, sorted, length = nCols + 1
  /** spans[r][c] = how many grid columns the cell starting at (r,c) covers; 0 = covered by a cell to its left. */
  spans: number[][];
}

/* ---------- Document model (what we export) ---------- */

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  /** Low OCR confidence; highlighted in the review editor. */
  low?: boolean;
}

export type Align = 'left' | 'center' | 'right' | 'justify';

export interface ParaNode {
  type: 'para';
  role: 'p' | 'h1' | 'h2' | 'h3' | 'li';
  list?: 'bullet' | 'number';
  align: Align;
  fontPt: number;
  leftPt: number;
  firstLinePt: number;
  spaceBeforePt: number;
  /** Keep the original line breaks (addresses, poems, short lines). */
  lines: Run[][];
  keepBreaks: boolean;
}

export interface TableNode {
  type: 'table';
  colWidthsPt: number[];
  rows: { heightPt: number; cells: { span: number; paras: ParaNode[] }[] }[];
  spaceBeforePt: number;
}

export interface ImageNode {
  type: 'image';
  dataUrl: string;
  widthPt: number;
  heightPt: number;
  align: Align;
  spaceBeforePt: number;
}

export interface ColumnsNode {
  type: 'columns';
  gapPt: number;
  spaceBeforePt: number;
  cols: { widthPt: number; nodes: DocNode[] }[];
}

export type DocNode = ParaNode | TableNode | ImageNode | ColumnsNode;

export interface DocPage {
  widthPt: number;
  heightPt: number;
  margin: { top: number; right: number; bottom: number; left: number };
  nodes: DocNode[];
}
