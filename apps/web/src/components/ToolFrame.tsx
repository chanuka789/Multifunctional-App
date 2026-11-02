import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import type { ToolDef } from '@/tools/registry';
import { GROUP_LABEL } from '@/tools/registry';

/** Title row + two-column work area used by every tool. */
export function ToolFrame({ tool, options, children, wide }: { tool: ToolDef; options?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="tool">
      <div className="tool-title">
        <nav aria-label="Breadcrumb" className="crumbs small">
          <Link to="/tools" className="muted">
            Tools
          </Link>
          <span aria-hidden="true" className="muted">
            /
          </span>
          <span className="muted">{GROUP_LABEL[tool.group]}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="tool-h1">{tool.name}</h1>
          <span className="pill pill-ok">
            <ShieldCheck size={14} aria-hidden="true" /> On this device
          </span>
        </div>
        <p className="tool-blurb">{tool.blurb}</p>
      </div>
      <div className={wide ? 'tool-body tool-body-wide' : 'tool-body'}>
        {options && (
          <section className="tool-options" aria-label="Settings">
            {options}
            <dl className="engine small">
              <div>
                <dt className="muted">Engine</dt>
                <dd>{tool.engine}</dd>
              </div>
              {tool.download && (
                <div>
                  <dt className="muted">One-time download</dt>
                  <dd>{tool.download}, then cached</dd>
                </div>
              )}
            </dl>
          </section>
        )}
        <section className="tool-work" aria-label="Your file">
          {children}
        </section>
      </div>
    </div>
  );
}
