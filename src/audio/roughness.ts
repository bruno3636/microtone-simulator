/**
 * Sensory roughness after W. A. Sethares ("Local consonance and the relationship between timbre
 * and scale", JASA 1993; "Tuning, Timbre, Spectrum, Scale", 2005), his parametrisation of the
 * Plomp–Levelt curve: for two partials f1 < f2 with amplitudes a1, a2,
 *   d = min(a1, a2) · (e^(−b1·s·(f2−f1)) − e^(−b2·s·(f2−f1))),   s = d* / (s1·f1 + s2),
 * and the roughness of a sound is the sum of d over every pair of its partials.
 */
const B1 = 3.5;
const B2 = 5.75;
const D_STAR = 0.24;
const S1 = 0.0207;
const S2 = 18.96;
/** beyond this many scaled bandwidths a pair contributes < 1e-8: stop looking further up */
const FAR = Math.log(1e8) / B1;

export interface Partial { freq: number; amp: number }

export function pairDissonance(fa: number, aa: number, fb: number, ab: number): number {
  const [f1, f2] = fa <= fb ? [fa, fb] : [fb, fa];
  const s = D_STAR / (S1 * f1 + S2);
  const x = s * (f2 - f1);
  return Math.min(aa, ab) * (Math.exp(-B1 * x) - Math.exp(-B2 * x));
}

/** Sum of the pair dissonances of all partials (any order). */
export function totalRoughness(partials: Partial[]): number {
  const ps = partials.filter((p) => p.amp > 0).sort((a, b) => a.freq - b.freq);
  let total = 0;
  for (let i = 0; i < ps.length; i++) {
    const s = D_STAR / (S1 * ps[i].freq + S2);
    for (let j = i + 1; j < ps.length; j++) {
      if (s * (ps[j].freq - ps[i].freq) > FAR) break;
      total += pairDissonance(ps[i].freq, ps[i].amp, ps[j].freq, ps[j].amp);
    }
  }
  return total;
}

/**
 * Sethares' dissonance curve: roughness of two tones with harmonic amplitudes `amps`, one at
 * `baseHz` and one `cents` above it, sampled at `points` intervals from `fromCents` to `toCents`.
 */
export function dissonanceCurve(
  amps: number[], baseHz: number, fromCents: number, toCents: number, points: number,
): { cents: number; value: number }[] {
  const tone = (f: number): Partial[] => amps.map((a, k) => ({ freq: (k + 1) * f, amp: Math.abs(a) })).filter((p) => p.amp > 1e-4 && p.freq < 20000);
  const base = tone(baseHz);
  const out: { cents: number; value: number }[] = [];
  for (let i = 0; i < points; i++) {
    const cents = fromCents + ((toCents - fromCents) * i) / Math.max(1, points - 1);
    out.push({ cents, value: totalRoughness([...base, ...tone(baseHz * 2 ** (cents / 1200))]) });
  }
  return out;
}

/** Local minima of a curve whose dip is at least `prominence` × the curve's range deep on both sides. */
export function curveMinima(curve: { cents: number; value: number }[], prominence = 0.03): { cents: number; value: number }[] {
  if (curve.length < 3) return [];
  const values = curve.map((p) => p.value);
  const range = Math.max(...values) - Math.min(...values) || 1;
  const out: { cents: number; value: number }[] = [];
  for (let i = 0; i < curve.length; i++) {
    const v = values[i];
    if ((i > 0 && values[i - 1] < v) || (i < curve.length - 1 && values[i + 1] <= v)) continue;
    // highest point between this dip and the next lower point on each side
    let left = v;
    for (let j = i - 1; j >= 0 && values[j] >= v; j--) left = Math.max(left, values[j]);
    let right = v;
    for (let j = i + 1; j < curve.length && values[j] >= v; j++) right = Math.max(right, values[j]);
    const edge = i === 0 || i === curve.length - 1;
    if (Math.min(edge ? Math.max(left, right) : left, edge ? Math.max(left, right) : right) - v >= prominence * range) out.push(curve[i]);
  }
  return out;
}
