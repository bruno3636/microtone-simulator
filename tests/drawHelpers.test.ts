import { describe, it, expect } from 'vitest';
import { sampleTable, tablePeak, findTrigger } from '../src/viz/drawWave';
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
});
