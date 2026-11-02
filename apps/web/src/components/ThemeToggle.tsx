import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { applyTheme, getTheme, type Theme } from '@/lib/theme';

const ORDER: Theme[] = ['system', 'light', 'dark'];
const LABEL: Record<Theme, string> = { system: 'Theme: match device', light: 'Theme: light', dark: 'Theme: dark' };

export function ThemeToggle() {
  const [t, setT] = useState<Theme>(getTheme);
  useEffect(() => applyTheme(t), [t]);
  const Icon = t === 'light' ? Sun : t === 'dark' ? Moon : Monitor;
  return (
    <button type="button" className="icon-btn" aria-label={`${LABEL[t]}. Change theme`} title={LABEL[t]} onClick={() => setT(ORDER[(ORDER.indexOf(t) + 1) % 3])}>
      <Icon size={18} />
    </button>
  );
}
