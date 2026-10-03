import { describe, it, expect } from 'vitest';
import { buildPartials, findCoincidences } from '../src/viz/partials';

const amps = [1, 0.5, 0.4, 0.3];

describe('partials', () => {
  it('builds k·f partials scaled by level, capped at maxHz', () => {
    const p = buildPartials([{ id: '0', degree: 0, freq: 6000, level: 0.5 }], amps);
    expect(p.map((x) => x.freq)).toEqual([6000, 12000, 18000]);
    expect(p[1].amp).toBeCloseTo(0.25);
  });
  it('a just fifth (3:2) has coinciding partials', () => {
    const p = buildPartials(
      [{ id: '0', degree: 0, freq: 200, level: 1 }, { id: '4', degree: 4, freq: 300, level: 1 }],
      amps,
    );
    const { coincident, near } = findCoincidences(p);
    expect(coincident.map((c) => Math.round(c.freq))).toContain(600);
    expect(near).toHaveLength(0);
  });
  it('an equal-tempered fifth produces a near-miss with the right beat rate', () => {
    const f2 = 200 * 2 ** (7 / 12);
    const p = buildPartials(
      [{ id: '0', degree: 0, freq: 200, level: 1 }, { id: '7', degree: 7, freq: f2, level: 1 }],
      amps,
    );
    const { coincident, near } = findCoincidences(p);
    expect(coincident).toHaveLength(0);
    const m = near.find((n) => Math.round(Math.max(n.a.freq, n.b.freq)) === 600)!;
    expect(m.beatHz).toBeCloseTo(Math.abs(600 - 2 * f2), 3);
    expect(m.cents).toBeGreaterThan(1.5);
  });
  it('limits near-miss labels to maxNear, strongest first', () => {
    const notes = [0, 1, 2, 3, 4, 5].map((i) => ({ id: String(i), degree: i, freq: 200 * 2 ** (i / 120), level: 1 }));
    const { near } = findCoincidences(buildPartials(notes, amps), { maxNear: 3 });
    expect(near).toHaveLength(3);
    const strength = (n: (typeof near)[0]) => Math.min(n.a.amp, n.b.amp);
    expect(strength(near[0])).toBeGreaterThanOrEqual(strength(near[2]));
  });
  it('blends attack and sustain spectra by each note\'s brightness', () => {
    const p = buildPartials([{ id: '0', degree: 0, freq: 100, level: 0.5, brightness: 0.25 }], [1, 0.8], 20000, [1, 0, 0.4]);
    expect(p.map((x) => x.harmonic)).toEqual([1, 2, 3]);
    expect(p[1].amp).toBeCloseTo(0.5 * (0.25 * 0.8 + 0.75 * 0));
    expect(p[2].amp).toBeCloseTo(0.5 * (0.75 * 0.4));
  });
});
