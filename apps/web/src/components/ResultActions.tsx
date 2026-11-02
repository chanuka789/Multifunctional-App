import { Download } from 'lucide-react';
import { downloadBlob, formatBytes } from '@/lib/util';
import { ShareButton } from './ShareButton';

export function ResultActions({ blob, filename, tool, note }: { blob: Blob; filename: string; tool: string; note?: string }) {
  return (
    <div className="result-actions">
      <div className="grid gap-2">
        <button type="button" className="btn btn-accent btn-lg" onClick={() => downloadBlob(blob, filename)}>
          <Download size={20} /> Download {filename.split('.').pop()?.toUpperCase()}
        </button>
        <span className="small muted">
          {filename} · {formatBytes(blob.size)}
          {note ? ` · ${note}` : ''}
        </span>
      </div>
      <ShareButton blob={blob} filename={filename} tool={tool} />
    </div>
  );
}
