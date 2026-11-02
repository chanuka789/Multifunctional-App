import { useRef, useState, type ReactNode } from 'react';
import { Upload } from 'lucide-react';
import { cx, formatBytes } from '@/lib/util';

/**
 * Drop or pick files. Files stay in this tab's memory; nothing is sent anywhere.
 */
export function DropZone(props: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title?: string;
  hint: string;
  compact?: boolean;
  children?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const pick = (list: FileList | null) => {
    if (!list?.length) return;
    props.onFiles(Array.from(list));
  };
  return (
    <div
      className={cx('drop', over && 'drop-over', props.compact && 'drop-compact')}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        pick(e.dataTransfer.files);
      }}
    >
      <input
        ref={input}
        type="file"
        className="sr-only"
        accept={props.accept}
        multiple={props.multiple}
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
        aria-describedby="drop-hint"
        tabIndex={-1}
      />
      <Upload size={props.compact ? 20 : 28} aria-hidden="true" strokeWidth={1.75} />
      <p className="drop-title">{props.title ?? (props.multiple ? 'Drop files here' : 'Drop a file here')}</p>
      <button type="button" className="btn btn-sm" onClick={() => input.current?.click()}>
        Choose {props.multiple ? 'files' : 'a file'}
      </button>
      <p className="drop-hint" id="drop-hint">
        {props.hint}
      </p>
      {props.children}
    </div>
  );
}

export function FileChip({ file, onClear }: { file: File; onClear?: () => void }) {
  return (
    <div className="file-chip">
      <span className="file-chip-name" title={file.name}>
        {file.name}
      </span>
      <span className="muted small">{formatBytes(file.size)}</span>
      {onClear && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
          Change file
        </button>
      )}
    </div>
  );
}
