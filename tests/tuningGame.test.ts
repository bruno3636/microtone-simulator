import { describe, it, expect } from 'vitest';
import { GAME_INTERVALS, newRound, rate, describeError } from '../src/game/tuningGame';

/** deterministic rng from a list of values in [0, 1) */
const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };

describe('tuning game', () => {
  it('offers just intervals with exact cents', () => {
    const fifth = GAME_INTERVALS.find((x) => x.ratio === '3/2')!;
    expect(fifth.name).toBe('Perfect 5th');
    expect(fifth.cents).toBeCloseTo(701.955, 3);
    expect(GAME_INTERVALS.every((x, i) => i === 0 || x.cents > GAME_INTERVALS[i - 1].cents)).toBe(true);
    expect(new Set(GAME_INTERVALS.map((x) => x.id)).size).toBe(GAME_INTERVALS.length);
  });

  it('a round hides the target: shifted slider, a start well away from it, a base note in range', () => {
    for (let k = 0; k < 200; k++) {
      const r = newRound('3-2', Math.random, null);
      expect(r.interval.ratio).toBe('3/2');
      expect(r.baseHz).toBeGreaterThanOrEqual(196);
      expect(r.baseHz).toBeLessThanOrEqual(392);
      expect(r.min).toBeLessThan(r.interval.cents);
      expect(r.max).toBeGreaterThan(r.interval.cents);
      expect(r.max - r.min).toBeCloseTo(300, 6);
      expect(Math.abs(r.start - r.interval.cents)).toBeGreaterThanOrEqual(25);
      expect(Math.abs(r.start - r.interval.cents)).toBeLessThanOrEqual(120);
      expect(r.start).toBeGreaterThanOrEqual(r.min);
      expect(r.start).toBeLessThanOrEqual(r.max);
    }
  });

  it('random picks any interval; a fixed base frequency is used when given', () => {
    const r = newRound('random', seq(0.999, 0.5, 0.5, 0.5, 0.5), 261.63);
    expect(r.interval).toBe(GAME_INTERVALS.at(-1));
    expect(r.baseHz).toBe(261.63);
  });

  it('rates the error and says sharp / flat', () => {
    expect(rate(0.4).label).toBe('Perfect');
    expect(rate(-2).label).toBe('Excellent');
    expect(rate(5).label).toBe('Great');
    expect(rate(-9).label).toBe('Good');
    expect(rate(20).label).toBe('Close');
    expect(rate(-60).label).toBe('Keep practising');
    expect(describeError(3.24)).toBe('3.2¢ sharp');
    expect(describeError(-0.04)).toBe('spot on');
    expect(describeError(-7.5)).toBe('7.5¢ flat');
  });
});
