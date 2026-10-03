import { useStore } from '../state/store';
import type { ThemeMode } from '../theme';

const NEXT: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };

export function Header() {
  const volume = useStore((s) => s.volume);
  const setVolume = useStore((s) => s.setVolume);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  return (
    <header className="border-b border-[var(--border-subtle)]">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h1 className="display m-0 text-lg sm:text-xl">Extended Just Intonation Simulator</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="label">Volume</span>
            <input type="range" min={0} max={1} step={0.01} value={volume} aria-label="Master volume"
              onChange={(e) => setVolume(Number(e.target.value))} className="w-24" />
          </label>
          <button type="button" className="btn" onClick={() => setTheme(NEXT[theme])}
            aria-label={`Theme: ${theme}. Click to change.`}>
            ◐ {theme}
          </button>
        </div>
      </div>
    </header>
  );
}
