import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { HarmonicSettings } from '../audio/harmonics';
import { curveAmount, type EnvelopeSettings } from '../audio/envelope';
import { DEFAULT_KEYMAPS, NOTE_FREQS, TUNINGS } from '../tuning/presets';
import { SCALE_PRESETS } from '../tuning/scalePresets';
import { createFromTemplate } from '../tuning/ratios';
import { SYNTH_PRESETS, type PresetId } from './presets';
import type { ThemeMode } from '../theme';

export interface VizSettings {
  view: 'wave' | 'spectrum' | 'roughness';
  source: 'computed' | 'live';
  periods: number;
  speed: number;
  showSum: boolean;
  freqScale: 'log' | 'lin';
  liveGain: number;
  /** live wave refresh speed: 1 = every frame, lower holds each capture longer, 0 = frozen */
  liveSpeed: number;
  /** roughness view: dissonance curve over 1 or 2 octaves above the root */
  roughRange: 1 | 2;
}

interface Data {
  tab: 'tuning' | 'synth' | 'game';
  tuning: string;
  /** variant of the tuning (meantone fraction, well temperament); '' when it has none */
  tuningVariant: string;
  /** divisions per octave for Custom EDO */
  edo: number;
  /** divisions of the tritave for the Custom EDT tuning */
  edt: number;
  /** the interval the pitch collection repeats at: 2 (octave) or 3 (tritave) */
  period: number;
  scale: string;
  notes: string[];
  root: { note: string; freq: number };
  keymaps: Record<string, Record<string, string>>;
  keymap: string;
  shown: number[];
  held: number[];
  /** pitches sustained by shift-click (not persisted) */
  latched: number[];
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
  /** the scale preset the notes were loaded from (Reset reloads it), or null */
  scalePreset: string | null;
  /** pitch bend in cents on live (not sustained) notes; springs back to 0, not persisted */
  bend: number;
}

interface Actions {
  setTab(t: Data['tab']): void;
  applyTemplate(tuning: string, scale: string): void;
  setTuningVariant(variant: string): void;
  setEdo(n: number): void;
  setEdt(n: number): void;
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
  setLatched(degree: number, on: boolean): void;
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
  loadScalePreset(id: string): void;
  setBend(cents: number): void;
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

// a new user starts on the 7-limit chromatic preset (12 notes, so the piano key layout)
const INITIAL_PRESET = SCALE_PRESETS.find((p) => p.id === 'ji12-7limit')!;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      tab: 'tuning',
      tuning: 'just_intonation',
      tuningVariant: '',
      edo: 31,
      edt: 13,
      period: 2,
      scale: 'chromatic',
      notes: [...INITIAL_PRESET.notes],
      root: { note: 'A', freq: NOTE_FREQS.A },
      keymaps: structuredClone(DEFAULT_KEYMAPS),
      keymap: 'piano',
      shown: [0],
      held: [],
      latched: [],
      // a new user starts on the 1/k ×64 synth
      harmonics: structuredClone(SYNTH_PRESETS.harm64.harmonics),
      darkHarmonics: null,
      brightnessTau: 1000,
      envelope: { ...SYNTH_PRESETS.harm64.envelope },
      preset: 'harm64',
      volume: 0.6,
      space: 0,
      viz: { view: 'wave', source: 'computed', periods: 2, speed: 0.5, showSum: true, freqScale: 'log', liveGain: 1, liveSpeed: 1, roughRange: 1 },
      open: { keyboard: true, ratios: false },
      theme: 'system',
      scalePreset: INITIAL_PRESET.id,
      bend: 0,

      setTab: (tab) => set({ tab }),
      applyTemplate: (tuning, scale) => {
        const s = get();
        // switching tuning resets the variant to that tuning's default
        const variant = tuning === s.tuning && s.tuningVariant ? s.tuningVariant : (TUNINGS[tuning]?.defaultVariant ?? '');
        const t = createFromTemplate(tuning, scale, variant, s.edo, s.edt);
        set({ tuning, tuningVariant: variant, scale: t.scale, notes: t.notes, shown: [0], scalePreset: null, period: TUNINGS[tuning]?.period ?? 2 });
      },
      setTuningVariant: (variant) => {
        const s = get();
        const t = createFromTemplate(s.tuning, s.scale, variant, s.edo, s.edt);
        set({ tuningVariant: variant, scale: t.scale, notes: t.notes, shown: [0], scalePreset: null });
      },
      setEdo: (n) => {
        const edo = Math.min(96, Math.max(1, Math.round(n)));
        set({ edo });
        if (TUNINGS[get().tuning]?.edo) get().applyTemplate(get().tuning, get().scale); // also clears a scale preset
      },
      setEdt: (n) => {
        const edt = Math.min(96, Math.max(1, Math.round(n)));
        set({ edt });
        if (TUNINGS[get().tuning]?.edt) get().applyTemplate(get().tuning, get().scale);
      },
      resetNotes: () => {
        const { scalePreset } = get();
        if (scalePreset && SCALE_PRESETS.some((p) => p.id === scalePreset)) get().loadScalePreset(scalePreset);
        else get().applyTemplate(get().tuning, get().scale);
      },
      loadScalePreset: (id) => {
        const p = SCALE_PRESETS.find((x) => x.id === id);
        if (!p) return;
        set((s) => ({
          tuning: p.tuning, tuningVariant: p.variant ?? TUNINGS[p.tuning]?.defaultVariant ?? '', edo: p.edo ?? s.edo,
          edt: p.edt ?? s.edt, period: p.period ?? TUNINGS[p.tuning]?.period ?? 2,
          scale: 'chromatic', notes: [...p.notes], shown: [0], scalePreset: id,
          // 12-note presets play like a piano (A W S E D …); others go back from the piano layout
          keymap: p.notes.length === 12 && s.keymaps.piano ? 'piano' : s.keymap === 'piano' ? 'scale' : s.keymap,
        }));
      },
      setBend: (bend) => set({ bend: Math.max(-1200, Math.min(1200, bend)) }),
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
      setLatched: (degree, on) =>
        set((s) => ({ latched: on ? [...new Set([...s.latched, degree])] : s.latched.filter((d) => d !== degree) })),
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
      // v5 reorganised the tunings (renamed 12EDO/meantone, removed the custom presets);
      // v6 changed the Custom EDO default from 19 to 31
      version: 10,
      storage: createJSONStorage(() => safeStorage),
      // shown (visualizer) has no toggle on the cards any more: it always restarts as the root
      partialize: ({ held: _held, latched: _latched, shown: _shown, bend: _bend, ...rest }) => {
        void _bend;
        void _held;
        void _latched;
        void _shown;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Partial<StoreState>;
      },
      migrate: (persisted, version) => {
        const p = persisted as Partial<StoreState>;
        if (p.preset && !(p.preset in SYNTH_PRESETS)) p.preset = 'custom';
        const renamed: Record<string, [string, string]> = {
          equal_temperament: ['edo12', ''],
          meantone_temperament: ['meantone', 'quarter'],
        };
        if (p.tuning && renamed[p.tuning]) [p.tuning, p.tuningVariant] = renamed[p.tuning];
        // still on the old default — unless Custom EDO is in use, whose saved notes are 19-EDO
        if (version < 6 && p.edo === 19 && p.tuning !== 'custom_edo') p.edo = 31;
        // unknown tunings (incl. Tempered JI, merged into Just intonation in v7) fall back to JI
        if (p.tuning && !(p.tuning in TUNINGS)) {
          p.tuning = 'just_intonation';
          p.tuningVariant = '';
        }
        // v8: ";" and "'" continue the home row after L in the default scale keymap
        const km = p.keymaps?.scale;
        if (version < 8 && km && km[9] === 'c' && km[10] === 'v') p.keymaps = { ...p.keymaps, scale: { ...km, 9: 'c,;', 10: "v,'" } };
        // v10: saved scale maps that never got ";" / "'" (customised before v8) gain them on 9 / 10
        const sc = p.keymaps?.scale;
        if (version < 10 && sc) {
          const has = (k: string) => Object.values(sc).some((v) => String(v).split(',').some((x) => x.trim()[0] === k));
          const add = (deg: number, k: string) => { if (!has(k)) sc[deg] = sc[deg] ? `${sc[deg]},${k}` : k; };
          add(9, ';');
          add(10, "'");
        }
        // v9: the piano layout joins saved keymaps
        if (p.keymaps && !p.keymaps.piano) p.keymaps = { ...p.keymaps, piano: { ...DEFAULT_KEYMAPS.piano } };
        if (p.viz) p.viz = { ...p.viz, liveSpeed: p.viz.liveSpeed ?? 1, roughRange: p.viz.roughRange ?? 1 };
        if (p.envelope) {
          const e = p.envelope;
          p.envelope = { ...e, attackCurve: curveAmount(e.attackCurve), decayCurve: curveAmount(e.decayCurve), releaseCurve: curveAmount(e.releaseCurve) };
        }
        return p as StoreState;
      },
    },
  ),
);
