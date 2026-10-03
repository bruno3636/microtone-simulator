import { describe, it, expect } from 'vitest';
import { intervalByFifths, intervalBySemitones } from '../src/tuning/intervals';
import { splitLabel, evalRatio, isPure, splitCents } from '../src/tuning/ratios';
import { tuningNotes } from '../src/tuning/presets';
import { buildDegree } from '../src/tuning/degreeInput';
import { interScaleRatios } from '../src/tuning/interScale';

describe('interval names', () => {
  it('from the chain of fifths (Pythagorean / meantone spellings)', () => {
    expect(intervalByFifths(0)).toBe('Perfect unison');
    expect(intervalByFifths(1)).toBe('Perfect 5th');
    expect(intervalByFifths(-1)).toBe('Perfect 4th');
    expect(intervalByFifths(4)).toBe('Major 3rd');
    expect(intervalByFifths(-3)).toBe('Minor 3rd');
    expect(intervalByFifths(-5)).toBe('Minor 2nd');
    expect(intervalByFifths(7)).toBe('Augmented unison');
    expect(intervalByFifths(6)).toBe('Augmented 4th');
    expect(intervalByFifths(-6)).toBe('Diminished 5th');
    expect(intervalByFifths(8)).toBe('Augmented 5th');
  });
  it('from semitones (well temperament: enharmonics coincide)', () => {
    expect(intervalBySemitones(4)).toBe('Major 3rd');
    expect(intervalBySemitones(6)).toBe('Tritone');
    expect(intervalBySemitones(11)).toBe('Major 7th');
  });
});

describe('labelled notes ("Major 3rd|5/4")', () => {
  it('splits the label from the expression; the maths ignores it', () => {
    expect(splitLabel('Major 3rd|5/4')).toEqual({ label: 'Major 3rd', body: '5/4' });
    expect(splitLabel('5/4')).toEqual({ label: null, body: '5/4' });
    expect(evalRatio('Major 3rd|5/4')).toBe(1.25);
    expect(isPure('Major 3rd|5/4')).toBe(true);
    expect(splitCents('Major 3rd|5/4 -2c')).toEqual({ ratio: '5/4', cents: -2 });
  });
  it('note-picker sources are labelled with their interval', () => {
    const py = (spelling: string) => buildDegree({ source: 'pythagorean', spelling })!;
    expect(splitLabel(py('C♯'))).toEqual({ label: 'Augmented unison', body: '3^7 / 2^11' });
    expect(splitLabel(py('D♭')).label).toBe('Minor 2nd');
    expect(splitLabel(py('C')).label).toBe('Perfect unison');
    expect(splitLabel(buildDegree({ source: 'meantone', variant: 'quarter', spelling: 'E' })!).label).toBe('Major 3rd');
    expect(evalRatio(buildDegree({ source: 'meantone', variant: 'quarter', spelling: 'E' })!)).toBeCloseTo(1.25, 12);
    expect(splitLabel(buildDegree({ source: 'well', variant: 'vallotti', note: 6 })!).label).toBe('Tritone');
  });
  it('the Pythagorean, meantone and well-temperament templates are labelled too', () => {
    expect(splitLabel(tuningNotes('pythagorean_tuning')[6]).label).toBe('Diminished 5th');
    expect(splitLabel(tuningNotes('meantone', 'quarter')[8]).label).toBe('Augmented 5th');
    expect(splitLabel(tuningNotes('meantone', 'quarter')[4]).label).toBe('Major 3rd');
    expect(splitLabel(tuningNotes('well_temperament', 'werckmeister3')[6]).label).toBe('Tritone');
    expect(splitLabel(tuningNotes('just_intonation')[4]).label).toBeNull();
  });
  it('inter-note ratios work with labelled notes', () => {
    const rows = interScaleRatios(['Perfect unison|1', 'Major 3rd|5/4', 'Perfect 5th|3/2'], [0, 1, 2]);
    expect(rows[0][0].exact).toBe('5/4');
    expect(rows[1][0].exact).toBe('6/5');
  });
});
