const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Bend a segment a → b over t ∈ [0,1]. c > 0 (EXP) is convex (below the chord),
 * c < 0 (LOG) is concave (above the chord), whether the segment rises or falls.
 */
export function shapeCurve(a: number, b: number, t: number, c: number): number {
  const x = clamp01(t);
  if (Math.abs(c) < 1e-6 || a === b) return a + (b - a) * x;
  const k = 8 * Math.abs(c);
  const grow = (u: number) => (Math.exp(k * u) - 1) / (Math.exp(k) - 1); // convex, below diagonal
  const ease = (u: number) => 1 - grow(1 - u); // concave, above diagonal
  const rising = b > a;
  const convex = c > 0;
  const g = rising === convex ? grow : ease;
  return a + (b - a) * g(x);
}

/**
 * Inverse of the segment midpoint: the curve amount c ∈ [−1, 1] whose value at t = 0.5 is `mid`
 * (used by the envelope editor's drag handle). Values past the reachable range clamp to ±1; a flat
 * segment has no curvature (0). Bisection — the midpoint is monotonic in c.
 */
export function curveForMidpoint(a: number, b: number, mid: number): number {
  if (Math.abs(b - a) < 1e-9) return 0;
  const chord = (a + b) / 2;
  if (Math.abs(mid - chord) < 1e-9) return 0;
  // c > 0 bends below the chord; find c such that shapeCurve(a, b, 0.5, c) = mid
  const below = (c: number) => shapeCurve(a, b, 0.5, c) - mid;
  let lo = -1;
  let hi = 1;
  if (below(lo) <= 0) return -1; // even full LOG stays below `mid` → target is above the reachable range
  if (below(hi) >= 0) return 1;
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    if (below(m) > 0) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
