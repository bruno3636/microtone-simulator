import { MEANTONE_FRACTIONS, meantoneDegree, tuningNotes } from './presets';
import { evalRatio, joinCents } from './ratios';

/** Ways to type in a new scale degree (the "insert degree" popover). */
export type DegreeSourceId =
  | 'ji' | 'tempered_ji' | 'harmonic' | 'edo12' | 'custom_edo' | 'pythagorean' | 'meantone' | 'well' | 'cents' | 'frequency';

export const DEGREE_SOURCES: { id: DegreeSourceId; label: string }[] = [
  { id: 'ji', label: 'Just intonation (ratio)' },
  { id: 'tempered_ji', label: 'Tempered JI (ratio ± cents)' },
  { id: 'harmonic', label: 'Harmonic series (harmonic no.)' },
  { id: 'edo12', label: '12EDO (steps)' },
  { id: 'custom_edo', label: 'Custom EDO (steps of N)' },
  { id: 'pythagorean', label: 'Pythagorean (fifths)' },
  { id: 'meantone', label: 'Meantone (fifths)' },
  { id: 'well', label: 'Well temperament (note)' },
  { id: 'cents', label: 'Cents' },
  { id: 'frequency', label: 'Frequency (Hz)' },
];

export interface DegreeInput {
  source: DegreeSourceId;
  ratio?: string;
  cents?: number;
  harmonic?: number;
  steps?: number;
  divisions?: number;
  fifths?: number;
  variant?: string;
  /** chromatic note index 0–11 (well temperament) */
  note?: number;
  hz?: number;
  rootHz?: number;
}

const isInt = (n: number | undefined): n is number => n != null && Number.isInteger(n);
const finite = (n: number | undefined): n is number => n != null && Number.isFinite(n);

/** `n` pure fifths from the root as an exact ratio, reduced into the octave. */
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
    case 'harmonic':
      return isInt(i.harmonic) && i.harmonic >= 1 ? String(i.harmonic) : null;
    case 'edo12':
      return isInt(i.steps) ? (i.steps === 0 ? '1' : `2^(${i.steps}/12)`) : null;
    case 'custom_edo':
      if (!isInt(i.steps) || !isInt(i.divisions) || i.divisions < 1) return null;
      return i.steps === 0 ? '1' : `2^(${i.steps}/${i.divisions})`;
    case 'pythagorean':
      return isInt(i.fifths) ? pythagorean(i.fifths) : null;
    case 'meantone': {
      const f = MEANTONE_FRACTIONS[i.variant ?? 'quarter'];
      return f && isInt(i.fifths) ? meantoneDegree(f[0], f[1], i.fifths) : null;
    }
    case 'well':
      return isInt(i.note) && i.note >= 0 && i.note < 12 ? tuningNotes('well_temperament', i.variant)[i.note] : null;
    case 'cents':
      return finite(i.cents) ? joinCents('1', i.cents) : null;
    case 'frequency':
      return finite(i.hz) && i.hz > 0 && finite(i.rootHz) && i.rootHz > 0 ? `${i.hz} / ${+i.rootHz.toFixed(3)}` : null;
  }
}
