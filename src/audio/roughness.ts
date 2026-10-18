/**
 * Sensory roughness after W. A. Sethares ("Local consonance and the relationship between timbre
 * and scale", JASA 1993; "Tuning, Timbre, Spectrum, Scale", 2005), his parametrisation of the
 * Plomp–Levelt curve: for two partials f1 < f2 with amplitudes a1, a2,
 *   d = min(ℓ1, ℓ2) · (e^(−b1·s·(f2−f1)) − e^(−b2·s·(f2−f1))),   s = d* / (s1·f1 + s2),
 * where ℓ1, ℓ2 are the partials' loudnesses in sones, and the roughness of a sound is the sum of d
 * over every pair of its partials.
 * As in the book (2nd ed., Appendix E "How to Draw Dissonance Curves", eqs. E.1–E.4, E.6–E.7):
 * b1 = 3.5, b2 = 5.75, d* = 0.24, no overall factor. s1, s2 use the unrounded fit 0.0207 / 18.96 of
 * his `dissmeasure` program (the book prints 0.021 / 19). Loudness follows eq. E.5 (see `loudness`).
 */
const B1 = 3.5;
const B2 = 5.75;
const D_STAR = 0.24;
const S1 = 0.0207;
const S2 = 18.96;
/** beyond this many scaled bandwidths a pair contributes < 1e-8: stop looking further up */
const FAR = Math.log(1e8) / B1;

export interface Partial { freq: number; amp: number }

/**
 * The level (dB SPL) taken for amplitude 1, the strongest harmonic at full level. The app's
 * amplitudes are relative, while the book's loudness needs an absolute level; 70 dB is a moderate
 * listening level. It only scales the whole curve (loudness ∝ amplitude^0.6), not its shape.
 */
export const REFERENCE_DB = 70;

/**
 * Loudness in sones of a partial with relative amplitude `amp` (book eq. E.5):
 * SPL = REFERENCE_DB + 20·log10(amp), ℓ = 2^(SPL/10) / 16 (40 dB = 1 sone, +10 dB ≈ twice as loud).
 */
export function loudness(amp: number): number {
  if (!(amp > 0)) return 0;
  const spl = REFERENCE_DB + 20 * Math.log10(amp);
  return 2 ** (spl / 10) / 16;
}

/** Dissonance of two partials with weights (loudnesses) `aa`, `ab` (book eqs. E.2–E.4). */
export function pairDissonance(fa: number, aa: number, fb: number, ab: number): number {
  const [f1, f2] = fa <= fb ? [fa, fb] : [fb, fa];
  const s = D_STAR / (S1 * f1 + S2);
  const x = s * (f2 - f1);
  return Math.min(aa, ab) * (Math.exp(-B1 * x) - Math.exp(-B2 * x));
}

/**
 * Sum of the pair dissonances of all partials (any order), each pair weighted by the smaller
 * loudness (book eqs. E.4–E.6): each partial's amplitude is converted to sones with `loudness`.
 */
export function totalRoughness(partials: Partial[]): number {
  const ps = partials.filter((p) => p.amp > 0).map((p) => ({ freq: p.freq, amp: loudness(p.amp) })).sort((a, b) => a.freq - b.freq);
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

/** Roughness of two tones with harmonic amplitudes `amps`, `cents` apart above `baseHz`. */
export function intervalRoughness(amps: number[], baseHz: number, cents: number): number {
  return dissonanceCurve(amps, baseHz, cents, cents, 1)[0].value;
}

export interface Dip { cents: number; value: number; prominence: number }

/**
 * Dips of a curve, deepest first, with their depth on a log scale:
 * - valleys (local minima): ln(lower of the two neighbouring peaks / dip value), one side at the ends;
 * - notches where the curve keeps rising or falling but bends sharply (two partials coinciding on a
 *   slope, e.g. 8/7): how far the point sits below the straight line (in log values) between the
 *   points `notchWindow` × the curve's width to either side, where that is a local maximum.
 * Dips shallower than `minProminence` are dropped (tiny: notch depths shrink with the visible width,
 * and the label threshold — not this floor — decides what is shown); a notch at a valley is that
 * valley, with the larger depth.
 */
export function curveDips(curve: { cents: number; value: number }[], minProminence = 1e-7, notchWindow = 0.01): Dip[] {
  const v = curve.map((p) => Math.max(p.value, 1e-12));
  const lv = v.map(Math.log);
  const out: Dip[] = [];
  for (let i = 0; i < v.length; i++) {
    if ((i > 0 && v[i - 1] < v[i]) || (i < v.length - 1 && v[i + 1] <= v[i])) continue;
    let left = v[i];
    for (let j = i - 1; j >= 0 && v[j] >= v[i]; j--) left = Math.max(left, v[j]);
    let right = v[i];
    for (let j = i + 1; j < v.length && v[j] >= v[i]; j++) right = Math.max(right, v[j]);
    const edge = i === 0 || i === v.length - 1;
    const peak = edge ? Math.max(left, right) : Math.min(left, right);
    const prominence = Math.log(peak / v[i]);
    if (prominence >= minProminence) out.push({ cents: curve[i].cents, value: curve[i].value, prominence });
  }
  // notches: depth below the chord across ±k points, at its local maxima
  const k = Math.max(2, Math.round(v.length * notchWindow));
  const depth = lv.map((x, i) => (i < k || i >= lv.length - k ? -Infinity : (lv[i - k] + lv[i + k]) / 2 - x));
  for (let i = k; i < lv.length - k; i++) {
    const d = depth[i];
    if (d < minProminence || depth[i - 1] > d || depth[i + 1] >= d) continue;
    // a notch at a valley is that valley: it keeps the larger of the two depths
    const same = out.find((m) => Math.abs(m.cents - curve[i].cents) <= Math.abs(curve[k].cents - curve[0].cents));
    if (same) same.prominence = Math.max(same.prominence, d);
    else out.push({ cents: curve[i].cents, value: curve[i].value, prominence: d });
  }
  return out.sort((a, b) => b.prominence - a.prominence);
}

/** How deep (log scale) a dip must be to get a label at a given zoom factor: shallower as you zoom in. */
export function dipLabelThreshold(zoom: number): number {
  return 0.035 / Math.max(1, zoom) ** 1.5;
}

const gcdInt = (a: number, b: number): number => (b === 0 ? a : gcdInt(b, a % b));

/**
 * The harmonic coincidence behind a dip at `cents`: the ratio p/q (lowest terms) for which harmonic
 * k·p of the lower tone meets harmonic k·q of the upper one, both present in `amps`, within `tolCents`.
 * The strongest pair wins (the larger of min(amplitudes) over k), then the closest. Null if none.
 */
export function dipRatio(cents: number, amps: number[], tolCents = 4): { p: number; q: number } | null {
  const n = amps.length;
  const a = (k: number) => Math.abs(amps[k - 1] ?? 0);
  let best: { p: number; q: number; strength: number; d: number } | null = null;
  for (let q = 1; q <= n; q++) {
    for (let p = q + 1; p <= n; p++) {
      if (gcdInt(p, q) !== 1) continue;
      const d = Math.abs(1200 * Math.log2(p / q) - cents);
      if (d > tolCents) continue;
      let strength = 0;
      for (let k = 1; k * p <= n; k++) strength = Math.max(strength, Math.min(a(k * p), a(k * q)));
      if (strength <= 0) continue;
      if (!best || strength > best.strength * (1 + 1e-9) || (Math.abs(strength - best.strength) <= best.strength * 1e-9 && d < best.d)) {
        best = { p, q, strength, d };
      }
    }
  }
  return best && { p: best.p, q: best.q };
}

/**
 * Labels for the dips of the visible curve: deep enough for the zoom (`threshold`), away from the
 * window's edges, named by their harmonic coincidence (`dipRatio`), each ratio once (the deepest dip
 * keeps it). Dips with no coinciding harmonics nearby get no label.
 */
export function labelDips(
  dips: Dip[], amps: number[], threshold: number, fromCents: number, toCents: number, tolCents = 4,
): (Dip & { label: string })[] {
  const span = toCents - fromCents;
  const seen = new Set<string>();
  const out: (Dip & { label: string })[] = [];
  for (const d of dips) {
    if (d.prominence < threshold) break; // deepest first
    if (d.cents < fromCents + span * 0.01 || d.cents > toCents - span * 0.01) continue;
    const r = dipRatio(d.cents, amps, tolCents);
    if (!r) continue;
    const label = `${r.p}/${r.q}`;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ ...d, label });
  }
  return out;
}
