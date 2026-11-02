/** Parse "1-3, 5, 8-" into zero-based page indexes (in the order given). */
export function parseRanges(input: string, count: number): number[] | null {
  const out: number[] = [];
  const parts = input.split(/[,;\s]+/).filter(Boolean);
  if (!parts.length) return null;
  for (const p of parts) {
    const m = p.match(/^(\d+)?\s*(-)?\s*(\d+)?$/);
    if (!m || (!m[1] && !m[3])) return null;
    const a = m[1] ? parseInt(m[1]) : 1;
    const b = m[2] ? (m[3] ? parseInt(m[3]) : count) : a;
    if (a < 1 || b < 1 || a > count || b > count) return null;
    const step = a <= b ? 1 : -1;
    for (let i = a; step > 0 ? i <= b : i >= b; i += step) out.push(i - 1);
  }
  return out;
}
