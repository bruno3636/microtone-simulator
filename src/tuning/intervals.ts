/** Interval names for note-name sources (Pythagorean, meantone, well temperament). */

/** Name of the interval `n` fifths above the root (spelled: C♯ = +7 = augmented unison, D♭ = −5 = minor 2nd). */
const BY_FIFTHS: Record<number, string> = {
  [-6]: 'Diminished 5th', [-5]: 'Minor 2nd', [-4]: 'Minor 6th', [-3]: 'Minor 3rd', [-2]: 'Minor 7th', [-1]: 'Perfect 4th',
  0: 'Perfect unison', 1: 'Perfect 5th', 2: 'Major 2nd', 3: 'Major 6th', 4: 'Major 3rd', 5: 'Major 7th',
  6: 'Augmented 4th', 7: 'Augmented unison', 8: 'Augmented 5th', 9: 'Augmented 2nd', 10: 'Augmented 6th',
};

export const intervalByFifths = (n: number): string => BY_FIFTHS[n] ?? `${n} fifths`;

/** Name by semitones above the root, for 12-name tunings where enharmonics coincide (well temperament). */
const BY_SEMITONES = [
  'Perfect unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th',
  'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th',
];

export const intervalBySemitones = (n: number): string => BY_SEMITONES[((n % 12) + 12) % 12];

/** A note expression tagged with its interval name: "Major 3rd|expr" (the maths ignores the tag). */
export const withLabel = (label: string, expr: string) => `${label}|${expr}`;
