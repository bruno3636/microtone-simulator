import { noteTag, withLabel } from './intervals';

export interface TuningVariant { label: string; notes: string[] }
export interface Tuning {
  label: string;
  /** 12-note tunings accept the major/minor scale templates; others are always chromatic */
  scalable: boolean;
  /** fixed notes; absent for variant tunings and custom EDO */
  notes?: string[];
  variants?: Record<string, TuningVariant>;
  defaultVariant?: string;
  /** notes generated from the "divisions per octave" setting */
  edo?: boolean;
}

/** N-EDO: k/N of an octave per step. */
export const edoNotes = (n: number): string[] =>
  Array.from({ length: n }, (_, k) => (k === 0 ? '1' : `2^(${k}/${n})`));

/** Circle-of-fifths position of each chromatic note from C (meantone: chain E♭ … G♯). */
const FIFTHS_FROM_C = [0, 7, 2, -3, 4, -1, 6, 1, 8, 3, -2, 5]; // C C# D Eb E F F# G G# A Bb B

/** Meantone variants as fractions of the syntonic comma (81/80) taken off each fifth. */
export const MEANTONE_FRACTIONS: Record<string, [number, number]> = {
  third: [1, 3], quarter: [1, 4], fifth: [1, 5], sixth: [1, 6], twoSevenths: [2, 7],
};

/** `n` meantone fifths (narrowed by num/den of a syntonic comma) from the root, reduced into the octave. */
export function meantoneDegree(num: number, den: number, n: number): string {
  if (n === 0) return '1';
  const fifthExpr = `(3/2 * (80/81)^(${num}/${den}))`;
  const fifth = 1.5 * (80 / 81) ** (num / den);
  const octaves = -Math.floor(Math.log2(fifth ** n));
  const pow = n < 0 ? `^(${n})` : `^${n}`;
  return octaves === 0 ? `${fifthExpr}${pow}` : `${fifthExpr}${pow} * 2^(${octaves})`;
}

/** 12-note meantone on the chain E♭ … G♯, each note tagged with its variant and fifths position. */
const meantoneNotes = (variant: string) => {
  const [num, den] = MEANTONE_FRACTIONS[variant];
  return FIFTHS_FROM_C.map((n) => withLabel(noteTag('meantone', variant, n), meantoneDegree(num, den, n)));
};

const PURE_FIFTH = 1200 * Math.log2(3 / 2);
const PYTHAGOREAN_COMMA = 1200 * Math.log2(531441 / 524288);
const SYNTONIC_COMMA = 1200 * Math.log2(81 / 80);
const SCHISMA = PYTHAGOREAN_COMMA - SYNTONIC_COMMA;

/**
 * Well temperament from its tempered fifths. `narrowing[i]` (cents) is subtracted from fifth i of
 * the circle C–G–D–A–E–B–F♯–C♯–G♯–D♯–A♯–F(–C); the narrowings sum to a Pythagorean comma so the
 * circle closes. Notes are given in cents to 3 decimals (≤ 0.0005 cent error).
 */
function wellNotes(variant: string, narrowing: Partial<Record<number, number>>): string[] {
  const chain = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]; // chromatic index of each note up the circle
  const cents = new Array<number>(12).fill(0);
  let c = 0;
  for (let i = 1; i < 12; i++) {
    c += PURE_FIFTH - (narrowing[i - 1] ?? 0);
    cents[chain[i]] = ((c % 1200) + 1200) % 1200;
  }
  return cents.map((x, i) => withLabel(noteTag('well', variant, i), i === 0 ? '1' : `2^(${x.toFixed(3)}/1200)`));
}

const range = (from: number, to: number, cents: number) =>
  Object.fromEntries(Array.from({ length: to - from + 1 }, (_, k) => [from + k, cents]));

export const TUNINGS: Record<string, Tuning> = {
  just_intonation: {
    label: 'Just intonation', scalable: true,
    notes: ['1', '1 + 1/15', '1 + 1/8', '1 + 1/5', '1 + 1/4', '1 + 1/3', '1 + 13/32', '1 + 1/2', '1 + 3/5', '1 + 2/3', '1 + 4/5', '1 + 7/8'],
  },
  harmonic_series: {
    label: 'Harmonic series', scalable: false,
    notes: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  },
  edo12: {
    label: '12EDO', scalable: false,
    notes: edoNotes(12),
  },
  custom_edo: {
    label: 'Custom EDO', scalable: false, edo: true,
  },
  pythagorean_tuning: {
    label: 'Pythagorean', scalable: true,
    // chain G♭ … B: fifths from C of each chromatic note, for the interval names
    notes: ['1', '2^8 / 3^5', '3^2 / 2^3', '2^5 / 3^3', '3^4 / 2^6', '2^2 / 3', '2^10 / 3^6', '3 / 2', '2^7 / 3^4', '3^3 / 2^4', '2^4 / 3^2', '3^5 / 2^7']
      .map((expr, i) => withLabel(noteTag('pythagorean', null, [0, -5, 2, -3, 4, -1, -6, 1, -4, 3, -2, 5][i]), expr)),
  },
  meantone: {
    label: 'Meantone', scalable: true, defaultVariant: 'quarter',
    variants: {
      third: { label: '⅓-comma (pure minor thirds)', notes: meantoneNotes('third') },
      quarter: { label: '¼-comma (pure major thirds)', notes: meantoneNotes('quarter') },
      fifth: { label: '⅕-comma', notes: meantoneNotes('fifth') },
      sixth: { label: '⅙-comma', notes: meantoneNotes('sixth') },
      twoSevenths: { label: '2/7-comma (Zarlino)', notes: meantoneNotes('twoSevenths') },
    },
  },
  well_temperament: {
    label: 'Well temperament', scalable: true, defaultVariant: 'werckmeister3',
    variants: {
      // C–G, G–D, D–A and B–F♯ narrowed by ¼ Pythagorean comma
      werckmeister3: { label: 'Werckmeister III', notes: wellNotes('werckmeister3', { 0: PYTHAGOREAN_COMMA / 4, 1: PYTHAGOREAN_COMMA / 4, 2: PYTHAGOREAN_COMMA / 4, 5: PYTHAGOREAN_COMMA / 4 }) },
      // C–G–D–A–E narrowed by ¼ syntonic comma (C–E pure 5/4), F♯–C♯ by a schisma
      kirnberger3: { label: 'Kirnberger III', notes: wellNotes('kirnberger3', { ...range(0, 3, SYNTONIC_COMMA / 4), 6: SCHISMA }) },
      // F–C–G–D–A–E–B narrowed by ⅙ Pythagorean comma
      vallotti: { label: 'Vallotti', notes: wellNotes('vallotti', { 11: PYTHAGOREAN_COMMA / 6, ...range(0, 4, PYTHAGOREAN_COMMA / 6) }) },
      // C–G–D–A–E–B–F♯ narrowed by ⅙ Pythagorean comma (Young's second temperament, 1799)
      young: { label: 'Young (1799)', notes: wellNotes('young', range(0, 5, PYTHAGOREAN_COMMA / 6)) },
    },
  },
};

/** Tuning menu order. */
export const TUNING_ORDER = [
  'just_intonation', 'harmonic_series', 'edo12', 'custom_edo', 'pythagorean_tuning', 'meantone', 'well_temperament',
];

/** The notes of a tuning: its variant's (default if unknown), N-EDO for custom EDO, else its fixed notes. */
export function tuningNotes(tuning: string, variant?: string, edo = 31): string[] {
  const t = TUNINGS[tuning] ?? TUNINGS.just_intonation;
  if (t.edo) return edoNotes(Math.max(1, Math.round(edo)));
  if (t.variants) return (t.variants[variant ?? ''] ?? t.variants[t.defaultVariant!]).notes;
  return t.notes!;
}

export const SCALES: Record<string, number[]> = {
  major: [1, 3, 5, 6, 8, 10, 12],
  'natural minor': [1, 3, 4, 6, 8, 9, 11],
  'harmonic minor': [1, 3, 4, 6, 8, 9, 12],
  chromatic: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

export const NOTE_NAMES = ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'];

// Same octave layout as the original (A = 440 Hz, A4 … G#5).
const M = 8;
export const NOTE_FREQS: Record<string, number> = {
  A: 55 * M, 'A#/Bb': 58.2705 * M, B: 61.7354 * M, C: 65.4064 * M, 'C#/Db': 69.2957 * M, D: 73.4162 * M,
  'D#/Eb': 77.7817 * M, E: 82.4069 * M, F: 87.3071 * M, 'F#/Gb': 92.4986 * M, G: 97.9989 * M, 'G#/Ab': 103.826 * M,
};

export const DEFAULT_KEYMAPS: Record<string, Record<string, string>> = {
  scale: { 0: 'a', 1: 's', 2: 'd', 3: 'f', 4: 'g', 5: 'h', 6: 'j', 7: 'k,z,y', 8: 'l,x', 9: 'c', 10: 'v', 11: 'b', 12: 'n', 13: 'm' },
  chords: { 0: 'a,f2,h2', 1: 's,g2,j', 2: 'a,d,h2', 3: 's,f,j2', 4: 'a,d,g', 5: 's,f,h', 6: 'j,d,g', 7: 'z,y', 8: 'x', 9: 'c', 10: 'v', 11: 'b', 12: 'n', 13: 'm' },
};
