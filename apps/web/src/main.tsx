import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './design/app.css';
import './design/shell.css';
import './design/site.css';

// After a new deploy, an open tab may ask for files that no longer exist. Reload once to get the new version.
window.addEventListener('vite:preloadError', () => {
  try {
    if (sessionStorage.getItem('ondevo-reloaded')) return;
    sessionStorage.setItem('ondevo-reloaded', '1');
  } catch {
    /* ignore */
  }
  location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
