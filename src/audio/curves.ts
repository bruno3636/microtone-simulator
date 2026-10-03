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
