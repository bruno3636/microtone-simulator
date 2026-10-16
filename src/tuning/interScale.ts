import { evalRatio, mod, parseEdo, splitCents, splitLabel, toFraction } from './ratios';

export { toFraction };
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
      let base: string;
      if (edo) {
        base = `${edo.steps} steps (${edo.divisions}EDO)`;
      } else {
        const ra = evalRatio(a.ratio);
        const rb = evalRatio(b.ratio);
        base = ra && rb ? (toFraction(rb / ra) ?? (rb / ra).toFixed(4)) : '—';
      }
      const exact = offset ? `${base} ${dc > 0 ? '+' : '-'}${Math.abs(dc).toFixed(1)}c` : base;
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
