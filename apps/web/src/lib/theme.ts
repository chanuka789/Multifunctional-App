export type Theme = 'light' | 'dark' | 'system';
const KEY = 'ondevo-theme';

export function getTheme(): Theme {
  try {
    return (localStorage.getItem(KEY) as Theme) || 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* private mode */
  }
}
