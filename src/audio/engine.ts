import { computeAmplitudes, type HarmonicSettings } from './harmonics';
import { normalizeRms, periodicWaveCoeffs, buildWavetable } from './timbre';
import { levelAt, releaseLevelAt, effMs, CURVE_AMOUNT, type CurveKind, type EnvelopeSettings } from './envelope';
import { shapeCurve } from './curves';
import { createImpulseResponse } from './reverb';

export type VoiceStage = 'attack' | 'decay' | 'sustain' | 'release';
export interface VoiceSnapshot { id: string; freq: number; level: number; stage: VoiceStage; elapsedMs: number; env: EnvelopeSettings }

export const MAX_VOICES = 24;
export const FADE_S = 0.008;
export const BASE_VOICE_GAIN = 0.3;
export const GAIN_TAU = 0.015;
const RAMP_STEPS = 32;
const TIMBRE_DEBOUNCE_MS = 50;

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
  settings: EnvelopeSettings;
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
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private getWave(): PeriodicWave {
    if (!this.wave) {
      const { real, imag } = periodicWaveCoeffs(this.amps);
      this.wave = this.ctx!.createPeriodicWave(real, imag, { disableNormalization: true });
    }
    return this.wave;
  }

  /** Schedule a curved segment as RAMP_STEPS linear ramps. Caller must have an event at t0 with value `from`. */
  private segment(p: AudioParam, from: number, to: number, curve: CurveKind, t0: number, dur: number) {
    const c = CURVE_AMOUNT[curve];
    for (let i = 1; i <= RAMP_STEPS; i++) {
      p.linearRampToValueAtTime(shapeCurve(from, to, i / RAMP_STEPS, c), t0 + (dur * i) / RAMP_STEPS);
    }
  }

  private levelOf(v: Voice, now: number): number {
    if (v.releaseAt == null) return levelAt(v.settings, (now - v.start) * 1000);
    return releaseLevelAt(v.settings, v.releaseFrom, (now - v.releaseAt) * 1000);
  }

  private fastFade(v: Voice, now: number) {
    const g = v.env.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(this.levelOf(v, now), now);
    g.linearRampToValueAtTime(0, now + FADE_S);
    v.osc.onended = () => this.disconnect(v);
    v.osc.stop(now + FADE_S + 0.01);
    this.voices.delete(v.id);
  }

  private disconnect(v: Voice) {
    v.osc.disconnect();
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
    if (existing) this.fastFade(existing, now);
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
    osc.connect(env).connect(vgain).connect(this.sum);

    const s = { ...this.envelope };
    const a = effMs(s.attack) / 1000;
    const d = effMs(s.decay) / 1000;
    env.gain.setValueAtTime(0, now);
    this.segment(env.gain, 0, 1, s.attackCurve, now, a);
    this.segment(env.gain, 1, s.sustain, s.decayCurve, now + a, d);
    osc.start(now);

    const voice: Voice = { id, freq, osc, env, vgain, start: now, releaseAt: null, releaseFrom: 0, settings: s };
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
    v.osc.stop(now + r + 0.05);
  }

  allNotesOff(): void {
    for (const id of [...this.voices.keys()]) this.noteOff(id);
  }

  isHeld(id: string): boolean {
    const v = this.voices.get(id);
    return !!v && v.releaseAt == null;
  }

  setTimbre(h: HarmonicSettings): void {
    this.amps = normalizeRms(computeAmplitudes(h));
    this.wavetable = buildWavetable(this.amps);
    this.wave = null; // new notes pick up the new wave immediately
    if (this.timbreTimer) clearTimeout(this.timbreTimer);
    this.timbreTimer = setTimeout(() => {
      this.timbreTimer = null;
      if (!this.ctx) return;
      const w = this.getWave();
      for (const v of this.voices.values()) v.osc.setPeriodicWave(w);
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
      out.push({ id: v.id, freq: v.freq, level: this.levelOf(v, now), stage, elapsedMs, env: v.settings });
    }
    return out;
  }

  getAmplitudes(): number[] { return this.amps; }
  getWavetable(): Float32Array { return this.wavetable; }
  getAnalyser(): AnalyserNode | null { return this.ctx ? this.analyser : null; }
}

export const engine = new AudioEngine();
