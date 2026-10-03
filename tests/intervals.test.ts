import { describe, it, expect } from 'vitest';
import { intervalByFifths, intervalBySemitones, parseTag, tagName, intervalBetween, nameRatio } from '../src/tuning/intervals';
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
    expect(splitLabel('Major 3rd|5/4')).toMatchObject({ label: 'Major 3rd', body: '5/4' }); // older plain-name tag
    expect(splitLabel('5/4')).toMatchObject({ label: null, body: '5/4' });
    expect(evalRatio('Major 3rd|5/4')).toBe(1.25);
    expect(isPure('Major 3rd|5/4')).toBe(true);
    expect(splitCents('Major 3rd|5/4 -2c')).toEqual({ ratio: '5/4', cents: -2 });
  });
  it('note-picker sources are labelled with their interval', () => {
    const py = (spelling: string) => buildDegree({ source: 'pythagorean', spelling })!;
    expect(splitLabel(py('C♯'))).toMatchObject({ label: 'Augmented unison', body: '3^7 / 2^11' });
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
    expect(rows[0][0].exact).toBe('5/4'); // plain-name tags carry no family: ratios as usual
    expect(rows[1][0].exact).toBe('6/5');
  });
});

describe('note tags (family, variant, position)', () => {
  it('parse and name', () => {
    expect(parseTag('meantone.quarter:4')).toEqual({ family: 'meantone', variant: 'quarter', pos: 4 });
    expect(parseTag('pythagorean:-5')).toEqual({ family: 'pythagorean', variant: null, pos: -5 });
    expect(parseTag('Major 3rd')).toBeNull();
    expect(tagName(parseTag('well.vallotti:6')!)).toBe('Tritone');
    expect(tagName(parseTag('pythagorean:7')!)).toBe('Augmented unison');
  });
  it('interval between two notes of the same family and variant', () => {
    const t = (s: string) => parseTag(s)!;
    expect(intervalBetween(t('meantone.quarter:4'), t('meantone.quarter:1'))).toBe('Minor 3rd'); // E → G
    expect(intervalBetween(t('pythagorean:0'), t('pythagorean:-5'))).toBe('Minor 2nd');
    expect(intervalBetween(t('well.vallotti:4'), t('well.vallotti:11'))).toBe('Perfect 5th'); // 7 semitones
    expect(intervalBetween(t('well.vallotti:4'), t('well.kirnberger3:11'))).toBeNull(); // different variants
    expect(intervalBetween(t('meantone.quarter:0'), t('pythagorean:4'))).toBeNull();
  });
});

describe('inter-note ratios by source', () => {
  it('irrational ratios show 4 decimals; rational ones a fraction', () => {
    const rows = interScaleRatios(['1', '5/4', '1 +13.7c', 'sqrt(2)'], [0, 1, 3]);
    expect(rows[0][1].exact).toBe('1.4142');
    expect(rows[0][0].exact).toBe('5/4');
  });
  it('two notes of the same EDO show the distance in steps', () => {
    const rows = interScaleRatios(['1', '2^(4/12)', '2^(7/12)', '2^(5/19)'], [0, 1, 2, 3]);
    expect(rows[0][0].exact).toBe('4 steps (12EDO)'); // root 1 counts as step 0
    expect(rows[1][0].exact).toBe('3 steps (12EDO)');
    expect(rows[1][1].exact).not.toContain('steps'); // 12EDO vs 19EDO: not the same EDO
  });
  it('named tunings show their ratio again; the musical interval is its own column', () => {
    const notes = [tuningNotes('meantone', 'quarter')[0], tuningNotes('meantone', 'quarter')[4], tuningNotes('meantone', 'quarter')[7]];
    const rows = interScaleRatios(notes, [0, 1, 2]);
    expect(rows[0][0].exact).toBe('5/4'); // quarter-comma major third is pure
    expect(rows[0][1].exact).toBe('1.4953');
    expect(rows[0][0].interval).toBe('Major 3rd');
    expect(rows[0][1].interval).toBe('Perfect 5th');
    expect(rows[1][0].interval).toBe('Minor 3rd');
  });
  it('other pairs are named from the reference ratios with a cents deviation', () => {
    const rows = interScaleRatios(['1', '5/4', '7/4', '2^(4/12)', '2^(7/12)'], [0, 1, 2, 3, 4]);
    expect(rows[0][0].interval).toBe('Major 3rd'); // 1 → 5/4
    expect(rows[0][1].interval).toBe('−27.3¢ Minor 7th'); // 7/4 vs 16/9
    expect(rows[3][0].interval).toBe('Minor 3rd'); // 12EDO 4 → 7 steps: semitone name
  });
});

describe('nameRatio (nearest reference interval, octave-reduced)', () => {
  it('exact reference ratios get the bare name', () => {
    expect(nameRatio(1)).toBe('Unison');
    expect(nameRatio(5 / 4)).toBe('Major 3rd');
    expect(nameRatio(3 / 2)).toBe('Perfect 5th');
    expect(nameRatio(7 / 5)).toBe('Diminished 5th');
    expect(nameRatio(10 / 7)).toBe('Augmented 4th');
    expect(nameRatio(16 / 9)).toBe('Minor 7th');
  });
  it('others get the nearest name with the cents difference in front', () => {
    expect(nameRatio(2 ** (4 / 12))).toBe('+13.7¢ Major 3rd');
    expect(nameRatio(7 / 4)).toBe('−27.3¢ Minor 7th');
    expect(nameRatio(2 ** (18 / 31))).toBe('−5.2¢ Perfect 5th');
  });
  it('reduces to one octave, and wraps just-below-octave ratios to unison', () => {
    expect(nameRatio(5 / 2)).toBe('Major 3rd');
    expect(nameRatio(3 / 8)).toBe('Perfect 5th');
    expect(nameRatio(1.99)).toBe('−8.7¢ Unison');
  });
});
