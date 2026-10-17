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
      expect(r.max - r.min).toBeCloseTo(100, 6);
      expect(r.interval.cents - r.min).toBeGreaterThanOrEqual(19.9); // not at an end
      expect(r.max - r.interval.cents).toBeGreaterThanOrEqual(19.9);
      expect(Math.abs(r.start - r.interval.cents)).toBeGreaterThanOrEqual(14.9);
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

describe('custom just intervals', () => {
  it('parses a/b, a:b, integers and exact decimals into a reduced ratio', async () => {
    const { parseCustomInterval } = await import('../src/game/tuningGame');
    expect(parseCustomInterval('13/8')).toMatchObject({ ratio: '13/8', id: 'custom-13/8', name: '' });
    expect(parseCustomInterval('6:4')).toMatchObject({ ratio: '3/2', name: 'Perfect 5th' }); // known names kept
    expect(parseCustomInterval(' 21 : 16 ')!.ratio).toBe('21/16');
    expect(parseCustomInterval('26/16')!.ratio).toBe('13/8');
    expect(parseCustomInterval('1.625')!.ratio).toBe('13/8');
    expect(parseCustomInterval('3')!.ratio).toBe('3/1');
    expect(parseCustomInterval('13/8')!.cents).toBeCloseTo(840.528, 3);
  });
  it('rejects non-just, out-of-range or malformed input', async () => {
    const { parseCustomInterval } = await import('../src/game/tuningGame');
    for (const bad of ['', 'abc', '1', '1/1', '8/9', '9/1', '2^(1/12)', 'sqrt(2)', '0', '-3/2']) {
      expect(parseCustomInterval(bad), bad).toBeNull();
    }
    expect(parseCustomInterval('8/1')!.ratio).toBe('8/1');
  });
  it('newRound accepts a custom interval', async () => {
    const { parseCustomInterval } = await import('../src/game/tuningGame');
    const iv = parseCustomInterval('11/7')!;
    const r = newRound(iv, Math.random, null);
    expect(r.interval).toBe(iv);
    expect(r.min).toBeLessThan(iv.cents);
    expect(r.max).toBeGreaterThan(iv.cents);
  });
});

describe('choosing the base note', () => {
  it('note + octave → Hz (A4 = 440, 12-TET)', async () => {
    const { noteHz } = await import('../src/game/tuningGame');
    expect(noteHz('A', 4)).toBeCloseTo(440, 9);
    expect(noteHz('C', 4)).toBeCloseTo(261.626, 3);
    expect(noteHz('C♯', 2)).toBeCloseTo(69.296, 3);
    expect(noteHz('B', 6)).toBeCloseTo(1975.533, 3);
  });
  it('Hz → the nearest note and octave', async () => {
    const { nearestNote } = await import('../src/game/tuningGame');
    expect(nearestNote(440)).toEqual({ name: 'A', octave: 4 });
    expect(nearestNote(261.63)).toEqual({ name: 'C', octave: 4 });
    expect(nearestNote(123.47)).toEqual({ name: 'B', octave: 2 });
    expect(nearestNote(255)).toEqual({ name: 'C', octave: 4 }); // nearer C4 than B3
  });
  it('a chosen base is used as is', () => {
    const r = newRound(GAME_INTERVALS[0], Math.random, 110);
    expect(r.baseHz).toBe(110);
  });
});
