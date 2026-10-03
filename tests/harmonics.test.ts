import { describe, it, expect } from 'vitest';
import { computeAmplitudes, type HarmonicSettings } from '../src/audio/harmonics';

const base: HarmonicSettings = { count: 8, start: 1, end: 0.1, curve: 0, filter: 'all', tweaks: {} };

describe('computeAmplitudes', () => {
  it('count 1 is a pure sine', () => {
    expect(computeAmplitudes({ ...base, count: 1 })).toEqual([1]);
  });
  it('interpolates start to end linearly at curve 0', () => {
    const a = computeAmplitudes({ ...base, count: 3, start: 1, end: 0 });
    expect(a[0]).toBeCloseTo(1);
    expect(a[1]).toBeCloseTo(0.5);
    expect(a[2]).toBeCloseTo(0);
  });
  it('clamps count to 1..64', () => {
    expect(computeAmplitudes({ ...base, count: 100 })).toHaveLength(64);
    expect(computeAmplitudes({ ...base, count: 0 })).toHaveLength(1);
  });
  it('tweaks override the curve', () => {
    const a = computeAmplitudes({ ...base, tweaks: { 3: 0.77 } });
    expect(a[2]).toBeCloseTo(0.77);
  });
  it('ignores tweaks above count but they do not break anything', () => {
    expect(computeAmplitudes({ ...base, count: 2, tweaks: { 5: 1 } })).toHaveLength(2);
  });
  it('odd filter zeroes even harmonics, keeps fundamental', () => {
    const a = computeAmplitudes({ ...base, filter: 'odd' });
    expect(a[0]).toBeGreaterThan(0);
    expect(a[1]).toBe(0);
    expect(a[2]).toBeGreaterThan(0);
    expect(a[3]).toBe(0);
  });
  it('even filter zeroes odd harmonics above 1, keeps fundamental', () => {
    const a = computeAmplitudes({ ...base, filter: 'even' });
    expect(a[0]).toBeGreaterThan(0);
    expect(a[1]).toBeGreaterThan(0);
    expect(a[2]).toBe(0);
  });
  it('falls back to a sine when everything is zero', () => {
    expect(computeAmplitudes({ ...base, count: 4, start: 0, end: 0 })).toEqual([1, 0, 0, 0]);
  });
});
