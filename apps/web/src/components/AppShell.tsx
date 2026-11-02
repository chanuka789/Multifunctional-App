import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { Menu, Search, X } from 'lucide-react';
import { TOOLS, GROUP_LABEL, type ToolGroup } from '@/tools/registry';
import { Wordmark } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { CommandBar, useCommandBar } from './CommandBar';
import { useAuth } from '@/lib/auth';

function ToolNav({ onPick }: { onPick?: () => void }) {
  return (
    <nav aria-label="Tools" className="side-nav">
      {(['audio', 'document'] as ToolGroup[]).map((g) => (
        <div key={g} className="side-group">
          <h2 className="side-label">{GROUP_LABEL[g]}</h2>
          <ul>
            {TOOLS.filter((t) => t.group === g).map((t) => (
              <li key={t.slug}>
                <NavLink to={`/tools/${t.slug}`} className="side-link" onClick={onPick}>
                  {t.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Account() {
  const { user, loading } = useAuth();
  if (loading) return <span className="w-[86px]" />;
  if (user)
    return (
      <Link to="/account" className="avatar" aria-label={`Your account, ${user.email}`} title={user.email}>
        {(user.name || user.email).slice(0, 1).toUpperCase()}
      </Link>
    );
  return (
    <Link to="/login" className="btn btn-sm btn-quiet">
      Log in
    </Link>
  );
}

/** Framed sheet: one tinted L-frame (sidebar + top bar), the work on a white sheet. */
export function AppShell() {
  const cmd = useCommandBar();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname]);
  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to the tool
      </a>
      <aside className="shell-side">
        <div className="shell-brand">
          <Wordmark />
        </div>
        <ToolNav />
        <p className="side-foot small muted">Every tool runs on this device. Nothing is uploaded unless you ask for a share link.</p>
      </aside>
      <header className="shell-top">
        <Dialog.Root open={menu} onOpenChange={setMenu}>
          <Dialog.Trigger asChild>
            <button type="button" className="icon-btn shell-menu" aria-label="Open tool menu">
              <Menu size={20} />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="overlay" />
            <Dialog.Content className="drawer" aria-describedby={undefined}>
              <div className="flex items-center justify-between">
                <Dialog.Title asChild>
                  <span>
                    <Wordmark />
                  </span>
                </Dialog.Title>
                <Dialog.Close className="icon-btn" aria-label="Close menu">
                  <X size={20} />
                </Dialog.Close>
              </div>
              <ToolNav onPick={() => setMenu(false)} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <span className="shell-mobile-brand">
          <Wordmark size={22} />
        </span>
        <button type="button" className="search-btn" onClick={() => cmd.setOpen(true)}>
          <Search size={16} aria-hidden="true" />
          <span>Find a tool</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="shell-actions">
          <ThemeToggle />
          <Account />
        </div>
      </header>
      <main id="main" className="shell-sheet" tabIndex={-1}>
        <Outlet />
      </main>
      <CommandBar open={cmd.open} setOpen={cmd.setOpen} />
    </div>
  );
}
