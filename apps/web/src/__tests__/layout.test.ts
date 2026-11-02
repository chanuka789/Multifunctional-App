import { describe, expect, it } from 'vitest';
import { buildPage, classifyAlign, joinLines, pagesToText, paperFor } from '../lib/ocr/layout';
import { detectTables } from '../lib/ocr/image';
import type { OcrLine, OcrPara, OcrWord, RawPage } from '../lib/ocr/types';

/** Make a line of words starting at x, baseline-ish y, word height h. */
function line(text: string, x: number, y: number, h = 30, cw = 15, bold = false): OcrLine {
  const words: OcrWord[] = [];
  let cx = x;
  for (const t of text.split(' ')) {
    const w = t.length * cw;
    words.push({ text: t, x0: cx, x1: cx + w, y0: y, y1: y + h, conf: 95, bold });
    cx += w + cw;
  }
  return { words, x0: x, x1: cx - cw, y0: y, y1: y + h };
}
function para(lines: OcrLine[]): OcrPara {
  return { lines, x0: Math.min(...lines.map((l) => l.x0)), x1: Math.max(...lines.map((l) => l.x1)), y0: lines[0].y0, y1: lines[lines.length - 1].y1 };
}
const crop = () => 'data:image/png;base64,AA==';

describe('paper size', () => {
  it('picks A4 for A4 proportions and Letter for Letter', () => {
    expect(paperFor(2480, 3508).widthPt).toBeCloseTo(595.28);
    expect(paperFor(2550, 3300).widthPt).toBe(612);
    expect(paperFor(3508, 2480).widthPt).toBeCloseTo(841.89);
  });
});

describe('reading order and structure', () => {
  // A4 at 300 dpi: 2480 x 3508. Title across the page, then two columns.
  const title = para([line('ANNUAL REPORT', 767, 200, 80, 40)]);
  const leftA = para([line('Left column first paragraph text goes here', 200, 500), line('and it continues on a second line here', 200, 545)]);
  const leftB = para([line('Left column second paragraph starts', 200, 700), line('with more words on the next line', 200, 745)]);
  const rightA = para([line('Right column first paragraph has text', 1300, 500), line('that also wraps to another line', 1300, 545)]);
  const rightB = para([line('Right column second paragraph here', 1300, 700), line('ending on this line of words', 1300, 745)]);
  const raw: RawPage = { width: 2480, height: 3508, paras: [title, rightA, leftB, rightB, leftA], images: [], tables: [] };
  const page = buildPage(raw, crop);

  it('detects the large line as a heading', () => {
    const first = page.nodes[0];
    expect(first.type).toBe('para');
    if (first.type === 'para') {
      expect(first.role).toBe('h1');
      expect(first.align).toBe('center');
    }
  });

  it('keeps the two columns apart and reads left before right', () => {
    const cols = page.nodes.find((n) => n.type === 'columns');
    expect(cols?.type).toBe('columns');
    if (cols?.type === 'columns') {
      expect(cols.cols).toHaveLength(2);
      const text = pagesToText([{ ...page, nodes: [cols] }]);
      expect(text.indexOf('Left column first')).toBeLessThan(text.indexOf('Left column second'));
      expect(text.indexOf('Left column second')).toBeLessThan(text.indexOf('Right column first'));
    }
  });
});

describe('lists, bold and hyphens', () => {
  it('turns bullet lines into list items without the bullet glyph', () => {
    const raw: RawPage = {
      width: 2480,
      height: 3508,
      paras: [para([line('Body text line that is long enough to be normal body copy here', 200, 300)]), para([line('• first item', 200, 400)]), para([line('• second item', 200, 460)])],
      images: [],
      tables: [],
    };
    const page = buildPage(raw, crop);
    const items = page.nodes.filter((n) => n.type === 'para' && n.list === 'bullet');
    expect(items).toHaveLength(2);
    expect(pagesToText([page], true)).toContain('- first item');
  });

  it('joins hyphenated line ends', () => {
    expect(joinLines([[{ text: 'infor-' }], [{ text: 'mation here' }]]).map((r) => r.text).join('')).toBe('information here');
    expect(joinLines([[{ text: 'one' }], [{ text: 'two' }]]).map((r) => r.text).join('')).toBe('one two');
  });

  it('classifies right aligned text', () => {
    const col = { x0: 200, x1: 2280, y0: 0, y1: 3000 };
    const p = para([line('Colombo 07', 2280 - 150, 100), line('Sri Lanka', 2280 - 135, 140)]);
    p.lines[0].x1 = 2280;
    p.lines[1].x1 = 2280;
    expect(classifyAlign(p, col)).toBe('right');
  });
});

describe('ruled tables', () => {
  it('finds a 2x2 grid drawn with rules and fills cells from words', () => {
    const w = 800, h = 600;
    const bin = new Uint8Array(w * h);
    const hline = (y: number) => {
      for (let x = 100; x <= 700; x++) for (let t = 0; t < 2; t++) bin[(y + t) * w + x] = 1;
    };
    const vline = (x: number) => {
      for (let y = 100; y <= 300; y++) for (let t = 0; t < 2; t++) bin[y * w + x + t] = 1;
    };
    [100, 200, 300].forEach(hline);
    [100, 400, 700].forEach(vline);
    const tables = detectTables(bin, w, h);
    expect(tables).toHaveLength(1);
    expect(tables[0].rows).toHaveLength(3);
    expect(tables[0].cols).toHaveLength(3);

    const raw: RawPage = {
      width: 2480,
      height: 3508,
      paras: [para([line('Name', 150, 130, 30, 15), line('Qty', 450, 130, 30, 15)]), para([line('Rice', 150, 230), line('2', 450, 230)])],
      images: [],
      tables: tables,
    };
    const page = buildPage(raw, crop);
    const t = page.nodes.find((n) => n.type === 'table');
    expect(t?.type).toBe('table');
    if (t?.type === 'table') {
      expect(t.rows).toHaveLength(2);
      expect(pagesToText([page], true)).toContain('| Name | Qty |');
    }
  });
});
