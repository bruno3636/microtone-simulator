import { describe, it, expect } from 'vitest';
import { buildDegree, DEGREE_SOURCES } from '../src/tuning/degreeInput';
import { evalRatio } from '../src/tuning/ratios';

const value = (s: string | null) => (s == null ? null : evalRatio(s));
const cents = (s: string | null) => 1200 * Math.log2(value(s)!);

describe('buildDegree (insert degree from a typed value)', () => {
  it('offers every source, including Cents and Frequency', () => {
    expect(DEGREE_SOURCES.map((s) => s.id)).toEqual([
      'ji', 'tempered_ji', 'edo12', 'custom_edo', 'pythagorean', 'meantone', 'well', 'cents', 'frequency',
    ]);
  });
  it('just intonation: a ratio expression', () => {
    expect(buildDegree({ source: 'ji', ratio: ' 7/4 ' })).toBe('7/4');
    expect(buildDegree({ source: 'ji', ratio: '7/' })).toBeNull();
  });
  it('tempered JI: ratio ± cents', () => {
    expect(buildDegree({ source: 'tempered_ji', ratio: '5/4', cents: -13.7 })).toBe('5/4 -13.7c');
    expect(buildDegree({ source: 'tempered_ji', ratio: 'x', cents: 1 })).toBeNull();
  });
  it('EDO: steps of 12 or of N', () => {
    expect(value(buildDegree({ source: 'edo12', steps: 7 }))).toBeCloseTo(2 ** (7 / 12), 12);
    expect(buildDegree({ source: 'edo12', steps: 0 })).toBe('1');
    expect(value(buildDegree({ source: 'custom_edo', steps: 11, divisions: 19 }))).toBeCloseTo(2 ** (11 / 19), 12);
    expect(buildDegree({ source: 'custom_edo', steps: 1, divisions: 0 })).toBeNull();
  });
  it('Pythagorean: a note of the 12-note Pythagorean tuning (root = C)', () => {
    expect(value(buildDegree({ source: 'pythagorean', note: 7 }))).toBeCloseTo(3 / 2, 12);
    expect(value(buildDegree({ source: 'pythagorean', note: 5 }))).toBeCloseTo(4 / 3, 12);
    expect(value(buildDegree({ source: 'pythagorean', note: 2 }))).toBeCloseTo(9 / 8, 12);
    expect(value(buildDegree({ source: 'pythagorean', note: 6 }))).toBeCloseTo(1024 / 729, 12);
    expect(buildDegree({ source: 'pythagorean', note: 0 })).toBe('1');
    expect(buildDegree({ source: 'pythagorean', note: -1 })).toBeNull();
  });
  it('meantone: a note of the chosen variant (root = C)', () => {
    expect(value(buildDegree({ source: 'meantone', variant: 'quarter', note: 4 }))).toBeCloseTo(5 / 4, 12);
    expect(cents(buildDegree({ source: 'meantone', variant: 'third', note: 7 }))).toBeCloseTo(694.786, 2);
    expect(value(buildDegree({ source: 'meantone', variant: 'quarter', note: 5 }))).toBeCloseTo(2 / 5 ** 0.25, 12);
    expect(buildDegree({ source: 'meantone', variant: 'quarter', note: 12 })).toBeNull();
  });
  it('well temperament: a note of the chosen variant', () => {
    expect(cents(buildDegree({ source: 'well', variant: 'werckmeister3', note: 4 }))).toBeCloseTo(390.225, 2);
    expect(buildDegree({ source: 'well', variant: 'vallotti', note: 12 })).toBeNull();
  });
  it('cents: an editable cents offset from the root', () => {
    expect(buildDegree({ source: 'cents', cents: 701.955 })).toBe('1 +702c');
    expect(cents(buildDegree({ source: 'cents', cents: 386.3 }))).toBeCloseTo(386.3, 6);
  });
  it('frequency: Hz relative to the current root', () => {
    expect(buildDegree({ source: 'frequency', hz: 660, rootHz: 440 })).toBe('660 / 440');
    expect(value(buildDegree({ source: 'frequency', hz: 523.251, rootHz: 440 }))).toBeCloseTo(523.251 / 440, 12);
    expect(buildDegree({ source: 'frequency', hz: 0, rootHz: 440 })).toBeNull();
  });
});
