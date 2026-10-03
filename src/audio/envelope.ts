import { shapeCurve } from './curves';

export type CurveKind = 'lin' | 'exp' | 'log';
export const CURVE_AMOUNT: Record<CurveKind, number> = { lin: 0, exp: 0.6, log: -0.6 };

export interface EnvelopeSettings {
  attack: number; // ms
  decay: number; // ms
  sustain: number; // 0..1
  release: number; // ms
  attackCurve: CurveKind;
  decayCurve: CurveKind;
  releaseCurve: CurveKind;
}

export const MIN_RAMP_MS = 3;
export const effMs = (ms: number) => Math.max(MIN_RAMP_MS, ms);

/** Level while held, `tMs` since note-on. `fromLevel` is where the attack starts (non-zero on a re-strike). */
export function levelAt(env: EnvelopeSettings, tMs: number, fromLevel = 0): number {
  const a = effMs(env.attack);
  const d = effMs(env.decay);
  if (tMs <= 0) return fromLevel;
  if (tMs < a) return shapeCurve(fromLevel, 1, tMs / a, CURVE_AMOUNT[env.attackCurve]);
  if (tMs < a + d) return shapeCurve(1, env.sustain, (tMs - a) / d, CURVE_AMOUNT[env.decayCurve]);
  return env.sustain;
}

export function releaseLevelAt(env: EnvelopeSettings, fromLevel: number, tMs: number): number {
  const r = effMs(env.release);
  if (tMs <= 0) return fromLevel;
  if (tMs >= r) return 0;
  return shapeCurve(fromLevel, 0, tMs / r, CURVE_AMOUNT[env.releaseCurve]);
}

export function sampleSegment(from: number, to: number, curve: CurveKind, points = 256): Float32Array {
  const out = new Float32Array(points);
  for (let i = 0; i < points; i++) out[i] = shapeCurve(from, to, i / (points - 1), CURVE_AMOUNT[curve]);
  return out;
}
