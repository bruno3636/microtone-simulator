import { describe, it, expect } from 'vitest';
import { levelAt, releaseLevelAt, sampleSegment, effMs, type EnvelopeSettings } from '../src/audio/envelope';

const env: EnvelopeSettings = {
  attack: 100, decay: 200, sustain: 0.5, release: 400,
  attackCurve: 'lin', decayCurve: 'lin', releaseCurve: 'lin',
};

describe('envelope', () => {
  it('starts at 0 and peaks at the end of attack', () => {
    expect(levelAt(env, 0)).toBe(0);
    expect(levelAt(env, 50)).toBeCloseTo(0.5);
    expect(levelAt(env, 100)).toBeCloseTo(1);
  });
  it('decays to sustain and holds', () => {
    expect(levelAt(env, 200)).toBeCloseTo(0.75);
    expect(levelAt(env, 300)).toBeCloseTo(0.5);
    expect(levelAt(env, 10_000)).toBeCloseTo(0.5);
  });
  it('releases from an arbitrary level to 0', () => {
    expect(releaseLevelAt(env, 0.3, 0)).toBeCloseTo(0.3);
    expect(releaseLevelAt(env, 0.3, 200)).toBeCloseTo(0.15);
    expect(releaseLevelAt(env, 0.3, 400)).toBe(0);
    expect(releaseLevelAt(env, 0.3, 1000)).toBe(0);
  });
  it('applies the 3 ms floor to zero-length segments', () => {
    expect(effMs(0)).toBe(3);
    const zero = { ...env, attack: 0 };
    expect(levelAt(zero, 1.5)).toBeCloseTo(0.5);
    expect(levelAt(zero, 3)).toBeCloseTo(1);
  });
  it('sampleSegment returns exact endpoints and the requested length', () => {
    const s = sampleSegment(1, 0.2, 'exp', 256);
    expect(s).toHaveLength(256);
    expect(s[0]).toBeCloseTo(1);
    expect(s[255]).toBeCloseTo(0.2);
    expect(s[128]).toBeLessThan(0.6); // EXP is below the chord
  });
});
