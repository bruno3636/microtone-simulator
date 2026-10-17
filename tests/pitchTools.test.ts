import { describe, it, expect } from 'vitest';
import { shiftOctave, octaveOf } from '../src/tuning/octave';
import { convertSource, SOURCE_TARGETS, targetKey } from '../src/tuning/convertSource';
import { SCALE_PRESETS } from '../src/tuning/scalePresets';
import { evalRatio, splitLabel, splitCents, parseEdo } from '../src/tuning/ratios';
import { sourceBadge } from '../src/tuning/sourceBadge';
import { buildDegree } from '../src/tuning/degreeInput';
import { DEFAULT_KEYMAPS } from '../src/tuning/presets';
import { degreesForKey } from '../src/tuning/keymaps';

const cents = (n: string) => 1200 * Math.log2(evalRatio(n)!);

describe('shiftOctave', () => {
  it('rational ratios stay tidy fractions', () => {
    expect(shiftOctave('5/4', 1)).toBe('5/2');
    expect(shiftOctave('1 + 1/4', -1)).toBe('5/8');
    expect(shiftOctave('3/2', 1)).toBe('3');
  });
  it('EDO steps move by N steps', () => {
    expect(shiftOctave('2^(7/12)', 1)).toBe('2^(19/12)');
    expect(shiftOctave('2^(3/31) +2c', -1)).toBe('2^(-28/31) +2c');
  });
  it('named notes keep their tag and cents; irrational values get a 2^n factor', () => {
    const n = buildDegree({ source: 'meantone', variant: 'third', spelling: 'G' })! + ' -3c';
    const up = shiftOctave(n, 1);
    expect(splitLabel(up).tag).toEqual({ family: 'meantone', variant: 'third', pos: 1 });
    expect(splitCents(up).cents).toBe(-3);
    expect(cents(up)).toBeCloseTo(cents(n) + 1200, 6);
    // repeated shifts combine into one factor
    expect(splitLabel(shiftOctave(up, 1)).body).toMatch(/\* 2\^\(2\) -3c$/);
    expect(shiftOctave(shiftOctave(up, -1), 0)).toBe(n);
  });
  it('octaveOf ignores the cents offset', () => {
    expect(octaveOf('5/4')).toBe(0);
    expect(octaveOf('5/2')).toBe(1);
    expect(octaveOf('2 -5c')).toBe(1);
    expect(octaveOf('3/8')).toBe(-2);
  });
});

describe('convertSource (switch a pitch to another source)', () => {
  const t = (label: string) => SOURCE_TARGETS(31).find((x) => targetKey(x) === label)!;
  it('lists every source by its badge', () => {
    expect(SOURCE_TARGETS(31).map(targetKey)).toEqual([
      'JI', '12EDO', '31EDO', '13EDT', 'Pyth', '1/3 MT', '1/4 MT', '1/5 MT', '1/6 MT', '2/7 MT', 'Werck', 'Kirn', 'Val', 'Yng',
    ]);
  });
  it('moves to the nearest pitch of the new source, keeping octave and cents offset', () => {
    const fifth12 = convertSource('3/2 +4c', t('12EDO'));
    expect(fifth12).toBe('2^(7/12) +4c');
    expect(convertSource('5/2', t('31EDO'))).toBe('2^(41/31)');
    const pyth = convertSource('2^(4/12)', t('Pyth'));
    expect(sourceBadge(pyth, 'x')).toBe('Pyth');
    expect(splitLabel(pyth).tag?.pos).toBe(4); // Pythagorean major third (81/64)
    const mt = convertSource('5/4', t('1/4 MT'));
    expect(cents(mt)).toBeCloseTo(386.314, 2);
    const well = convertSource('2^(19/12)', t('Val')); // a fifth an octave up
    expect(sourceBadge(well, 'x')).toBe('Val');
    expect(cents(well)).toBeCloseTo(1200 + 698.045, 2); // pure fifth − ⅙ Pythagorean comma
    expect(convertSource('2^(4/12)', t('JI'))).toBe('5/4');
    expect(convertSource('2^(11.9/12)', t('JI'))).toBe('2'); // nearer the octave
  });
  it('the root stays the root', () => {
    for (const k of ['JI', '12EDO', 'Pyth', '1/4 MT', 'Werck']) expect(cents(convertSource('1', t(k)))).toBeCloseTo(0, 6);
  });
});

describe('scale presets', () => {
  it('cover every source and all evaluate', () => {
    const groups = new Set(SCALE_PRESETS.map((p) => p.group));
    expect([...groups]).toEqual(['Just intonation', '12EDO', 'Other EDOs', 'Tritave (EDT)', 'Pythagorean', 'Meantone', 'Well temperament']);
    for (const p of SCALE_PRESETS) {
      expect(p.notes.length, p.id).toBeGreaterThan(3);
      for (const n of p.notes) expect(evalRatio(n), `${p.id} ${n}`).not.toBeNull();
      expect(evalRatio(p.notes[0])).toBe(1);
      const cs = p.notes.map(cents);
      expect(cs.every((c, i) => i === 0 || c > cs[i - 1]), p.id).toBe(true); // ascending, within the period
      expect(cs.at(-1)!).toBeLessThan(1200 * Math.log2(p.period ?? 2));
    }
    expect(new Set(SCALE_PRESETS.map((p) => p.id)).size).toBe(SCALE_PRESETS.length);
    // each group is one contiguous run (the menu shows one heading per group)
    const runs = SCALE_PRESETS.map((p) => p.group).filter((g, i, a) => i === 0 || a[i - 1] !== g);
    expect(runs).toEqual([...groups]);
  });
  it('there are several 12-note just intonation presets', () => {
    const ji12 = SCALE_PRESETS.filter((p) => p.group === 'Just intonation' && p.notes.length === 12);
    expect(ji12.length).toBeGreaterThanOrEqual(5);
    for (const p of ji12) expect(p.notes.every((n) => /^\d+(\/\d+)?$/.test(n)), p.id).toBe(true); // plain ratios
  });
  it('EDO presets are EDO steps of their division', () => {
    const rast = SCALE_PRESETS.find((p) => p.id === 'edo24-rast')!;
    expect(rast).toMatchObject({ tuning: 'custom_edo', edo: 24 });
    expect(rast.notes.slice(1).every((n) => parseEdo(n)?.divisions === 24)).toBe(true);
  });
});

describe('default keymap', () => {
  it("; and ' continue the home row after L", () => {
    expect(degreesForKey(DEFAULT_KEYMAPS.scale, ';', 12)).toEqual([9]);
    expect(degreesForKey(DEFAULT_KEYMAPS.scale, "'", 12)).toEqual([10]);
    expect(degreesForKey(DEFAULT_KEYMAPS.scale, 'c', 12)).toEqual([9]);
  });
  it('piano layout: white keys on the home row, black keys above, continuing into the next octave', () => {
    const order = 'a w s e d f t g y h u j'.split(' ');
    order.forEach((k, deg) => expect(degreesForKey(DEFAULT_KEYMAPS.piano, k, 12), k).toEqual([deg]));
    expect(degreesForKey(DEFAULT_KEYMAPS.piano, 'k', 12)).toEqual([12]);
    expect(degreesForKey(DEFAULT_KEYMAPS.piano, 'o', 12)).toEqual([13]);
    expect(degreesForKey(DEFAULT_KEYMAPS.piano, "'", 12)).toEqual([17]);
  });
});

describe('filterPresets (search in the preset menu)', () => {
  it('matches label, group or note count words, case-insensitively, keeping list order', async () => {
    const { filterPresets } = await import('../src/tuning/scalePresets');
    expect(filterPresets('').length).toBe(SCALE_PRESETS.length);
    const maqam = filterPresets('MAQAM').map((p) => p.id);
    expect(maqam).toEqual(['edo24-rast', 'edo24-bayati', 'edo24-hijaz']);
    expect(filterPresets('meantone dorian').map((p) => p.id)).toEqual(['mt-quarter-dorian']); // every word must match
    expect(filterPresets('zzz')).toEqual([]);
  });
});
