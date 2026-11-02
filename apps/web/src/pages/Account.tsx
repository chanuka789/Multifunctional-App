import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Copy, Trash2 } from 'lucide-react';
import { api, ApiError, type Share } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Countdown } from '@/components/Countdown';
import { formatBytes } from '@/lib/util';
import { toolBySlug } from '@/tools/registry';

export default function Account() {
  const { user, loading, setUser, logout } = useAuth();
  const nav = useNavigate();
  const [shares, setShares] = useState<Share[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState(user?.name ?? '');
  const [saved, setSaved] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; m: string } | null>(null);
  const [del, setDel] = useState('');
  const [delErr, setDelErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .myShares()
      .then((r) => setShares(r.shares))
      .catch(() => setErr('Your links could not be loaded. Try again in a moment.'));
  }, []);
  useEffect(() => {
    document.title = 'Your account — Ondevo';
    if (user) load();
  }, [user, load]);
  useEffect(() => setName(user?.name ?? ''), [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const active = shares?.filter((s) => new Date(s.expiresAt).getTime() > Date.now()) ?? [];

  return (
    <div className="acct">
      <div className="tool-title m-0">
        <h1 className="tool-h1">Your account</h1>
        <p className="tool-blurb">
          {user.email} · {active.length === 0 ? 'no live share links' : `${active.length} live share link${active.length > 1 ? 's' : ''}`}
        </p>
      </div>

      <section className="acct-row" aria-labelledby="links-h">
        <div>
          <h2 id="links-h">Share links</h2>
          <p className="small muted m-0">Each file is deleted for good 2 hours after you share it. Delete one sooner here.</p>
        </div>
        <div className="acct-panel">
          {err && <p className="field-error m-0">{err}</p>}
          {shares === null && !err && <p className="muted m-0">Loading…</p>}
          {shares && active.length === 0 && (
            <p className="m-0">
              No live links. Use <strong>Get a share link</strong> on any tool's result.{' '}
              <Link className="link" to="/tools">
                Open the tools
              </Link>
            </p>
          )}
          {active.length > 0 && (
            <table className="share-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Tool</th>
                  <th className="num">Size</th>
                  <th className="num">Deleted in</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {active.map((s) => (
                  <tr key={s.id}>
                    <td className="font-semibold break-all">{s.filename}</td>
                    <td className="muted">{(s.tool && toolBySlug(s.tool)?.name) ?? '—'}</td>
                    <td className="num">{formatBytes(s.size)}</td>
                    <td className="num">
                      <Countdown to={s.expiresAt} onEnd={load} />
                    </td>
                    <td>
                      <span className="flex justify-end">
                        <button type="button" className="icon-btn" aria-label={`Copy link to ${s.filename}`} onClick={() => navigator.clipboard.writeText(`${location.origin}/s/${s.id}`)}>
                          <Copy size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Delete ${s.filename} now`}
                          onClick={async () => {
                            await api.deleteShare(s.id);
                            load();
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="acct-row" aria-labelledby="profile-h">
        <div>
          <h2 id="profile-h">Profile</h2>
          <p className="small muted m-0">Your name shows on your account only.</p>
        </div>
        <form
          className="acct-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await api.updateProfile({ name });
            setUser(r.user);
            setSaved(true);
            setTimeout(() => setSaved(false), 1600);
          }}
        >
          <div className="field">
            <label className="field-label" htmlFor="acct-name">
              Name
            </label>
            <input id="acct-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div className="field">
            <span className="field-label">Email</span>
            <span>{user.email}</span>
          </div>
          <button className="btn btn-sm justify-self-start">{saved ? 'Saved' : 'Save'}</button>
        </form>
      </section>

      <section className="acct-row" aria-labelledby="pw-h">
        <div>
          <h2 id="pw-h">Password</h2>
          <p className="small muted m-0">At least 10 characters. Changing it logs out your other devices.</p>
        </div>
        <form
          className="acct-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.changePassword(pw);
              setPw({ current: '', next: '' });
              setPwMsg({ ok: true, m: 'Password changed.' });
            } catch (x) {
              setPwMsg({ ok: false, m: x instanceof ApiError ? x.message : 'Could not change the password.' });
            }
          }}
        >
          <div className="field">
            <label className="field-label" htmlFor="pw-cur">
              Current password
            </label>
            <input id="pw-cur" type="password" className="input" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="pw-new">
              New password
            </label>
            <input id="pw-new" type="password" className="input" autoComplete="new-password" minLength={10} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </div>
          {pwMsg && <p className={pwMsg.ok ? 'm-0 text-[var(--ok)]' : 'field-error m-0'}>{pwMsg.m}</p>}
          <button className="btn btn-sm justify-self-start" disabled={!pw.current || pw.next.length < 10}>
            Change password
          </button>
        </form>
      </section>

      <section className="acct-row" aria-labelledby="out-h">
        <div>
          <h2 id="out-h">Log out or delete</h2>
          <p className="small muted m-0">Deleting removes your account, your settings and every share link at once.</p>
        </div>
        <div className="acct-panel">
          <button
            type="button"
            className="btn btn-quiet btn-sm justify-self-start"
            onClick={async () => {
              await logout();
              nav('/');
            }}
          >
            Log out
          </button>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.deleteAccount({ password: del });
                setUser(null);
                nav('/');
              } catch (x) {
                setDelErr(x instanceof ApiError ? x.message : 'Could not delete the account.');
              }
            }}
          >
            <div className="field">
              <label className="field-label" htmlFor="del-pw">
                Password, to delete the account
              </label>
              <input id="del-pw" type="password" className="input" autoComplete="current-password" value={del} onChange={(e) => setDel(e.target.value)} />
            </div>
            {delErr && <p className="field-error m-0">{delErr}</p>}
            <button className="btn btn-sm justify-self-start" style={{ ['--btn-bg' as string]: 'var(--bad)', ['--btn-fg' as string]: '#fff' }} disabled={!del}>
              Delete my account
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
