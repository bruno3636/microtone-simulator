import { evalRatio, mod, parseEdo, splitCents, splitLabel } from './ratios';
import { intervalBetween } from './intervals';

/** `cents`: size of the interval in cents, e.g. "315.6¢". */
export interface InterRatio { lo: number; hi: number; exact: string; cents: string }

/** Best rational p/q with q ≤ 4096 within 1e-10, else null. Continued fractions. */
export function toFraction(v: number): string | null {
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  let x = v;
  for (let i = 0; i < 32; i++) {
    const a = Math.floor(x);
    [h0, h1] = [h1, a * h1 + h0];
    [k0, k1] = [k1, a * k1 + k0];
    if (k1 > 4096) return null;
    if (Math.abs(h1 / k1 - v) < 1e-10) return `${h1}/${k1}`;
    const frac = x - a;
    if (frac < 1e-12) return null;
    x = 1 / frac;
  }
  return null;
}

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
 * Pairs of shown/held degrees, each described by the most meaningful form for its sources:
 * the musical interval (both from the same Pythagorean / meantone / well temperament), the
 * distance in EDO steps (both from the same EDO), the just ratio ± cents (tempered JI), a fraction
 * (rational), or the ratio to 4 decimals (irrational) — plus the size in cents.
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
      const edo = named ? null : sameEdo(la.body, lb.body);
      const a = splitCents(la.body);
      const b = splitCents(lb.body);
      let exact: string;
      if (named) {
        exact = named;
      } else if (edo) {
        exact = `${edo.steps} steps (${edo.divisions}EDO)`;
      } else if (a.cents != null || b.cents != null) {
        // tempered JI: the just ratio between the ratio parts, plus the cents difference
        const ra = evalRatio(a.ratio);
        const rb = evalRatio(b.ratio);
        const dc = (b.cents ?? 0) - (a.cents ?? 0);
        const just = ra && rb ? (toFraction(rb / ra) ?? (rb / ra).toFixed(4)) : '—';
        exact = Math.abs(dc) < 0.05 ? just : `${just} ${dc > 0 ? '+' : '-'}${Math.abs(dc).toFixed(1)}c`;
      } else {
        exact = toFraction(v) ?? v.toFixed(4);
      }
      row.push({ lo: ds[i], hi: ds[j], exact, cents: `${(1200 * Math.log2(v)).toFixed(1)}¢` });
    }
    rows.push(row);
  }
  return rows;
}
