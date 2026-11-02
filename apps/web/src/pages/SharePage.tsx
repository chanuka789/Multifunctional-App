import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Download } from 'lucide-react';
import { SitePage } from '@/components/Site';
import { Countdown } from '@/components/Countdown';
import { api, type Share } from '@/lib/api';
import { formatBytes } from '@/lib/util';
import { toolBySlug } from '@/tools/registry';

export default function SharePage() {
  const { id = '' } = useParams();
  const [data, setData] = useState<{ share: Share; downloadUrl: string | null } | null>(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    api
      .getShare(id)
      .then(setData)
      .catch(() => setGone(true));
  }, [id]);
  return (
    <SitePage title="Shared file">
      <div className="share-page">
        {gone && (
          <>
            <h1 className="page-title p-0">This link has ended</h1>
            <p className="lead m-0 measure">Shared files are deleted for good 2 hours after they are shared, and this one is gone. Ask the sender to share it again.</p>
            <Link to="/tools" className="btn btn-lg">
              Open the tools
            </Link>
          </>
        )}
        {!gone && !data && <p className="muted">Opening the link…</p>}
        {data && (
          <>
            <p className="m-0 muted">Someone shared a file with you{data.share.tool && toolBySlug(data.share.tool) ? `, made with ${toolBySlug(data.share.tool)!.name}` : ''}.</p>
            <h1 className="share-name">{data.share.filename}</h1>
            <p className="m-0">{formatBytes(data.share.size)}</p>
            <p className="m-0 small muted">Deleted for good in</p>
            <p className="share-clock" aria-live="off">
              <Countdown to={data.share.expiresAt} onEnd={() => setGone(true)} />
            </p>
            {data.downloadUrl ? (
              <a href={data.downloadUrl} className="btn btn-accent btn-lg" download={data.share.filename}>
                <Download size={20} /> Download
              </a>
            ) : (
              <p className="muted">The upload has not finished yet. Refresh in a moment.</p>
            )}
            <p className="small muted m-0 measure">Ondevo does not look inside shared files. Only open files from people you trust.</p>
          </>
        )}
      </div>
    </SitePage>
  );
}
