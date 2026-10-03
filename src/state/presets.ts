import type { HarmonicSettings } from '../audio/harmonics';
import type { EnvelopeSettings } from '../audio/envelope';

export type PresetId = 'sine' | 'organ' | 'strings' | 'pluck' | 'custom';

export const DEFAULT_HARMONICS: HarmonicSettings = { count: 8, start: 1, end: 0.1, curve: 0.5, filter: 'all', tweaks: {} };
export const DEFAULT_ENVELOPE: EnvelopeSettings = {
  attack: 10, decay: 200, sustain: 0.8, release: 400, attackCurve: 'lin', decayCurve: 'exp', releaseCurve: 'exp',
};

export const SYNTH_PRESETS: Record<Exclude<PresetId, 'custom'>, { label: string; harmonics: HarmonicSettings; envelope: EnvelopeSettings }> = {
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
};
