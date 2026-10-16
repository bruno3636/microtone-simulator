import { describe, it, expect } from 'vitest';
import { sourceBadge } from '../src/tuning/sourceBadge';
import { alternativesFor, buildDegree } from '../src/tuning/degreeInput';
import { splitLabel, evalRatio } from '../src/tuning/ratios';

describe('sourceBadge (label right of the coloured square)', () => {
  it('ratios are JI (just, tempered, cents)', () => {
    expect(sourceBadge('5/4', 'just_intonation')).toBe('JI');
    expect(sourceBadge('5/4 -13.7c', 'just_intonation')).toBe('JI');
    expect(sourceBadge('1 +386.3c', 'just_intonation')).toBe('JI');
  });
  it('EDO steps name their EDO (the root 1 too, in an EDO tuning)', () => {
    expect(sourceBadge('2^(7/12)', 'just_intonation')).toBe('12EDO');
    expect(sourceBadge('2^(18/31)', 'custom_edo', 31)).toBe('31EDO');
    expect(sourceBadge('2^(5/19)', 'just_intonation')).toBe('19EDO');
    expect(sourceBadge('2^(7/12) +3c', 'just_intonation')).toBe('12EDO');
    expect(sourceBadge('1 -2c', 'custom_edo', 22)).toBe('22EDO');
    expect(sourceBadge('1', 'custom_edo', 22)).toBe('22EDO');
    expect(sourceBadge('1', 'edo12', 31)).toBe('12EDO');
    expect(sourceBadge('1', 'just_intonation')).toBe('JI');
  });
  it('named tunings show their family / variant', () => {
    expect(sourceBadge(buildDegree({ source: 'pythagorean', spelling: 'E' })!, 'just_intonation')).toBe('Pyth');
    expect(sourceBadge(buildDegree({ source: 'meantone', variant: 'quarter', spelling: 'E' })!, 'just_intonation')).toBe('1/4 MT');
    expect(sourceBadge(buildDegree({ source: 'meantone', variant: 'twoSevenths', spelling: 'E' })!, 'x')).toBe('2/7 MT');
    expect(sourceBadge(buildDegree({ source: 'meantone', variant: 'third', spelling: 'E' })!, 'x')).toBe('1/3 MT');
    const well = (variant: string) => sourceBadge(buildDegree({ source: 'well', variant, note: 4 })!, 'x');
    expect([well('werckmeister3'), well('kirnberger3'), well('vallotti'), well('young')]).toEqual(['Werck', 'Kirn', 'Val', 'Yng']);
  });
});

describe('alternativesFor (interval dropdown on named cards)', () => {
  it('lists the other intervals of the same family and variant', () => {
    const tag = splitLabel(buildDegree({ source: 'meantone', variant: 'third', spelling: 'E' })!).tag!;
    const alts = alternativesFor(tag);
    expect(alts).toHaveLength(17);
    expect(alts.map((a) => a.name).slice(0, 3)).toEqual(['Perfect unison', 'Augmented unison', 'Minor 2nd']);
    const fifth = alts.find((a) => a.name === 'Perfect 5th')!;
    expect(splitLabel(fifth.note).tag).toEqual({ family: 'meantone', variant: 'third', pos: 1 });
    expect(1200 * Math.log2(evalRatio(fifth.note)!)).toBeCloseTo(694.786, 2);
  });
  it('well temperament offers its 12 intervals', () => {
    const tag = splitLabel(buildDegree({ source: 'well', variant: 'vallotti', note: 4 })!).tag!;
    const alts = alternativesFor(tag);
    expect(alts).toHaveLength(12);
    expect(alts[6]).toMatchObject({ name: 'Tritone', pos: 6 });
  });
});
