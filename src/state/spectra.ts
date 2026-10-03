/**
 * Measured harmonic spectra for the instrument presets (linear amplitude, harmonic 1 first,
 * normalized to the strongest harmonic; levels below −60 dB dropped as noise floor).
 *
 * Violin / cello: SHARC timbre database (G. Sandell, 1991; tones from the McGill University
 * Master Samples), `violin_vibrato` median of 27 notes G3–A5 and `cello_vibrato` median of
 * 27 notes C2–D4, each note normalized to its strongest harmonic before taking the median.
 *
 * Piano / guitar: analysed from the University of Iowa Musical Instrument Samples.
 * Piano: Steinway `Piano.mf.{C3,C4,A4}`, left and right channels (6 measurements).
 * Guitar: `Guitar.mf.sulE.E2B2` and `Guitar.mf.sulA.C3B3`, 16 cleanly separated notes.
 * Attack spectrum = 30–200 ms after onset, sustain spectrum = 0.8–1.2 s after onset
 * (Hann window, peak search ±2.5 % around each partial, allowing for piano inharmonicity).
 * Darken time τ: exponential fit of how fast each note's spectrum moves from the attack
 * to the sustain spectrum.
 */

export const VIOLIN = [
  1.0, 0.7025, 0.3677, 0.3841, 0.3983, 0.2233, 0.2171, 0.1134, 0.0612, 0.0666, 0.0276, 0.026, 0.0173, 0.0168,
  0.012, 0.0141, 0.0084, 0.0049, 0.0061, 0.0032, 0.002, 0.0018,
];

export const CELLO = [
  1.0, 0.9838, 0.3707, 0.2445, 0.1305, 0.1621, 0.1168, 0.1041, 0.0645, 0.0638, 0.0462, 0.0532, 0.0575, 0.0401,
  0.0452, 0.0333, 0.031, 0.0197, 0.0154, 0.0133, 0.0148, 0.0103, 0.0124, 0.0078, 0.009, 0.0062, 0.0073, 0.0052,
  0.0066, 0.004, 0.0033, 0.003,
];

export const PIANO_ATTACK = [
  1.0, 0.7228, 0.3058, 0.1834, 0.107, 0.0628, 0.1847, 0.0327, 0.0066, 0.0058, 0.0067, 0.0045, 0.0028,
];

export const PIANO_SUSTAIN = [
  0.523, 1.0, 0.3276, 0.1795, 0.1129, 0.0681, 0.0584, 0.008, 0.0053, 0.0052, 0.0046, 0.0036, 0.0025,
];

export const GUITAR_ATTACK = [
  1.0, 0.331, 0.1967, 0.0568, 0.0679, 0.0245, 0.0248, 0.0114, 0.0041, 0.007, 0.0105, 0.0064, 0.0033, 0.0028,
  0.0014, 0.0016, 0.0017, 0.0012, 0.0014, 0.0012, 0.0, 0.0012,
];

export const GUITAR_SUSTAIN = [
  1.0, 0.4033, 0.1618, 0.164, 0.0884, 0.0235, 0.0112, 0.0048, 0.0023, 0.003, 0.0021, 0.001,
];

/** Fitted darken time constants (ms). */
export const PIANO_TAU_MS = 1220;
export const GUITAR_TAU_MS = 570;
