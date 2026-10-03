import { shapeCurve } from './curves';

export type HarmonicFilter = 'all' | 'odd' | 'even';

export interface HarmonicSettings {
  count: number;
  start: number;
  end: number;
  curve: number;
  filter: HarmonicFilter;
  /** harmonic number (1-based) → level 0..1 */
  tweaks: Record<number, number>;
}

export const MAX_HARMONICS = 64;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function computeAmplitudes(s: HarmonicSettings): number[] {
  const count = Math.round(clamp(s.count, 1, MAX_HARMONICS));
  const out: number[] = [];
  for (let n = 1; n <= count; n++) {
    const t = count === 1 ? 0 : (n - 1) / (count - 1);
    let a = s.tweaks[n] ?? shapeCurve(s.start, s.end, t, s.curve);
    a = clamp(a, 0, 1);
    if (n > 1 && ((s.filter === 'odd' && n % 2 === 0) || (s.filter === 'even' && n % 2 === 1))) a = 0;
    out.push(a);
  }
  if (out.every((a) => a <= 0)) {
    out.fill(0);
    out[0] = 1;
  }
  return out;
}
