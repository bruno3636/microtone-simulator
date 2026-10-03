import { describe, it, expect } from 'vitest';
import { geometry, scaleFor, dotX, PLATEAU } from '../src/components/envelopeGeometry';
import type { EnvelopeSettings } from '../src/audio/envelope';

const env: EnvelopeSettings = {
  attack: 100, decay: 200, sustain: 0.5, release: 400, attackCurve: 0, decayCurve: 0, releaseCurve: 0,
};
const g = geometry(env, scaleFor(env));
const held = (ms: number) => ({ stage: 'sustain' as const, elapsedMs: ms, heldMs: ms, env });
const voice = (stage: 'attack' | 'decay' | 'sustain', ms: number) => ({ stage, elapsedMs: ms, heldMs: ms, env });
const released = (heldMs: number, ms: number) => ({ stage: 'release' as const, elapsedMs: ms, heldMs, env });

describe('envelope dot position', () => {
  it('moves through attack, decay and the sustain plateau while held', () => {
    expect(dotX(voice('attack', 50), g)).toBeCloseTo((g.x0 + g.x1) / 2);
    expect(dotX(voice('decay', 200), g)).toBeCloseTo((g.x1 + g.x2) / 2);
    expect(dotX(held(300 + 500), g)).toBeCloseTo(g.x2 + PLATEAU / 2);
    expect(dotX(held(300 + 5000), g)).toBeCloseTo(g.x3);
  });

  it('does not jump when the note is released mid-sustain', () => {
    const before = dotX(held(800), g);
    expect(dotX(released(800, 0), g)).toBeCloseTo(before);
  });

  it('does not jump when released during the attack', () => {
    const before = dotX(voice('attack', 40), g);
    expect(dotX(released(40, 0), g)).toBeCloseTo(before);
  });

  it('glides to the end of the release segment over the release time', () => {
    const start = dotX(released(800, 0), g);
    expect(dotX(released(800, 200), g)).toBeCloseTo((start + g.x4) / 2);
    expect(dotX(released(800, 400), g)).toBeCloseTo(g.x4);
    expect(dotX(released(800, 900), g)).toBeCloseTo(g.x4);
  });
});
