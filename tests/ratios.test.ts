import { describe, it, expect } from 'vitest';
import { evalRatio, degreeRatio, degreeFreq, isPure, createFromTemplate, mod, splitCents, joinCents } from '../src/tuning/ratios';
import { TUNINGS, TUNING_ORDER, tuningNotes } from '../src/tuning/presets';

const cents = (expr: string) => 1200 * Math.log2(evalRatio(expr)!);

describe('ratios', () => {
  it('evaluates every preset expression to a positive number', () => {
    for (const [id, t] of Object.entries(TUNINGS)) {
      for (const v of [undefined, ...Object.keys(t.variants ?? {})]) {
        for (const n of tuningNotes(id, v, 19)) expect(evalRatio(n)).toBeGreaterThan(0);
      }
    }
  });
  it('evaluates JI and ET expressions', () => {
    expect(evalRatio('1 + 1/2')).toBeCloseTo(1.5);
    expect(evalRatio('2^(7/12)')).toBeCloseTo(1.4983, 4);
    expect(evalRatio('nthRoot(5,4)')).toBeCloseTo(1.4953, 4);
  });
  it('returns null for invalid or non-positive input', () => {
    expect(evalRatio('1 +')).toBeNull();
    expect(evalRatio('foo')).toBeNull();
    expect(evalRatio('0')).toBeNull();
    expect(evalRatio('')).toBeNull();
  });
  it('mod handles negatives', () => {
    expect(mod(-1, 7)).toBe(6);
  });
  it('maps degrees across octaves', () => {
    const notes = ['1', '5/4', '3/2'];
    expect(degreeRatio(notes, 4)).toBeCloseTo(2.5);
    expect(degreeRatio(notes, -1)).toBeCloseTo(0.75);
    expect(degreeFreq(notes, 2, 440)).toBeCloseTo(660);
    expect(degreeRatio(['1', 'bad'], 1)).toBeNull();
  });
  it('detects pure intervals', () => {
    expect(isPure('3/2')).toBe(true);
    expect(isPure('1 + 1/4')).toBe(true);
    expect(isPure('2^(7/12)')).toBe(false);
  });
  it('builds a scale from a template and forces chromatic for non-scalable tunings', () => {
    const maj = createFromTemplate('just_intonation', 'major');
    expect(maj.notes).toHaveLength(7);
    expect(maj.notes[4]).toBe('1 + 1/2');
    const hs = createFromTemplate('harmonic_series', 'major');
    expect(hs.scale).toBe('chromatic');
    expect(hs.notes).toHaveLength(12);
  });

  describe('tuning roster', () => {
    it('offers exactly the requested tunings, in order', () => {
      expect(TUNING_ORDER).toEqual([
        'just_intonation', 'tempered_ji', 'harmonic_series', 'edo12', 'custom_edo', 'pythagorean_tuning', 'meantone', 'well_temperament',
      ]);
      expect([...TUNING_ORDER].sort()).toEqual(Object.keys(TUNINGS).sort());
    });
    it('custom EDO divides the octave into N equal steps', () => {
      const n = tuningNotes('custom_edo', undefined, 19);
      expect(n).toHaveLength(19);
      expect(evalRatio(n[1])).toBeCloseTo(2 ** (1 / 19), 12);
      expect(tuningNotes('custom_edo', undefined, 31)).toHaveLength(31);
    });
    it('12EDO is 100-cent steps', () => {
      expect(cents(tuningNotes('edo12')[7])).toBeCloseTo(700, 9);
    });
  });

  describe('meantone variants', () => {
    // fifth size (cents) = 701.955 − f × syntonic comma (21.506)
    const fifths: Record<string, number> = { third: 694.786, quarter: 696.578, fifth: 697.654, sixth: 698.371, twoSevenths: 695.810 };
    it('each variant tempers the fifth by its fraction of the syntonic comma', () => {
      for (const [v, f] of Object.entries(fifths)) expect(cents(tuningNotes('meantone', v)[7])).toBeCloseTo(f, 2);
    });
    it('quarter-comma has pure major thirds and matches the classic ratios', () => {
      expect(evalRatio(tuningNotes('meantone', 'quarter')[4])).toBeCloseTo(5 / 4, 12);
      expect(evalRatio(tuningNotes('meantone', 'quarter')[7])).toBeCloseTo(5 ** 0.25, 12);
    });
    it('third-comma has pure minor thirds', () => {
      expect(evalRatio(tuningNotes('meantone', 'third')[3])).toBeCloseTo(6 / 5, 12);
    });
    it('the variant menu is ⅓, ¼, ⅕, ⅙ and 2/7-comma, defaulting to ¼', () => {
      expect(Object.keys(TUNINGS.meantone.variants!)).toEqual(['third', 'quarter', 'fifth', 'sixth', 'twoSevenths']);
      expect(TUNINGS.meantone.defaultVariant).toBe('quarter');
    });
  });

  describe('well temperaments', () => {
    // pitch of each note in cents above C, from each temperament's documented tempered fifths
    const check = (v: string, expected: Record<number, number>) => {
      const n = tuningNotes('well_temperament', v);
      for (const [i, c] of Object.entries(expected)) expect(cents(n[Number(i)])).toBeCloseTo(c, 2);
    };
    it('Werckmeister III', () => check('werckmeister3', { 2: 192.18, 4: 390.225, 6: 588.27, 7: 696.09, 9: 888.27, 11: 1092.18 }));
    it('Kirnberger III (pure 5/4 major third C–E)', () => check('kirnberger3', { 2: 193.157, 4: 386.314, 9: 889.735, 1: 90.225 }));
    it('Vallotti', () => check('vallotti', { 4: 392.18, 6: 592.18, 11: 1090.225, 5: 501.955 }));
    it('Young (1799)', () => check('young', { 4: 392.18, 6: 588.27, 11: 1090.225, 5: 498.045 }));
  });

  describe('tempered JI: ratio ± cents', () => {
    it('parses a cents offset after the ratio', () => {
      expect(evalRatio('3/2 -2c')).toBeCloseTo(1.5 * 2 ** (-2 / 1200), 12);
      expect(evalRatio('5/4+13.7c')).toBeCloseTo(1.25 * 2 ** (13.7 / 1200), 12);
      expect(evalRatio('5/4 + 0c')).toBe(1.25);
      expect(evalRatio('5/4 -13.7 cents')).toBeCloseTo(1.25 * 2 ** (-13.7 / 1200), 12);
      expect(splitCents('16/15 +0c')).toEqual({ ratio: '16/15', cents: 0 });
      expect(splitCents('3/2')).toEqual({ ratio: '3/2', cents: null });
      expect(joinCents('5/4', -13.7)).toBe('5/4 -13.7c');
      expect(joinCents('5/4', 0)).toBe('5/4 +0c');
    });
    it('a tempered degree is only "pure" when its offset is zero', () => {
      expect(isPure('5/4 +0c')).toBe(true);
      expect(isPure('5/4 -13.7c')).toBe(false);
    });
    it('the template is the just ratios with a zero offset each', () => {
      const n = tuningNotes('tempered_ji');
      expect(n).toHaveLength(12);
      expect(n[7]).toBe('3/2 +0c');
      expect(evalRatio(n[4])).toBe(1.25);
    });
  });
});
