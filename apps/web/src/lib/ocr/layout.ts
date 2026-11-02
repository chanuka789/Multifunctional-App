/**
 * Rebuilds a document from OCR boxes: reading order (columns), headings, alignment,
 * indents, lists, spacing, tables and pictures. Pure functions, unit-tested.
 */
import type { Align, Box, DocNode, DocPage, ImageNode, OcrLine, OcrPara, OcrWord, ParaNode, RawPage, Run, TableGrid, TableNode } from './types';

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const W = (b: Box) => b.x1 - b.x0;
const H = (b: Box) => b.y1 - b.y0;
const cx = (b: Box) => (b.x0 + b.x1) / 2;
const cy = (b: Box) => (b.y0 + b.y1) / 2;
const union = (bs: Box[]): Box => ({
  x0: Math.min(...bs.map((b) => b.x0)),
  y0: Math.min(...bs.map((b) => b.y0)),
  x1: Math.max(...bs.map((b) => b.x1)),
  y1: Math.max(...bs.map((b) => b.y1)),
});
const inside = (b: Box, outer: Box, pad = 2) => cx(b) >= outer.x0 - pad && cx(b) <= outer.x1 + pad && cy(b) >= outer.y0 - pad && cy(b) <= outer.y1 + pad;

export const BULLET = /^([•·▪●○◦■□▸►‣⁃–—*-])\s*/u;
export const NUMBERED = /^(\(?(\d{1,3}|[a-zA-Z]|[ivxlcdm]{1,6})[.)])\s+/u;

/** Paper size from the image proportions: A4 unless it is clearly US Letter. */
export function paperFor(w: number, h: number): { widthPt: number; heightPt: number } {
  const r = h / w;
  const landscape = r < 1;
  const rr = landscape ? 1 / r : r;
  const letter = Math.abs(rr - 11 / 8.5) < Math.abs(rr - 297 / 210);
  const [pw, ph] = letter ? [612, 792] : [595.28, 841.89];
  return landscape ? { widthPt: ph, heightPt: pw } : { widthPt: pw, heightPt: ph };
}

type Item =
  | { kind: 'para'; box: Box; para: OcrPara }
  | { kind: 'table'; box: Box; grid: TableGrid; words: OcrWord[] }
  | { kind: 'image'; box: Box };

type Tree = { kind: 'stack'; box: Box; children: Tree[] } | { kind: 'cols'; box: Box; children: Tree[] } | { kind: 'leaf'; box: Box; items: Item[] };

function gaps(intervals: [number, number][], minGap: number): { at: number; size: number }[] {
  const s = [...intervals].sort((a, b) => a[0] - b[0]);
  const cuts: { at: number; size: number }[] = [];
  let end = s[0][1];
  for (let i = 1; i < s.length; i++) {
    if (s[i][0] - end >= minGap) cuts.push({ at: (s[i][0] + end) / 2, size: s[i][0] - end });
    end = Math.max(end, s[i][1]);
  }
  return cuts;
}

function splitAt<T extends { box: Box }>(items: T[], cuts: number[], axis: 'x' | 'y'): T[][] {
  const groups: T[][] = Array.from({ length: cuts.length + 1 }, () => []);
  for (const it of items) {
    const c = axis === 'x' ? cx(it.box) : cy(it.box);
    let k = 0;
    while (k < cuts.length && c > cuts[k]) k++;
    groups[k].push(it);
  }
  return groups.filter((g) => g.length);
}

/**
 * Recursive XY-cut with one guard: inside multi-column text we only cut horizontally
 * around full-width elements, so paragraph gaps that happen to line up across columns
 * do not interleave the columns.
 */
export function xyCut(items: Item[], bodyLineH: number, pageW: number, depth = 0): Tree {
  const box = union(items.map((i) => i.box));
  if (items.length <= 1 || depth > 12) return { kind: 'leaf', box, items };
  const regionW = W(box);
  const minGapY = Math.max(4, bodyLineH * 0.45);
  const minGapX = Math.max(12, Math.min(pageW * 0.02, bodyLineH * 1.2));

  const vCuts = gaps(items.map((i) => [i.box.x0, i.box.x1]), minGapX);
  const wide = items.filter((i) => W(i.box) > regionW * 0.6);
  let hCuts = gaps(items.map((i) => [i.box.y0, i.box.y1]), minGapY);
  if (wide.length && wide.length < items.length) {
    // inside columns, only cut right above or below a wide element
    hCuts = hCuts.filter((c) => wide.some((w) => Math.abs(c.at - w.box.y0) < bodyLineH * 3 || Math.abs(c.at - w.box.y1) < bodyLineH * 3));
  }
  // Choose the axis with the widest whitespace (relative to the text size): a gutter between
  // columns is wide; a gap between paragraphs is narrow; a gap under a title is wide.
  const vBest = Math.max(0, ...vCuts.map((c) => c.size)) / bodyLineH;
  const hBest = Math.max(0, ...hCuts.map((c) => c.size)) / bodyLineH;
  if (vCuts.length && vBest >= hBest) {
    const cols = splitAt(items, vCuts.map((c) => c.at), 'x');
    if (cols.length > 1) return { kind: 'cols', box, children: cols.map((c) => xyCut(c, bodyLineH, pageW, depth + 1)) };
  }
  if (hCuts.length) {
    // cut only at the clearly larger gaps first, so a paragraph gap inside a column waits for its turn
    const big = hCuts.filter((c) => c.size >= Math.max(minGapY, hBest * bodyLineH * 0.85));
    const bands = splitAt(items, (big.length ? big : hCuts).map((c) => c.at), 'y');
    if (bands.length > 1) return { kind: 'stack', box, children: bands.map((b) => xyCut(b, bodyLineH, pageW, depth + 1)) };
  }
  if (vCuts.length) {
    const cols = splitAt(items, vCuts.map((c) => c.at), 'x');
    if (cols.length > 1) return { kind: 'cols', box, children: cols.map((c) => xyCut(c, bodyLineH, pageW, depth + 1)) };
  }
  return { kind: 'leaf', box, items: [...items].sort((a, b) => a.box.y0 - b.box.y0) };
}


/**
 * Tesseract sometimes reads straight across a column gutter, so one "line" holds text from two
 * columns. Split lines at wide gaps, then rebuild paragraphs from line pieces that sit under each other.
 */
export function regroup(paras: OcrPara[]): OcrPara[] {
  type Seg = OcrLine & { tid: number };
  const segs: Seg[] = [];
  paras.forEach((p, tid) =>
    p.lines.forEach((l) => {
      const ws = [...l.words].sort((a, b) => a.x0 - b.x0);
      const lh = median(ws.map(H)) || H(l);
      const gapsW = ws.slice(1).map((w, i) => w.x0 - ws[i].x1);
      const typical = median(gapsW.filter((g) => g > 0 && g < lh * 1.2)) || lh * 0.3;
      let cur: OcrWord[] = [];
      ws.forEach((w, i) => {
        if (i > 0 && gapsW[i - 1] > Math.max(lh * 1.6, typical * 4)) {
          segs.push({ ...union(cur), words: cur, tid });
          cur = [];
        }
        cur.push(w);
      });
      if (cur.length) segs.push({ ...union(cur), words: cur, tid });
    }),
  );
  segs.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const out: (OcrPara & { last: Seg })[] = [];
  for (const sg of segs) {
    const lh = lineHeight(sg);
    let best: (typeof out)[number] | null = null;
    for (const p of out) {
      const last = p.last;
      const gap = sg.y0 - last.y1;
      const overlap = Math.min(last.x1, sg.x1) - Math.max(last.x0, sg.x0);
      const similar = Math.abs(lineHeight(last) - lh) / Math.max(lineHeight(last), lh) < 0.25;
      const limit = last.tid === sg.tid ? lh * 0.9 : lh * 0.35;
      if (gap > -lh * 0.3 && gap < limit && overlap > Math.min(W(sg), W(last)) * 0.3 && similar && sg.y0 > last.y0 + lh * 0.3) best = p;
    }
    if (best) {
      best.lines.push(sg);
      Object.assign(best, union([best, sg]));
      best.last = sg;
    } else out.push({ ...union([sg]), lines: [sg], last: sg });
  }
  return out.map(({ last: _last, ...p }) => p);
}

/** Bullet dots are small; OCR often reads them as "6", "e", "o" or "*". */
export function fixBullets(paras: OcrPara[]) {
  for (const p of paras)
    for (const l of p.lines) {
      const [first, second] = l.words;
      if (!first || !second || first.text.length > 2 || BULLET.test(first.text + ' ')) continue;
      const rest = median(l.words.slice(1).map(H));
      const small = H(first) < rest * 0.62 && W(first) < rest * 0.9;
      if (small && second.x0 - first.x1 > W(first) * 0.6 && !/^\d+[.)]$/.test(first.text)) first.text = '•';
    }
}

/* ---------- Paragraph analysis ---------- */

/** Height from the top of the tallest letter to the bottom of the lowest: about 0.93 em. */
function lineHeight(l: OcrLine) {
  const hs = l.words.map(H).filter((h) => h > 0);
  return hs.length ? Math.max(...hs) : H(l);
}

export function classifyAlign(p: OcrPara, col: Box): Align {
  const lines = p.lines;
  const cw = W(col);
  const lm = lines.map((l) => l.x0 - col.x0);
  const rm = lines.map((l) => col.x1 - l.x1);
  const tol = Math.max(6, cw * 0.025);
  const centred = lines.every((_l, i) => Math.abs(lm[i] - rm[i]) < Math.max(tol * 1.5, cw * 0.06) && lm[i] > cw * 0.06);
  if (centred) return 'center';
  const leftEven = Math.max(...lm) - Math.min(...lm) < tol;
  const rightEven = Math.max(...rm) - Math.min(...rm) < tol;
  if (rightEven && Math.max(...rm) < tol * 1.5 && Math.min(...lm) > cw * 0.4) return 'right';
  if (!leftEven && rightEven && Math.min(...lm) > cw * 0.15) return 'right';
  if (lines.length === 1 && lm[0] > cw * 0.45 && rm[0] < tol) return 'right';
  if (lines.length >= 3) {
    const body = rm.slice(0, -1);
    if (Math.max(...body) - Math.min(...body) < tol && Math.max(...body) < tol * 1.5) return 'justify';
  }
  return 'left';
}

/** Join a paragraph's lines into runs, merging hyphenated line ends. */
function runsForLine(words: OcrWord[]): Run[] {
  const runs: Run[] = [];
  for (const w of words) {
    const low = w.conf < 60;
    const last = runs[runs.length - 1];
    const same = last && !!last.bold === !!w.bold && last.color === w.color && !!last.low === low;
    if (same) last.text += ' ' + w.text;
    else runs.push({ text: (runs.length ? ' ' : '') + w.text, bold: w.bold || undefined, color: w.color, low: low || undefined });
  }
  return runs;
}

export function joinLines(lines: Run[][]): Run[] {
  const out: Run[] = [];
  lines.forEach((runs, i) => {
    if (!runs.length) return;
    const copy = runs.map((r) => ({ ...r }));
    if (i > 0 && out.length) {
      const prev = out[out.length - 1];
      const nextStartsLower = /^\s*\p{Ll}/u.test(copy[0].text);
      if (/[A-Za-z]-$/.test(prev.text) && nextStartsLower) prev.text = prev.text.slice(0, -1);
      else copy[0].text = ' ' + copy[0].text.replace(/^\s+/, '');
    }
    for (const r of copy) {
      const p = out[out.length - 1];
      if (p && !!p.bold === !!r.bold && p.color === r.color && !!p.low === !!r.low && !!p.italic === !!r.italic) p.text += r.text;
      else out.push(r);
    }
  });
  return out;
}

export interface BuildOptions {
  /** Points per source pixel. */
  scale: number;
  bodyLineH: number;
  bodyPt: number;
  headingSizes: number[]; // distinct heading line heights, largest first
}

function quantPt(v: number) {
  return Math.max(6, Math.round(v * 2) / 2);
}

export function paraNode(p: OcrPara, col: Box, prevBottom: number | null, o: BuildOptions): ParaNode {
  const lh = median(p.lines.map(lineHeight));
  const ratio = lh / o.bodyLineH;
  const text = p.lines.map((l) => l.words.map((w) => w.text).join(' ')).join(' ');
  const allBold = p.lines.every((l) => l.words.every((w) => w.bold));
  let role: ParaNode['role'] = 'p';
  if (ratio >= 1.3 && p.lines.length <= 3) {
    const idx = o.headingSizes.findIndex((s) => Math.abs(s - lh) / lh < 0.12);
    role = idx <= 0 ? 'h1' : idx === 1 ? 'h2' : 'h3';
  } else if (allBold && p.lines.length === 1 && text.length < 80 && !/[.,;:]$/.test(text)) role = 'h3';

  const firstWord = p.lines[0]?.words[0]?.text ?? '';
  let list: ParaNode['list'];
  const lines = p.lines.map((l) => runsForLine(l.words));
  if (BULLET.test(firstWord) && role === 'p') {
    list = 'bullet';
    role = 'li';
    const r0 = lines[0][0];
    r0.text = r0.text.replace(BULLET, '');
    if (!r0.text.trim() && lines[0].length > 1) lines[0].shift();
    if (lines[0][0] && !lines[0][0].text.trim()) lines[0].shift();
    if (lines[0][0]) lines[0][0].text = lines[0][0].text.replace(/^\s+/, '');
  } else if (NUMBERED.test(text) && role === 'p' && text.length < 600) {
    list = 'number';
    role = 'li';
  }

  const minX = Math.min(...p.lines.map((l) => l.x0));
  const first = p.lines[0].x0;
  const leftPt = Math.max(0, (minX - col.x0) * o.scale);
  const firstLinePt = p.lines.length > 1 && first - minX > lh * 0.8 ? (first - minX) * o.scale : 0;
  const align = classifyAlign(p, col);
  const avgW = p.lines.reduce((s, l) => s + W(l), 0) / p.lines.length;
  const keepBreaks = role !== 'li' && p.lines.length > 1 && align !== 'justify' && avgW < W(col) * 0.55;
  // Line box height runs about 0.93 em for mixed-case text.
  const fontPt = role === 'p' || role === 'li' ? (ratio > 0.6 && ratio < 1.22 ? o.bodyPt : quantPt(lh * 1.08 * o.scale)) : quantPt(lh * 1.08 * o.scale);
  return {
    type: 'para',
    role,
    list,
    align: role === 'li' ? 'left' : align,
    fontPt,
    leftPt: align === 'center' || align === 'right' ? 0 : leftPt,
    firstLinePt,
    spaceBeforePt: prevBottom == null ? 0 : Math.max(0, (p.y0 - prevBottom) * o.scale - fontPt * 0.25),
    lines,
    keepBreaks,
  };
}

function tableNode(t: TableGrid, words: OcrWord[], o: BuildOptions): TableNode {
  const nR = t.rows.length - 1, nC = t.cols.length - 1;
  const colWidthsPt = Array.from({ length: nC }, (_, c) => (t.cols[c + 1] - t.cols[c]) * o.scale);
  const rows: TableNode['rows'] = [];
  for (let r = 0; r < nR; r++) {
    const cells: TableNode['rows'][number]['cells'] = [];
    for (let c = 0; c < nC; c++) {
      const span = t.spans[r]?.[c] ?? 1;
      if (span === 0) continue;
      const cell: Box = { x0: t.cols[c], x1: t.cols[c + span], y0: t.rows[r], y1: t.rows[r + 1] };
      const ws = words.filter((w) => inside(w, cell, 0)).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
      const lines: OcrLine[] = [];
      for (const w of ws) {
        const l = lines.find((ln) => Math.abs(cy(ln) - cy(w)) < H(w) * 0.6);
        if (l) {
          l.words.push(w);
          Object.assign(l, union([l, w]));
        } else lines.push({ ...w, words: [w] });
      }
      lines.forEach((l) => l.words.sort((a, b) => a.x0 - b.x0));
      lines.sort((a, b) => a.y0 - b.y0);
      const paras = lines.length ? [paraNode({ ...union(lines), lines }, cell, null, o)] : [];
      paras.forEach((p) => {
        if (p.role !== 'li') p.role = 'p';
        p.leftPt = 0;
        p.firstLinePt = 0;
        p.keepBreaks = lines.length > 1;
      });
      cells.push({ span, paras });
    }
    rows.push({ heightPt: (t.rows[r + 1] - t.rows[r]) * o.scale, cells });
  }
  return { type: 'table', colWidthsPt, rows, spaceBeforePt: 0 };
}

/** Turn one OCR'd page into the document model. `crop` gives a data URL for a picture region. */
export function buildPage(raw: RawPage, crop: (b: Box) => string): DocPage {
  raw = { ...raw, paras: regroup(raw.paras) };
  fixBullets(raw.paras);
  const { widthPt, heightPt } = paperFor(raw.width, raw.height);
  const scale = widthPt / raw.width;
  const lineHs = raw.paras.flatMap((p) => p.lines.flatMap((l) => Array(Math.max(1, l.words.length)).fill(lineHeight(l))));
  const bodyLineH = median(lineHs) || 20;
  const bodyPt = Math.min(14, Math.max(8, quantPt(bodyLineH * 1.08 * scale)));
  const headSizes = [...new Set(raw.paras.filter((p) => p.lines.length <= 3).map((p) => median(p.lines.map(lineHeight))).filter((h) => h / bodyLineH >= 1.3))]
    .sort((a, b) => b - a)
    .reduce<number[]>((acc, h) => (acc.some((x) => Math.abs(x - h) / h < 0.12) ? acc : [...acc, h]), []);
  const o: BuildOptions = { scale, bodyLineH, bodyPt, headingSizes: headSizes };

  // Words that fall inside a table belong to the table, not to paragraphs.
  const tableWords = raw.tables.map(() => [] as OcrWord[]);
  const paras: OcrPara[] = [];
  for (const p of raw.paras) {
    const lines: OcrLine[] = [];
    for (const l of p.lines) {
      const keep: OcrWord[] = [];
      for (const w of l.words) {
        const ti = raw.tables.findIndex((t) => inside(w, t));
        if (ti >= 0) tableWords[ti].push(w);
        else keep.push(w);
      }
      if (keep.length) lines.push({ ...union(keep), words: keep });
    }
    if (lines.length) paras.push({ ...union(lines), lines });
  }
  const flatParas = paras.flatMap((p) => splitParaByGaps(p, bodyLineH));

  const items: Item[] = [
    ...flatParas.map((para) => ({ kind: 'para' as const, box: para as Box, para })),
    ...raw.tables.map((grid, i) => ({ kind: 'table' as const, box: grid as Box, grid, words: tableWords[i] })),
    ...raw.images.filter((b) => !raw.tables.some((t) => inside(b, t))).map((b) => ({ kind: 'image' as const, box: b })),
  ];
  if (!items.length) return { widthPt, heightPt, margin: { top: 36, right: 36, bottom: 36, left: 36 }, nodes: [] };

  const content = union(items.map((i) => i.box));
  const margin = {
    top: Math.max(18, content.y0 * scale * 0.9),
    left: Math.max(18, content.x0 * scale),
    right: Math.max(18, (raw.width - content.x1) * scale),
    bottom: Math.max(18, (raw.height - content.y1) * scale * 0.9),
  };
  const tree = xyCut(items, bodyLineH, raw.width);
  const nodes = emit(tree, content, null, o, crop).nodes;
  return { widthPt, heightPt, margin, nodes };
}

/** Tesseract sometimes merges blocks across big gaps; split a paragraph where lines are far apart. */
function splitParaByGaps(p: OcrPara, bodyLineH: number): OcrPara[] {
  const out: OcrLine[][] = [[]];
  p.lines.forEach((l, i) => {
    if (i > 0) {
      const prev = p.lines[i - 1];
      const gap = l.y0 - prev.y1;
      const sizeJump = Math.abs(lineHeight(l) - lineHeight(prev)) / Math.max(lineHeight(l), lineHeight(prev)) > 0.25;
      if (gap > bodyLineH * 0.9 || sizeJump) out.push([]);
    }
    out[out.length - 1].push(l);
  });
  return out.filter((g) => g.length).map((lines) => ({ ...union(lines), lines }));
}

function emit(t: Tree, col: Box, prevBottom: number | null, o: BuildOptions, crop: (b: Box) => string): { nodes: DocNode[]; bottom: number | null } {
  if (t.kind === 'leaf') {
    const nodes: DocNode[] = [];
    let bottom = prevBottom;
    for (const it of t.items) {
      const sp = bottom == null ? 0 : Math.max(0, (it.box.y0 - bottom) * o.scale);
      if (it.kind === 'para') nodes.push(paraNode(it.para, col, bottom, o));
      else if (it.kind === 'table') nodes.push({ ...tableNode(it.grid, it.words, o), spaceBeforePt: sp });
      else {
        const img: ImageNode = {
          type: 'image',
          dataUrl: crop(it.box),
          widthPt: W(it.box) * o.scale,
          heightPt: H(it.box) * o.scale,
          align: Math.abs(it.box.x0 - col.x0 - (col.x1 - it.box.x1)) < W(col) * 0.08 ? 'center' : it.box.x0 - col.x0 > col.x1 - it.box.x1 ? 'right' : 'left',
          spaceBeforePt: sp,
        };
        nodes.push(img);
      }
      bottom = it.box.y1;
    }
    return { nodes, bottom };
  }
  if (t.kind === 'stack') {
    const nodes: DocNode[] = [];
    let bottom = prevBottom;
    for (const c of t.children) {
      const r = emit(c, col, bottom, o, crop);
      nodes.push(...r.nodes);
      bottom = r.bottom;
    }
    return { nodes, bottom };
  }
  // columns: widths from the real column boxes, gaps from the gutters
  const boxes = t.children.map((c) => c.box);
  const cols = t.children.map((c, i) => {
    const colBox = { ...c.box, x0: i === 0 ? Math.min(c.box.x0, col.x0) : c.box.x0 };
    return { widthPt: W(colBox) * o.scale, nodes: emit(c, colBox, null, o, crop).nodes };
  });
  const gapPt = boxes.length > 1 ? ((boxes[1].x0 - boxes[0].x1) * o.scale) : 0;
  return {
    nodes: [{ type: 'columns', gapPt: Math.max(8, gapPt), spaceBeforePt: prevBottom == null ? 0 : Math.max(0, (t.box.y0 - prevBottom) * o.scale), cols }],
    bottom: t.box.y1,
  };
}

/* ---------- Plain exports ---------- */

export function runsText(runs: Run[]) {
  return runs.map((r) => r.text).join('');
}

export function nodeText(n: DocNode, md = false): string {
  if (n.type === 'para') {
    const body = n.keepBreaks ? n.lines.map(runsText).join(md ? '  \n' : '\n') : runsText(joinLines(n.lines));
    if (!md) return n.list === 'bullet' ? `• ${body}` : body;
    const mdBody = n.keepBreaks
      ? n.lines.map((l) => l.map((r) => (r.bold && r.text.trim() ? `**${r.text.trim()}** ` : r.text)).join('')).join('  \n')
      : joinLines(n.lines).map((r) => (r.bold && r.text.trim() ? ` **${r.text.trim()}** ` : r.text)).join('').replace(/\s+/g, ' ').trim();
    if (n.role === 'h1') return `# ${mdBody}`;
    if (n.role === 'h2') return `## ${mdBody}`;
    if (n.role === 'h3') return `### ${mdBody}`;
    if (n.list === 'bullet') return `- ${mdBody}`;
    return mdBody;
  }
  if (n.type === 'table') {
    const rows = n.rows.map((r) => r.cells.map((c) => c.paras.map((p) => nodeText(p)).join(' ').replace(/\n/g, ' ').replace(/\|/g, '\\|')));
    if (!md) return rows.map((r) => r.join('\t')).join('\n');
    const nC = Math.max(...rows.map((r) => r.length));
    const pad = rows.map((r) => [...r, ...Array(nC - r.length).fill('')]);
    return [`| ${pad[0].join(' | ')} |`, `| ${Array(nC).fill('---').join(' | ')} |`, ...pad.slice(1).map((r) => `| ${r.join(' | ')} |`)].join('\n');
  }
  if (n.type === 'image') return md ? '![picture](picture.png)' : '';
  return n.cols.map((c) => c.nodes.map((x) => nodeText(x, md)).filter(Boolean).join('\n\n')).join('\n\n');
}

export function pagesToText(pages: DocPage[], md = false) {
  return pages
    .map((p) => p.nodes.map((n) => nodeText(n, md)).filter((s) => s.trim()).join('\n\n'))
    .join(md ? '\n\n---\n\n' : '\n\n\f\n\n');
}
