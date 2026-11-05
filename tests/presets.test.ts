import { describe, it, expect } from 'vitest';
import { computeAmplitudes } from '../src/audio/harmonics';
import { extendSpectrum, MIN_INSTRUMENT_HARMONICS, SYNTH_PRESETS } from '../src/state/presets';

const WAVEFORMS = ['saw', 'square', 'triangle'] as const;
const SYNTHETIC = new Set(['sine', ...WAVEFORMS, 'harm64', 'harm32', 'harm16', 'harm8']);

describe('preset harmonic counts', () => {
  it('waveform presets carry 128 harmonics, all sounding', () => {
    for (const id of WAVEFORMS) {
      expect(SYNTH_PRESETS[id].harmonics.count).toBe(128);
      expect(computeAmplitudes(SYNTH_PRESETS[id].harmonics)).toHaveLength(128);
    }
  });
  it('every instrument preset (and its sustain spectrum) carries at least 32 harmonics', () => {
    for (const [id, p] of Object.entries(SYNTH_PRESETS)) {
      if (SYNTHETIC.has(id)) continue;
      expect(p.harmonics.count, id).toBeGreaterThanOrEqual(MIN_INSTRUMENT_HARMONICS);
      if (p.dark) expect(p.dark.count, `${id} dark`).toBeGreaterThanOrEqual(MIN_INSTRUMENT_HARMONICS);
    }
  });
});

describe('extendSpectrum', () => {
  it('keeps the measured levels and continues a power-law roll-off', () => {
    const measured = Array.from({ length: 10 }, (_, i) => 1 / (i + 1) ** 2);
    const out = extendSpectrum(measured, 32);
    expect(out).toHaveLength(32);
    expect(out.slice(0, 10)).toEqual(measured);
    for (let k = 11; k <= 32; k++) expect(out[k - 1]).toBeCloseTo(1 / k ** 2, 6);
  });
  it('never rises, even when the measured tail does', () => {
    const out = extendSpectrum([1, 0.01, 0.02, 0.04], 16);
    for (let k = 5; k <= 16; k++) expect(out[k - 1]).toBeLessThan(out[k - 2]);
  });
  it('leaves spectra already long enough alone', () => {
    const s = Array.from({ length: 40 }, () => 0.5);
    expect(extendSpectrum(s, 32)).toBe(s);
  });
});
