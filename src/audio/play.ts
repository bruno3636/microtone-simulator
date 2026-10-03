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

export function stopDegree(degree: number): void {
  engine.noteOff(String(degree));
  useStore.getState().setHeld(degree, false);
}

export function stopAll(): void {
  engine.allNotesOff();
  for (const d of useStore.getState().held) useStore.getState().setHeld(d, false);
}
