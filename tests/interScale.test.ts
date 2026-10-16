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
    expect(x.exact).toBe('3/2 +1.0c'); // 703¢ vs 701.955¢
    expect(x.interval).toBe('+3.0¢ Perfect 5th');
    expect(x.cents).toBe('703.0¢');
  });
  it('offset named notes keep their exact name, with the offset in front', () => {
    const n = tuningNotes('meantone', 'quarter');
    const [[x]] = interScaleRatios([n[0], `${n[4]} -2c`], [0, 1]);
    expect(x.interval).toBe('−2.0¢ Major 3rd');
    expect(x.exact).toBe('5/4 -2.0c'); // ¼-comma major third is a pure 5/4
  });

  it('just intervals are named without a ±¢ prefix (their cents are already shown)', () => {
    const [[a, b]] = interScaleRatios(['1', '45/32', '11/9'], [0, 1, 2]);
    expect(a.exact).toBe('45/32');
    expect(a.interval).toBe('Diminished 5th'); // nearest reference 7/5, no "+7.7¢"
    expect(b.interval).toBe('Neutral 3rd');
    // irrational (e.g. 31EDO) intervals keep the deviation from the nearest just reference
    const [[e]] = interScaleRatios(['1', '2^(10/31)'], [0, 1]);
    expect(e.interval).toMatch(/^[+−]\d+\.\d¢ Major 3rd$/);
  });

  it('nearestJust: a, b ≤ 32, a·b ≤ 256; a·b in (64, 128] scored 5¢ worse, above 128 10¢ worse', async () => {
    const { nearestJust } = await import('../src/tuning/interScale');
    expect(nearestJust(2 ** (7 / 12))).toEqual({ a: 3, b: 2 });
    expect(nearestJust(2 ** (4 / 12))).toEqual({ a: 5, b: 4 });
    expect(nearestJust(2 ** (3 / 12))).toEqual({ a: 6, b: 5 }); // 13/11 (143): 10.8 + 10 > 15.6
    expect(nearestJust(2 ** (1 / 12))).toEqual({ a: 16, b: 15 }); // 240, allowed: 11.7 + 10 beats 11/10's 65
    expect(nearestJust(2 ** (6 / 12))).toEqual({ a: 17, b: 12 }); // 3.0 + 10 still beats 7/5's 17.5
    expect(nearestJust(2 ** (8 / 31))).toEqual({ a: 6, b: 5 });
    // 11/10 (110) scores 10.2 + 5, losing to 12/11 (132) at 4.2 + 10
    expect(nearestJust(2 ** (4 / 31))).toEqual({ a: 12, b: 11 });
    expect(nearestJust(2 ** (14 / 31))).toEqual({ a: 11, b: 8 }); // 9.4 + 5 beats 15/11 (165) at 5.0 + 10
    expect(nearestJust(2 ** (8 / 12))).toEqual({ a: 8, b: 5 }); // 19/12 (228): 4.4 + 10 > 13.7
    expect(nearestJust(2 ** (25 / 41))).toEqual({ a: 3, b: 2 }); // 17/11 (187): 21.9 + 10 > 29.8
    expect(nearestJust(2)).toEqual({ a: 2, b: 1 });
    expect(nearestJust(40)).toEqual({ a: 32, b: 1 });
    for (const k of [1, 5, 11, 17, 23]) {
      const { a, b } = nearestJust(2 ** (k / 24));
      expect(a * b).toBeLessThanOrEqual(256);
      expect(Math.max(a, b)).toBeLessThanOrEqual(32);
    }
  });
});
