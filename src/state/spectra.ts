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

/*
 * Winds and brass: SHARC, each note normalized to its strongest harmonic, median per harmonic.
 * Flute `flute_vibrato` 25 notes C4–C6; clarinet `Bb_clarinet` 21 notes D3–A#4 (chalumeau and
 * throat register, where the cylindrical bore's weak even harmonics are clearest); trombone
 * `trombone` 26 notes E2–F4; trumpet `C_trumpet` 31 notes F#3–C6.
 */

export const FLUTE = [
  1.0, 0.4654, 0.1197, 0.133, 0.0236, 0.0089, 0.0043, 0.0059, 0.0027, 0.0019, 0.0019, 0.0015, 0.0013,
];

export const CLARINET = [
  1.0, 0.0275, 0.5693, 0.0478, 0.3199, 0.113, 0.2568, 0.1126, 0.1531, 0.0853, 0.0705, 0.0513, 0.0587, 0.0312,
  0.0316, 0.0269, 0.0232, 0.0194, 0.0106, 0.0102, 0.0075, 0.0069, 0.0035, 0.0028, 0.0024, 0.0041, 0.0018, 0.0019,
  0.0022, 0.0011, 0.0011,
];

export const TROMBONE = [
  0.5773, 0.7526, 0.9871, 1.0, 0.9149, 0.8417, 0.658, 0.48, 0.3255, 0.1975, 0.1257, 0.0979, 0.0697, 0.0495,
  0.0359, 0.0239, 0.0167, 0.0126, 0.0084, 0.006, 0.0046, 0.004, 0.0028, 0.002, 0.0018, 0.0021, 0.0017, 0.0016,
  0.0013, 0.0, 0.0014, 0.0016,
];

export const TRUMPET = [
  0.7375, 1.0, 0.989, 0.7566, 0.5324, 0.3859, 0.2168, 0.1439, 0.076, 0.0764, 0.0486, 0.0475, 0.0451, 0.059,
  0.0635, 0.059, 0.0471, 0.0464, 0.0446, 0.0404, 0.0314, 0.0233, 0.0254, 0.025, 0.0203, 0.0139, 0.0133, 0.0108,
  0.0093, 0.0094, 0.0095, 0.0063,
];

/*
 * Pipe organ principal chorus (8' + 4' + 2 2/3' + 2'). Each rank uses the measured Open Diapason
 * spectral envelope from C. E. Pykett, "The Effect of Organ Pipe Scales on their Harmonic Spectra"
 * (tenor G pipe): −6 dB/octave up to harmonic 4.5, then −23 dB/octave. A rank at k times the
 * 8' pitch contributes to harmonics k, 2k, 3k…; independent pipes add in power. Rank levels follow
 * conventional chorus voicing: 8' 0 dB, 4' −3 dB, 2 2/3' −6 dB, 2' −6 dB.
 */
export const ORGAN_CHORUS = [
  1.0, 0.8674, 0.6026, 0.6635, 0.1494, 0.3532, 0.0413, 0.3088, 0.1684, 0.1063, 0.0073, 0.2163, 0.0039, 0.0294,
  0.0749, 0.1271, 0.0014, 0.039, 0.0, 0.0752, 0.0207, 0.0052, 0.0, 0.0395, 0.0, 0.0028, 0.0079, 0.0208, 0.0,
  0.0055, 0.0, 0.0125,
];

/*
 * More SHARC medians (same method): oboe 27 notes A#3–C6; bassoon 32 notes A#1–F4;
 * tuba 26 notes C2–D4; French horn 37 notes D2–D5.
 */

export const OBOE = [
  0.6609, 1.0, 0.3158, 0.2851, 0.153, 0.0667, 0.0295, 0.0247, 0.0332, 0.0204, 0.0118, 0.0062, 0.0048, 0.0053,
  0.0027, 0.0034, 0.0026, 0.0021, 0.0033, 0.0028, 0.0015, 0.0023, 0.0015, 0.0013, 0.0013, 0.0012, 0.0, 0.0013,
];

export const BASSOON = [
  0.6458, 1.0, 0.9601, 0.8694, 0.4465, 0.3521, 0.14, 0.0981, 0.0547, 0.0653, 0.0429, 0.0176, 0.0128, 0.0083,
  0.0078, 0.0075, 0.0056, 0.0038, 0.0039, 0.004, 0.0031, 0.0028, 0.002, 0.0023, 0.0027, 0.0028, 0.0014, 0.0024,
  0.0017, 0.0016, 0.0021, 0.0013,
];

export const TUBA = [
  0.9455, 1.0, 0.5624, 0.2522, 0.1164, 0.09, 0.0525, 0.0218, 0.0171, 0.0123, 0.0104, 0.0056, 0.0036, 0.0019,
  0.001, 0.0013,
];

export const FRENCH_HORN = [
  0.5985, 1.0, 0.9631, 0.7493, 0.4256, 0.232, 0.1435, 0.0904, 0.0349, 0.0124, 0.0086, 0.0062, 0.0052, 0.003,
  0.0021, 0.0013, 0.0011, 0.0012,
];

/*
 * Saxophone: Univ. of Iowa MIS Eb alto sax, `AltoSax.NoVib.mf.{Db3B3,C4B4}`, 23 notes, steady-state
 * window 0.3–0.8 s after onset, median of per-note normalized spectra.
 */
export const ALTO_SAX = [
  1.0, 0.4752, 0.2156, 0.1354, 0.1063, 0.0728, 0.0644, 0.047, 0.0307, 0.033, 0.032, 0.0198, 0.0153, 0.015,
  0.0106, 0.0076, 0.0075, 0.0055, 0.0077, 0.0041, 0.0045, 0.0028, 0.0035, 0.0028, 0.0022, 0.0019, 0.002, 0.0013,
  0.0016, 0.0017, 0.0019,
];

/*
 * Harp: VSCO 2 Community Edition (CC0), `KSHarp_{C3,E3,G3,B3,D4,F4,A4,C5,E5}_mf`, both channels
 * (18 measurements). Harpists pluck near mid-string, so even harmonics are weak.
 * Harpsichord: Freesound pack "Harpsichord" by pjcohen (CC0), overhead mics, notes sounding D4, E4,
 * D5, E5 (files are labelled an octave lower), both channels, HQ MP3 previews (analysis capped at
 * 16 kHz). Plucked near the string end, so the spectrum stays bright.
 * Both: attack 30–200 ms, sustain 0.8–1.2 s after onset; darken time fitted as for piano/guitar.
 */
export const HARP_ATTACK = [
  1.0, 0.1454, 0.3152, 0.0282, 0.0691, 0.0174, 0.0181, 0.0035, 0.0054, 0.0021, 0.0035, 0.0, 0.0012, 0.0012,
];
export const HARP_SUSTAIN = [1.0, 0.0823, 0.0668, 0.0042, 0.0033];

export const HARPSICHORD_ATTACK = [
  1.0, 0.437, 0.2355, 0.2037, 0.1115, 0.2227, 0.1081, 0.089, 0.0948, 0.1484, 0.1366, 0.104, 0.0544, 0.1213,
  0.0941, 0.1333, 0.0766, 0.0522, 0.0501, 0.0487, 0.0252, 0.0344, 0.0244, 0.0283, 0.0427, 0.0366, 0.0387, 0.0345,
  0.0375, 0.0276, 0.0286, 0.0205,
];
export const HARPSICHORD_SUSTAIN = [
  0.8861, 1.0, 0.2439, 0.1722, 0.0904, 0.0531, 0.042, 0.0371, 0.0125, 0.0178, 0.0075, 0.0135, 0.0032, 0.0062,
  0.006, 0.0082, 0.003, 0.0013, 0.0026, 0.0034, 0.0, 0.0012, 0.0019, 0.0021, 0.0, 0.0012,
];

export const HARP_TAU_MS = 595;
export const HARPSICHORD_TAU_MS = 475;

/*
 * Voice, sung "ah" — modelled from measured formant data rather than one recording.
 * Formants F1–F3: Peterson & Barney (1952) vowel /ɑ/ ("hod"), mean of men (730, 1090, 2440 Hz)
 * and women (850, 1220, 2810 Hz) → 790, 1155, 2625 Hz; F4 3500 Hz and F5 4500 Hz are typical
 * adult vocal-tract values; bandwidths 80/90/120/150/200 Hz are typical measured values (Fant).
 * Source-filter model: glottal source −12 dB/oct plus lip radiation +6 dB/oct (amplitude ∝ 1/k),
 * times the all-pole formant response, evaluated at the harmonics of a 220 Hz (A3) reference
 * pitch shared by alto and tenor voices.
 */
export const VOICE_AH = [
  0.4069, 0.318, 0.6323, 1.0, 0.9021, 0.1787, 0.0499, 0.0244, 0.0163, 0.0146, 0.0197, 0.0518, 0.0115, 0.0064,
  0.0063, 0.0103, 0.0022,
];
