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

describe('curveDips (labels on the roughness curve)', () => {
  it('finds every dip with its depth on a log scale, deepest first', async () => {
    const { curveDips } = await import('../src/audio/roughness');
    const amps = Array.from({ length: 12 }, (_, k) => 1 / (k + 1));
    const curve = dissonanceCurve(amps, 261.6, 0, 1200, 1201);
    const dips = curveDips(curve);
    // deepest first
    expect(dips.every((d, i) => i === 0 || d.prominence <= dips[i - 1].prominence)).toBe(true);
    const near = (c: number) => dips.find((d) => Math.abs(d.cents - c) <= 3);
    // big dips (3/2, 4/3) are much deeper than small ones (7/5, 8/7) but the small ones are found too
    expect(near(702)!.prominence).toBeGreaterThan(near(583)!.prominence);
    expect(near(231)).toBeDefined(); // 8/7
    expect(dips.length).toBeGreaterThan(curveMinima(curve, 0.03).length);
  });
  it('dipLabelThreshold falls as you zoom in', async () => {
    const { dipLabelThreshold } = await import('../src/audio/roughness');
    expect(dipLabelThreshold(2)).toBeLessThan(dipLabelThreshold(1));
    expect(dipLabelThreshold(8)).toBeLessThan(dipLabelThreshold(2));
  });
});

describe('notches on a slope', () => {
  // the app's default timbre (8 harmonics)
  const amps = [0.782, 0.47, 0.294, 0.194, 0.138, 0.106, 0.088, 0.078];
  it('finds a notch where the curve keeps falling but bends sharply (8/7 at ≈231¢)', async () => {
    const { curveDips, dipLabelThreshold } = await import('../src/audio/roughness');
    const curve = dissonanceCurve(amps, 440, 0, 1200, 601);
    const dips = curveDips(curve);
    const n87 = dips.find((d) => Math.abs(d.cents - 231.2) <= 4);
    expect(n87, JSON.stringify(dips.slice(0, 12).map((d) => [Math.round(d.cents), +d.prominence.toFixed(3)]))).toBeDefined();
    // labelled by a little zoom at the latest
    expect(n87!.prominence).toBeGreaterThan(dipLabelThreshold(1.5));
  });
  it('true valleys are still found once (not doubled as notches)', async () => {
    const { curveDips } = await import('../src/audio/roughness');
    const curve = dissonanceCurve(amps, 440, 0, 1200, 601);
    const near702 = curveDips(curve).filter((d) => Math.abs(d.cents - 702) <= 10);
    expect(near702).toHaveLength(1);
  });
});
