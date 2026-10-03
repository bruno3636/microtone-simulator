import { shapeCurve } from './curves';

/** Legacy curve names (persist ≤ v3); curves are now continuous amounts. */
export type CurveKind = 'lin' | 'exp' | 'log';
const LEGACY_CURVE: Record<CurveKind, number> = { lin: 0, exp: 0.6, log: -0.6 };

/** Curve amount from a stored value: a number in [−1, 1] or a legacy name. */
export function curveAmount(c: unknown): number {
  if (typeof c === 'number' && Number.isFinite(c)) return Math.min(1, Math.max(-1, c));
  return LEGACY_CURVE[c as CurveKind] ?? 0;
}

export interface EnvelopeSettings {
  attack: number; // ms
  decay: number; // ms
  sustain: number; // 0..1
  release: number; // ms
  /** segment curve amounts in [−1, 1]: 0 = linear, > 0 = EXP (below the chord), < 0 = LOG (above) */
  attackCurve: number;
  decayCurve: number;
  releaseCurve: number;
}

export const MIN_RAMP_MS = 3;
export const effMs = (ms: number) => Math.max(MIN_RAMP_MS, ms);

/** Level while held, `tMs` since note-on. `fromLevel` is where the attack starts (non-zero on a re-strike). */
export function levelAt(env: EnvelopeSettings, tMs: number, fromLevel = 0): number {
  const a = effMs(env.attack);
  const d = effMs(env.decay);
  if (tMs <= 0) return fromLevel;
  if (tMs < a) return shapeCurve(fromLevel, 1, tMs / a, env.attackCurve);
  if (tMs < a + d) return shapeCurve(1, env.sustain, (tMs - a) / d, env.decayCurve);
  return env.sustain;
}

export function releaseLevelAt(env: EnvelopeSettings, fromLevel: number, tMs: number): number {
  const r = effMs(env.release);
  if (tMs <= 0) return fromLevel;
  if (tMs >= r) return 0;
  return shapeCurve(fromLevel, 0, tMs / r, env.releaseCurve);
}

export function sampleSegment(from: number, to: number, curve: number, points = 256): Float32Array {
  const out = new Float32Array(points);
  for (let i = 0; i < points; i++) out[i] = shapeCurve(from, to, i / (points - 1), curve);
  return out;
}
