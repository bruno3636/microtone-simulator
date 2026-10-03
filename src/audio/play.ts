import { engine } from './engine';
import { useStore } from '../state/store';
import { degreeFreq } from '../tuning/ratios';

export function playDegree(degree: number): void {
  const s = useStore.getState();
  const f = degreeFreq(s.notes, degree, s.root.freq);
  if (f == null) return;
  engine.noteOn(String(degree), f);
  s.setHeld(degree, true);
}

/** Release a held pitch. Sustained (shift-clicked) pitches ignore ordinary releases. */
export function stopDegree(degree: number): void {
  if (useStore.getState().latched.includes(degree)) return;
  engine.noteOff(String(degree));
  useStore.getState().setHeld(degree, false);
}

/** Shift-click: sustain a pitch until it is clicked again. */
export function toggleLatch(degree: number): void {
  const s = useStore.getState();
  if (s.latched.includes(degree)) {
    s.setLatched(degree, false);
    stopDegree(degree);
  } else {
    playDegree(degree);
    if (useStore.getState().held.includes(degree)) s.setLatched(degree, true);
  }
}

/** Release everything that isn't sustained (window blur, tab hidden). */
export function stopAll(): void {
  const { held, latched } = useStore.getState();
  for (const d of held) if (!latched.includes(d)) stopDegree(d);
}
