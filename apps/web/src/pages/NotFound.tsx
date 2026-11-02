import { Link } from 'react-router';
import { SitePage } from '@/components/Site';

export default function NotFound({ inShell }: { inShell?: boolean }) {
  const body = (
    <div className="share-page">
      <h1 className="page-title p-0">Nothing here</h1>
      <p className="lead m-0 measure">This page does not exist. The tool may have moved; every tool is on one list.</p>
      <Link to="/tools" className="btn btn-lg">
        See all tools
      </Link>
    </div>
  );
  return inShell ? body : <SitePage title="Page not found">{body}</SitePage>;
}
