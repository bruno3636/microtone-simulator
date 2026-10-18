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

describe('dip labels come from the harmonics that coincide there', () => {
  // square wave: odd harmonics 1/k up to 63
  const square = Array.from({ length: 64 }, (_, i) => ((i + 1) % 2 ? 1 / (i + 1) : 0));
  it('dipRatio picks the strongest coinciding harmonic pair within the tolerance', async () => {
    const { dipRatio } = await import('../src/audio/roughness');
    expect(dipRatio(884.4, square, 4)).toEqual({ p: 5, q: 3 });
    expect(dipRatio(582.5, square, 4)).toEqual({ p: 7, q: 5 });
    // square waves have no even harmonics, so 3/2 can't be the coincidence behind a dip
    expect(dipRatio(701.9, square, 4)).not.toEqual({ p: 3, q: 2 });
    // a dip 17¢ from 5/3 is not labelled 5/3
    expect(dipRatio(901.9, square, 4)).not.toEqual({ p: 5, q: 3 });
    const saw = Array.from({ length: 16 }, (_, i) => 1 / (i + 1));
    expect(dipRatio(702, saw, 4)).toEqual({ p: 3, q: 2 });
    expect(dipRatio(1500, [1], 4)).toBeNull(); // a sine has nothing to coincide
  });
  it('labelDips never shows the same ratio twice (square wave, zoomed windows)', async () => {
    const { curveDips, labelDips, dipLabelThreshold } = await import('../src/audio/roughness');
    for (const [f, t] of [[0, 1200], [400, 800], [500, 700], [800, 960], [850, 920], [980, 1060]]) {
      const curve = dissonanceCurve(square, 440, f, t, 601);
      const labels = labelDips(curveDips(curve), square, dipLabelThreshold(1200 / (t - f)), f, t).map((d) => d.label);
      expect(new Set(labels).size, `${f}–${t}: ${labels}`).toBe(labels.length);
    }
    const curve = dissonanceCurve(square, 440, 850, 920, 601);
    const near53 = labelDips(curveDips(curve), square, dipLabelThreshold(1200 / 70), 850, 920).filter((d) => d.label === '5/3');
    expect(near53).toHaveLength(1);
    expect(Math.abs(near53[0].cents - 884.4)).toBeLessThan(2);
  });
});

describe('labels stay as you zoom in', () => {
  const square = Array.from({ length: 64 }, (_, i) => ((i + 1) % 2 ? 1 / (i + 1) : 0));
  it('37/29 (square wave) keeps its label from the zoom where it appears up to 64×', async () => {
    const { curveDips, labelDips, dipLabelThreshold } = await import('../src/audio/roughness');
    const c0 = 1200 * Math.log2(37 / 29);
    const labelled = [8, 12, 16, 24, 32, 48, 64].map((z) => {
      const width = 1200 / z;
      const f = c0 - width * 0.4;
      const curve = dissonanceCurve(square, 440, f, f + width, 601);
      return labelDips(curveDips(curve), square, dipLabelThreshold(z), f, f + width).some((d) => d.label === '37/29');
    });
    expect(labelled).toEqual([true, true, true, true, true, true, true]);
  });
});

describe("matches the book's model (Appendix E)", () => {
  it('d = min(a1, a2) · (e^(−3.5·s·Δf) − e^(−5.75·s·Δf)), s = 0.24 / (0.0207·f1 + 18.96)', () => {
    const s = 0.24 / (0.0207 * 440 + 18.96);
    const x = s * 20;
    expect(pairDissonance(440, 1, 460, 0.5)).toBeCloseTo(0.5 * (Math.exp(-3.5 * x) - Math.exp(-5.75 * x)), 12);
  });
});

describe("loudness weighting (book eqs. E.4–E.5)", () => {
  it('loudness in sones: ℓ = 2^(SPL/10) / 16, amplitude 1 = 70 dB SPL', async () => {
    const { loudness, REFERENCE_DB } = await import('../src/audio/roughness');
    expect(REFERENCE_DB).toBe(70);
    expect(loudness(1)).toBeCloseTo(2 ** 7 / 16, 12); // 70 dB → 8 sones
    expect(loudness(10 ** (-30 / 20))).toBeCloseTo(1, 12); // 40 dB → 1 sone
    expect(loudness(0.1) / loudness(1)).toBeCloseTo(0.1 ** (2 * Math.log10(2)), 12); // ∝ A^0.602
    expect(loudness(0)).toBe(0);
  });
  it('totalRoughness weights each pair by the smaller loudness (amplitudes converted with E.5)', async () => {
    const { totalRoughness, loudness } = await import('../src/audio/roughness');
    const ps = [{ freq: 440, amp: 1 }, { freq: 460, amp: 0.25 }];
    expect(totalRoughness(ps)).toBeCloseTo(pairDissonance(440, loudness(0.25), 460, loudness(1)), 12);
  });
});
