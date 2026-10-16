import { evaluate } from 'mathjs';
import { TUNINGS, SCALES, tuningNotes } from './presets';
import { parseTag, tagName, type NoteTag } from './intervals';

export const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Split the tag off a named note. New tags record family/variant/position ("meantone.quarter:4|…")
 * and the label is derived from them; older plain-name tags ("Major 3rd|…") are kept as the label.
 */
export function splitLabel(expr: string): { label: string | null; tag: NoteTag | null; body: string } {
  const m = /^\s*([^|]*?)\s*\|\s*(.*)$/.exec(String(expr));
  if (!m || !m[1]) return { label: null, tag: null, body: String(expr).trim() };
  const tag = parseTag(m[1]);
  return { label: tag ? tagName(tag) : m[1], tag, body: m[2] };
}

const CENTS_SUFFIX = /^(.*?)\s*([+-])\s*(\d+(?:\.\d*)?|\.\d+)\s*(?:c|¢|cents?)\s*$/i;

/** Split "5/4 -13.7c" into the ratio part and its cents offset (null when there is none). */
export function splitCents(expr: string): { ratio: string; cents: number | null } {
  const body = splitLabel(expr).body;
  const m = CENTS_SUFFIX.exec(body);
  if (!m || m[1].trim() === '') return { ratio: body, cents: null };
  return { ratio: m[1].trim(), cents: (m[2] === '-' ? -1 : 1) * Number(m[3]) };
}

/** "5/4" + −13.7 → "5/4 -13.7c" (offset rounded to 0.1 cent). */
export function joinCents(ratio: string, cents: number): string {
  const c = Math.round(cents * 10) / 10;
  return `${ratio.trim()} ${c < 0 ? '-' : '+'}${Math.abs(c)}c`;
}

/** A ratio with a cents offset, or the plain ratio when the offset rounds to 0. */
export function withCents(ratio: string, cents: number): string {
  return Math.round(cents * 10) === 0 ? ratio.trim() : joinCents(ratio, cents);
}

/**
 * Set the cents offset of any note (ratio, EDO step or named note), keeping its name tag and its
 * value; 0 removes the offset.
 */
export function setCents(note: string, cents: number): string {
  const m = /^\s*([^|]*?)\s*\|/.exec(String(note));
  const prefix = m && m[1] ? `${m[1]}|` : '';
  return prefix + withCents(splitCents(note).ratio, cents);
}

/** Evaluate a ratio expression, optionally followed by a cents offset ("3/2 -2c"). */
export function evalRatio(expr: string): number | null {
  if (expr == null || String(expr).trim() === '') return null;
  try {
    const { ratio, cents } = splitCents(expr);
    const v = evaluate(ratio) * 2 ** ((cents ?? 0) / 1200);
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

const PURE = TUNINGS.just_intonation.notes!.map((n) => evalRatio(n)!);

/**
 * True when the ratio is an integer multiple of a just-intonation interval (same rule as the
 * original). A tempered degree ("5/4 -13.7c") is only pure when its offset is zero.
 */
export function isPure(expr: string): boolean {
  const { ratio, cents } = splitCents(expr);
  if (cents) return false;
  const r = evalRatio(ratio);
  if (r == null) return false;
  return PURE.some((p) => {
    const q = r / p;
    return Math.round(q) >= 1 && Math.abs(q - Math.round(q)) < 1e-9;
  });
}

export function createFromTemplate(
  tuning: string, scale: string, variant?: string, edo?: number,
): { notes: string[]; scale: string } {
  const t = TUNINGS[tuning] ?? TUNINGS.just_intonation;
  const all = tuningNotes(tuning, variant, edo);
  if (!t.scalable) return { notes: all, scale: 'chromatic' };
  return { notes: SCALES[scale].map((n) => all[n - 1]), scale };
}

/** Any EDO step written as "2^(k/N)" (spaces allowed), or null. */
export function parseEdo(expr: string): { step: number; divisions: number } | null {
  const m = /^2\^\((-?\d+)\/(\d+)\)$/.exec(String(expr).replace(/\s+/g, ''));
  return m && Number(m[2]) > 0 ? { step: Number(m[1]), divisions: Number(m[2]) } : null;
}

/** Step k of an N-EDO note ("2^(k/N)", or "1" for step 0); null for anything else. */
export function edoStep(expr: string, n: number): number | null {
  if (String(expr).trim() === '1') return 0;
  const p = parseEdo(expr);
  return p && p.divisions === n ? p.step : null;
}

/** N-EDO note for step k. */
export const edoExpr = (k: number, n: number) => (k === 0 ? '1' : `2^(${k}/${n})`);
