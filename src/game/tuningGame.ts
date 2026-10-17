/**
 * Tuning game: tune a note against a base note to a chosen just interval by ear, then reveal how
 * far off you were. Pure logic here; the panel is `components/TuningGame.tsx`.
 */
export interface GameInterval {
  id: string; name: string; ratio: string; cents: number;
  /** 'cents': typed as a size in cents (`ratio` then reads e.g. "386.3¢") */
  kind?: 'ratio' | 'cents';
}

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
  /** slider range (cents above the base): 100¢ wide, the target somewhere inside, not centred */
  min: number;
  max: number;
  /** where the tuned note starts: anywhere on the slider at least 15¢ from the target */
  start: number;
}

const SPAN = 100;
/** the target is at least this far from either end of the slider */
const EDGE = 20;
/** the tuned note starts at least this far from the target */
const MIN_AWAY = 15;

/**
 * A new round for `intervalId` ('random' picks one). The base note is random between 220 and 440 Hz
 * unless `fixedBaseHz` is given. `rng` returns values in [0, 1).
 */
export function newRound(
  which: string | GameInterval, rng: () => number = Math.random, fixedBaseHz: number | null = null,
): Round {
  const intervalId = typeof which === 'string' ? which : null;
  const interval = typeof which !== 'string' ? which : intervalId === 'random'
    ? GAME_INTERVALS[Math.min(GAME_INTERVALS.length - 1, Math.floor(rng() * GAME_INTERVALS.length))]
    : GAME_INTERVALS.find((x) => x.id === intervalId) ?? GAME_INTERVALS[0];
  const baseHz = fixedBaseHz ?? Math.round(220 * 2 ** rng() * 100) / 100; // A3 … A4 (220–440 Hz)
  // the target sits 20–80¢ from the slider's low end, so its position gives nothing away
  const min = Math.round((interval.cents - (EDGE + rng() * (SPAN - 2 * EDGE))) * 10) / 10;
  const max = Math.round((min + SPAN) * 10) / 10;
  // start anywhere on the slider except within 15¢ of the target: pick a point along the two
  // allowed stretches (below and above the target) laid end to end
  const below = interval.cents - MIN_AWAY - min;
  const above = max - (interval.cents + MIN_AWAY);
  const u = rng() * (below + above);
  const start = u < below ? min + u : interval.cents + MIN_AWAY + (u - below);
  return { interval, baseHz, min, max, start: Math.round(start * 10) / 10 };
}

/** largest custom interval (five octaves; the top note stays audible above a 440 Hz base) */
export const MAX_CUSTOM = 32;

/** A decimal or integer string as an exact fraction of BigInts ("1.625" → 1625 / 1000). */
function exact(text: string): [bigint, bigint] | null {
  const m = /^(\d*)(?:\.(\d+))?$/.exec(text);
  if (!m || (m[1] === '' && !m[2])) return null;
  const frac = m[2] ?? '';
  return [BigInt((m[1] || '0') + frac), 10n ** BigInt(frac.length)];
}
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));

/**
 * A just interval typed in by the user — "13/8", "21:16", "3", "1.625" or "1.5/1" — read exactly
 * from its digits (any size of numbers, e.g. 531441/524288) and reduced to lowest terms; null
 * unless it is above 1/1 and at most 32/1. Roots, powers and other expressions are rejected.
 */
export function parseCustomInterval(text: string): GameInterval | null {
  const parts = text.trim().split(/\s*[/:]\s*/);
  if (parts.length > 2) return null;
  const num = exact(parts[0]);
  const den = parts.length === 2 ? exact(parts[1]) : [1n, 1n] as [bigint, bigint];
  if (!num || !den) return null;
  let n = num[0] * den[1];
  let d = num[1] * den[0];
  if (n === 0n || d === 0n) return null;
  const g = gcd(n, d);
  n /= g;
  d /= g;
  // compare exactly: 1 < n/d ≤ 32
  if (n <= d || n > d * BigInt(MAX_CUSTOM)) return null;
  const frac = `${n}/${d}`;
  // a known interval keeps its name ("Perfect 5th"); anything else is named by its ratio alone
  const known = GAME_INTERVALS.find((x) => x.ratio === frac);
  const cents = 1200 * (log2Big(n) - log2Big(d));
  return known ?? { id: `custom-${frac}`, name: '', ratio: frac, cents };
}

/** log2 of a BigInt of any size (scaled down first so it fits a float). */
function log2Big(x: bigint): number {
  const bits = x.toString(2).length;
  if (bits <= 1000) return Math.log2(Number(x));
  const shift = BigInt(bits - 60);
  return Math.log2(Number(x >> shift)) + Number(shift);
}

/** largest cents target (five octaves, as for ratios) */
export const MAX_CENTS = 6000;

/** A target typed as a size in cents ("386.3", "700¢", "551.3c"): above 0, at most 6000. */
export function parseCentsInterval(text: string): GameInterval | null {
  const m = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(?:¢|c|cents?)?\s*$/i.exec(text);
  if (!m) return null;
  const c = Number(m[1]);
  if (!(c > 0) || c > MAX_CENTS) return null;
  return { id: `cents-${c}`, name: '', ratio: `${c}¢`, cents: c, kind: 'cents' };
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
