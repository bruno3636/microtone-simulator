import { effMs, type EnvelopeSettings } from '../audio/envelope';
import type { VoiceStage } from '../audio/engine';

/** SVG geometry of the envelope editor (viewBox units). */
export const W = 600;
export const H = 200;
export const PAD = 12;
export const IW = W - 2 * PAD;
export const IH = H - 2 * PAD;
/** the sustain plateau is drawn at a fixed width */
export const PLATEAU = IW * 0.2;

export interface Geometry { x0: number; x1: number; x2: number; x3: number; x4: number }

/** px per ms: attack + decay + release fill the width left of the plateau (min span 50 ms) */
export const scaleFor = (e: EnvelopeSettings) => (IW - PLATEAU) / Math.max(50, e.attack + e.decay + e.release);
export const yOf = (level: number) => PAD + (1 - level) * IH;

export function geometry(e: EnvelopeSettings, k: number): Geometry {
  const x0 = PAD;
  const x1 = x0 + e.attack * k;
  const x2 = x1 + e.decay * k;
  const x3 = x2 + PLATEAU;
  const x4 = x3 + e.release * k;
  return { x0, x1, x2, x3, x4 };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * x of a held note `heldMs` after note-on, using the voice's own envelope timing mapped onto the
 * drawn segments (so editing the envelope mid-note keeps the dot on the drawing). The plateau is
 * crossed in 1 s, then the dot waits at its end.
 */
function heldX(heldMs: number, e: EnvelopeSettings, g: Geometry): number {
  const a = effMs(e.attack);
  const d = effMs(e.decay);
  if (heldMs < a) return g.x0 + (g.x1 - g.x0) * clamp01(heldMs / a);
  if (heldMs < a + d) return g.x1 + (g.x2 - g.x1) * clamp01((heldMs - a) / d);
  return g.x2 + PLATEAU * clamp01((heldMs - a - d) / 1000);
}

/**
 * x of a voice's dot. On release the dot starts exactly where it was when the note was let go and
 * glides to the end of the release segment over the release time — it never jumps.
 */
export function dotX(v: { stage: VoiceStage; elapsedMs: number; heldMs: number; env: EnvelopeSettings }, g: Geometry): number {
  if (v.stage !== 'release') return heldX(v.elapsedMs, v.env, g);
  const from = heldX(v.heldMs, v.env, g);
  return from + (g.x4 - from) * clamp01(v.elapsedMs / effMs(v.env.release));
}
