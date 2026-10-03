export type ThemeMode = 'system' | 'light' | 'dark';

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function degreeColor(i: number, dark: boolean, alpha = 1): string {
  const h = 25 + 30 * mod(i, 12);
  const base = dark ? '72% 0.12' : '64% 0.11';
  return alpha === 1 ? `oklch(${base} ${h})` : `oklch(${base} ${h} / ${alpha})`;
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(mode: ThemeMode): 'light' | 'dark' {
  const t = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', t);
  return t;
}
