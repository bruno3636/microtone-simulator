import { describe, it, expect } from 'vitest';
import { interScaleRatios, toFraction } from '../src/tuning/interScale';

describe('inter-scale ratios', () => {
  it('toFraction finds small rationals and rejects irrationals', () => {
    expect(toFraction(1.2)).toBe('6/5');
    expect(toFraction(1.5)).toBe('3/2');
    expect(toFraction(2 ** (1 / 12))).toBeNull();
  });
  it('pairs every shown degree with every higher one', () => {
    const notes = ['1', '1 + 1/4', '1 + 1/2'];
    const rows = interScaleRatios(notes, [2, 0, 1]);
    expect(rows).toHaveLength(2);
    expect(rows[0].map((r) => [r.lo, r.hi, r.exact])).toEqual([[0, 1, '5/4'], [0, 2, '3/2']]);
    expect(rows[1][0]).toMatchObject({ lo: 1, hi: 2, exact: '6/5', decimal: '1.200' });
  });
  it('dedupes octave copies and needs at least two degrees', () => {
    expect(interScaleRatios(['1', '3/2'], [0, 2])).toEqual([]);
  });
});
