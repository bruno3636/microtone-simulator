import { evalRatio, mod, parseEdo, splitCents, splitLabel, toFraction } from './ratios';

export { toFraction };

const LIMIT = 32;
/** largest allowed a·b, which keeps the shown ratios reasonably simple */
export const MAX_PRODUCT = 256;
/** complexity penalties (prefer simpler ratios): a·b above `above` counts `cents` further away */
export const PENALTIES = [{ above: 128, cents: 10 }, { above: 64, cents: 5 }];
const penalty = (p: number) => PENALTIES.find((t) => p > t.above)?.cents ?? 0;

/**
 * The just ratio shown for an EDO / irrational interval: with 1 ≤ a, b ≤ 32 and a·b ≤ 256, the a/b
 * whose cents distance is smallest — ratios with 64 < a·b ≤ 128 scored 5¢ worse, a·b > 128 10¢ worse; the smaller a·b wins
 * an exact tie. Always in lowest terms.
 */
export function nearestJust(v: number): { a: number; b: number } {
  const c = 1200 * Math.log2(v);
  let best = { a: 1, b: 1, score: Infinity };
  for (let b = 1; b <= LIMIT; b++) {
    for (let a = 1; a <= LIMIT; a++) {
      const p = a * b;
      if (p > MAX_PRODUCT) continue;
      const score = Math.abs(1200 * Math.log2(a / b) - c) + penalty(p);
      if (score < best.score - 1e-9 || (Math.abs(score - best.score) <= 1e-9 && p < best.a * best.b)) best = { a, b, score };
    }
  }
  return { a: best.a, b: best.b };
}

const signedCents = (d: number) => `${d > 0 ? '+' : '-'}${Math.abs(d).toFixed(1)}c`;
import { intervalBetween, intervalBySemitones, nameRatio } from './intervals';

/**
 * `exact`: the ratio (or EDO steps / just ratio ± cents); `cents`: size in cents, e.g. "315.6¢";
 * `interval`: the musical interval name.
 */
export interface InterRatio { lo: number; hi: number; exact: string; cents: string; interval: string }

/** EDO steps of two notes in the same EDO (the root "1" is step 0 of any EDO), or null. */
function sameEdo(a: string, b: string): { steps: number; divisions: number } | null {
  const pa = parseEdo(a);
  const pb = parseEdo(b);
  const n = pa?.divisions ?? pb?.divisions;
  if (n == null) return null;
  const ka = pa ? (pa.divisions === n ? pa.step : null) : a.trim() === '1' ? 0 : null;
  const kb = pb ? (pb.divisions === n ? pb.step : null) : b.trim() === '1' ? 0 : null;
  return ka == null || kb == null ? null : { steps: kb - ka, divisions: n };
}

/**
 * Pairs of shown/held degrees: the distance in EDO steps (both from the same EDO), the just ratio
 * ± cents (JI + cents), a fraction (rational) or the ratio to 4 decimals (irrational); the size in
 * cents; and the musical interval as its own column.
 */
export function interScaleRatios(notes: string[], degrees: number[]): InterRatio[][] {
  const len = notes.length;
  const ds = [...new Set(degrees.map((d) => mod(d, len)))].sort((a, b) => a - b);
  const rows: InterRatio[][] = [];
  for (let i = 0; i < ds.length - 1; i++) {
    const row: InterRatio[] = [];
    for (let j = i + 1; j < ds.length; j++) {
      const lo = evalRatio(notes[ds[i]]);
      const hi = evalRatio(notes[ds[j]]);
      if (lo == null || hi == null) continue;
      const v = hi / lo;
      const la = splitLabel(notes[ds[i]]);
      const lb = splitLabel(notes[ds[j]]);
      const named = la.tag && lb.tag ? intervalBetween(la.tag, lb.tag) : null;
      // any note can carry a cents offset: describe the values without it, then add the difference
      const a = splitCents(la.body);
      const b = splitCents(lb.body);
      const edo = sameEdo(a.ratio, b.ratio);
      const dc = (b.cents ?? 0) - (a.cents ?? 0);
      const offset = Math.abs(dc) >= 0.05;
      // exact: a just ratio between the values as written, plus any offset difference; for EDO and
      // other irrational intervals, the nearest just ratio a/b (a, b ≤ 32) ± how far off it is
      const ra = evalRatio(a.ratio);
      const rb = evalRatio(b.ratio);
      const frac = !edo && ra && rb ? toFraction(rb / ra) : null;
      let exact: string;
      if (frac) {
        exact = offset ? `${frac} ${signedCents(dc)}` : frac;
      } else {
        const j = nearestJust(v);
        const d = 1200 * Math.log2(v / (j.a / j.b));
        exact = Math.abs(d) < 0.05 ? `${j.a}/${j.b}` : `${j.a}/${j.b} ${signedCents(d)}`;
      }
      // musical interval: exact for two notes of the same named tuning or of 12EDO (the offset in
      // front, as nameRatio writes it), else the nearest reference
      const exactName = named ?? (edo && edo.divisions === 12 ? intervalBySemitones(edo.steps) : null);
      const interval = exactName
        ? offset ? `${dc > 0 ? '+' : '−'}${Math.abs(dc).toFixed(1)}¢ ${exactName}` : exactName
        // a just (rational) interval needs no ±¢ prefix: its size in cents is shown beside it
        : nameRatio(v, !(!edo && !offset && toFraction(v) != null));
      row.push({ lo: ds[i], hi: ds[j], exact, cents: `${(1200 * Math.log2(v)).toFixed(1)}¢`, interval });
    }
    rows.push(row);
  }
  return rows;
}
