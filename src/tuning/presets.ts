export interface Tuning { label: string; scalable: boolean; notes: string[] }

export const TUNINGS: Record<string, Tuning> = {
  just_intonation: {
    label: 'Just intonation', scalable: true,
    notes: ['1', '1 + 1/15', '1 + 1/8', '1 + 1/5', '1 + 1/4', '1 + 1/3', '1 + 13/32', '1 + 1/2', '1 + 3/5', '1 + 2/3', '1 + 4/5', '1 + 7/8'],
  },
  equal_temperament: {
    label: 'Equal temperament', scalable: true,
    notes: ['1', '2^(1/12)', '2^(2/12)', '2^(3/12)', '2^(4/12)', '2^(5/12)', '2^(6/12)', '2^(7/12)', '2^(8/12)', '2^(9/12)', '2^(10/12)', '2^(11/12)'],
  },
  pythagorean_tuning: {
    label: 'Pythagorean', scalable: true,
    notes: ['1', '2^8 / 3^5', '3^2 / 2^3', '2^5 / 3^3', '3^4 / 2^6', '2^2 / 3', '2^10 / 3^6', '3 / 2', '2^7 / 3^4', '3^3 / 2^4', '2^4 / 3^2', '3^5 / 2^7'],
  },
  meantone_temperament: {
    label: 'Meantone', scalable: true,
    notes: ['1', '5/16 * nthRoot(5^3, 4)', '1/2 * sqrt(5)', '4/5 * nthRoot(5,4)', '1 + 1/4', '2/5 * nthRoot(5^3,4)', '5/8 * sqrt(5)', 'nthRoot(5,4)', '25/16', '1/2 * nthRoot(5^3,4)', '4/5 * sqrt(5)', '5/4 * nthRoot(5,4)'],
  },
  harmonic_series: {
    label: 'Harmonic series', scalable: false,
    notes: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  },
  custom_equal_scale: {
    label: 'Custom equal (7)', scalable: false,
    notes: ['1', '1 + 1/7', '1 + 2/7', '1 + 3/7', '1 + 4/7', '1 + 5/7', '1 + 6/7'],
  },
  custom_spooky: {
    label: 'Custom spooky', scalable: false,
    notes: ['1/1', '1.6', '1.87'],
  },
};

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
