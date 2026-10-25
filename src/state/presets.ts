import type { HarmonicSettings } from '../audio/harmonics';
import type { EnvelopeSettings } from '../audio/envelope';
import {
  ALTO_SAX, BASSOON, CELLO, CLARINET, FLUTE, FRENCH_HORN, GUITAR_ATTACK, GUITAR_SUSTAIN, GUITAR_TAU_MS,
  HARP_ATTACK, HARP_SUSTAIN, HARP_TAU_MS, HARPSICHORD_ATTACK, HARPSICHORD_SUSTAIN, HARPSICHORD_TAU_MS, OBOE,
  ORGAN_CHORUS, PIANO_ATTACK, PIANO_SUSTAIN, PIANO_TAU_MS, TROMBONE, TRUMPET, TUBA, VIOLIN, VOICE_AH,
} from './spectra';

export type PresetId =
  | 'sine' | 'saw' | 'square' | 'triangle' | 'harm64' | 'harm32' | 'harm16' | 'harm8' | 'pluck' | 'organ' | 'piano' | 'harpsichord' | 'guitar' | 'harp' | 'violin' | 'cello' | 'voice'
  | 'flute' | 'oboe' | 'clarinet' | 'sax' | 'bassoon' | 'trumpet' | 'horn' | 'trombone' | 'tuba' | 'custom';

/** Preset bar order: synthetic, keyboards, plucked, bowed, voice, woodwinds, brass (high to low). */
export const PRESET_ORDER: Exclude<PresetId, 'custom'>[] = [
  'sine', 'saw', 'square', 'triangle', 'harm64', 'harm32', 'harm16', 'harm8', 'pluck', 'organ', 'piano', 'harpsichord', 'guitar', 'harp', 'violin', 'cello', 'voice',
  'flute', 'oboe', 'clarinet', 'sax', 'bassoon', 'trumpet', 'horn', 'trombone', 'tuba',
];

export interface SynthPreset {
  label: string;
  harmonics: HarmonicSettings;
  envelope: EnvelopeSettings;
  /** sustain spectrum for brightness decay (absent = off) */
  dark?: HarmonicSettings;
  tauMs?: number;
}

/**
 * A classic waveform's Fourier series as harmonic settings (band-limited to `count` harmonics).
 * Signed values are phase-inverted harmonics, needed for the waveform's shape (not its sound).
 */
function series(count: number, level: (k: number) => number): HarmonicSettings {
  const levels = Array.from({ length: count }, (_, i) => level(i + 1));
  return {
    count,
    start: Math.abs(levels[0]),
    end: Math.abs(levels[count - 1]),
    curve: 0,
    filter: 'all',
    tweaks: Object.fromEntries(levels.map((v, i) => [i + 1, v])),
  };
}

const SYNTH_ENVELOPE: EnvelopeSettings = { attack: 5, decay: 100, sustain: 1, release: 120, attackCurve: 0, decayCurve: 0.6, releaseCurve: 0.6 };

/** A measured spectrum as harmonic settings: every harmonic set explicitly as a tweak. */
function measured(levels: number[]): HarmonicSettings {
  return {
    count: levels.length,
    start: levels[0],
    end: levels[levels.length - 1],
    curve: 0,
    filter: 'all',
    tweaks: Object.fromEntries(levels.map((v, i) => [i + 1, v])),
  };
}

export const DEFAULT_HARMONICS: HarmonicSettings = { count: 8, start: 1, end: 0.1, curve: 0.5, filter: 'all', tweaks: {} };
export const DEFAULT_ENVELOPE: EnvelopeSettings = {
  attack: 10, decay: 200, sustain: 0.8, release: 400, attackCurve: 0, decayCurve: 0.6, releaseCurve: 0.6,
};

export const SYNTH_PRESETS: Record<Exclude<PresetId, 'custom'>, SynthPreset> = {
  sine: {
    label: 'Sine',
    harmonics: { count: 1, start: 1, end: 1, curve: 0, filter: 'all', tweaks: {} },
    envelope: { attack: 10, decay: 200, sustain: 1, release: 300, attackCurve: 0, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  // Classic waveforms, exact Fourier series. Saw: every harmonic at 1/k with alternating sign
  // (rising ramp). Square: odd harmonics at 1/k. Triangle: odd harmonics at 1/k² with
  // alternating sign; it falls below −60 dB after harmonic 31.
  saw: {
    label: 'Saw',
    harmonics: series(64, (k) => (k % 2 ? 1 : -1) / k),
    envelope: { ...SYNTH_ENVELOPE },
  },
  square: {
    label: 'Square',
    harmonics: series(64, (k) => (k % 2 ? 1 / k : 0)),
    envelope: { ...SYNTH_ENVELOPE },
  },
  triangle: {
    label: 'Triangle',
    harmonics: series(32, (k) => (k % 2 ? (k % 4 === 1 ? 1 : -1) / (k * k) : 0)),
    envelope: { ...SYNTH_ENVELOPE },
  },
  // Harmonic k at 1/k of the fundamental, all in phase (the saw's spectrum without its sign
  // pattern): the first 64, 32, 16 or 8 harmonics. 1/k ×64 is the default synth.
  harm64: { label: '1/k ×64', harmonics: series(64, (k) => 1 / k), envelope: { ...SYNTH_ENVELOPE } },
  harm32: { label: '1/k ×32', harmonics: series(32, (k) => 1 / k), envelope: { ...SYNTH_ENVELOPE } },
  harm16: { label: '1/k ×16', harmonics: series(16, (k) => 1 / k), envelope: { ...SYNTH_ENVELOPE } },
  harm8: { label: '1/k ×8', harmonics: series(8, (k) => 1 / k), envelope: { ...SYNTH_ENVELOPE } },
  organ: {
    // pipe organ principal chorus, see spectra.ts; flue-pipe speech ≈40 ms, flat sustain
    label: 'Organ',
    harmonics: measured(ORGAN_CHORUS),
    envelope: { attack: 40, decay: 60, sustain: 1, release: 120, attackCurve: -0.6, decayCurve: 0, releaseCurve: 0.6 },
  },
  pluck: {
    label: 'Pluck',
    harmonics: { count: 32, start: 1, end: 0.02, curve: 0.85, filter: 'all', tweaks: {} },
    envelope: { attack: 3, decay: 1200, sustain: 0, release: 500, attackCurve: 0, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  // Instrument presets from spectral analysis (see spectra.ts for sources).
  // Piano/guitar decay to silence while held; decay length chosen so the EXP curve reaches −20 dB
  // at the measured median ≈0.9 s.
  piano: {
    label: 'Piano',
    harmonics: measured(PIANO_ATTACK),
    dark: measured(PIANO_SUSTAIN),
    tauMs: PIANO_TAU_MS,
    envelope: { attack: 4, decay: 2000, sustain: 0, release: 250, attackCurve: 0, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  guitar: {
    label: 'Guitar',
    harmonics: measured(GUITAR_ATTACK),
    dark: measured(GUITAR_SUSTAIN),
    tauMs: GUITAR_TAU_MS,
    envelope: { attack: 3, decay: 2000, sustain: 0, release: 180, attackCurve: 0, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  violin: {
    label: 'Violin',
    harmonics: measured(VIOLIN),
    envelope: { attack: 90, decay: 120, sustain: 0.9, release: 180, attackCurve: -0.6, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  cello: {
    label: 'Cello',
    harmonics: measured(CELLO),
    envelope: { attack: 130, decay: 150, sustain: 0.9, release: 300, attackCurve: -0.6, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  // Winds and brass from SHARC (see spectra.ts): sustained tones, onset times typical of each instrument.
  flute: {
    label: 'Flute',
    harmonics: measured(FLUTE),
    envelope: { attack: 80, decay: 100, sustain: 0.95, release: 150, attackCurve: -0.6, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  clarinet: {
    label: 'Clarinet',
    harmonics: measured(CLARINET),
    envelope: { attack: 40, decay: 80, sustain: 0.95, release: 120, attackCurve: -0.6, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  trombone: {
    label: 'Trombone',
    harmonics: measured(TROMBONE),
    envelope: { attack: 60, decay: 120, sustain: 0.9, release: 160, attackCurve: -0.6, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  trumpet: {
    label: 'Trumpet',
    harmonics: measured(TRUMPET),
    envelope: { attack: 35, decay: 100, sustain: 0.9, release: 140, attackCurve: -0.6, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  oboe: {
    label: 'Oboe',
    harmonics: measured(OBOE),
    envelope: { attack: 50, decay: 100, sustain: 0.95, release: 120, attackCurve: -0.6, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  bassoon: {
    label: 'Bassoon',
    harmonics: measured(BASSOON),
    envelope: { attack: 60, decay: 120, sustain: 0.9, release: 150, attackCurve: -0.6, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  sax: {
    label: 'Saxophone',
    harmonics: measured(ALTO_SAX),
    envelope: { attack: 45, decay: 100, sustain: 0.92, release: 130, attackCurve: -0.6, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  horn: {
    label: 'French horn',
    harmonics: measured(FRENCH_HORN),
    envelope: { attack: 70, decay: 150, sustain: 0.9, release: 200, attackCurve: -0.6, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  tuba: {
    label: 'Tuba',
    harmonics: measured(TUBA),
    envelope: { attack: 80, decay: 150, sustain: 0.9, release: 200, attackCurve: -0.6, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  // Plucked: decay length matches the measured median time to −20 dB on the EXP curve
  // (harp ≈1.0 s, harpsichord ≈1.3 s); the harpsichord's damper cuts the release short.
  harp: {
    label: 'Harp',
    harmonics: measured(HARP_ATTACK),
    dark: measured(HARP_SUSTAIN),
    tauMs: HARP_TAU_MS,
    envelope: { attack: 3, decay: 2200, sustain: 0, release: 300, attackCurve: 0, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  harpsichord: {
    label: 'Harpsichord',
    harmonics: measured(HARPSICHORD_ATTACK),
    dark: measured(HARPSICHORD_SUSTAIN),
    tauMs: HARPSICHORD_TAU_MS,
    envelope: { attack: 2, decay: 2900, sustain: 0, release: 100, attackCurve: 0, decayCurve: 0.6, releaseCurve: 0.6 },
  },
  voice: {
    // sung "ah" from formant data (see spectra.ts); soft onset, no vibrato
    label: 'Voice',
    harmonics: measured(VOICE_AH),
    envelope: { attack: 80, decay: 100, sustain: 0.9, release: 150, attackCurve: -0.6, decayCurve: 0.6, releaseCurve: 0.6 },
  },
};
