import { Link } from 'react-router';

/** The Ondevo mark: sound becomes text inside one device-shaped tile. */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="8" fill="var(--logo-tile, #1f2b4d)" />
      <g strokeLinecap="round" strokeWidth="2.4" fill="none">
        <path d="M6.5 13v6M10 9.5v13" stroke="var(--logo-ink, #fff)" />
        <path d="M13.5 12v8" stroke="#f7941d" />
        <path d="M17.5 11h8M17.5 16h6M17.5 21h8" stroke="var(--logo-ink, #fff)" />
      </g>
    </svg>
  );
}

export function Wordmark({ to = '/', size = 26 }: { to?: string; size?: number }) {
  return (
    <Link to={to} className="wordmark" aria-label="Ondevo home">
      <Mark size={size} />
      <span>Ondevo</span>
    </Link>
  );
}
