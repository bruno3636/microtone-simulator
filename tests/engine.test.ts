import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AudioEngine, MAX_VOICES, voiceGain } from '../src/audio/engine';
import { levelAt, type EnvelopeSettings } from '../src/audio/envelope';
import { FakeContext, FakeGain, asCtx } from './fakeAudio';

const env: EnvelopeSettings = {
  attack: 100, decay: 100, sustain: 0.5, release: 200,
  attackCurve: 0, decayCurve: 0, releaseCurve: 0,
};

let fake: FakeContext;
let eng: AudioEngine;

beforeEach(() => {
  fake = new FakeContext();
  eng = new AudioEngine(() => asCtx(fake));
  eng.setEnvelope(env);
});
afterEach(() => vi.useRealTimers());

// voice chain: osc → env gain → voice gain
const envOf = (i: number) => fake.oscillators[i].connections[0] as FakeGain;
const vgainOf = (i: number) => envOf(i).connections[0] as FakeGain;

describe('AudioEngine', () => {
  it('starts a voice at phase 0 with an attack ramp from 0', () => {
    eng.noteOn('0', 440);
    expect(fake.oscillators).toHaveLength(1);
    expect(fake.oscillators[0].startedAt).toBe(0);
    expect(fake.oscillators[0].frequency.value).toBe(440);
    const g = envOf(0).gain;
    expect(g.events[0]).toMatchObject({ type: 'set', value: 0, time: 0 });
    expect(g.events.filter((e) => e.type === 'ramp')).toHaveLength(64); // 32 attack + 32 decay
    expect(eng.getVoices()[0].stage).toBe('attack');
  });

  it('releases from the exact current level (no jump)', () => {
    eng.noteOn('0', 440);
    fake.currentTime = 0.05; // mid-attack
    eng.noteOff('0');
    const g = envOf(0).gain;
    const set = g.last('set')!;
    expect(set.time).toBeCloseTo(0.05);
    expect(set.value).toBeCloseTo(levelAt(env, 50));
    expect(g.last('ramp')).toMatchObject({ value: 0 });
    expect(g.last('ramp')!.time).toBeCloseTo(0.05 + 0.2);
    expect(eng.getVoices()[0].stage).toBe('release');
  });

  it('re-striking a sounding note reuses its oscillator and restarts the attack from the current level (no dip)', () => {
    eng.noteOn('0', 440);
    fake.currentTime = 0.5; // sustaining at 0.5
    eng.noteOff('0');
    fake.currentTime = 0.55; // mid-release
    const levelNow = eng.getVoices()[0].level;
    expect(levelNow).toBeGreaterThan(0.1);
    eng.noteOn('0', 440);

    expect(fake.oscillators).toHaveLength(1); // same oscillator: phase continues
    const g = envOf(0).gain;
    const set = g.last('set')!;
    expect(set.time).toBeCloseTo(0.55);
    expect(set.value).toBeCloseTo(levelNow);
    const after = g.events.slice(g.events.lastIndexOf(set) + 1).filter((e) => e.type === 'ramp');
    expect(after).toHaveLength(64); // attack + decay, no fade to 0
    expect(after[0].value).toBeGreaterThan(levelNow); // rises from where it was
    expect(after[31]).toMatchObject({ value: 1 });
    expect(after[31].time).toBeCloseTo(0.55 + 0.1);
    expect(fake.oscillators[0].stoppedAt).toBeGreaterThan(1e6); // pending release stop pushed out
    const v = eng.getVoices();
    expect(v).toHaveLength(1);
    expect(v[0].stage).toBe('attack');
    expect(eng.isHeld('0')).toBe(true);
  });

  it('re-striking a held note restarts its attack from the current level', () => {
    eng.noteOn('0', 440);
    fake.currentTime = 0.5;
    eng.noteOn('0', 440);
    expect(fake.oscillators).toHaveLength(1);
    expect(envOf(0).gain.last('set')).toMatchObject({ value: 0.5 });
    expect(eng.getVoices()[0].level).toBeCloseTo(0.5);
  });

  it('re-striking after the release has died away starts a fresh voice', () => {
    eng.noteOn('0', 440);
    fake.currentTime = 0.5;
    eng.noteOff('0');
    fake.currentTime = 0.5 + 0.2 + 0.01; // release (200 ms) finished, oscillator not yet ended
    eng.noteOn('0', 440);
    expect(fake.oscillators).toHaveLength(2);
    expect(eng.getVoices()).toHaveLength(1);
    fake.oscillators[0].end(); // the old voice ending must not remove the new one
    expect(eng.getVoices().map((x) => x.id)).toEqual(['0']);
  });

  it('snapshots report how long the note was held (for the release dot)', () => {
    eng.noteOn('0', 440);
    fake.currentTime = 0.3;
    expect(eng.getVoices()[0].heldMs).toBeCloseTo(300);
    eng.noteOff('0');
    fake.currentTime = 0.4;
    const v = eng.getVoices()[0];
    expect(v.heldMs).toBeCloseTo(300);
    expect(v.elapsedMs).toBeCloseTo(100);
  });

  it('caps polyphony at 24 by stealing the oldest voice', () => {
    for (let i = 0; i <= MAX_VOICES; i++) { fake.currentTime = i * 0.01; eng.noteOn(String(i), 200 + i); }
    const ids = eng.getVoices().map((v) => v.id);
    expect(ids).toHaveLength(MAX_VOICES);
    expect(ids).not.toContain('0');
  });

  it('scales voice gain by 1/sqrt(n) with a smooth glide', () => {
    for (let i = 0; i < 4; i++) eng.noteOn(String(i), 200 + i);
    const t = vgainOf(0).gain.last('target')!;
    expect(t.value).toBeCloseTo(voiceGain(4));
    expect(voiceGain(4)).toBeCloseTo(0.15);
    expect(t.tau).toBeCloseTo(0.015);
  });

  it('removes a voice when its oscillator ends and rebalances the rest', () => {
    eng.noteOn('0', 200); eng.noteOn('1', 300);
    eng.noteOff('0');
    fake.oscillators[0].end();
    expect(eng.getVoices().map((v) => v.id)).toEqual(['1']);
    expect(vgainOf(1).gain.last('target')!.value).toBeCloseTo(voiceGain(1));
  });

  it('builds an un-normalized, RMS-normalized PeriodicWave', () => {
    eng.setTimbre({ count: 2, start: 1, end: 1, curve: 0, filter: 'all', tweaks: {} });
    eng.noteOn('0', 440);
    const w = fake.waves.at(-1)!;
    expect(w.opts).toEqual({ disableNormalization: true });
    expect(w.imag[1]).toBeCloseTo(Math.SQRT1_2);
    expect(w.imag[2]).toBeCloseTo(Math.SQRT1_2);
  });

  it('applies timbre edits to held voices after a 50 ms debounce', () => {
    vi.useFakeTimers();
    eng.noteOn('0', 440);
    const before = fake.oscillators[0].wave;
    eng.setTimbre({ count: 4, start: 1, end: 0.2, curve: 0, filter: 'all', tweaks: {} });
    vi.advanceTimersByTime(49);
    expect(fake.oscillators[0].wave).toBe(before);
    vi.advanceTimersByTime(2);
    expect(fake.oscillators[0].wave).not.toBe(before);
  });

  it('wires compressor settings and keeps reverb fully dry by default', () => {
    eng.resume();
    const v = eng as unknown as { comp: { threshold: { value: number }; ratio: { value: number } }; dry: FakeGain; wet: FakeGain };
    expect(v.comp.threshold.value).toBe(-12);
    expect(v.comp.ratio.value).toBe(4);
    expect(v.dry.gain.value).toBe(1);
    expect(v.wet.gain.value).toBe(0);
  });

  it('envelope edits do not change voices already sounding', () => {
    eng.noteOn('0', 440);
    eng.setEnvelope({ ...env, release: 5000 });
    fake.currentTime = 1;
    eng.noteOff('0');
    expect(envOf(0).gain.last('ramp')!.time).toBeCloseTo(1 + 0.2);
  });

  describe('brightness decay', () => {
    const bright = { count: 4, start: 1, end: 0.8, curve: 0, filter: 'all' as const, tweaks: {} };
    const dark = { count: 4, start: 1, end: 0.05, curve: 0, filter: 'all' as const, tweaks: {} };
    const weightsOf = (i: number) => {
      const wB = fake.oscillators[i].connections[0] as FakeGain;
      const wD = fake.oscillators[i + 1].connections[0] as FakeGain;
      return { wB, wD };
    };

    it('off: one oscillator per voice', () => {
      eng.setTimbre(bright, null);
      eng.noteOn('0', 440);
      expect(fake.oscillators).toHaveLength(1);
      expect(eng.getVoices()[0].brightness).toBe(1);
    });

    it('on: two phase-locked oscillators whose weights cross-fade with time constant τ', () => {
      eng.setTimbre(bright, { harmonics: dark, tauMs: 500 });
      eng.noteOn('0', 440);
      expect(fake.oscillators).toHaveLength(2);
      const [a, b] = fake.oscillators;
      expect(a.startedAt).toBe(0);
      expect(b.startedAt).toBe(0);
      expect(b.frequency.value).toBe(440);
      expect(a.wave).not.toBe(b.wave);
      const { wB, wD } = weightsOf(0);
      expect(wB.connections[0]).toBe(wD.connections[0]); // both feed the same envelope gain
      expect(wB.gain.events[0]).toMatchObject({ type: 'set', value: 1, time: 0 });
      expect(wB.gain.last('target')).toMatchObject({ value: 0, time: 0, tau: 0.5 });
      expect(wD.gain.events[0]).toMatchObject({ type: 'set', value: 0, time: 0 });
      expect(wD.gain.last('target')).toMatchObject({ value: 1, time: 0, tau: 0.5 });
      fake.currentTime = 0.5;
      expect(eng.getVoices()[0].brightness).toBeCloseTo(Math.exp(-1));
    });

    it('both sustain-spectrum amplitudes are RMS-normalized and exposed for the visualizer', () => {
      eng.setTimbre(bright, { harmonics: dark, tauMs: 500 });
      const d = eng.getDarkAmplitudes()!;
      expect(d.reduce((s, x) => s + x * x, 0)).toBeCloseTo(1);
      expect(eng.getDarkWavetable()).not.toBeNull();
      eng.setTimbre(bright, null);
      expect(eng.getDarkAmplitudes()).toBeNull();
      expect(eng.getDarkWavetable()).toBeNull();
    });

    it('noteOff stops both oscillators', () => {
      eng.setTimbre(bright, { harmonics: dark, tauMs: 500 });
      eng.noteOn('0', 440);
      fake.currentTime = 0.3;
      eng.noteOff('0');
      expect(fake.oscillators[0].stoppedAt).toBeCloseTo(0.3 + 0.2 + 0.05);
      expect(fake.oscillators[1].stoppedAt).toBeCloseTo(0.3 + 0.2 + 0.05);
    });

    it('a re-strike brightens again over 5 ms, then darkens anew', () => {
      eng.setTimbre(bright, { harmonics: dark, tauMs: 500 });
      eng.noteOn('0', 440);
      fake.currentTime = 1;
      const w = eng.getVoices()[0].brightness;
      eng.noteOn('0', 440);
      expect(fake.oscillators).toHaveLength(2);
      const { wB, wD } = weightsOf(0);
      expect(wB.gain.last('set')).toMatchObject({ value: w, time: 1 });
      expect(wB.gain.last('ramp')).toMatchObject({ value: 1 });
      expect(wB.gain.last('ramp')!.time).toBeCloseTo(1.005);
      expect(wB.gain.last('target')!.time).toBeCloseTo(1.005);
      expect(wD.gain.last('set')).toMatchObject({ value: 1 - w, time: 1 });
      expect(wD.gain.last('ramp')).toMatchObject({ value: 0 });
    });

    it('harmonic edits update both waves of held voices after the debounce', () => {
      vi.useFakeTimers();
      eng.setTimbre(bright, { harmonics: dark, tauMs: 500 });
      eng.noteOn('0', 440);
      const [a0, b0] = fake.oscillators.map((o) => o.wave);
      eng.setTimbre({ ...bright, end: 0.5 }, { harmonics: { ...dark, end: 0.2 }, tauMs: 500 });
      vi.advanceTimersByTime(51);
      expect(fake.oscillators[0].wave).not.toBe(a0);
      expect(fake.oscillators[1].wave).not.toBe(b0);
    });
  });

  it('retune glides a sounding voice to a new pitch without restarting it', () => {
    eng.noteOn('4', 550);
    fake.currentTime = 0.5;
    eng.retune('4', 551.27);
    const f = fake.oscillators[0].frequency;
    expect(fake.oscillators).toHaveLength(1);
    expect(f.last('target')).toMatchObject({ value: 551.27, time: 0.5 });
    expect(eng.getVoices()[0].freq).toBe(551.27);
    expect(envOf(0).gain.events.filter((e) => e.time === 0.5)).toHaveLength(0); // envelope untouched
  });

  it('retune ignores ids that are not sounding', () => {
    expect(() => eng.retune('9', 300)).not.toThrow();
    expect(fake.oscillators).toHaveLength(0);
  });
});
