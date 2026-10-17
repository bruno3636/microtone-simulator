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
      expect(r.baseHz).toBeGreaterThanOrEqual(220);
      expect(r.baseHz).toBeLessThanOrEqual(440);
      expect(r.min).toBeLessThan(r.interval.cents);
      expect(r.max).toBeGreaterThan(r.interval.cents);
      expect(r.max - r.min).toBeGreaterThanOrEqual(64 - 1e-6);
      expect(r.max - r.min).toBeLessThanOrEqual(128 + 1e-6);
      expect(r.interval.cents - r.min).toBeGreaterThanOrEqual(19.9); // not at an end
      expect(r.max - r.interval.cents).toBeGreaterThanOrEqual(19.9);
      expect(Math.abs(r.start - r.interval.cents)).toBeGreaterThanOrEqual(14.9);
      expect(r.start).toBeGreaterThanOrEqual(r.min);
      expect(r.start).toBeLessThanOrEqual(r.max);
    }
  });

  it('the slider width varies between 64 and 128 cents', () => {
    const widths = Array.from({ length: 300 }, () => { const r = newRound('3-2'); return r.max - r.min; });
    expect(Math.min(...widths)).toBeLessThan(75);
    expect(Math.max(...widths)).toBeGreaterThan(117);
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
    for (const bad of ['', 'abc', '1', '1/1', '8/9', '33/1', '2^(1/12)', 'sqrt(2)', '0', '-3/2', '3/0', '3^12/2^19']) {
      expect(parseCustomInterval(bad), bad).toBeNull();
    }
    expect(parseCustomInterval('8/1')!.ratio).toBe('8/1');
    expect(parseCustomInterval('32/1')!.ratio).toBe('32/1');
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

describe('big ratios', () => {
  it('large numerators and denominators are read exactly (no rounding through decimals)', async () => {
    const { parseCustomInterval } = await import('../src/game/tuningGame');
    const comma = parseCustomInterval('531441/524288')!; // Pythagorean comma
    expect(comma.ratio).toBe('531441/524288');
    expect(comma.cents).toBeCloseTo(23.46, 2);
    expect(parseCustomInterval('1048576/1048575')!.cents).toBeCloseTo(0.00165, 4);
    expect(parseCustomInterval('4096/3125')!.ratio).toBe('4096/3125');
    expect(parseCustomInterval('2187/2048')!.ratio).toBe('2187/2048');
    expect(parseCustomInterval('1000000/999999')).not.toBeNull();
    expect(parseCustomInterval('99999999999999999999/50000000000000000000')!.ratio).toBe('99999999999999999999/50000000000000000000');
  });
  it('wide intervals up to 32/1 (five octaves)', async () => {
    const { parseCustomInterval, MAX_CUSTOM } = await import('../src/game/tuningGame');
    expect(MAX_CUSTOM).toBe(32);
    expect(parseCustomInterval('16/1')!.cents).toBeCloseTo(4800, 6);
    expect(parseCustomInterval('25:1')!.ratio).toBe('25/1');
    expect(parseCustomInterval('1.5/1')!.ratio).toBe('3/2');
    expect(parseCustomInterval('12.5')!.ratio).toBe('25/2');
  });
});

describe('cents targets', () => {
  it('parses a size in cents (optionally with ¢ or c)', async () => {
    const { parseCentsInterval } = await import('../src/game/tuningGame');
    expect(parseCentsInterval('386.3')).toMatchObject({ cents: 386.3, ratio: '386.3¢', name: '', kind: 'cents' });
    expect(parseCentsInterval(' 700 ¢ ')!.cents).toBe(700);
    expect(parseCentsInterval('551.3c')!.cents).toBe(551.3);
    expect(parseCentsInterval('6000')!.cents).toBe(6000);
  });
  it('rejects zero, negatives, too large or non-numbers', async () => {
    const { parseCentsInterval } = await import('../src/game/tuningGame');
    for (const bad of ['', '0', '-50', '6000.5', 'abc', '3/2', '1e3']) expect(parseCentsInterval(bad), bad).toBeNull();
  });
  it('a round can use a cents target', async () => {
    const { parseCentsInterval } = await import('../src/game/tuningGame');
    const iv = parseCentsInterval('700')!;
    const r = newRound(iv, Math.random, 300);
    expect(r.interval.cents).toBe(700);
    expect(r.min).toBeLessThan(700);
    expect(r.max).toBeGreaterThan(700);
  });
});
