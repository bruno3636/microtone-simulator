import { computeAmplitudes, type HarmonicSettings } from './harmonics';
import { normalizeRms, periodicWaveCoeffs, buildWavetable } from './timbre';
import { levelAt, releaseLevelAt, effMs, CURVE_AMOUNT, type CurveKind, type EnvelopeSettings } from './envelope';
import { shapeCurve } from './curves';
import { createImpulseResponse } from './reverb';

export type VoiceStage = 'attack' | 'decay' | 'sustain' | 'release';
export interface VoiceSnapshot {
  id: string;
  freq: number;
  level: number;
  stage: VoiceStage;
  elapsedMs: number;
  env: EnvelopeSettings;
  /** attack-spectrum weight: 1 = fully bright, 0 = fully the sustain spectrum (always 1 when brightness decay is off) */
  brightness: number;
}

/** Optional second (sustain) spectrum the voice darkens toward, with time constant `tauMs`. */
export interface BrightnessSettings { harmonics: HarmonicSettings; tauMs: number }

export const MAX_VOICES = 24;
export const FADE_S = 0.008;
export const BASE_VOICE_GAIN = 0.3;
export const GAIN_TAU = 0.015;
const RAMP_STEPS = 32;
const TIMBRE_DEBOUNCE_MS = 50;
/** Below this envelope level a sounding voice counts as silent: a re-strike starts a fresh voice. */
const SILENT_LEVEL = 1e-3;
/** stop() time used to cancel a pending stop (the last stop() call wins). */
const NEVER = 1e9;
/** How long a re-strike takes to return to the fully bright spectrum. */
const REBRIGHTEN_S = 0.005;

export const voiceGain = (n: number) => BASE_VOICE_GAIN / Math.sqrt(Math.max(1, n));

interface Voice {
  id: string;
  freq: number;
  osc: OscillatorNode;
  env: GainNode;
  vgain: GainNode;
  start: number;
  releaseAt: number | null;
  releaseFrom: number;
  /** level the current attack started from (non-zero after a re-strike) */
  attackFrom: number;
  settings: EnvelopeSettings;
  /** second oscillator with the sustain spectrum plus the two blend weights; null when brightness decay is off */
  dark: { osc: OscillatorNode; wBright: GainNode; wDark: GainNode } | null;
  /** when the current darkening began, and its time constant (s) */
  brightStart: number;
  brightTau: number;
}

const DEFAULT_ENV: EnvelopeSettings = {
  attack: 10, decay: 200, sustain: 0.8, release: 400,
  attackCurve: 'lin', decayCurve: 'exp', releaseCurve: 'exp',
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sum!: GainNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private convolver!: ConvolverNode;
  private comp!: DynamicsCompressorNode;
  private master!: GainNode;
  private analyser!: AnalyserNode;
  private irLoaded = false;

  private voices = new Map<string, Voice>();
  private wave: PeriodicWave | null = null;
  private amps: number[] = [1];
  private wavetable: Float32Array = buildWavetable([1]);
  private darkWave: PeriodicWave | null = null;
  private darkAmps: number[] | null = null;
  private darkWavetable: Float32Array | null = null;
  private brightTau = 1;
  private timbreTimer: ReturnType<typeof setTimeout> | null = null;
  private envelope: EnvelopeSettings = { ...DEFAULT_ENV };
  private volume = 0.6;
  private reverbMix = 0;

  constructor(private createContext: () => AudioContext = () => new AudioContext()) {}

  /** Create/resume the context. Call from a user gesture. */
  resume(): void {
    this.ensureContext();
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const ctx = this.createContext();
      this.ctx = ctx;
      this.sum = ctx.createGain();
      this.dry = ctx.createGain();
      this.wet = ctx.createGain();
      this.convolver = ctx.createConvolver();
      this.comp = ctx.createDynamicsCompressor();
      this.master = ctx.createGain();
      this.analyser = ctx.createAnalyser();
      this.comp.threshold.value = -12;
      this.comp.knee.value = 10;
      this.comp.ratio.value = 4;
      this.comp.attack.value = 0.003;
      this.comp.release.value = 0.25;
      this.analyser.fftSize = 8192;
      this.analyser.smoothingTimeConstant = 0.6;
      this.master.gain.value = this.volume;
      this.sum.connect(this.dry).connect(this.comp);
      this.sum.connect(this.convolver).connect(this.wet).connect(this.comp);
      this.comp.connect(this.master);
      this.master.connect(ctx.destination);
      this.master.connect(this.analyser);
      this.applyReverb(0, true);
    }
    // 'suspended' or iOS 'interrupted'; swallow rejection so it never goes unhandled
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private getWave(): PeriodicWave {
    if (!this.wave) {
      const { real, imag } = periodicWaveCoeffs(this.amps);
      this.wave = this.ctx!.createPeriodicWave(real, imag, { disableNormalization: true });
    }
    return this.wave;
  }

  private getDarkWave(): PeriodicWave {
    if (!this.darkAmps) return this.getWave();
    if (!this.darkWave) {
      const { real, imag } = periodicWaveCoeffs(this.darkAmps);
      this.darkWave = this.ctx!.createPeriodicWave(real, imag, { disableNormalization: true });
    }
    return this.darkWave;
  }

  private brightnessOf(v: Voice, now: number): number {
    if (!v.dark || now <= v.brightStart) return 1;
    return Math.exp(-(now - v.brightStart) / v.brightTau);
  }

  private stopVoice(v: Voice, when: number) {
    v.osc.stop(when);
    v.dark?.osc.stop(when);
  }

  /** Schedule a curved segment as RAMP_STEPS linear ramps. Caller must have an event at t0 with value `from`. */
  private segment(p: AudioParam, from: number, to: number, curve: CurveKind, t0: number, dur: number) {
    const c = CURVE_AMOUNT[curve];
    for (let i = 1; i <= RAMP_STEPS; i++) {
      p.linearRampToValueAtTime(shapeCurve(from, to, i / RAMP_STEPS, c), t0 + (dur * i) / RAMP_STEPS);
    }
  }

  private levelOf(v: Voice, now: number): number {
    if (v.releaseAt == null) return levelAt(v.settings, (now - v.start) * 1000, v.attackFrom);
    return releaseLevelAt(v.settings, v.releaseFrom, (now - v.releaseAt) * 1000);
  }

  /** Attack from `from` to 1, then decay to sustain. Caller must have an event at `now` with value `from`. */
  private scheduleAttack(p: AudioParam, from: number, s: EnvelopeSettings, now: number) {
    const a = effMs(s.attack) / 1000;
    this.segment(p, from, 1, s.attackCurve, now, a);
    this.segment(p, 1, s.sustain, s.decayCurve, now + a, effMs(s.decay) / 1000);
  }

  /**
   * Re-strike a voice that is still sounding: keep its oscillator (no phase reset, no second
   * same-pitch voice) and restart the envelope from the current level, so there is no dip.
   */
  private restrike(v: Voice, freq: number, now: number, level: number) {
    const g = v.env.gain;
    const s = { ...this.envelope };
    g.cancelScheduledValues(now);
    g.setValueAtTime(level, now);
    this.scheduleAttack(g, level, s, now);
    const retuned = v.freq !== freq;
    if (retuned) v.osc.frequency.setValueAtTime(freq, now);
    this.stopVoice(v, NEVER); // cancel the stop scheduled by the release
    if (v.dark) {
      const w = this.brightnessOf(v, now);
      const { wBright, wDark } = v.dark;
      const t = now + REBRIGHTEN_S;
      v.brightTau = this.brightTau;
      wBright.gain.cancelScheduledValues(now);
      wBright.gain.setValueAtTime(w, now);
      wBright.gain.linearRampToValueAtTime(1, t);
      wBright.gain.setTargetAtTime(0, t, v.brightTau);
      wDark.gain.cancelScheduledValues(now);
      wDark.gain.setValueAtTime(1 - w, now);
      wDark.gain.linearRampToValueAtTime(0, t);
      wDark.gain.setTargetAtTime(1, t, v.brightTau);
      if (retuned) v.dark.osc.frequency.setValueAtTime(freq, now);
      v.brightStart = t;
    }
    v.freq = freq;
    v.start = now;
    v.releaseAt = null;
    v.releaseFrom = 0;
    v.attackFrom = level;
    v.settings = s;
  }

  private fastFade(v: Voice, now: number) {
    const g = v.env.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(this.levelOf(v, now), now);
    g.linearRampToValueAtTime(0, now + FADE_S);
    v.osc.onended = () => this.disconnect(v);
    this.stopVoice(v, now + FADE_S + 0.01);
    this.voices.delete(v.id);
  }

  private disconnect(v: Voice) {
    v.osc.disconnect();
    if (v.dark) {
      v.dark.osc.disconnect();
      v.dark.wBright.disconnect();
      v.dark.wDark.disconnect();
    }
    v.env.disconnect();
    v.vgain.disconnect();
  }

  private rebalance(now: number) {
    const g = voiceGain(this.voices.size);
    for (const v of this.voices.values()) v.vgain.gain.setTargetAtTime(g, now, GAIN_TAU);
  }

  noteOn(id: string, freq: number): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const existing = this.voices.get(id);
    if (existing) {
      const level = this.levelOf(existing, now);
      if (level > SILENT_LEVEL) return this.restrike(existing, freq, now, level);
      // release has died away: let the old oscillator finish on its own, start a fresh voice
      this.voices.delete(id);
    }
    while (this.voices.size >= MAX_VOICES) {
      let oldest: Voice | null = null;
      for (const v of this.voices.values()) if (!oldest || v.start < oldest.start) oldest = v;
      this.fastFade(oldest!, now);
    }

    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.getWave());
    osc.frequency.value = freq;
    const env = ctx.createGain();
    const vgain = ctx.createGain();
    vgain.gain.setValueAtTime(voiceGain(this.voices.size + 1), now);
    env.connect(vgain).connect(this.sum);
    let dark: Voice['dark'] = null;
    if (this.darkAmps) {
      // two phase-locked oscillators (same frequency, same start) blended by complementary weights
      const darkOsc = ctx.createOscillator();
      darkOsc.setPeriodicWave(this.getDarkWave());
      darkOsc.frequency.value = freq;
      const wBright = ctx.createGain();
      const wDark = ctx.createGain();
      wBright.gain.setValueAtTime(1, now);
      wBright.gain.setTargetAtTime(0, now, this.brightTau);
      wDark.gain.setValueAtTime(0, now);
      wDark.gain.setTargetAtTime(1, now, this.brightTau);
      osc.connect(wBright).connect(env);
      darkOsc.connect(wDark).connect(env);
      darkOsc.start(now);
      dark = { osc: darkOsc, wBright, wDark };
    } else {
      osc.connect(env);
    }

    const s = { ...this.envelope };
    env.gain.setValueAtTime(0, now);
    this.scheduleAttack(env.gain, 0, s, now);
    osc.start(now);

    const voice: Voice = {
      id, freq, osc, env, vgain, start: now, releaseAt: null, releaseFrom: 0, attackFrom: 0, settings: s,
      dark, brightStart: now, brightTau: this.brightTau,
    };
    osc.onended = () => {
      this.disconnect(voice);
      if (this.voices.get(id) === voice) {
        this.voices.delete(id);
        this.rebalance(this.ctx!.currentTime);
      }
    };
    this.voices.set(id, voice);
    this.rebalance(now);
  }

  noteOff(id: string): void {
    const v = this.voices.get(id);
    if (!v || v.releaseAt != null || !this.ctx) return;
    const now = this.ctx.currentTime;
    const level = this.levelOf(v, now);
    const r = effMs(v.settings.release) / 1000;
    v.env.gain.cancelScheduledValues(now);
    v.env.gain.setValueAtTime(level, now);
    this.segment(v.env.gain, level, 0, v.settings.releaseCurve, now, r);
    v.releaseAt = now;
    v.releaseFrom = level;
    this.stopVoice(v, now + r + 0.05);
  }

  allNotesOff(): void {
    for (const id of [...this.voices.keys()]) this.noteOff(id);
  }

  isHeld(id: string): boolean {
    const v = this.voices.get(id);
    return !!v && v.releaseAt == null;
  }

  /** Attack spectrum `h`; optional sustain spectrum + darken time (brightness decay). */
  setTimbre(h: HarmonicSettings, dark: BrightnessSettings | null = null): void {
    this.amps = normalizeRms(computeAmplitudes(h));
    this.wavetable = buildWavetable(this.amps);
    this.darkAmps = dark ? normalizeRms(computeAmplitudes(dark.harmonics)) : null;
    this.darkWavetable = this.darkAmps ? buildWavetable(this.darkAmps) : null;
    if (dark) this.brightTau = Math.max(0.05, dark.tauMs / 1000);
    // new notes pick up the new waves immediately
    this.wave = null;
    this.darkWave = null;
    if (this.timbreTimer) clearTimeout(this.timbreTimer);
    this.timbreTimer = setTimeout(() => {
      this.timbreTimer = null;
      if (!this.ctx) return;
      const w = this.getWave();
      const d = this.getDarkWave(); // equals the bright wave when brightness decay is off
      for (const v of this.voices.values()) {
        v.osc.setPeriodicWave(w);
        v.dark?.osc.setPeriodicWave(d);
      }
    }, TIMBRE_DEBOUNCE_MS);
  }

  setEnvelope(e: EnvelopeSettings): void {
    this.envelope = { ...e };
  }

  setMasterVolume(v: number): void {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  setReverbMix(m: number): void {
    this.reverbMix = Math.min(1, Math.max(0, m));
    if (this.ctx) this.applyReverb(this.ctx.currentTime, false);
  }

  private applyReverb(now: number, immediate: boolean) {
    const m = this.reverbMix;
    if (m > 0 && !this.irLoaded) {
      this.convolver.buffer = createImpulseResponse(this.ctx!);
      this.irLoaded = true;
    }
    const dry = Math.cos((m * Math.PI) / 2);
    const wet = Math.sin((m * Math.PI) / 2);
    if (immediate) {
      this.dry.gain.value = dry;
      this.wet.gain.value = wet;
    } else {
      this.dry.gain.setTargetAtTime(dry, now, 0.03);
      this.wet.gain.setTargetAtTime(wet, now, 0.03);
    }
  }

  getVoices(): VoiceSnapshot[] {
    if (!this.ctx) return [];
    const now = this.ctx.currentTime;
    const out: VoiceSnapshot[] = [];
    for (const v of this.voices.values()) {
      let stage: VoiceStage;
      let elapsedMs: number;
      if (v.releaseAt != null) {
        stage = 'release';
        elapsedMs = (now - v.releaseAt) * 1000;
      } else {
        elapsedMs = (now - v.start) * 1000;
        const a = effMs(v.settings.attack);
        stage = elapsedMs < a ? 'attack' : elapsedMs < a + effMs(v.settings.decay) ? 'decay' : 'sustain';
      }
      out.push({
        id: v.id, freq: v.freq, level: this.levelOf(v, now), stage, elapsedMs, env: v.settings,
        brightness: this.brightnessOf(v, now),
      });
    }
    return out;
  }

  getAmplitudes(): number[] { return this.amps; }
  getWavetable(): Float32Array { return this.wavetable; }
  /** Sustain-spectrum amplitudes / wavetable, or null when brightness decay is off. */
  getDarkAmplitudes(): number[] | null { return this.darkAmps; }
  getDarkWavetable(): Float32Array | null { return this.darkWavetable; }
  getAnalyser(): AnalyserNode | null { return this.ctx ? this.analyser : null; }
}

export const engine = new AudioEngine();
