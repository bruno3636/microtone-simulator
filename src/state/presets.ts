import type { HarmonicSettings } from '../audio/harmonics';
import type { EnvelopeSettings } from '../audio/envelope';
import {
  CELLO, GUITAR_ATTACK, GUITAR_SUSTAIN, GUITAR_TAU_MS, PIANO_ATTACK, PIANO_SUSTAIN, PIANO_TAU_MS, VIOLIN,
} from './spectra';

export type PresetId = 'sine' | 'organ' | 'strings' | 'pluck' | 'piano' | 'guitar' | 'violin' | 'cello' | 'custom';

export interface SynthPreset {
  label: string;
  harmonics: HarmonicSettings;
  envelope: EnvelopeSettings;
  /** sustain spectrum for brightness decay (absent = off) */
  dark?: HarmonicSettings;
  tauMs?: number;
}

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
  attack: 10, decay: 200, sustain: 0.8, release: 400, attackCurve: 'lin', decayCurve: 'exp', releaseCurve: 'exp',
};

export const SYNTH_PRESETS: Record<Exclude<PresetId, 'custom'>, SynthPreset> = {
  sine: {
    label: 'Sine',
    harmonics: { count: 1, start: 1, end: 1, curve: 0, filter: 'all', tweaks: {} },
    envelope: { attack: 10, decay: 200, sustain: 1, release: 300, attackCurve: 'lin', decayCurve: 'exp', releaseCurve: 'exp' },
  },
  organ: {
    label: 'Organ',
    harmonics: { count: 8, start: 1, end: 0.6, curve: -0.3, filter: 'all', tweaks: { 2: 0.9, 4: 0.7, 8: 0.5 } },
    envelope: { attack: 15, decay: 50, sustain: 1, release: 120, attackCurve: 'lin', decayCurve: 'lin', releaseCurve: 'exp' },
  },
  strings: {
    label: 'Strings',
    harmonics: { count: 24, start: 1, end: 0.05, curve: 0.7, filter: 'all', tweaks: {} },
    envelope: { attack: 350, decay: 300, sustain: 0.85, release: 900, attackCurve: 'log', decayCurve: 'exp', releaseCurve: 'exp' },
  },
  pluck: {
    label: 'Pluck',
    harmonics: { count: 32, start: 1, end: 0.02, curve: 0.85, filter: 'all', tweaks: {} },
    envelope: { attack: 3, decay: 1200, sustain: 0, release: 500, attackCurve: 'lin', decayCurve: 'exp', releaseCurve: 'exp' },
  },
  // Instrument presets from spectral analysis (see spectra.ts for sources).
  // Piano/guitar decay to silence while held; decay length chosen so the EXP curve reaches −20 dB
  // at the measured median ≈0.9 s.
  piano: {
    label: 'Piano',
    harmonics: measured(PIANO_ATTACK),
    dark: measured(PIANO_SUSTAIN),
    tauMs: PIANO_TAU_MS,
    envelope: { attack: 4, decay: 2000, sustain: 0, release: 250, attackCurve: 'lin', decayCurve: 'exp', releaseCurve: 'exp' },
  },
  guitar: {
    label: 'Guitar',
    harmonics: measured(GUITAR_ATTACK),
    dark: measured(GUITAR_SUSTAIN),
    tauMs: GUITAR_TAU_MS,
    envelope: { attack: 3, decay: 2000, sustain: 0, release: 180, attackCurve: 'lin', decayCurve: 'exp', releaseCurve: 'exp' },
  },
  violin: {
    label: 'Violin',
    harmonics: measured(VIOLIN),
    envelope: { attack: 90, decay: 120, sustain: 0.9, release: 180, attackCurve: 'log', decayCurve: 'exp', releaseCurve: 'exp' },
  },
  cello: {
    label: 'Cello',
    harmonics: measured(CELLO),
    envelope: { attack: 130, decay: 150, sustain: 0.9, release: 300, attackCurve: 'log', decayCurve: 'exp', releaseCurve: 'exp' },
  },
};
