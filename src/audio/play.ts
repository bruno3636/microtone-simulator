import { engine } from './engine';
import { useStore, type StoreState } from '../state/store';
import { degreeFreq } from '../tuning/ratios';

/** Sounding frequency of a degree: live notes follow the pitch bend, sustained (shift) notes don't. */
export function liveFreq(s: Pick<StoreState, 'notes' | 'root' | 'latched' | 'bend'> & { period?: number }, degree: number): number | null {
  const f = degreeFreq(s.notes, degree, s.root.freq, s.period ?? 2);
  if (f == null) return null;
  return s.latched.includes(degree) ? f : f * 2 ** (s.bend / 1200);
}

export function playDegree(degree: number): void {
  const s = useStore.getState();
  const f = liveFreq(s, degree);
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

// a sounding pitch follows its card: editing its ratio / cents (or the root), bending, and
// sustaining (which leaves the bend) are heard live
useStore.subscribe((s, prev) => {
  if (s.notes === prev.notes && s.root.freq === prev.root.freq && s.bend === prev.bend && s.latched === prev.latched && s.period === prev.period) return;
  for (const d of s.held) {
    const f = liveFreq(s, d);
    if (f != null) engine.retune(String(d), f);
  }
});

/** Release everything that isn't sustained (window blur, tab hidden). */
export function stopAll(): void {
  const { held, latched } = useStore.getState();
  for (const d of held) if (!latched.includes(d)) stopDegree(d);
}
