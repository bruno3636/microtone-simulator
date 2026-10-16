import { describe, it, expect } from 'vitest';
import { buildDegree, DEGREE_SOURCES, SPELLED_NOTES, spelledInterval } from '../src/tuning/degreeInput';
import { evalRatio } from '../src/tuning/ratios';

const value = (s: string | null) => (s == null ? null : evalRatio(s));
const cents = (s: string | null) => 1200 * Math.log2(value(s)!);

describe('buildDegree (insert degree from a typed value)', () => {
  it('offers every source', () => {
    expect(DEGREE_SOURCES.map((s) => s.id)).toEqual([
      'ji', 'edo12', 'custom_edo', 'pythagorean', 'meantone', 'well', 'cents',
    ]);
  });
  it('just intonation: a ratio expression', () => {
    expect(buildDegree({ source: 'ji', ratio: ' 7/4 ' })).toBe('7/4');
    expect(buildDegree({ source: 'ji', ratio: '7/' })).toBeNull();
  });
  it('JI + cents: ratio with an optional cents offset', () => {
    expect(buildDegree({ source: 'ji', ratio: '5/4', cents: -13.7 })).toBe('5/4 -13.7c');
    expect(buildDegree({ source: 'ji', ratio: '5/4', cents: 0 })).toBe('5/4');
    expect(buildDegree({ source: 'ji', ratio: '5/4' })).toBe('5/4');
    expect(buildDegree({ source: 'ji', ratio: 'x', cents: 1 })).toBeNull();
  });
  it('EDO: steps of 12 or of N', () => {
    expect(value(buildDegree({ source: 'edo12', steps: 7 }))).toBeCloseTo(2 ** (7 / 12), 12);
    expect(buildDegree({ source: 'edo12', steps: 0 })).toBe('1');
    expect(value(buildDegree({ source: 'custom_edo', steps: 11, divisions: 19 }))).toBeCloseTo(2 ** (11 / 19), 12);
    expect(buildDegree({ source: 'custom_edo', steps: 1, divisions: 0 })).toBeNull();
  });
  it('spelled notes: sharps and flats are separate entries placed on the chain of fifths', () => {
    expect(SPELLED_NOTES.map((n) => n.name)).toEqual([
      'C', 'C♯', 'D♭', 'D', 'D♯', 'E♭', 'E', 'F', 'F♯', 'G♭', 'G', 'G♯', 'A♭', 'A', 'A♯', 'B♭', 'B',
    ]);
    const fifths = Object.fromEntries(SPELLED_NOTES.map((n) => [n.name, n.fifths]));
    expect(fifths).toMatchObject({ C: 0, G: 1, F: -1, 'C♯': 7, 'D♭': -5, 'F♯': 6, 'G♭': -6 });
  });
  it('Pythagorean: sharps and flats are distinct pitches', () => {
    const py = (spelling: string) => buildDegree({ source: 'pythagorean', spelling });
    expect(value(py('G'))).toBeCloseTo(3 / 2, 12);
    expect(value(py('F'))).toBeCloseTo(4 / 3, 12);
    expect(value(py('C♯'))).toBeCloseTo(2187 / 2048, 12); // 113.7¢ apotome
    expect(value(py('D♭'))).toBeCloseTo(256 / 243, 12); // 90.2¢ limma
    expect(value(py('F♯'))).toBeCloseTo(729 / 512, 12);
    expect(value(py('G♭'))).toBeCloseTo(1024 / 729, 12);
    expect(evalRatio(py('C')!)).toBe(1);
    expect(py('H')).toBeNull();
  });
  it('meantone: sharps and flats are distinct pitches in the chosen variant', () => {
    const mt = (spelling: string, variant = 'quarter') => buildDegree({ source: 'meantone', variant, spelling });
    expect(value(mt('E'))).toBeCloseTo(5 / 4, 12);
    expect(cents(mt('C♯'))).toBeCloseTo(76.049, 2);
    expect(cents(mt('D♭'))).toBeCloseTo(117.108, 2);
    expect(cents(mt('G♯'))).toBeCloseTo(772.627, 2);
    expect(cents(mt('A♭'))).toBeCloseTo(813.686, 2);
    expect(cents(mt('G', 'third'))).toBeCloseTo(694.786, 2);
  });
  it('well temperament: a note of the chosen variant', () => {
    expect(cents(buildDegree({ source: 'well', variant: 'werckmeister3', note: 4 }))).toBeCloseTo(390.225, 2);
    expect(buildDegree({ source: 'well', variant: 'vallotti', note: 12 })).toBeNull();
  });
  it('cents: an editable cents offset from the root', () => {
    expect(buildDegree({ source: 'cents', cents: 701.955 })).toBe('1 +702c');
    expect(cents(buildDegree({ source: 'cents', cents: 386.3 }))).toBeCloseTo(386.3, 6);
  });
  it('note pickers list interval names (spelled for Pythagorean / meantone)', () => {
    expect(SPELLED_NOTES.map(spelledInterval)).toEqual([
      'Perfect unison', 'Augmented unison', 'Minor 2nd', 'Major 2nd', 'Augmented 2nd', 'Minor 3rd', 'Major 3rd',
      'Perfect 4th', 'Augmented 4th', 'Diminished 5th', 'Perfect 5th', 'Augmented 5th', 'Minor 6th', 'Major 6th',
      'Augmented 6th', 'Minor 7th', 'Major 7th',
    ]);
  });
});
