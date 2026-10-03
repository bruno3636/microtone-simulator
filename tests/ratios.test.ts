import { describe, it, expect } from 'vitest';
import { evalRatio, degreeRatio, degreeFreq, isPure, createFromTemplate, mod } from '../src/tuning/ratios';
import { TUNINGS } from '../src/tuning/presets';

describe('ratios', () => {
  it('evaluates every preset expression to a positive number', () => {
    for (const t of Object.values(TUNINGS)) for (const n of t.notes) expect(evalRatio(n)).toBeGreaterThan(0);
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
});
