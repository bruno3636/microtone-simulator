/** Interval names for note-name sources (Pythagorean, meantone, well temperament). */

/** Name of the interval `n` fifths above the root (spelled: C♯ = +7 = augmented unison, D♭ = −5 = minor 2nd). */
const BY_FIFTHS: Record<number, string> = {
  [-6]: 'Diminished 5th', [-5]: 'Minor 2nd', [-4]: 'Minor 6th', [-3]: 'Minor 3rd', [-2]: 'Minor 7th', [-1]: 'Perfect 4th',
  0: 'Perfect unison', 1: 'Perfect 5th', 2: 'Major 2nd', 3: 'Major 6th', 4: 'Major 3rd', 5: 'Major 7th',
  6: 'Augmented 4th', 7: 'Augmented unison', 8: 'Augmented 5th', 9: 'Augmented 2nd', 10: 'Augmented 6th',
};

export const intervalByFifths = (n: number): string => BY_FIFTHS[n] ?? `${n} fifths`;

/** Name by semitones above the root, for 12-name tunings where enharmonics coincide (well temperament). */
const BY_SEMITONES = [
  'Perfect unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th',
  'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th',
];

export const intervalBySemitones = (n: number): string => BY_SEMITONES[((n % 12) + 12) % 12];

/** A note expression tagged with its interval name: "Major 3rd|expr" (the maths ignores the tag). */
export const withLabel = (label: string, expr: string) => `${label}|${expr}`;

/** Where a named note came from: its tuning family, variant, and position (fifths from the root,
 *  or semitones for well temperament). Stored as the note's tag, e.g. "meantone.quarter:4". */
export type NoteFamily = 'pythagorean' | 'meantone' | 'well';
export interface NoteTag { family: NoteFamily; variant: string | null; pos: number }

export const noteTag = (family: NoteFamily, variant: string | null, pos: number) =>
  `${family}${variant ? `.${variant}` : ''}:${pos}`;

export function parseTag(tag: string): NoteTag | null {
  const m = /^(pythagorean|meantone|well)(?:\.([A-Za-z0-9]+))?:(-?\d+)$/.exec(tag.trim());
  return m ? { family: m[1] as NoteFamily, variant: m[2] ?? null, pos: Number(m[3]) } : null;
}

/** Interval name of a tagged note above the root. */
export const tagName = (t: NoteTag) => (t.family === 'well' ? intervalBySemitones(t.pos) : intervalByFifths(t.pos));

/** Musical interval from note a up to note b, when both come from the same tuning family and variant. */
export function intervalBetween(a: NoteTag, b: NoteTag): string | null {
  if (a.family !== b.family || a.variant !== b.variant) return null;
  if (a.family === 'well') return intervalBySemitones(b.pos - a.pos);
  return BY_FIFTHS[b.pos - a.pos] ?? null;
}

/** Reference ratios for naming arbitrary ratios (JI, EDO, cents…), within one octave. */
const REFERENCE: [number, string][] = [
  [1, 'Unison'], [16 / 15, 'Minor 2nd'], [10 / 9, 'Submajor 2nd'], [9 / 8, 'Major 2nd'], [8 / 7, 'Supermajor 2nd'],
  [7 / 6, 'Subminor 3rd'], [6 / 5, 'Minor 3rd'], [11 / 9, 'Neutral 3rd'], [5 / 4, 'Major 3rd'], [9 / 7, 'Supermajor 3rd'],
  [21 / 16, 'Narrow 4th'], [4 / 3, 'Perfect 4th'], [11 / 8, 'Wide 4th'], [7 / 5, 'Diminished 5th'], [10 / 7, 'Augmented 4th'],
  [16 / 11, 'Narrow 5th'], [3 / 2, 'Perfect 5th'], [32 / 21, 'Wide 5th'],
  [14 / 9, 'Subminor 6th'], [8 / 5, 'Minor 6th'], [18 / 11, 'Neutral 6th'], [5 / 3, 'Major 6th'], [12 / 7, 'Supermajor 6th'],
  [7 / 4, 'Subminor 7th'], [16 / 9, 'Minor 7th'], [9 / 5, 'Superminor 7th'], [15 / 8, 'Major 7th'], [2, 'Octave'],
];
const REFERENCE_CENTS = REFERENCE.map(([r, name]) => [1200 * Math.log2(r), name] as const);

/**
 * Name of the nearest reference interval (octave-reduced), with the cents difference in front:
 * "+13.7¢ Major 3rd". Ratios nearer 2/1 than 1/1 are named from the octave; exact octaves are "Octave".
 */
/** `deviation` false: just the reference name, without the "±x¢" prefix. */
export function nameRatio(ratio: number, deviation = true): string {
  const raw = 1200 * Math.log2(ratio);
  const c = ((raw % 1200) + 1200) % 1200;
  if (c < 0.05 && Math.abs(raw) > 600) return 'Octave'; // 2/1, 4/1, 1/2 …
  let best = REFERENCE_CENTS[0];
  for (const ref of REFERENCE_CENTS) if (Math.abs(c - ref[0]) < Math.abs(c - best[0])) best = ref;
  const d = c - best[0];
  return Math.abs(d) < 0.05 || !deviation ? best[1] : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}¢ ${best[1]}`;
}
