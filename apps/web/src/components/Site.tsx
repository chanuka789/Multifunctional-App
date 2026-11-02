import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { Wordmark } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/lib/auth';

const LINKS = [
  { to: '/tools', label: 'All tools' },
  { to: '/tools/noise-remover', label: 'Noise remover' },
  { to: '/tools/ocr', label: 'Document OCR' },
  { to: '/privacy', label: 'Privacy' },
];

/** Plain bar: wordmark, a few links, one action. Folds into a menu on phones. */
export function SiteHeader({ dark }: { dark?: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  return (
    <header className={dark ? 'site-head field-dark' : 'site-head'}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Wordmark />
      <nav aria-label="Main" className="site-nav">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} className="site-link">
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="site-actions">
        <ThemeToggle />
        {user ? (
          <Link to="/account" className="site-link hide-sm">
            Account
          </Link>
        ) : (
          <Link to="/login" className="site-link hide-sm">
            Log in
          </Link>
        )}
        <Link to="/tools" className="btn btn-accent hide-sm">
          Open the tools
        </Link>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button type="button" className="icon-btn site-menu" aria-label="Open menu">
              <Menu size={22} />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="overlay" />
            <Dialog.Content className="sheet-menu" aria-describedby={undefined}>
              <div className="flex items-center justify-between">
                <Dialog.Title asChild>
                  <span>
                    <Wordmark />
                  </span>
                </Dialog.Title>
                <Dialog.Close className="icon-btn" aria-label="Close menu">
                  <X size={22} />
                </Dialog.Close>
              </div>
              <nav aria-label="Main" className="sheet-menu-nav">
                {LINKS.map((l) => (
                  <Link key={l.to} to={l.to}>
                    {l.label}
                  </Link>
                ))}
                <Link to={user ? '/account' : '/login'}>{user ? 'Account' : 'Log in'}</Link>
                {!user && <Link to="/signup">Create an account</Link>}
              </nav>
              <Link to="/tools" className="btn btn-accent btn-lg w-full">
                Open the tools
              </Link>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  );
}

export function SiteFooter({ children }: { children?: ReactNode }) {
  return (
    <footer className="site-foot">
      <div className="site-foot-top">
        <div className="site-foot-invite">
          {children ?? (
            <>
              <p className="site-foot-line">Your files, your device.</p>
              <Link to="/tools" className="btn btn-lg">
                Open the tools
              </Link>
            </>
          )}
        </div>
        <ul className="site-foot-links">
          <li>
            <Link to="/tools">All tools</Link>
          </li>
          <li>
            <Link to="/signup">Create an account</Link>
          </li>
          <li>
            <Link to="/privacy">Privacy</Link>
          </li>
          <li>
            <Link to="/terms">Terms</Link>
          </li>
          <li>
            <Link to="/brand">Brand</Link>
          </li>
        </ul>
      </div>
      <div className="site-foot-legal small">
        <span>© {new Date().getFullYear()} Ondevo. Tools run in your browser; shared links delete after 2 hours.</span>
        <span>Built with RNNoise, SoundTouch, Tesseract, Whisper, pdf.js, pdf-lib and ffmpeg.wasm.</span>
      </div>
      <div className="site-foot-name" aria-hidden="true">
        ONDEVO
      </div>
    </footer>
  );
}

/** Simple page frame for public pages. */
export function SitePage({ children, title }: { children: ReactNode; title: string }) {
  useEffect(() => {
    document.title = `${title} — Ondevo`;
  }, [title]);
  return (
    <>
      <SiteHeader />
      <main id="main" className="site-main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
