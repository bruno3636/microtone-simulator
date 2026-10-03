import { describe, it, expect } from 'vitest';
import { normalizeRms, periodicWaveCoeffs, buildWavetable } from '../src/audio/timbre';

describe('timbre', () => {
  it('normalizeRms gives sum of squares = 1', () => {
    expect(normalizeRms([3, 4])).toEqual([0.6, 0.8]);
    expect(normalizeRms([1])).toEqual([1]);
  });
  it('periodicWaveCoeffs puts amplitudes in imag[1..]', () => {
    const { real, imag } = periodicWaveCoeffs([0.5, 0.25]);
    expect(real).toHaveLength(3);
    expect(Array.from(imag)).toEqual([0, 0.5, 0.25]);
    expect(Array.from(real)).toEqual([0, 0, 0]);
  });
  it('wavetable matches the analytic sum', () => {
    const amps = [0.5, 0.25];
    const t = buildWavetable(amps, 64);
    const i = 5;
    const x = (2 * Math.PI * i) / 64;
    expect(t[i]).toBeCloseTo(0.5 * Math.sin(x) + 0.25 * Math.sin(2 * x), 5);
  });
  it('normalized timbre has unit-sine RMS', () => {
    const t = buildWavetable(normalizeRms([1, 0.5, 0.3, 0.2]), 2048);
    const rms = Math.sqrt(t.reduce((s, v) => s + v * v, 0) / t.length);
    expect(rms).toBeCloseTo(Math.SQRT1_2, 3);
  });
});
