import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { applyTheme, resolveTheme } from '../theme';

export function useResolvedTheme(): 'light' | 'dark' {
  const mode = useStore((s) => s.theme);
  const [resolved, setResolved] = useState(() => resolveTheme(mode));
  useEffect(() => {
    setResolved(applyTheme(mode));
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(applyTheme('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);
  return resolved;
}
