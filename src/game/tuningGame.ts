import { evalRatio, toFraction } from '../tuning/ratios';

/**
 * Tuning game: tune a note against a base note to a chosen just interval by ear, then reveal how
 * far off you were. Pure logic here; the panel is `components/TuningGame.tsx`.
 */
export interface GameInterval { id: string; name: string; ratio: string; cents: number }

const I = (name: string, a: number, b: number): GameInterval =>
  ({ id: `${a}-${b}`, name, ratio: `${a}/${b}`, cents: 1200 * Math.log2(a / b) });

/** Just intervals to practise, ascending; names match the Inter-Note Ratio display. */
export const GAME_INTERVALS: GameInterval[] = [
  I('Minor 2nd', 16, 15), I('Submajor 2nd', 10, 9), I('Major 2nd', 9, 8), I('Subminor 3rd', 7, 6),
  I('Minor 3rd', 6, 5), I('Neutral 3rd', 11, 9), I('Major 3rd', 5, 4), I('Supermajor 3rd', 9, 7),
  I('Perfect 4th', 4, 3), I('Wide 4th', 11, 8), I('Diminished 5th', 7, 5), I('Perfect 5th', 3, 2),
  I('Minor 6th', 8, 5), I('Major 6th', 5, 3), I('Subminor 7th', 7, 4), I('Minor 7th', 16, 9),
  I('Superminor 7th', 9, 5), I('Major 7th', 15, 8), I('Octave', 2, 1),
];

export interface Round {
  interval: GameInterval;
  baseHz: number;
  /** slider range (cents above the base): 300¢ wide, the target somewhere inside, not centred */
  min: number;
  max: number;
  /** where the tuned note starts: 25–120¢ from the target */
  start: number;
}

const SPAN = 300;

/**
 * A new round for `intervalId` ('random' picks one). The base note is random between G3 and G4
 * unless `fixedBaseHz` is given. `rng` returns values in [0, 1).
 */
export function newRound(
  which: string | GameInterval, rng: () => number = Math.random, fixedBaseHz: number | null = null,
): Round {
  const intervalId = typeof which === 'string' ? which : null;
  const interval = typeof which !== 'string' ? which : intervalId === 'random'
    ? GAME_INTERVALS[Math.min(GAME_INTERVALS.length - 1, Math.floor(rng() * GAME_INTERVALS.length))]
    : GAME_INTERVALS.find((x) => x.id === intervalId) ?? GAME_INTERVALS[0];
  const baseHz = fixedBaseHz ?? Math.round(196 * 2 ** rng() * 100) / 100; // G3 … G4
  // the target sits 60–240¢ from the slider's low end, so its position gives nothing away
  const min = Math.round((interval.cents - (60 + rng() * (SPAN - 120))) * 10) / 10;
  const max = Math.round((min + SPAN) * 10) / 10;
  // start 25–120¢ away, on whichever side has room
  const away = 25 + rng() * 95;
  let start = interval.cents + (rng() < 0.5 ? -away : away);
  if (start < min || start > max) start = interval.cents * 2 - start;
  return { interval, baseHz, min, max, start: Math.round(start * 10) / 10 };
}

/** largest custom interval (three octaves) */
export const MAX_CUSTOM = 8;

/**
 * A just interval typed in by the user — "13/8", "21:16", "3" or an exact decimal ("1.625") —
 * reduced to lowest terms; null unless it is rational, above 1/1 and at most 8/1.
 */
export function parseCustomInterval(text: string): GameInterval | null {
  const t = text.trim().replace(/\s*:\s*/, '/');
  if (!/^[\d\s./]+$/.test(t)) return null; // digits, "/" and "." only: no roots or powers
  const v = evalRatio(t);
  if (v == null || v <= 1 + 1e-12 || v > MAX_CUSTOM + 1e-12) return null;
  const frac = toFraction(v);
  if (!frac) return null;
  // a known interval keeps its name ("Perfect 5th"); anything else is named by its ratio alone
  const known = GAME_INTERVALS.find((x) => x.ratio === frac);
  return known ?? { id: `custom-${frac}`, name: '', ratio: frac, cents: 1200 * Math.log2(v) };
}

/** Note names for choosing a base note (sharps). */
export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
/** Octaves offered for the base note (scientific pitch: C4 = middle C). */
export const OCTAVES = [1, 2, 3, 4, 5, 6, 7];

/** 12-TET frequency of a note (A4 = 440 Hz). */
export function noteHz(name: string, octave: number): number {
  const midi = 12 * (octave + 1) + Math.max(0, NOTE_NAMES.indexOf(name));
  return 440 * 2 ** ((midi - 69) / 12);
}

/** The 12-TET note nearest a frequency. */
export function nearestNote(hz: number): { name: string; octave: number } {
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  return { name: NOTE_NAMES[((midi % 12) + 12) % 12], octave: Math.floor(midi / 12) - 1 };
}

export interface Rating { label: string; detail: string }

/** A verdict for an error in cents (sign ignored). */
export function rate(errorCents: number): Rating {
  const e = Math.abs(errorCents);
  if (e < 1) return { label: 'Perfect', detail: 'under 1¢: beyond what most ears can tell' };
  if (e < 3) return { label: 'Excellent', detail: 'under 3¢: the beating is very slow' };
  if (e < 6) return { label: 'Great', detail: 'under 6¢' };
  if (e < 12) return { label: 'Good', detail: 'under 12¢' };
  if (e < 30) return { label: 'Close', detail: 'under 30¢: listen for the beating to slow down' };
  return { label: 'Keep practising', detail: 'listen for where the beating stops' };
}

/** "3.2¢ sharp", "7.5¢ flat", or "spot on". */
export function describeError(errorCents: number): string {
  if (Math.abs(errorCents) < 0.05) return 'spot on';
  return `${Math.abs(errorCents).toFixed(1)}¢ ${errorCents > 0 ? 'sharp' : 'flat'}`;
}
