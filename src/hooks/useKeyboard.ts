import { useEffect } from 'react';
import { useStore } from '../state/store';
import { engine } from '../audio/engine';
import { playDegree, stopDegree, stopAll } from '../audio/play';
import { degreesForKey } from '../tuning/keymaps';

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
};

const lookup = (key: string) => {
  const s = useStore.getState();
  return degreesForKey(s.keymaps[s.keymap] ?? {}, key, s.notes.length);
};

export function useKeyboard(): void {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
      const ds = lookup(e.key);
      if (ds.length === 0) return;
      engine.resume();
      ds.forEach(playDegree);
    };
    // keyup is never filtered by focus, so a note can't get stuck if focus moves mid-press
    const up = (e: KeyboardEvent) => lookup(e.key).forEach(stopDegree);
    const onHide = () => { if (document.hidden) stopAll(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', stopAll);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', stopAll);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);
}
