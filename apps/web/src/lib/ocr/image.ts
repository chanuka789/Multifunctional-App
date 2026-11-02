import type { Box, OcrWord, TableGrid } from './types';

export interface Pixels {
  data: Uint8ClampedArray; // RGBA
  width: number;
  height: number;
}

/** Luminance 0..255 for every pixel. */
export function toGray(p: Pixels): Uint8Array {
  const g = new Uint8Array(p.width * p.height);
  const d = p.data;
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  return g;
}

/** Otsu threshold on a gray image. */
export function otsu(gray: Uint8Array): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > best) {
      best = v;
      thr = t;
    }
  }
  return thr;
}

/** 1 = ink. */
export function binarize(gray: Uint8Array, thr = otsu(gray)): Uint8Array {
  const b = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) b[i] = gray[i] <= thr ? 1 : 0;
  return b;
}

interface Seg {
  a: number; // start along the scan
  b: number; // end along the scan
  at0: number; // first scan line
  at1: number; // last scan line
}

/** Long straight runs of ink along rows (horizontal) or columns (vertical). */
export function findRules(bin: Uint8Array, w: number, h: number, dir: 'h' | 'v', minLen: number, maxThick = 8): Seg[] {
  const lines = dir === 'h' ? h : w;
  const along = dir === 'h' ? w : h;
  const open: Seg[] = [];
  const done: Seg[] = [];
  for (let s = 0; s < lines; s++) {
    const runs: [number, number][] = [];
    let start = -1, gaps = 0;
    for (let t = 0; t <= along; t++) {
      const ink = t < along && (dir === 'h' ? bin[s * w + t] : bin[t * w + s]) === 1;
      if (ink) {
        if (start < 0) start = t;
        gaps = 0;
      } else if (start >= 0) {
        // allow tiny breaks in a rule (scan noise)
        if (++gaps > 2 || t === along) {
          const end = t - gaps;
          if (end - start + 1 >= minLen) runs.push([start, end]);
          start = -1;
          gaps = 0;
        }
      }
    }
    // extend open segments that continue on this scan line
    const used = new Set<number>();
    for (const seg of open) {
      if (seg.at1 !== s - 1) continue;
      const i = runs.findIndex(([a, b], k) => !used.has(k) && Math.min(b, seg.b) - Math.max(a, seg.a) > 0.8 * Math.min(b - a, seg.b - seg.a));
      if (i >= 0) {
        used.add(i);
        seg.at1 = s;
        seg.a = Math.min(seg.a, runs[i][0]);
        seg.b = Math.max(seg.b, runs[i][1]);
      }
    }
    runs.forEach(([a, b], k) => !used.has(k) && open.push({ a, b, at0: s, at1: s }));
    for (let i = open.length - 1; i >= 0; i--) {
      if (open[i].at1 < s) {
        done.push(open[i]);
        open.splice(i, 1);
      }
    }
  }
  done.push(...open);
  return done.filter((g) => g.at1 - g.at0 + 1 <= maxThick);
}

/** Find ruled tables: horizontal and vertical rules that touch each other. */
export function detectTables(bin: Uint8Array, w: number, h: number): TableGrid[] {
  const hs = findRules(bin, w, h, 'h', Math.max(50, Math.round(w * 0.08))).map((s) => ({ x0: s.a, x1: s.b, y: (s.at0 + s.at1) / 2 }));
  const vs = findRules(bin, w, h, 'v', Math.max(18, Math.round(h * 0.012))).map((s) => ({ y0: s.a, y1: s.b, x: (s.at0 + s.at1) / 2 }));
  if (hs.length < 2) return [];
  const tol = 5;
  const parent = Array.from({ length: hs.length + vs.length }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (a: number, b: number) => (parent[find(a)] = find(b));
  const touches = new Array(vs.length).fill(0);
  hs.forEach((hl, i) =>
    vs.forEach((vl, j) => {
      if (vl.x >= hl.x0 - tol && vl.x <= hl.x1 + tol && hl.y >= vl.y0 - tol && hl.y <= vl.y1 + tol) {
        join(i, hs.length + j);
        touches[j]++;
      }
    }),
  );
  const groups = new Map<number, { h: typeof hs; v: typeof vs }>();
  hs.forEach((hl, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, { h: [], v: [] });
    groups.get(r)!.h.push(hl);
  });
  vs.forEach((vl, j) => {
    if (touches[j] < 2) return; // a letter stroke touches at most one rule
    const r = find(hs.length + j);
    if (!groups.has(r)) groups.set(r, { h: [], v: [] });
    groups.get(r)!.v.push(vl);
  });
  const merge = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const out: number[] = [];
    for (const x of s) if (!out.length || x - out[out.length - 1] > 8) out.push(x);
    return out;
  };
  const tables: TableGrid[] = [];
  for (const g of groups.values()) {
    if (g.h.length < 2 || g.v.length < 2) continue;
    const rows = merge(g.h.map((l) => l.y));
    const cols = merge(g.v.map((l) => l.x));
    if (rows.length < 2 || cols.length < 2) continue;
    const x0 = Math.min(...g.h.map((l) => l.x0)), x1 = Math.max(...g.h.map((l) => l.x1));
    if (x1 - x0 < w * 0.15 || rows[rows.length - 1] - rows[0] < 20) continue;
    // Horizontal spans: a missing vertical rule between two cells means they are one cell.
    const spans: number[][] = [];
    for (let r = 0; r < rows.length - 1; r++) {
      const mid = (rows[r] + rows[r + 1]) / 2;
      const row = new Array(cols.length - 1).fill(1);
      let lead = 0;
      for (let c = 1; c < cols.length - 1; c++) {
        const hasRule = g.v.some((vl) => Math.abs(vl.x - cols[c]) <= 8 && vl.y0 - tol <= mid && vl.y1 + tol >= mid);
        if (hasRule) lead = c;
        else {
          row[lead] += 1;
          row[c] = 0;
        }
      }
      spans.push(row);
    }
    tables.push({ x0: cols[0], x1: cols[cols.length - 1], y0: rows[0], y1: rows[rows.length - 1], rows, cols, spans });
  }
  return tables;
}

/** Ink density of a box (share of dark pixels), used to spot bold words. */
export function inkDensity(bin: Uint8Array, w: number, b: Box): number {
  const x0 = Math.max(0, Math.floor(b.x0)), x1 = Math.min(w - 1, Math.ceil(b.x1));
  const y0 = Math.max(0, Math.floor(b.y0)), y1 = Math.ceil(b.y1);
  let ink = 0, n = 0;
  for (let y = y0; y <= y1; y++) {
    const row = y * w;
    for (let x = x0; x <= x1; x++) {
      ink += bin[row + x] ?? 0;
      n++;
    }
  }
  return n ? ink / n : 0;
}

/** Mark bold words: ink density clearly above words of a similar size. */
export function markBold(words: OcrWord[], bin: Uint8Array, w: number) {
  const dens = words.map((wd) => {
    const h = wd.y1 - wd.y0;
    // stroke weight scales with size; normalise by height so big headings are not all "bold"
    return { wd, d: inkDensity(bin, w, wd), h };
  });
  const buckets = new Map<number, number[]>();
  for (const x of dens) {
    const k = Math.round(Math.log2(Math.max(4, x.h)) * 3);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(x.d);
  }
  const med = new Map<number, number>();
  buckets.forEach((v, k) => {
    v.sort((a, b) => a - b);
    med.set(k, v[Math.floor(v.length / 2)]);
  });
  for (const x of dens) {
    const k = Math.round(Math.log2(Math.max(4, x.h)) * 3);
    const m = med.get(k)!;
    const n = buckets.get(k)!.length;
    if (n >= 6 && x.wd.text.length >= 2 && x.d > m * 1.32) x.wd.bold = true;
  }
}

/** Average colour of the dark pixels of a box when it is clearly coloured (not black or grey). */
export function sampleColor(p: Pixels, gray: Uint8Array, thr: number, b: Box): string | undefined {
  const w = p.width;
  let r = 0, g = 0, bl = 0, n = 0;
  const x0 = Math.max(0, Math.floor(b.x0)), x1 = Math.min(w - 1, Math.ceil(b.x1));
  const y0 = Math.max(0, Math.floor(b.y0)), y1 = Math.min(p.height - 1, Math.ceil(b.y1));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const j = y * w + x;
      if (gray[j] > thr) continue;
      const i = j * 4;
      r += p.data[i];
      g += p.data[i + 1];
      bl += p.data[i + 2];
      n++;
    }
  }
  if (n < 12) return undefined;
  r /= n;
  g /= n;
  bl /= n;
  const max = Math.max(r, g, bl), min = Math.min(r, g, bl);
  const sat = max ? (max - min) / max : 0;
  if (sat < 0.35 || max < 60) return undefined;
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(bl)}`;
}

/**
 * Find picture regions (photos, logos, charts): blocks of non-white pixels that no text box covers.
 * Works on a coarse grid so it stays fast on 300 dpi pages.
 */
export function detectPictures(gray: Uint8Array, w: number, h: number, textBoxes: Box[], tables: Box[]): Box[] {
  const cell = 16;
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const covered = new Uint8Array(gw * gh);
  const mark = (b: Box, pad: number) => {
    for (let y = Math.max(0, Math.floor((b.y0 - pad) / cell)); y <= Math.min(gh - 1, Math.floor((b.y1 + pad) / cell)); y++)
      for (let x = Math.max(0, Math.floor((b.x0 - pad) / cell)); x <= Math.min(gw - 1, Math.floor((b.x1 + pad) / cell)); x++) covered[y * gw + x] = 1;
  };
  textBoxes.forEach((b) => mark(b, 6));
  tables.forEach((b) => mark(b, 4));
  const busy = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      if (covered[gy * gw + gx]) continue;
      let n = 0, dark = 0;
      for (let y = gy * cell; y < Math.min(h, gy * cell + cell); y += 2)
        for (let x = gx * cell; x < Math.min(w, gx * cell + cell); x += 2) {
          n++;
          if (gray[y * w + x] < 225) dark++;
        }
      if (n && dark / n > 0.3) busy[gy * gw + gx] = 1;
    }
  const seen = new Uint8Array(gw * gh);
  const out: Box[] = [];
  for (let i = 0; i < busy.length; i++) {
    if (!busy[i] || seen[i]) continue;
    let x0 = gw, y0 = gh, x1 = 0, y1 = 0, count = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop()!;
      const x = j % gw, y = (j / gw) | 0;
      count++;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const k = ny * gw + nx;
        if (busy[k] && !seen[k]) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
    const bw = (x1 - x0 + 1) * cell, bh = (y1 - y0 + 1) * cell;
    const fill = count / ((x1 - x0 + 1) * (y1 - y0 + 1));
    if (bw > 64 && bh > 64 && bw * bh > w * h * 0.012 && fill > 0.35) out.push({ x0: x0 * cell, y0: y0 * cell, x1: Math.min(w, (x1 + 1) * cell), y1: Math.min(h, (y1 + 1) * cell) });
  }
  return out;
}
