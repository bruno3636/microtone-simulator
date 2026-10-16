import { buildDegree } from './degreeInput';
import { edoExpr } from './ratios';

/** A ready-made scale: which tuning it belongs to and its notes (ascending, root first). */
export interface ScalePreset {
  id: string;
  label: string;
  group: string;
  tuning: string;
  variant?: string;
  edo?: number;
  notes: string[];
}

const edo = (n: number, steps: number[]) => steps.map((k) => edoExpr(k, n));
const pyth = (names: string) => names.split(' ').map((spelling) => buildDegree({ source: 'pythagorean', spelling })!);
const meantone = (variant: string, names: string) =>
  names.split(' ').map((spelling) => buildDegree({ source: 'meantone', variant, spelling })!);
const well = (variant: string, notes: number[]) => notes.map((note) => buildDegree({ source: 'well', variant, note })!);

const MAJOR = 'C D E F G A B';
const MINOR = 'C D E♭ F G A♭ B♭';
const CHROMATIC_12 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MAJOR_12 = [0, 2, 4, 5, 7, 9, 11];

export const SCALE_PRESETS: ScalePreset[] = [
  // just intonation
  { id: 'ji-major', label: 'Just major (Ptolemy)', group: 'Just intonation', tuning: 'just_intonation',
    notes: ['1', '9/8', '5/4', '4/3', '3/2', '5/3', '15/8'] },
  { id: 'ji-minor', label: 'Just natural minor', group: 'Just intonation', tuning: 'just_intonation',
    notes: ['1', '9/8', '6/5', '4/3', '3/2', '8/5', '9/5'] },
  { id: 'ji-pentatonic', label: 'Just pentatonic', group: 'Just intonation', tuning: 'just_intonation',
    notes: ['1', '9/8', '5/4', '3/2', '5/3'] },
  { id: 'ji-septimal', label: 'Septimal major (harmonic 7th)', group: 'Just intonation', tuning: 'just_intonation',
    notes: ['1', '9/8', '5/4', '4/3', '3/2', '5/3', '7/4'] },
  { id: 'ji-otonal', label: 'Harmonics 8–16 (otonal)', group: 'Just intonation', tuning: 'just_intonation',
    notes: ['1', '9/8', '5/4', '11/8', '3/2', '13/8', '7/4', '15/8'] },
  // 12-note just intonation (these use the piano key layout)
  { id: 'ji12-5limit', label: '5-limit chromatic (12)', group: 'Just intonation', tuning: 'just_intonation',
    notes: ['1', '16/15', '9/8', '6/5', '5/4', '4/3', '45/32', '3/2', '8/5', '5/3', '9/5', '15/8'] },
  { id: 'ji12-5limit-169', label: '5-limit chromatic, 16/9 seventh (12)', group: 'Just intonation', tuning: 'just_intonation',
    notes: ['1', '16/15', '9/8', '6/5', '5/4', '4/3', '45/32', '3/2', '8/5', '5/3', '16/9', '15/8'] },
  { id: 'ji12-7limit', label: '7-limit chromatic (12)', group: 'Just intonation', tuning: 'just_intonation',
    notes: ['1', '16/15', '9/8', '7/6', '5/4', '4/3', '7/5', '3/2', '8/5', '5/3', '7/4', '15/8'] },
  { id: 'ji12-11limit', label: '11-limit chromatic (12)', group: 'Just intonation', tuning: 'just_intonation',
    notes: ['1', '12/11', '9/8', '7/6', '5/4', '4/3', '11/8', '3/2', '8/5', '5/3', '7/4', '11/6'] },
  { id: 'ji12-13limit', label: '13-limit chromatic (12)', group: 'Just intonation', tuning: 'just_intonation',
    notes: ['1', '13/12', '9/8', '7/6', '5/4', '4/3', '11/8', '3/2', '13/8', '5/3', '7/4', '11/6'] },
  { id: 'ji12-otonal', label: 'Harmonics 16–30 (12)', group: 'Just intonation', tuning: 'just_intonation',
    notes: ['1', '17/16', '9/8', '19/16', '5/4', '21/16', '11/8', '3/2', '13/8', '27/16', '7/4', '15/8'] },
  { id: 'ji12-utonal', label: 'Subharmonics 16–32 (12)', group: 'Just intonation', tuning: 'just_intonation',
    notes: ['1', '16/15', '8/7', '32/27', '16/13', '4/3', '16/11', '32/21', '8/5', '32/19', '16/9', '32/17'] },
  // 12EDO
  { id: 'edo12-major', label: 'Major', group: '12EDO', tuning: 'edo12', notes: edo(12, MAJOR_12) },
  { id: 'edo12-minor', label: 'Natural minor', group: '12EDO', tuning: 'edo12', notes: edo(12, [0, 2, 3, 5, 7, 8, 10]) },
  { id: 'edo12-harmonic-minor', label: 'Harmonic minor', group: '12EDO', tuning: 'edo12', notes: edo(12, [0, 2, 3, 5, 7, 8, 11]) },
  { id: 'edo12-pentatonic', label: 'Major pentatonic', group: '12EDO', tuning: 'edo12', notes: edo(12, [0, 2, 4, 7, 9]) },
  { id: 'edo12-blues', label: 'Blues', group: '12EDO', tuning: 'edo12', notes: edo(12, [0, 3, 5, 6, 7, 10]) },
  { id: 'edo12-whole-tone', label: 'Whole tone', group: '12EDO', tuning: 'edo12', notes: edo(12, [0, 2, 4, 6, 8, 10]) },
  // other EDOs (Custom EDO)
  { id: 'edo19-major', label: '19EDO major', group: 'Other EDOs', tuning: 'custom_edo', edo: 19, notes: edo(19, [0, 3, 6, 8, 11, 14, 17]) },
  { id: 'edo22-major', label: '22EDO superpyth major', group: 'Other EDOs', tuning: 'custom_edo', edo: 22, notes: edo(22, [0, 4, 8, 9, 13, 17, 21]) },
  { id: 'edo24-rast', label: '24EDO maqam Rast', group: 'Other EDOs', tuning: 'custom_edo', edo: 24, notes: edo(24, [0, 4, 7, 10, 14, 18, 21]) },
  { id: 'edo31-major', label: '31EDO major', group: 'Other EDOs', tuning: 'custom_edo', edo: 31, notes: edo(31, [0, 5, 10, 13, 18, 23, 28]) },
  { id: 'edo53-major', label: '53EDO major (near-just)', group: 'Other EDOs', tuning: 'custom_edo', edo: 53, notes: edo(53, [0, 9, 17, 22, 31, 39, 48]) },
  // Pythagorean
  { id: 'pyth-major', label: 'Pythagorean major', group: 'Pythagorean', tuning: 'pythagorean_tuning', notes: pyth(MAJOR) },
  { id: 'pyth-minor', label: 'Pythagorean natural minor', group: 'Pythagorean', tuning: 'pythagorean_tuning', notes: pyth(MINOR) },
  { id: 'pyth-pentatonic', label: 'Pythagorean pentatonic', group: 'Pythagorean', tuning: 'pythagorean_tuning', notes: pyth('C D E G A') },
  // meantone
  { id: 'mt-quarter-major', label: '¼-comma major', group: 'Meantone', tuning: 'meantone', variant: 'quarter', notes: meantone('quarter', MAJOR) },
  { id: 'mt-quarter-minor', label: '¼-comma natural minor', group: 'Meantone', tuning: 'meantone', variant: 'quarter', notes: meantone('quarter', MINOR) },
  { id: 'mt-quarter-chromatic', label: '¼-comma chromatic (E♭–G♯)', group: 'Meantone', tuning: 'meantone', variant: 'quarter',
    notes: meantone('quarter', 'C C♯ D E♭ E F F♯ G G♯ A B♭ B') },
  { id: 'mt-sixth-major', label: '⅙-comma major', group: 'Meantone', tuning: 'meantone', variant: 'sixth', notes: meantone('sixth', MAJOR) },
  // well temperaments
  { id: 'well-werck-chromatic', label: 'Werckmeister III chromatic', group: 'Well temperament', tuning: 'well_temperament', variant: 'werckmeister3', notes: well('werckmeister3', CHROMATIC_12) },
  { id: 'well-kirn-major', label: 'Kirnberger III major', group: 'Well temperament', tuning: 'well_temperament', variant: 'kirnberger3', notes: well('kirnberger3', MAJOR_12) },
  { id: 'well-vallotti-chromatic', label: 'Vallotti chromatic', group: 'Well temperament', tuning: 'well_temperament', variant: 'vallotti', notes: well('vallotti', CHROMATIC_12) },
  { id: 'well-young-major', label: 'Young major', group: 'Well temperament', tuning: 'well_temperament', variant: 'young', notes: well('young', MAJOR_12) },
];
