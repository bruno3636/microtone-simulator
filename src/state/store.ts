import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { HarmonicSettings } from '../audio/harmonics';
import type { EnvelopeSettings } from '../audio/envelope';
import { DEFAULT_KEYMAPS, NOTE_FREQS } from '../tuning/presets';
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
  scale: string;
  notes: string[];
  root: { note: string; freq: number };
  keymaps: Record<string, Record<string, string>>;
  keymap: string;
  shown: number[];
  held: number[];
  harmonics: HarmonicSettings;
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
  resetNotes(): void;
  clearNotes(): void;
  setNote(i: number, expr: string): void;
  deleteDegree(i: number): void;
  insertDegree(after: number, expr: string): void;
  setRootNote(name: string): void;
  setRootFreq(hz: number): void;
  setKeymap(name: string): void;
  setKey(degree: number, keys: string): void;
  addKeyDegree(): void;
  deleteKeyDegree(degree: number): void;
  toggleShown(i: number): void;
  setHeld(degree: number, on: boolean): void;
  setHarmonics(p: Partial<HarmonicSettings>): void;
  setTweak(n: number, v: number | null): void;
  resetTweaks(): void;
  setEnvelope(p: Partial<EnvelopeSettings>): void;
  applyPreset(id: Exclude<PresetId, 'custom'>): void;
  setVolume(v: number): void;
  setSpace(v: number): void;
  setViz(p: Partial<VizSettings>): void;
  toggleOpen(k: keyof Data['open']): void;
  setTheme(m: ThemeMode): void;
}

export type StoreState = Data & Actions;

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
      scale: initialTemplate.scale,
      notes: initialTemplate.notes,
      root: { note: 'A', freq: NOTE_FREQS.A },
      keymaps: structuredClone(DEFAULT_KEYMAPS),
      keymap: 'scale',
      shown: [0],
      held: [],
      harmonics: structuredClone(DEFAULT_HARMONICS),
      envelope: { ...DEFAULT_ENVELOPE },
      preset: 'custom',
      volume: 0.6,
      space: 0,
      viz: { view: 'wave', source: 'computed', periods: 2, speed: 0.5, showSum: true, freqScale: 'log', liveGain: 1 },
      open: { keyboard: true, ratios: false },
      theme: 'system',

      setTab: (tab) => set({ tab }),
      applyTemplate: (tuning, scale) => {
        const t = createFromTemplate(tuning, scale);
        set({ tuning, scale: t.scale, notes: t.notes, shown: [0] });
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
      setHarmonics: (p) => set((s) => ({ harmonics: { ...s.harmonics, ...p }, preset: 'custom' })),
      setTweak: (n, v) =>
        set((s) => {
          const tweaks = { ...s.harmonics.tweaks };
          if (v == null) delete tweaks[n];
          else tweaks[n] = Math.min(1, Math.max(0, v));
          return { harmonics: { ...s.harmonics, tweaks }, preset: 'custom' };
        }),
      resetTweaks: () => set((s) => ({ harmonics: { ...s.harmonics, tweaks: {} }, preset: 'custom' })),
      setEnvelope: (p) => set((s) => ({ envelope: { ...s.envelope, ...p }, preset: 'custom' })),
      applyPreset: (id) =>
        set({
          harmonics: structuredClone(SYNTH_PRESETS[id].harmonics),
          envelope: { ...SYNTH_PRESETS[id].envelope },
          preset: id,
        }),
      setVolume: (volume) => set({ volume }),
      setSpace: (space) => set({ space }),
      setViz: (p) => set((s) => ({ viz: { ...s.viz, ...p } })),
      toggleOpen: (k) => set((s) => ({ open: { ...s.open, [k]: !s.open[k] } })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ejis-settings',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ held: _held, ...rest }) => {
        void _held;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Partial<StoreState>;
      },
      migrate: (persisted) => persisted as StoreState,
    },
  ),
);
