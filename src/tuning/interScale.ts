import { simplify } from 'mathjs';
import { evalRatio, mod, splitCents } from './ratios';

export interface InterRatio { lo: number; hi: number; exact: string; decimal: string }

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
      const a = splitCents(notes[ds[i]]);
      const b = splitCents(notes[ds[j]]);
      let exact: string | null;
      if (a.cents != null || b.cents != null) {
        // tempered JI: the just ratio between the ratio parts, plus the cents difference
        const ra = evalRatio(a.ratio);
        const rb = evalRatio(b.ratio);
        const dc = (b.cents ?? 0) - (a.cents ?? 0);
        const just = ra && rb ? (toFraction(rb / ra) ?? (rb / ra).toFixed(3)) : '—';
        exact = Math.abs(dc) < 0.05 ? just : `${just} ${dc > 0 ? '+' : '-'}${Math.abs(dc).toFixed(1)}c`;
      } else {
        exact = toFraction(v);
      }
      if (exact == null) {
        try {
          exact = simplify(`(${notes[ds[j]]}) / (${notes[ds[i]]})`).toString().replace(/\s+/g, '');
        } catch {
          exact = '—';
        }
      }
      row.push({ lo: ds[i], hi: ds[j], exact, decimal: v.toFixed(3) });
    }
    rows.push(row);
  }
  return rows;
}
