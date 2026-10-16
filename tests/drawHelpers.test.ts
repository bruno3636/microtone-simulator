import { describe, it, expect } from 'vitest';
import { sampleTable, tablePeak, findTrigger, blendedSample } from '../src/viz/drawWave';
import { freqToX } from '../src/viz/drawSpectrum';

describe('draw helpers', () => {
  const table = new Float32Array([0, 1, 0, -1]);
  it('sampleTable interpolates and wraps', () => {
    expect(sampleTable(table, 0)).toBe(0);
    expect(sampleTable(table, 0.25)).toBeCloseTo(1);
    expect(sampleTable(table, 0.125)).toBeCloseTo(0.5);
    expect(sampleTable(table, 1.25)).toBeCloseTo(1);
    expect(sampleTable(table, -0.75)).toBeCloseTo(1);
  });
  it('tablePeak finds the max absolute value', () => {
    expect(tablePeak(new Float32Array([0.2, -0.9, 0.5]))).toBeCloseTo(0.9);
  });
  it('findTrigger returns the first rising zero crossing after a negative excursion', () => {
    const buf = new Float32Array(400);
    for (let i = 0; i < 400; i++) buf[i] = Math.sin((2 * Math.PI * (i + 10.5)) / 100); // crossing falls between samples 89 and 90
    const t = findTrigger(buf, 200);
    expect(buf[t - 1]).toBeLessThanOrEqual(0);
    expect(buf[t]).toBeGreaterThan(0);
    expect(t).toBe(90);
  });
  it('freqToX maps endpoints and octaves', () => {
    expect(freqToX(100, 100, 400, 200, 'log')).toBe(0);
    expect(freqToX(400, 100, 400, 200, 'log')).toBe(200);
    expect(freqToX(200, 100, 400, 200, 'log')).toBeCloseTo(100);
    expect(freqToX(250, 100, 400, 300, 'lin')).toBeCloseTo(150);
  });
  it('blendedSample mixes attack and sustain tables by brightness', () => {
    const dark = new Float32Array([0, 0.2, 0, -0.2]);
    expect(blendedSample(table, dark, 1, 0.25)).toBeCloseTo(1);
    expect(blendedSample(table, dark, 0, 0.25)).toBeCloseTo(0.2);
    expect(blendedSample(table, dark, 0.5, 0.25)).toBeCloseTo(0.6);
    expect(blendedSample(table, null, 0.3, 0.25)).toBeCloseTo(1);
  });
});

describe('spectrum hover helpers', () => {
  it('partialsAt returns every partial on the hovered line (overlapping harmonics of several notes)', async () => {
    const { partialsAt } = await import('../src/viz/drawSpectrum');
    const P = (noteId: string, degree: number, harmonic: number, freq: number) => ({ noteId, degree, harmonic, freq, amp: 0.5 });
    const parts = [P('0', 0, 3, 660), P('7', 7, 2, 660), P('0', 0, 1, 220), P('4', 4, 1, 275)];
    const xOf = (f: number) => f; // 1 px per Hz
    expect(partialsAt(parts, 662, xOf).map((p) => p.degree)).toEqual([0, 7]);
    expect(partialsAt(parts, 221, xOf).map((p) => p.harmonic)).toEqual([1]);
    expect(partialsAt(parts, 400, xOf)).toEqual([]);
  });
  it('liveLabels shows more labels on wider canvases, never closer than the gap', async () => {
    const { liveLabels, freqToX } = await import('../src/viz/drawSpectrum');
    const narrow = liveLabels(360);
    const wide = liveLabels(1100);
    expect(wide.length).toBeGreaterThan(narrow.length);
    expect(wide.length).toBeGreaterThanOrEqual(12);
    for (const ls of [narrow, wide]) {
      const xs = ls.map((f) => freqToX(f, 20, 20000, ls === narrow ? 360 : 1100, 'log'));
      expect(xs.every((x, i) => i === 0 || x - xs[i - 1] >= 30)).toBe(true);
    }
  });
});

describe('amplitudes relative to the fundamental', () => {
  it('ampVsFundamental: a partial as a ratio of its own note’s fundamental', async () => {
    const { ampVsFundamental } = await import('../src/viz/drawSpectrum');
    const P = (noteId: string, harmonic: number, amp: number) => ({ noteId, degree: 0, harmonic, freq: 100 * harmonic, amp });
    const parts = [P('0', 1, 0.8), P('0', 3, 0.2), P('7', 1, 0.5), P('7', 2, 0.6), P('9', 2, 0.3)];
    expect(ampVsFundamental(parts[0], parts)).toBe('fundamental');
    expect(ampVsFundamental(parts[1], parts)).toBe('0.25× fund.');
    expect(ampVsFundamental(parts[3], parts)).toBe('1.2× fund.');
    expect(ampVsFundamental(parts[4], parts)).toBe('0.30'); // no fundamental: plain amplitude
  });
  it('fundamentalDb: the strongest bin within ±3 % of the fundamental', async () => {
    const { fundamentalDb } = await import('../src/viz/drawSpectrum');
    const buf = new Float32Array(100).fill(-100);
    buf[44] = -20; buf[45] = -12; buf[90] = -5; // binHz 10 → 440–450 Hz around the fundamental, 900 Hz elsewhere
    expect(fundamentalDb(buf, 10, 440)).toBe(-12);
    expect(fundamentalDb(buf, 10, null)).toBeNull();
  });
});
