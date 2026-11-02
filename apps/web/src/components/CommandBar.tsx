import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Search } from 'lucide-react';
import { searchTools } from '@/tools/registry';

export function useCommandBar() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, setOpen };
}

export function toolHref(slug: string, value?: string) {
  if (!value) return `/tools/${slug}`;
  const n = parseFloat(value);
  if (slug === 'speed' && !Number.isNaN(n)) return `/tools/speed?rate=${n}`;
  if (slug === 'pitch' && !Number.isNaN(n)) return `/tools/pitch?semitones=${n}`;
  if (slug === 'ocr') return `/tools/ocr?lang=${value.split(' ')[0].toLowerCase()}`;
  return `/tools/${slug}`;
}

export function CommandBar({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const nav = useNavigate();
  const results = useMemo(() => searchTools(q), [q]);
  useEffect(() => setSel(0), [q]);
  const go = (i: number) => {
    const r = results[i];
    if (!r) return;
    setOpen(false);
    setQ('');
    nav(toolHref(r.tool.slug, r.value));
  };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="cmd" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Find a tool</Dialog.Title>
          <div className="cmd-input">
            <Search size={20} aria-hidden="true" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Say what you need, like “make my lecture 1.3x faster”"
              aria-label="Find a tool"
              aria-controls="cmd-list"
              aria-activedescendant={results[sel] ? `cmd-${results[sel].tool.slug}` : undefined}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSel((s) => Math.min(results.length - 1, s + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSel((s) => Math.max(0, s - 1));
                } else if (e.key === 'Enter') go(sel);
              }}
            />
          </div>
          <ul className="cmd-list" id="cmd-list" role="listbox" aria-label="Matching tools">
            {results.length === 0 && <li className="cmd-empty">No tool matches yet. Try “noise”, “speed” or “pdf”.</li>}
            {results.map((r, i) => (
              <li
                key={r.tool.slug}
                id={`cmd-${r.tool.slug}`}
                role="option"
                aria-selected={i === sel}
                className="cmd-row"
                onMouseEnter={() => setSel(i)}
                onClick={() => go(i)}
              >
                <span className="font-semibold">{r.tool.name}</span>
                <span className="muted small truncate">{r.value ?? r.tool.blurb}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
