import { edoExpr, evalRatio, labelPrefix, parseEdo, splitCents, toFraction, withCents } from './ratios';

const FACTOR = /^\((.*)\) \* 2\^\((-?\d+)\)$/;

/** Octave of a note relative to the root's (0 = within the root octave), ignoring its cents offset. */
export function octaveOf(note: string): number {
  const v = evalRatio(splitCents(note).ratio);
  return v == null ? 0 : Math.floor(Math.log2(v) + 1e-9);
}

/**
 * Move a note `k` octaves, keeping its name tag and cents offset. EDO steps move by N steps,
 * rational values stay tidy fractions ("5/4" → "5/2"), anything else gets one "(…) * 2^(n)" factor.
 */
export function shiftOctave(note: string, k: number): string {
  if (!k) return note;
  const { ratio, cents } = splitCents(note);
  const edo = parseEdo(ratio);
  let shifted: string;
  if (edo) {
    shifted = edoExpr(edo.step + k * edo.divisions, edo.divisions);
  } else {
    const m = FACTOR.exec(ratio.trim());
    const base = m ? m[1] : ratio.trim();
    const n = (m ? Number(m[2]) : 0) + k;
    const v = evalRatio(base);
    const frac = v == null ? null : toFraction(v * 2 ** n);
    shifted = frac ? frac.replace(/\/1$/, '') : n === 0 ? base : `(${base}) * 2^(${n})`;
  }
  return labelPrefix(note) + withCents(shifted, cents ?? 0);
}
