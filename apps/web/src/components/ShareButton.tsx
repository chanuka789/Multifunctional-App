import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Check, Copy, Link2 } from 'lucide-react';
import { api, uploadToBucket, type Share } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatBytes } from '@/lib/util';
import { Countdown } from './Countdown';

/**
 * Optional: put the result in temporary cloud storage and get a link.
 * The browser uploads straight to the bucket; the file is deleted 2 hours later.
 */
export function ShareButton({ blob, filename, tool }: { blob: Blob; filename: string; tool: string }) {
  const { online, user } = useAuth();
  const [state, setState] = useState<{ s: 'idle' } | { s: 'up'; p: number } | { s: 'ok'; share: Share } | { s: 'err'; m: string }>({ s: 'idle' });
  const [copied, setCopied] = useState(false);
  useEffect(() => setState({ s: 'idle' }), [blob]);
  if (!online) return null;

  const start = async () => {
    try {
      setState({ s: 'up', p: 0 });
      const { share, uploadUrl, headers } = await api.createShare({ filename, size: blob.size, contentType: blob.type || 'application/octet-stream', tool });
      await uploadToBucket(uploadUrl, headers, blob, (p) => setState({ s: 'up', p }));
      const done = await api.completeShare(share.id);
      setState({ s: 'ok', share: done.share });
    } catch (e) {
      setState({ s: 'err', m: e instanceof Error ? e.message : 'Upload failed' });
    }
  };

  if (state.s === 'ok') {
    const url = `${location.origin}/s/${state.share.id}`;
    return (
      <div className="share-box">
        <div className="flex items-center gap-2">
          <input className="input" readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            className="btn btn-quiet"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="small muted m-0">
          Deleted for good in <Countdown to={state.share.expiresAt} />.{' '}
          {user ? (
            <Link className="link" to="/account">
              See your links
            </Link>
          ) : (
            <>
              <Link className="link" to="/signup">
                Create an account
              </Link>{' '}
              to see all your links in one place.
            </>
          )}
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <button type="button" className="btn btn-quiet" onClick={start} disabled={state.s === 'up'}>
        <Link2 size={18} />
        {state.s === 'up' ? `Uploading ${Math.round(state.p * 100)}%` : 'Get a share link'}
      </button>
      <span className="small muted">
        {state.s === 'err' ? <span className="field-error">{state.m}</span> : `Uploads this ${formatBytes(blob.size)} result. Deleted after 2 hours.`}
      </span>
    </div>
  );
}
