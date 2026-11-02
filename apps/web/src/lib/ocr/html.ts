import type { Align, DocNode, DocPage, ParaNode, Run } from './types';
import { joinLines } from './layout';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function runsHtml(runs: Run[]) {
  return runs
    .map((r) => {
      let t = esc(r.text);
      if (r.bold) t = `<b>${t}</b>`;
      if (r.italic) t = `<i>${t}</i>`;
      if (r.color) t = `<span style="color:${r.color}">${t}</span>`;
      if (r.low) t = `<mark class="low" title="Low confidence: check this word">${t}</mark>`;
      return t;
    })
    .join('');
}

function paraHtml(n: ParaNode) {
  const tag = n.role === 'li' ? 'p' : n.role;
  const style = [
    `font-size:${n.fontPt}pt`,
    `text-align:${n.align}`,
    n.leftPt ? `margin-left:${n.leftPt.toFixed(1)}pt` : '',
    n.firstLinePt ? `text-indent:${n.firstLinePt.toFixed(1)}pt` : '',
    `margin-top:${Math.min(n.spaceBeforePt, 72).toFixed(1)}pt`,
  ]
    .filter(Boolean)
    .join(';');
  const body = n.keepBreaks ? n.lines.map(runsHtml).join('<br>') : runsHtml(joinLines(n.lines));
  const data = `data-role="${n.role}" data-list="${n.list ?? ''}" data-font="${n.fontPt}" data-left="${n.leftPt}" data-first="${n.firstLinePt}" data-space="${n.spaceBeforePt}" data-breaks="${n.keepBreaks ? 1 : 0}"`;
  const bullet = n.list === 'bullet' ? '<span class="bullet" contenteditable="false">•</span>' : '';
  return `<${tag} class="${n.list ? 'li ' + n.list : ''}" ${data} style="${style}">${bullet}${body}</${tag}>`;
}

export function nodeHtml(n: DocNode): string {
  if (n.type === 'para') return paraHtml(n);
  if (n.type === 'image')
    return `<figure data-type="image" data-w="${n.widthPt}" data-h="${n.heightPt}" data-align="${n.align}" style="margin:${Math.min(n.spaceBeforePt, 72)}pt 0 0;text-align:${n.align}" contenteditable="false"><img src="${n.dataUrl}" alt="Picture from the page" style="width:${n.widthPt}pt;max-width:100%"></figure>`;
  if (n.type === 'table') {
    const cols = n.colWidthsPt.map((w) => `<col style="width:${w}pt">`).join('');
    const rows = n.rows
      .map(
        (r) =>
          `<tr data-h="${r.heightPt}">${r.cells.map((c) => `<td${c.span > 1 ? ` colspan="${c.span}"` : ''}>${c.paras.map(paraHtml).join('') || '<p data-role="p" data-font="10"><br></p>'}</td>`).join('')}</tr>`,
      )
      .join('');
    return `<table data-type="table" data-cols="${n.colWidthsPt.join(',')}"><colgroup>${cols}</colgroup><tbody>${rows}</tbody></table>`;
  }
  return `<div data-type="columns" data-gap="${n.gapPt}" data-space="${n.spaceBeforePt}" class="cols" style="margin-top:${Math.min(n.spaceBeforePt, 72)}pt;gap:${n.gapPt}pt;grid-template-columns:${n.cols.map((c) => `${c.widthPt.toFixed(0)}fr`).join(' ')}">${n.cols
    .map((c) => `<div data-w="${c.widthPt}">${c.nodes.map(nodeHtml).join('')}</div>`)
    .join('')}</div>`;
}

export function pageHtml(p: DocPage) {
  return p.nodes.map(nodeHtml).join('');
}

/* ---------- Back from the edited HTML to the document model ---------- */

function readRuns(el: Element): Run[][] {
  const lines: Run[][] = [[]];
  const walk = (node: Node, f: { bold?: boolean; italic?: boolean; color?: string }) => {
    if (node.nodeType === 3) {
      const t = node.textContent ?? '';
      if (t) lines[lines.length - 1].push({ text: t, ...f });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.classList.contains('bullet')) return;
    if (node.tagName === 'BR') {
      lines.push([]);
      return;
    }
    const tag = node.tagName;
    const next = {
      bold: f.bold || tag === 'B' || tag === 'STRONG' || Number(node.style.fontWeight) >= 600 || undefined,
      italic: f.italic || tag === 'I' || tag === 'EM' || undefined,
      color: node.style.color ? rgbHex(node.style.color) : f.color,
    };
    if (tag === 'DIV' || tag === 'P') {
      if (lines[lines.length - 1].length) lines.push([]);
    }
    node.childNodes.forEach((c) => walk(c, next));
  };
  el.childNodes.forEach((c) => walk(c, {}));
  return lines.filter((l, i) => l.length || i === 0);
}

function rgbHex(c: string): string | undefined {
  if (c.startsWith('#')) return c;
  const m = c.match(/\d+/g);
  if (!m || m.length < 3) return undefined;
  return '#' + m.slice(0, 3).map((v) => Number(v).toString(16).padStart(2, '0')).join('');
}

function readPara(el: HTMLElement): ParaNode {
  const d = el.dataset;
  const tag = el.tagName.toLowerCase();
  const role = (['h1', 'h2', 'h3'].includes(tag) ? tag : d.role === 'li' ? 'li' : 'p') as ParaNode['role'];
  const lines = readRuns(el);
  return {
    type: 'para',
    role,
    list: (d.list || undefined) as ParaNode['list'],
    align: ((el.style.textAlign as Align) || 'left') as Align,
    fontPt: Number(d.font) || (role === 'h1' ? 22 : role === 'h2' ? 17 : role === 'h3' ? 14 : 11),
    leftPt: Number(d.left) || 0,
    firstLinePt: Number(d.first) || 0,
    spaceBeforePt: Number(d.space) || 0,
    lines,
    keepBreaks: d.breaks === '1' || lines.length > 1,
  };
}

function readNodes(container: Element): DocNode[] {
  const out: DocNode[] = [];
  for (const child of Array.from(container.children) as HTMLElement[]) {
    const tag = child.tagName;
    if (child.dataset.type === 'image') {
      const img = child.querySelector('img');
      if (img) out.push({ type: 'image', dataUrl: img.src, widthPt: Number(child.dataset.w), heightPt: Number(child.dataset.h), align: (child.dataset.align as Align) || 'left', spaceBeforePt: 0 });
    } else if (child.dataset.type === 'table' || tag === 'TABLE') {
      const colWidthsPt = (child.dataset.cols ?? '').split(',').map(Number).filter(Boolean);
      const rows = Array.from(child.querySelectorAll(':scope > tbody > tr')).map((tr) => ({
        heightPt: Number((tr as HTMLElement).dataset.h) || 18,
        cells: Array.from(tr.children).map((td) => ({
          span: Number(td.getAttribute('colspan')) || 1,
          paras: (readNodes(td).filter((n) => n.type === 'para') as ParaNode[]).filter((p) => p.lines.some((l) => l.some((r) => r.text.trim()))),
        })),
      }));
      const n = Math.max(...rows.map((r) => r.cells.reduce((a, c) => a + c.span, 0)));
      out.push({ type: 'table', colWidthsPt: colWidthsPt.length === n ? colWidthsPt : Array(n).fill(480 / n), rows });
    } else if (child.dataset.type === 'columns') {
      out.push({
        type: 'columns',
        gapPt: Number(child.dataset.gap) || 18,
        spaceBeforePt: Number(child.dataset.space) || 0,
        cols: Array.from(child.children).map((c) => ({ widthPt: Number((c as HTMLElement).dataset.w) || 240, nodes: readNodes(c) })),
      });
    } else if (/^(P|H1|H2|H3|H4|DIV|LI)$/.test(tag)) {
      const p = readPara(child);
      if (p.lines.some((l) => l.some((r) => r.text.trim()))) out.push(p);
    } else if (tag === 'UL' || tag === 'OL') {
      child.querySelectorAll('li').forEach((li) => {
        const p = readPara(li as HTMLElement);
        p.role = 'li';
        p.list = tag === 'UL' ? 'bullet' : 'number';
        out.push(p);
      });
    }
  }
  return out;
}

export function readPage(container: Element, base: DocPage): DocPage {
  return { ...base, nodes: readNodes(container) };
}
