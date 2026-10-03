import { useEffect } from 'react';
import { useStore } from '../state/store';
import { engine } from '../audio/engine';
import { playDegree, stopDegree, stopAll } from '../audio/play';
import { degreesForKey } from '../tuning/keymaps';
import { isTextEntry } from './keyTarget';
import { createKeyTracker } from './keyTracker';


const lookup = (key: string) => {
  const s = useStore.getState();
  return degreesForKey(s.keymaps[s.keymap] ?? {}, key, s.notes.length);
};

export function useKeyboard(): void {
  useEffect(() => {
    const tracker = createKeyTracker();
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTextEntry(e.target as Element | null)) return;
      const ds = lookup(e.key);
      if (ds.length === 0) return;
      engine.resume();
      tracker.press(e.code, ds).forEach(playDegree);
    };
    // keyup is never filtered by focus, so a note can't get stuck if focus moves mid-press
    // and releases exactly the degrees that key's keydown started (e.key can change with Shift)
    const up = (e: KeyboardEvent) => {
      const tracked = tracker.release(e.code);
      if (tracked) tracked.forEach(stopDegree);
      else lookup(e.key).filter((d) => !tracker.isActive(d)).forEach(stopDegree);
    };
    const releaseAll = () => { tracker.clear(); stopAll(); };
    const onHide = () => { if (document.hidden) releaseAll(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', releaseAll);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);
}
