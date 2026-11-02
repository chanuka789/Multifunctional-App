import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Wordmark } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function Shell({ statement, children, title }: { statement: string; children: ReactNode; title: string }) {
  useEffect(() => {
    document.title = `${title} — Ondevo`;
  }, [title]);
  return (
    <div className="auth">
      <aside className="auth-side field-dark">
        <div className="flex items-center justify-between">
          <Wordmark />
          <ThemeToggle />
        </div>
        <p className="auth-statement">{statement}</p>
        <p className="auth-foot small muted m-0">You never need an account to use a tool. It only keeps your share links and settings together.</p>
      </aside>
      <main id="main" className="auth-main">
        {children}
      </main>
    </div>
  );
}

function useSubmit() {
  const [error, setError] = useState<{ msg: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const wrap = (fn: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      if (err instanceof ApiError) setError({ msg: err.message, field: err.field });
      else setError({ msg: 'Could not reach Ondevo. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, wrap };
}

export function Login() {
  const nav = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { error, busy, wrap } = useSubmit();
  return (
    <Shell statement="Welcome back" title="Log in">
      <form
        className="auth-form"
        noValidate
        onSubmit={wrap(async () => {
          const { user } = await api.login({ email, password });
          setUser(user);
          nav('/account');
        })}
      >
        <h1>Log in</h1>
        <div className="field">
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input id="email" className="input" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={error?.field === 'email'} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={error?.field === 'password'} />
        </div>
        {error && (
          <p className="field-error m-0" role="alert">
            {error.msg}
          </p>
        )}
        <button className="btn btn-accent btn-lg" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <p className="m-0">
          New here?{' '}
          <Link to="/signup" className="link">
            Create an account
          </Link>
        </p>
        <p className="m-0 small muted">
          Or{' '}
          <Link to="/tools" className="link">
            use the tools without an account
          </Link>
          .
        </p>
      </form>
    </Shell>
  );
}

export function Signup() {
  const nav = useNavigate();
  const { setUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { error, busy, wrap } = useSubmit();
  const weak = password.length > 0 && password.length < 10;
  return (
    <Shell statement="Keep your links together" title="Create an account">
      <form
        className="auth-form"
        noValidate
        onSubmit={wrap(async () => {
          const { user } = await api.signup({ email, password, name: name || undefined });
          setUser(user);
          nav('/account');
        })}
      >
        <h1>Create an account</h1>
        <div className="field">
          <label className="field-label" htmlFor="name">
            Name <span className="muted font-normal">(optional)</span>
          </label>
          <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input id="email" className="input" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={error?.field === 'email'} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={weak || error?.field === 'password'}
            aria-describedby="pw-hint"
          />
          <span id="pw-hint" className={weak ? 'field-error' : 'field-hint'}>
            At least 10 characters. A short sentence is easy to remember.
          </span>
        </div>
        {error && (
          <p className="field-error m-0" role="alert">
            {error.msg}
          </p>
        )}
        <button className="btn btn-accent btn-lg" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="m-0">
          Already have one?{' '}
          <Link to="/login" className="link">
            Log in
          </Link>
        </p>
        <p className="m-0 small muted">
          By creating an account you accept the{' '}
          <Link to="/terms" className="link">
            terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="link">
            privacy notice
          </Link>
          .
        </p>
      </form>
    </Shell>
  );
}
