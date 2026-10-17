import { buildDegree } from './degreeInput';
import { edoExpr, edtExpr, evalRatio } from './ratios';

/** A ready-made scale: which tuning it belongs to and its notes (ascending, root first). */
export interface ScalePreset {
  id: string;
  label: string;
  group: string;
  tuning: string;
  variant?: string;
  edo?: number;
  edt?: number;
  /** the interval the notes repeat at (default 2, the octave; 3 for tritave scales) */
  period?: number;
  notes: string[];
}

const edo = (n: number, steps: number[]) => steps.map((k) => edoExpr(k, n));
const pyth = (names: string) => names.split(' ').map((spelling) => buildDegree({ source: 'pythagorean', spelling })!);
const meantone = (variant: string, names: string) =>
  names.split(' ').map((spelling) => buildDegree({ source: 'meantone', variant, spelling })!);
const well = (variant: string, notes: number[]) => notes.map((note) => buildDegree({ source: 'well', variant, note })!);

/** Notes sorted by pitch (for spellings whose order differs by tuning, e.g. meantone C♯ < D♭). */
const ascending = (notes: string[]) => [...notes].sort((a, b) => evalRatio(a)! - evalRatio(b)!);

const MAJOR = 'C D E F G A B';
const MINOR = 'C D E♭ F G A♭ B♭';
const CHROMATIC_12 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MAJOR_12 = [0, 2, 4, 5, 7, 9, 11];
const ALL_17 = 'C C♯ D♭ D D♯ E♭ E F F♯ G♭ G G♯ A♭ A A♯ B♭ B';
const CHROMATIC_SPELLED = 'C C♯ D E♭ E F F♯ G G♯ A B♭ B';
const JI = (id: string, label: string, notes: string) =>
  ({ id, label, group: 'Just intonation', tuning: 'just_intonation', notes: notes.split(' ') });
const E12 = (id: string, label: string, steps: number[]) =>
  ({ id: `edo12-${id}`, label, group: '12EDO', tuning: 'edo12', notes: edo(12, steps) });
const EN = (n: number, id: string, label: string, steps: number[]) =>
  ({ id: `edo${n}-${id}`, label, group: 'Other EDOs', tuning: 'custom_edo', edo: n, notes: edo(n, steps) });
const range = (n: number) => Array.from({ length: n }, (_, k) => k);

const ALL_PRESETS: ScalePreset[] = [
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
  ...EXTRA_PRESETS(),
];

export const PRESET_GROUPS = ['Just intonation', '12EDO', 'Other EDOs', 'Tritave (EDT)', 'Pythagorean', 'Meantone', 'Well temperament'];

/** Every preset, grouped by source in `PRESET_GROUPS` order (stable within a group). */
export const SCALE_PRESETS: ScalePreset[] = PRESET_GROUPS.flatMap((g) => ALL_PRESETS.filter((p) => p.group === g));

/** The longer tail of the list: modes, world scales, historical JI and more EDOs and temperaments. */
function EXTRA_PRESETS(): ScalePreset[] {
  return [
    // just intonation: modes and ancient Greek tetrachord scales
    JI('ji-harmonic-minor', 'Just harmonic minor', '1 9/8 6/5 4/3 3/2 8/5 15/8'),
    JI('ji-dorian', 'Just Dorian', '1 9/8 6/5 4/3 3/2 5/3 16/9'),
    JI('ji-phrygian', 'Just Phrygian', '1 16/15 6/5 4/3 3/2 8/5 9/5'),
    JI('ji-lydian', 'Just Lydian', '1 9/8 5/4 45/32 3/2 5/3 15/8'),
    JI('ji-mixolydian', 'Just Mixolydian', '1 9/8 5/4 4/3 3/2 5/3 16/9'),
    JI('ji-minor-pentatonic', 'Just minor pentatonic', '1 6/5 4/3 3/2 9/5'),
    JI('ji-harmonics-4-7', 'Harmonics 4–7 (harmonic 7th chord)', '1 5/4 3/2 7/4'),
    JI('ji-archytas', 'Archytas diatonic', '1 28/27 32/27 4/3 3/2 14/9 16/9'),
    JI('ji-didymus', 'Didymus diatonic', '1 16/15 32/27 4/3 3/2 8/5 16/9'),
    JI('ji-ptolemy-equable', 'Ptolemy equable diatonic', '1 12/11 6/5 4/3 3/2 18/11 9/5'),
    JI('ji-septimal-pentatonic', 'Septimal pentatonic', '1 8/7 4/3 3/2 7/4'),
    JI('ji-otonal-hexad', 'Otonal 7-limit hexad', '1 9/8 5/4 3/2 7/4 15/8'),
    JI('ji-utonal-minor', 'Utonal minor (subharmonics 6–4)', '1 6/5 4/3 3/2 8/5'),
    // 12EDO: church modes, other heptatonic and symmetric scales, world scales, full chromatic
    E12('dorian', 'Dorian', [0, 2, 3, 5, 7, 9, 10]),
    E12('phrygian', 'Phrygian', [0, 1, 3, 5, 7, 8, 10]),
    E12('lydian', 'Lydian', [0, 2, 4, 6, 7, 9, 11]),
    E12('mixolydian', 'Mixolydian', [0, 2, 4, 5, 7, 9, 10]),
    E12('locrian', 'Locrian', [0, 1, 3, 5, 6, 8, 10]),
    E12('melodic-minor', 'Melodic minor', [0, 2, 3, 5, 7, 9, 11]),
    E12('phrygian-dominant', 'Phrygian dominant', [0, 1, 4, 5, 7, 8, 10]),
    E12('double-harmonic', 'Double harmonic', [0, 1, 4, 5, 7, 8, 11]),
    E12('hungarian-minor', 'Hungarian minor', [0, 2, 3, 6, 7, 8, 11]),
    E12('minor-pentatonic', 'Minor pentatonic', [0, 3, 5, 7, 10]),
    E12('hirajoshi', 'Hirajōshi', [0, 2, 3, 7, 8]),
    E12('in', 'In (Miyako-bushi)', [0, 1, 5, 7, 8]),
    E12('octatonic', 'Octatonic (half–whole)', [0, 1, 3, 4, 6, 7, 9, 10]),
    E12('augmented', 'Augmented (hexatonic)', [0, 3, 4, 7, 8, 11]),
    E12('chromatic', 'Chromatic (12)', CHROMATIC_12),
    // other EDOs
    EN(5, 'all', '5EDO (slendro-like)', range(5)),
    EN(7, 'all', '7EDO (Thai-like)', range(7)),
    EN(17, 'major', '17EDO major', [0, 3, 6, 7, 10, 13, 16]),
    EN(19, 'chromatic', '19EDO chromatic (19)', range(19)),
    EN(22, 'srutis', '22EDO (22 srutis)', range(22)),
    EN(24, 'bayati', '24EDO maqam Bayati', [0, 3, 6, 10, 14, 16, 20]),
    EN(24, 'hijaz', '24EDO maqam Hijaz', [0, 2, 8, 10, 14, 16, 20]),
    EN(24, 'chromatic', '24EDO quarter-tones (24)', range(24)),
    EN(31, 'chromatic', '31EDO chromatic (31)', range(31)),
    EN(31, 'septimal', '31EDO septimal major (7/4)', [0, 5, 10, 13, 18, 23, 25]),
    EN(41, 'major', '41EDO major', [0, 7, 13, 17, 24, 30, 37]),
    EN(53, 'chromatic', '53EDO commas (53)', range(53)),
    // tritave scales: repeat at 3/1 instead of the octave
    { id: 'edt13-bp', label: 'Bohlen–Pierce (13EDT)', group: 'Tritave (EDT)', tuning: 'custom_edt', edt: 13, period: 3,
      notes: range(13).map((k) => edtExpr(k, 13)) },
    { id: 'edt13-lambda', label: 'Bohlen–Pierce Lambda mode (13EDT)', group: 'Tritave (EDT)', tuning: 'custom_edt', edt: 13, period: 3,
      notes: [0, 2, 3, 4, 6, 7, 9, 10, 12].map((k) => edtExpr(k, 13)) },
    { id: 'bp-just', label: 'Bohlen–Pierce (just)', group: 'Tritave (EDT)', tuning: 'just_intonation', period: 3,
      notes: ['1', '27/25', '25/21', '9/7', '7/5', '75/49', '5/3', '9/5', '49/25', '15/7', '7/3', '63/25', '25/9'] },
    { id: 'edt9', label: '9EDT', group: 'Tritave (EDT)', tuning: 'custom_edt', edt: 9, period: 3,
      notes: range(9).map((k) => edtExpr(k, 9)) },
    // Pythagorean modes and chromatic
    { id: 'pyth-dorian', label: 'Pythagorean Dorian', group: 'Pythagorean', tuning: 'pythagorean_tuning', notes: pyth('C D E♭ F G A B♭') },
    { id: 'pyth-phrygian', label: 'Pythagorean Phrygian', group: 'Pythagorean', tuning: 'pythagorean_tuning', notes: pyth('C D♭ E♭ F G A♭ B♭') },
    { id: 'pyth-lydian', label: 'Pythagorean Lydian', group: 'Pythagorean', tuning: 'pythagorean_tuning', notes: pyth('C D E F♯ G A B') },
    { id: 'pyth-mixolydian', label: 'Pythagorean Mixolydian', group: 'Pythagorean', tuning: 'pythagorean_tuning', notes: pyth('C D E F G A B♭') },
    { id: 'pyth-minor-pentatonic', label: 'Pythagorean minor pentatonic', group: 'Pythagorean', tuning: 'pythagorean_tuning', notes: pyth('C E♭ F G B♭') },
    { id: 'pyth-chromatic', label: 'Pythagorean chromatic (12)', group: 'Pythagorean', tuning: 'pythagorean_tuning', notes: ascending(pyth(CHROMATIC_SPELLED)) },
    { id: 'pyth-17', label: 'Pythagorean 17 (sharps and flats)', group: 'Pythagorean', tuning: 'pythagorean_tuning', notes: ascending(pyth(ALL_17)) },
    // meantone: other comma sizes, modes, chromatics and split keys
    { id: 'mt-third-major', label: '⅓-comma major', group: 'Meantone', tuning: 'meantone', variant: 'third', notes: meantone('third', MAJOR) },
    { id: 'mt-fifth-major', label: '⅕-comma major', group: 'Meantone', tuning: 'meantone', variant: 'fifth', notes: meantone('fifth', MAJOR) },
    { id: 'mt-27-major', label: '2/7-comma major (Zarlino)', group: 'Meantone', tuning: 'meantone', variant: 'twoSevenths', notes: meantone('twoSevenths', MAJOR) },
    { id: 'mt-quarter-dorian', label: '¼-comma Dorian', group: 'Meantone', tuning: 'meantone', variant: 'quarter', notes: meantone('quarter', 'C D E♭ F G A B♭') },
    { id: 'mt-quarter-mixolydian', label: '¼-comma Mixolydian', group: 'Meantone', tuning: 'meantone', variant: 'quarter', notes: meantone('quarter', 'C D E F G A B♭') },
    { id: 'mt-quarter-pentatonic', label: '¼-comma pentatonic', group: 'Meantone', tuning: 'meantone', variant: 'quarter', notes: meantone('quarter', 'C D E G A') },
    { id: 'mt-sixth-chromatic', label: '⅙-comma chromatic (12)', group: 'Meantone', tuning: 'meantone', variant: 'sixth', notes: ascending(meantone('sixth', CHROMATIC_SPELLED)) },
    { id: 'mt-third-chromatic', label: '⅓-comma chromatic (12)', group: 'Meantone', tuning: 'meantone', variant: 'third', notes: ascending(meantone('third', CHROMATIC_SPELLED)) },
    { id: 'mt-quarter-17', label: '¼-comma split keys (17)', group: 'Meantone', tuning: 'meantone', variant: 'quarter', notes: ascending(meantone('quarter', ALL_17)) },
    // well temperaments: the remaining majors and chromatics
    { id: 'well-werck-major', label: 'Werckmeister III major', group: 'Well temperament', tuning: 'well_temperament', variant: 'werckmeister3', notes: well('werckmeister3', MAJOR_12) },
    { id: 'well-kirn-chromatic', label: 'Kirnberger III chromatic', group: 'Well temperament', tuning: 'well_temperament', variant: 'kirnberger3', notes: well('kirnberger3', CHROMATIC_12) },
    { id: 'well-vallotti-major', label: 'Vallotti major', group: 'Well temperament', tuning: 'well_temperament', variant: 'vallotti', notes: well('vallotti', MAJOR_12) },
    { id: 'well-young-chromatic', label: 'Young chromatic', group: 'Well temperament', tuning: 'well_temperament', variant: 'young', notes: well('young', CHROMATIC_12) },
    { id: 'well-werck-minor', label: 'Werckmeister III natural minor', group: 'Well temperament', tuning: 'well_temperament', variant: 'werckmeister3', notes: well('werckmeister3', [0, 2, 3, 5, 7, 8, 10]) },
  ];
}

/** Presets whose label or group contains every word of `query` (case-insensitive), in list order. */
export function filterPresets(query: string): ScalePreset[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return SCALE_PRESETS;
  return SCALE_PRESETS.filter((p) => {
    const hay = `${p.label} ${p.group}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
