import { evaluate } from 'mathjs';
import { TUNINGS, SCALES } from './presets';

export const mod = (n: number, m: number) => ((n % m) + m) % m;

export function evalRatio(expr: string): number | null {
  if (expr == null || String(expr).trim() === '') return null;
  try {
    const v = evaluate(String(expr));
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function degreeRatio(notes: string[], degree: number): number | null {
  const len = notes.length;
  if (len === 0) return null;
  const r = evalRatio(notes[mod(degree, len)]);
  return r == null ? null : r * 2 ** Math.floor(degree / len);
}

export function degreeFreq(notes: string[], degree: number, rootHz: number): number | null {
  const r = degreeRatio(notes, degree);
  return r == null ? null : r * rootHz;
}

const PURE = TUNINGS.just_intonation.notes.map((n) => evalRatio(n)!);

/** True when the ratio is an integer multiple of a just-intonation interval (same rule as the original). */
export function isPure(expr: string): boolean {
  const r = evalRatio(expr);
  if (r == null) return false;
  return PURE.some((p) => {
    const q = r / p;
    return Math.round(q) >= 1 && Math.abs(q - Math.round(q)) < 1e-9;
  });
}

export function createFromTemplate(tuning: string, scale: string): { notes: string[]; scale: string } {
  const t = TUNINGS[tuning];
  const s = t.scalable ? scale : 'chromatic';
  const idx = SCALES[s].slice(0, t.notes.length);
  return { notes: idx.map((n) => t.notes[n - 1]), scale: s };
}
