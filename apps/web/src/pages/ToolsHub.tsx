import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Search } from 'lucide-react';
import { GROUP_LABEL, TOOLS, searchTools, type ToolGroup } from '@/tools/registry';
import { toolHref } from '@/components/CommandBar';

export default function ToolsHub() {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<'all' | ToolGroup>('all');
  useEffect(() => {
    document.title = 'All tools — Ondevo';
  }, []);
  const list = useMemo(() => {
    const base = q.trim() ? searchTools(q).map((r) => ({ tool: r.tool, value: r.value })) : TOOLS.map((tool) => ({ tool, value: undefined as string | undefined }));
    const results = q.trim() ? [...base, ...TOOLS.filter((t) => !base.some((b) => b.tool === t) && t.name.toLowerCase().includes(q.toLowerCase())).map((tool) => ({ tool, value: undefined }))] : base;
    return results.filter((r) => group === 'all' || r.tool.group === group);
  }, [q, group]);
  return (
    <div className="tool">
      <div className="tool-title">
        <h1 className="tool-h1">All tools</h1>
        <p className="tool-blurb">Nineteen tools for sound and paper. Each one runs on this device; pick one and drop a file.</p>
      </div>
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div className="field flex-1 min-w-[240px] max-w-[560px]">
          <label htmlFor="hub-q" className="field-label">
            Search
          </label>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
            <input id="hub-q" className="input" style={{ paddingLeft: 40 }} placeholder="noise, 1.5x, pdf to word, subtitles…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="seg" role="radiogroup" aria-label="Kind of tool">
          {(['all', 'audio', 'document'] as const).map((g) => (
            <button key={g} type="button" role="radio" aria-checked={group === g} onClick={() => setGroup(g)}>
              {g === 'all' ? 'All' : GROUP_LABEL[g]}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <p className="muted">No tool matches “{q}”. Try another word.</p>
      ) : (
        <ul className="hub" aria-label="Tools">
          {list.map(({ tool, value }) => (
            <li key={tool.slug}>
              <Link to={toolHref(tool.slug, value)} className="hub-row">
                <span className="hub-kind small">{GROUP_LABEL[tool.group]}</span>
                <span className="hub-name">{tool.name}</span>
                <span className="hub-blurb">{value ?? tool.blurb}</span>
                <ArrowRight size={18} aria-hidden="true" className="hub-arrow" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
