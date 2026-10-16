import { describe, it, expect } from 'vitest';
import { interScaleRatios, toFraction } from '../src/tuning/interScale';
import { tuningNotes } from '../src/tuning/presets';

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
    expect(rows[1][0]).toMatchObject({ lo: 1, hi: 2, exact: '6/5', cents: '315.6¢' });
  });
  it('dedupes octave copies and needs at least two degrees', () => {
    expect(interScaleRatios(['1', '3/2'], [0, 2])).toEqual([]);
  });
  it('tempered JI pairs show the just ratio plus the cents difference', () => {
    const rows = interScaleRatios(['1 +0c', '5/4 -13.7c', '3/2 +2c'], [0, 1, 2]);
    expect(rows[0][0].exact).toBe('5/4 -13.7c');
    expect(rows[1][0].exact).toBe('6/5 +15.7c');
    expect(rows[0][1].exact).toBe('3/2 +2.0c');
  });

  it('offset EDO steps: steps plus the cents difference; 12EDO names get the offset in front', () => {
    const [[x]] = interScaleRatios(['1', '2^(7/12) +3c'], [0, 1]);
    expect(x.exact).toBe('7 steps (12EDO) +3.0c');
    expect(x.interval).toBe('+3.0¢ Perfect 5th');
    expect(x.cents).toBe('703.0¢');
  });
  it('offset named notes keep their exact name, with the offset in front', () => {
    const n = tuningNotes('meantone', 'quarter');
    const [[x]] = interScaleRatios([n[0], `${n[4]} -2c`], [0, 1]);
    expect(x.interval).toBe('−2.0¢ Major 3rd');
    expect(x.exact).toBe('5/4 -2.0c'); // ¼-comma major third is a pure 5/4
  });
});
