import { MEANTONE_FRACTIONS, meantoneDegree, tuningNotes } from './presets';
import { intervalByFifths, noteTag, withLabel } from './intervals';
import { evalRatio, joinCents } from './ratios';

/** Ways to type in a new scale degree (the "insert degree" popover). */
export type DegreeSourceId =
  | 'ji' | 'tempered_ji' | 'edo12' | 'custom_edo' | 'pythagorean' | 'meantone' | 'well' | 'cents' | 'frequency';

export const DEGREE_SOURCES: { id: DegreeSourceId; label: string }[] = [
  { id: 'ji', label: 'Just intonation (ratio)' },
  { id: 'tempered_ji', label: 'Tempered JI (ratio ± cents)' },
  { id: 'edo12', label: '12EDO (steps)' },
  { id: 'custom_edo', label: 'Custom EDO (steps of N)' },
  { id: 'pythagorean', label: 'Pythagorean (note)' },
  { id: 'meantone', label: 'Meantone (note)' },
  { id: 'well', label: 'Well temperament (note)' },
  { id: 'cents', label: 'Cents' },
  { id: 'frequency', label: 'Frequency (Hz)' },
];

export interface DegreeInput {
  source: DegreeSourceId;
  ratio?: string;
  cents?: number;
  steps?: number;
  divisions?: number;
  variant?: string;
  /** spelled note name from SPELLED_NOTES, root = C (Pythagorean, meantone) */
  spelling?: string;
  /** chromatic note index 0–11, root = C (well temperament) */
  note?: number;
  hz?: number;
  rootHz?: number;
}

const isInt = (n: number | undefined): n is number => n != null && Number.isInteger(n);
const finite = (n: number | undefined): n is number => n != null && Number.isFinite(n);

/**
 * Spelled notes for chain-of-fifths tunings, where sharps and flats are different pitches
 * (C♯ is 7 fifths up, D♭ is 5 fifths down). `fifths` is the position relative to the root C.
 */
export const SPELLED_NOTES: { name: string; fifths: number }[] = [
  { name: 'C', fifths: 0 }, { name: 'C♯', fifths: 7 }, { name: 'D♭', fifths: -5 }, { name: 'D', fifths: 2 },
  { name: 'D♯', fifths: 9 }, { name: 'E♭', fifths: -3 }, { name: 'E', fifths: 4 }, { name: 'F', fifths: -1 },
  { name: 'F♯', fifths: 6 }, { name: 'G♭', fifths: -6 }, { name: 'G', fifths: 1 }, { name: 'G♯', fifths: 8 },
  { name: 'A♭', fifths: -4 }, { name: 'A', fifths: 3 }, { name: 'A♯', fifths: 10 }, { name: 'B♭', fifths: -2 },
  { name: 'B', fifths: 5 },
];

/** Interval name shown in the note picker for a spelled note. */
export const spelledInterval = (n: { fifths: number }) => intervalByFifths(n.fifths);

const fifthsOf = (spelling: string | undefined) => SPELLED_NOTES.find((n) => n.name === spelling)?.fifths;

/** `n` pure fifths from the root as an exact ratio 3^a / 2^b, reduced into the octave. */
function pythagorean(n: number): string {
  if (n === 0) return '1';
  if (n > 0) {
    const m = Math.floor(n * Math.log2(3));
    return m === 0 ? `3^${n}` : `3^${n} / 2^${m}`;
  }
  const m = Math.ceil(-n * Math.log2(3));
  return `2^${m} / 3^${-n}`;
}

/** The note expression for a typed-in degree, or null when the input is incomplete or invalid. */
export function buildDegree(i: DegreeInput): string | null {
  switch (i.source) {
    case 'ji':
      return i.ratio != null && evalRatio(i.ratio) != null ? i.ratio.trim() : null;
    case 'tempered_ji':
      return i.ratio != null && evalRatio(i.ratio) != null && finite(i.cents) ? joinCents(i.ratio, i.cents) : null;
    case 'edo12':
      return isInt(i.steps) ? (i.steps === 0 ? '1' : `2^(${i.steps}/12)`) : null;
    case 'custom_edo':
      if (!isInt(i.steps) || !isInt(i.divisions) || i.divisions < 1) return null;
      return i.steps === 0 ? '1' : `2^(${i.steps}/${i.divisions})`;
    case 'pythagorean': {
      const n = fifthsOf(i.spelling);
      return n == null ? null : withLabel(noteTag('pythagorean', null, n), pythagorean(n));
    }
    case 'meantone': {
      const n = fifthsOf(i.spelling);
      const f = MEANTONE_FRACTIONS[i.variant ?? 'quarter'];
      return n == null || !f ? null : withLabel(noteTag('meantone', i.variant ?? 'quarter', n), meantoneDegree(f[0], f[1], n));
    }
    case 'well':
      // a closed circle: enharmonic notes coincide, so 12 names suffice
      return isInt(i.note) && i.note >= 0 && i.note < 12 ? tuningNotes('well_temperament', i.variant)[i.note] : null;
    case 'cents':
      return finite(i.cents) ? joinCents('1', i.cents) : null;
    case 'frequency':
      return finite(i.hz) && i.hz > 0 && finite(i.rootHz) && i.rootHz > 0 ? `${i.hz} / ${+i.rootHz.toFixed(3)}` : null;
  }
}
