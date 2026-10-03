import { tuningNotes } from './presets';
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
  /** chromatic note index 0–11, root = C (Pythagorean, meantone, well temperament) */
  note?: number;
  hz?: number;
  rootHz?: number;
}

const isInt = (n: number | undefined): n is number => n != null && Number.isInteger(n);
const finite = (n: number | undefined): n is number => n != null && Number.isFinite(n);

/** A note (0–11, root = C) of a 12-note tuning, or null for an out-of-range note. */
const noteOf = (tuning: string, note: number | undefined, variant?: string) =>
  isInt(note) && note >= 0 && note < 12 ? tuningNotes(tuning, variant)[note] : null;

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
    case 'pythagorean':
      return noteOf('pythagorean_tuning', i.note);
    case 'meantone':
      return noteOf('meantone', i.note, i.variant ?? 'quarter');
    case 'well':
      return noteOf('well_temperament', i.note, i.variant);
    case 'cents':
      return finite(i.cents) ? joinCents('1', i.cents) : null;
    case 'frequency':
      return finite(i.hz) && i.hz > 0 && finite(i.rootHz) && i.rootHz > 0 ? `${i.hz} / ${+i.rootHz.toFixed(3)}` : null;
  }
}
