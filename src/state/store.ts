import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { HarmonicSettings } from '../audio/harmonics';
import { curveAmount, type EnvelopeSettings } from '../audio/envelope';
import { DEFAULT_KEYMAPS, NOTE_FREQS, TUNINGS } from '../tuning/presets';
import { createFromTemplate } from '../tuning/ratios';
import { DEFAULT_ENVELOPE, DEFAULT_HARMONICS, SYNTH_PRESETS, type PresetId } from './presets';
import type { ThemeMode } from '../theme';

export interface VizSettings {
  view: 'wave' | 'spectrum';
  source: 'computed' | 'live';
  periods: number;
  speed: number;
  showSum: boolean;
  freqScale: 'log' | 'lin';
  liveGain: number;
}

interface Data {
  tab: 'tuning' | 'synth';
  tuning: string;
  /** variant of the tuning (meantone fraction, well temperament); '' when it has none */
  tuningVariant: string;
  /** divisions per octave for Custom EDO */
  edo: number;
  scale: string;
  notes: string[];
  root: { note: string; freq: number };
  keymaps: Record<string, Record<string, string>>;
  keymap: string;
  shown: number[];
  held: number[];
  harmonics: HarmonicSettings;
  /** sustain spectrum for brightness decay; null = off */
  darkHarmonics: HarmonicSettings | null;
  /** darken time constant (ms) */
  brightnessTau: number;
  envelope: EnvelopeSettings;
  preset: PresetId;
  volume: number;
  space: number;
  viz: VizSettings;
  open: { keyboard: boolean; ratios: boolean };
  theme: ThemeMode;
}

interface Actions {
  setTab(t: Data['tab']): void;
  applyTemplate(tuning: string, scale: string): void;
  setTuningVariant(variant: string): void;
  setEdo(n: number): void;
  resetNotes(): void;
  clearNotes(): void;
  setNote(i: number, expr: string): void;
  deleteDegree(i: number): void;
  insertDegree(after: number, expr: string): void;
  /** move the pitch at `from` to position `to`; positions (numbers, colours, keys) stay in order */
  moveDegree(from: number, to: number): void;
  setRootNote(name: string): void;
  setRootFreq(hz: number): void;
  setKeymap(name: string): void;
  setKey(degree: number, keys: string): void;
  addKeyDegree(): void;
  deleteKeyDegree(degree: number): void;
  toggleShown(i: number): void;
  setHeld(degree: number, on: boolean): void;
  setHarmonics(p: Partial<HarmonicSettings>, which?: Spectrum): void;
  setTweak(n: number, v: number | null, which?: Spectrum): void;
  resetTweaks(which?: Spectrum): void;
  setBrightnessDecay(on: boolean): void;
  setBrightnessTau(ms: number): void;
  setEnvelope(p: Partial<EnvelopeSettings>): void;
  applyPreset(id: Exclude<PresetId, 'custom'>): void;
  setVolume(v: number): void;
  setSpace(v: number): void;
  setViz(p: Partial<VizSettings>): void;
  toggleOpen(k: keyof Data['open']): void;
  setTheme(m: ThemeMode): void;
}

export type StoreState = Data & Actions;

/** Which spectrum a harmonics edit targets: the attack spectrum or the brightness-decay sustain spectrum. */
export type Spectrum = 'attack' | 'sustain';

/** Seed a sustain spectrum from the attack spectrum: the same shape, progressively darker toward the top. */
function darken(h: HarmonicSettings): HarmonicSettings {
  const span = Math.max(1, h.count - 1);
  const tweaks = Object.fromEntries(
    Object.entries(h.tweaks).map(([k, v]) => [k, v * 0.3 ** ((Number(k) - 1) / span)]),
  );
  return { ...h, end: h.end * 0.3, tweaks };
}

const safeStorage: StateStorage = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};

const initialTemplate = createFromTemplate('just_intonation', 'chromatic');

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      tab: 'tuning',
      tuning: 'just_intonation',
      tuningVariant: '',
      edo: 19,
      scale: initialTemplate.scale,
      notes: initialTemplate.notes,
      root: { note: 'A', freq: NOTE_FREQS.A },
      keymaps: structuredClone(DEFAULT_KEYMAPS),
      keymap: 'scale',
      shown: [0],
      held: [],
      harmonics: structuredClone(DEFAULT_HARMONICS),
      darkHarmonics: null,
      brightnessTau: 1000,
      envelope: { ...DEFAULT_ENVELOPE },
      preset: 'custom',
      volume: 0.6,
      space: 0,
      viz: { view: 'wave', source: 'computed', periods: 2, speed: 0.5, showSum: true, freqScale: 'log', liveGain: 1 },
      open: { keyboard: true, ratios: false },
      theme: 'system',

      setTab: (tab) => set({ tab }),
      applyTemplate: (tuning, scale) => {
        const s = get();
        // switching tuning resets the variant to that tuning's default
        const variant = tuning === s.tuning && s.tuningVariant ? s.tuningVariant : (TUNINGS[tuning]?.defaultVariant ?? '');
        const t = createFromTemplate(tuning, scale, variant, s.edo);
        set({ tuning, tuningVariant: variant, scale: t.scale, notes: t.notes, shown: [0] });
      },
      setTuningVariant: (variant) => {
        const s = get();
        const t = createFromTemplate(s.tuning, s.scale, variant, s.edo);
        set({ tuningVariant: variant, scale: t.scale, notes: t.notes, shown: [0] });
      },
      setEdo: (n) => {
        const edo = Math.min(96, Math.max(1, Math.round(n)));
        set({ edo });
        if (TUNINGS[get().tuning]?.edo) get().applyTemplate(get().tuning, get().scale);
      },
      resetNotes: () => get().applyTemplate(get().tuning, get().scale),
      clearNotes: () => set({ notes: ['1'], shown: [0] }),
      setNote: (i, expr) => set((s) => ({ notes: s.notes.map((n, j) => (j === i ? expr : n)) })),
      deleteDegree: (i) =>
        set((s) => {
          if (i <= 0 || i >= s.notes.length) return {};
          return {
            notes: s.notes.filter((_, j) => j !== i),
            shown: s.shown.filter((d) => d !== i).map((d) => (d > i ? d - 1 : d)),
          };
        }),
      insertDegree: (after, expr) =>
        set((s) => {
          const p = after + 1;
          const notes = [...s.notes];
          notes.splice(p, 0, expr);
          return { notes, shown: s.shown.map((d) => (d >= p ? d + 1 : d)) };
        }),
      moveDegree: (from, to) =>
        set((s) => {
          const n = s.notes.length;
          if (from === to || from < 0 || to < 0 || from >= n || to >= n) return {};
          const notes = [...s.notes];
          const [moved] = notes.splice(from, 1);
          notes.splice(to, 0, moved);
          // where each old index ends up, so shown (visualizer) flags follow their pitch
          const newIndex = (i: number) => {
            if (i === from) return to;
            if (from < to && i > from && i <= to) return i - 1;
            if (from > to && i >= to && i < from) return i + 1;
            return i;
          };
          return { notes, shown: s.shown.map(newIndex) };
        }),
      setRootNote: (name) => set({ root: { note: name, freq: NOTE_FREQS[name] ?? get().root.freq } }),
      setRootFreq: (hz) => {
        const match = Object.entries(NOTE_FREQS).find(([, f]) => Math.abs(f - hz) < 1e-6);
        set({ root: { note: match ? match[0] : '', freq: hz } });
      },
      setKeymap: (keymap) => set({ keymap }),
      setKey: (degree, keys) =>
        set((s) => ({ keymaps: { ...s.keymaps, [s.keymap]: { ...s.keymaps[s.keymap], [degree]: keys } } })),
      addKeyDegree: () =>
        set((s) => {
          const map = s.keymaps[s.keymap];
          const next = Math.max(-1, ...Object.keys(map).map(Number)) + 1;
          return { keymaps: { ...s.keymaps, [s.keymap]: { ...map, [next]: '' } } };
        }),
      deleteKeyDegree: (degree) =>
        set((s) => {
          const map = { ...s.keymaps[s.keymap] };
          delete map[degree];
          return { keymaps: { ...s.keymaps, [s.keymap]: map } };
        }),
      toggleShown: (i) =>
        set((s) => ({ shown: s.shown.includes(i) ? s.shown.filter((d) => d !== i) : [...s.shown, i] })),
      setHeld: (degree, on) =>
        set((s) => ({ held: on ? [...new Set([...s.held, degree])] : s.held.filter((d) => d !== degree) })),
      setHarmonics: (p, which = 'attack') =>
        set((s) => {
          if (which === 'sustain') return s.darkHarmonics ? { darkHarmonics: { ...s.darkHarmonics, ...p }, preset: 'custom' } : {};
          return { harmonics: { ...s.harmonics, ...p }, preset: 'custom' };
        }),
      setTweak: (n, v, which = 'attack') =>
        set((s) => {
          const h = which === 'sustain' ? s.darkHarmonics : s.harmonics;
          if (!h) return {};
          const tweaks = { ...h.tweaks };
          if (v == null) delete tweaks[n];
          else tweaks[n] = Math.min(1, Math.max(0, v));
          const next = { ...h, tweaks };
          return which === 'sustain' ? { darkHarmonics: next, preset: 'custom' } : { harmonics: next, preset: 'custom' };
        }),
      resetTweaks: (which = 'attack') =>
        set((s) => {
          if (which === 'sustain') return s.darkHarmonics ? { darkHarmonics: { ...s.darkHarmonics, tweaks: {} }, preset: 'custom' } : {};
          return { harmonics: { ...s.harmonics, tweaks: {} }, preset: 'custom' };
        }),
      setBrightnessDecay: (on) =>
        set((s) => ({ darkHarmonics: on ? (s.darkHarmonics ?? darken(s.harmonics)) : null, preset: 'custom' })),
      setBrightnessTau: (brightnessTau) => set({ brightnessTau, preset: 'custom' }),
      setEnvelope: (p) => set((s) => ({ envelope: { ...s.envelope, ...p }, preset: 'custom' })),
      applyPreset: (id) =>
        set((s) => {
          const p = SYNTH_PRESETS[id];
          return {
            harmonics: structuredClone(p.harmonics),
            darkHarmonics: p.dark ? structuredClone(p.dark) : null,
            brightnessTau: p.tauMs ?? s.brightnessTau,
            envelope: { ...p.envelope },
            preset: id,
          };
        }),
      setVolume: (volume) => set({ volume }),
      setSpace: (space) => set({ space }),
      setViz: (p) => set((s) => ({ viz: { ...s.viz, ...p } })),
      toggleOpen: (k) => set((s) => ({ open: { ...s.open, [k]: !s.open[k] } })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ejis-settings',
      // v2 added darkHarmonics + brightnessTau (missing keys fall back to the initial state on merge);
      // v3 removed the STRINGS preset; v4 made envelope curves continuous amounts;
      // v5 reorganised the tunings (renamed 12EDO/meantone, removed the custom presets)
      version: 5,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ held: _held, ...rest }) => {
        void _held;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Partial<StoreState>;
      },
      migrate: (persisted) => {
        const p = persisted as Partial<StoreState>;
        if (p.preset && !(p.preset in SYNTH_PRESETS)) p.preset = 'custom';
        const renamed: Record<string, [string, string]> = {
          equal_temperament: ['edo12', ''],
          meantone_temperament: ['meantone', 'quarter'],
        };
        if (p.tuning && renamed[p.tuning]) [p.tuning, p.tuningVariant] = renamed[p.tuning];
        if (p.tuning && !(p.tuning in TUNINGS)) {
          p.tuning = 'just_intonation';
          p.tuningVariant = '';
        }
        if (p.envelope) {
          const e = p.envelope;
          p.envelope = { ...e, attackCurve: curveAmount(e.attackCurve), decayCurve: curveAmount(e.decayCurve), releaseCurve: curveAmount(e.releaseCurve) };
        }
        return p as StoreState;
      },
    },
  ),
);
