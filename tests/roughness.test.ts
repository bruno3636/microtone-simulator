import { describe, it, expect } from 'vitest';
import { pairDissonance, totalRoughness, dissonanceCurve, curveMinima } from '../src/audio/roughness';

describe('Sethares roughness', () => {
  it('pairDissonance: zero at unison, peaks near a quarter of a critical band, fades when far apart', () => {
    expect(pairDissonance(440, 1, 440, 1)).toBeCloseTo(0, 12);
    const near = [5, 10, 20, 30, 40, 60, 100, 200].map((df) => pairDissonance(440, 1, 440 + df, 1));
    const peak = near.indexOf(Math.max(...near));
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThan(near.length - 1);
    expect(near.at(-1)!).toBeLessThan(near[peak] / 5);
    // symmetric in order, scaled by the smaller amplitude
    expect(pairDissonance(500, 1, 440, 1)).toBeCloseTo(pairDissonance(440, 1, 500, 1), 12);
    expect(pairDissonance(440, 0.5, 470, 1)).toBeCloseTo(0.5 * pairDissonance(440, 1, 470, 1), 12);
  });
  it('the dissonance curve of a harmonic timbre dips at the simple just ratios', () => {
    const amps = Array.from({ length: 7 }, (_, k) => 0.88 ** k); // Sethares' example timbre
    const curve = dissonanceCurve(amps, 261.6, 0, 1200, 1201);
    const minima = curveMinima(curve, 0.02).map((m) => Math.round(m.cents));
    for (const target of [386, 498, 702, 884, 1200]) {
      expect(minima.some((c) => Math.abs(c - target) <= 4), `${target}¢ in ${minima}`).toBe(true);
    }
    const at = (c: number) => curve.find((p) => Math.round(p.cents) === c)!.value;
    expect(at(702)).toBeLessThan(at(650));
    expect(at(100)).toBeGreaterThan(at(702));
  });
  it('totalRoughness sums every pair of partials (a pure fifth is smoother than a tritone)', () => {
    const tone = (f: number) => [1, 2, 3, 4, 5, 6].map((k) => ({ freq: k * f, amp: 1 / k }));
    const fifth = totalRoughness([...tone(220), ...tone(330)]);
    const tritone = totalRoughness([...tone(220), ...tone(220 * Math.SQRT2)]);
    expect(tritone).toBeGreaterThan(fifth);
    expect(totalRoughness([])).toBe(0);
    expect(totalRoughness([{ freq: 440, amp: 1 }])).toBe(0);
  });
});

describe('intervalRoughness (tuning game)', () => {
  it('is the dissonance-curve value at one interval and is lowest at the just ratio', async () => {
    const { intervalRoughness } = await import('../src/audio/roughness');
    const amps = Array.from({ length: 7 }, (_, k) => 0.88 ** k);
    const fifth = intervalRoughness(amps, 300, 701.955);
    expect(fifth).toBeCloseTo(dissonanceCurve(amps, 300, 701.955, 701.955, 1)[0].value, 12);
    expect(intervalRoughness(amps, 300, 690)).toBeGreaterThan(fifth);
    expect(intervalRoughness(amps, 300, 715)).toBeGreaterThan(fifth);
  });
});
