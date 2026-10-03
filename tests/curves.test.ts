import { describe, it, expect } from 'vitest';
import { shapeCurve, curveForMidpoint } from '../src/audio/curves';

describe('shapeCurve', () => {
  it('hits endpoints exactly for any curve', () => {
    for (const c of [-1, -0.5, 0, 0.5, 1]) {
      expect(shapeCurve(0.2, 0.9, 0, c)).toBeCloseTo(0.2, 10);
      expect(shapeCurve(0.2, 0.9, 1, c)).toBeCloseTo(0.9, 10);
    }
  });
  it('is linear at c = 0', () => {
    expect(shapeCurve(0, 1, 0.25, 0)).toBeCloseTo(0.25);
    expect(shapeCurve(1, 0, 0.25, 0)).toBeCloseTo(0.75);
  });
  it('EXP (c > 0) bends below the chord, rising and falling', () => {
    expect(shapeCurve(0, 1, 0.5, 1)).toBeLessThan(0.5);
    expect(shapeCurve(1, 0, 0.5, 1)).toBeLessThan(0.5);
  });
  it('LOG (c < 0) bends above the chord, rising and falling', () => {
    expect(shapeCurve(0, 1, 0.5, -1)).toBeGreaterThan(0.5);
    expect(shapeCurve(1, 0, 0.5, -1)).toBeGreaterThan(0.5);
  });
  it('clamps t to [0, 1]', () => {
    expect(shapeCurve(0, 1, -2, 0.5)).toBe(0);
    expect(shapeCurve(0, 1, 3, 0.5)).toBeCloseTo(1);
  });

describe('curveForMidpoint (inverse of the midpoint, for the drag handle)', () => {
  it('round-trips the midpoint level for rising and falling segments', () => {
    for (const [a, b] of [[0, 1], [1, 0.3], [0.8, 0]]) {
      for (const c of [-0.9, -0.4, 0.25, 0.7]) {
        const mid = shapeCurve(a, b, 0.5, c);
        expect(curveForMidpoint(a, b, mid)).toBeCloseTo(c, 3);
      }
    }
  });
  it('a midpoint on the straight line is linear', () => {
    expect(curveForMidpoint(0, 1, 0.5)).toBe(0);
  });
  it('clamps beyond the reachable range to ±1', () => {
    expect(curveForMidpoint(0, 1, -5)).toBe(1); // dragged far below the chord → full EXP
    expect(curveForMidpoint(0, 1, 5)).toBe(-1); // far above → full LOG
  });
  it('is 0 for a flat segment (no curvature possible)', () => {
    expect(curveForMidpoint(0.5, 0.5, 0.9)).toBe(0);
  });
});
});
