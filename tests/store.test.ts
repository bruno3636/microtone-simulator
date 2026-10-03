import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../src/state/store';
import { SYNTH_PRESETS } from '../src/state/presets';

const s = () => useStore.getState();

beforeEach(() => {
  localStorage.clear();
  s().applyTemplate('just_intonation', 'chromatic');
  s().applyPreset('sine');
});

describe('store', () => {
  it('applyTemplate builds notes and resets shown to degree 1', () => {
    s().toggleShown(4);
    s().applyTemplate('just_intonation', 'major');
    expect(s().notes).toHaveLength(7);
    expect(s().shown).toEqual([0]);
  });
  it('non-scalable tunings force chromatic', () => {
    s().applyTemplate('harmonic_series', 'major');
    expect(s().scale).toBe('chromatic');
  });
  it('deleteDegree shifts shown indices', () => {
    s().toggleShown(3);
    s().toggleShown(5);
    s().deleteDegree(3);
    expect(s().shown).toEqual([0, 4]);
  });
  it('insertDegree inserts after the index and shifts shown', () => {
    s().toggleShown(2);
    s().insertDegree(0, '9/8');
    expect(s().notes[1]).toBe('9/8');
    expect(s().shown).toEqual([0, 3]);
  });
  it('degree 1 cannot be deleted', () => {
    const n = s().notes.length;
    s().deleteDegree(0);
    expect(s().notes).toHaveLength(n);
  });
  it('editing harmonics or envelope flips the preset to custom', () => {
    expect(s().preset).toBe('sine');
    s().setHarmonics({ count: 12 });
    expect(s().preset).toBe('custom');
    s().applyPreset('organ');
    s().setEnvelope({ attack: 500 });
    expect(s().preset).toBe('custom');
  });
  it('applyPreset sets harmonics and envelope together', () => {
    s().applyPreset('pluck');
    expect(s().harmonics).toEqual(SYNTH_PRESETS.pluck.harmonics);
    expect(s().envelope).toEqual(SYNTH_PRESETS.pluck.envelope);
  });
  it('tweaks survive a count change and can be reset', () => {
    s().setHarmonics({ count: 16 });
    s().setTweak(10, 0.5);
    s().setHarmonics({ count: 4 });
    s().setHarmonics({ count: 16 });
    expect(s().harmonics.tweaks[10]).toBe(0.5);
    s().setTweak(10, null);
    expect(s().harmonics.tweaks[10]).toBeUndefined();
    s().setTweak(3, 0.2);
    s().resetTweaks();
    expect(s().harmonics.tweaks).toEqual({});
  });
  it('root freq edits keep the note name only on exact match', () => {
    s().setRootNote('C');
    expect(s().root.freq).toBeCloseTo(523.2512);
    s().setRootFreq(500);
    expect(s().root.note).toBe('');
    s().setRootFreq(440);
    expect(s().root.note).toBe('A');
  });
  it('persists settings but not held notes', () => {
    s().setHeld(3, true);
    s().setVolume(0.42);
    const saved = JSON.parse(localStorage.getItem('ejis-settings')!);
    expect(saved.state.volume).toBe(0.42);
    expect(saved.state.held).toBeUndefined();
    expect(saved.version).toBe(4);
  });

  describe('brightness decay + instrument presets', () => {
    it('instrument presets carry measured spectra; piano and guitar darken, bowed strings do not', () => {
      s().applyPreset('piano');
      expect(s().harmonics.tweaks[1]).toBe(1);
      expect(Object.keys(s().harmonics.tweaks)).toHaveLength(s().harmonics.count);
      expect(s().darkHarmonics).not.toBeNull();
      expect(s().brightnessTau).toBe(SYNTH_PRESETS.piano.tauMs);
      s().applyPreset('violin');
      expect(s().darkHarmonics).toBeNull();
      expect(s().harmonics.tweaks[2]).toBeCloseTo(0.7025);
    });
    it('turning brightness decay on seeds a darker sustain spectrum; off clears it', () => {
      s().applyPreset('organ');
      s().setBrightnessDecay(true);
      const d = s().darkHarmonics!;
      expect(d.count).toBe(s().harmonics.count);
      expect(d.end).toBeLessThan(s().harmonics.end);
      expect(d.tweaks[8]).toBeLessThan(s().harmonics.tweaks[8]);
      expect(d.tweaks[1] ?? 1).toBeCloseTo(s().harmonics.tweaks[1] ?? 1);
      expect(s().preset).toBe('custom');
      s().setBrightnessDecay(false);
      expect(s().darkHarmonics).toBeNull();
    });
    it('harmonic actions can target the sustain spectrum', () => {
      s().applyPreset('guitar');
      const attackBefore = structuredClone(s().harmonics);
      s().setHarmonics({ end: 0.01 }, 'sustain');
      s().setTweak(3, 0.5, 'sustain');
      expect(s().darkHarmonics!.end).toBe(0.01);
      expect(s().darkHarmonics!.tweaks[3]).toBe(0.5);
      expect(s().harmonics).toEqual(attackBefore);
      s().resetTweaks('sustain');
      expect(s().darkHarmonics!.tweaks).toEqual({});
      expect(s().preset).toBe('custom');
    });
    it('sustain edits are ignored while brightness decay is off', () => {
      s().applyPreset('sine');
      s().setHarmonics({ end: 0.2 }, 'sustain');
      expect(s().darkHarmonics).toBeNull();
    });
    it('darken time is editable and flips the preset to custom', () => {
      s().applyPreset('piano');
      s().setBrightnessTau(300);
      expect(s().brightnessTau).toBe(300);
      expect(s().preset).toBe('custom');
    });
  });

  describe('preset roster', () => {
    it('drops STRINGS and offers the measured wind and brass presets', () => {
      expect(Object.keys(SYNTH_PRESETS)).not.toContain('strings');
      for (const id of ['flute', 'clarinet', 'trombone', 'trumpet'] as const) {
        expect(SYNTH_PRESETS[id].harmonics.tweaks[1]).toBeGreaterThan(0);
        expect(SYNTH_PRESETS[id].dark).toBeUndefined();
      }
    });
    it('clarinet has the weak even harmonics of a cylindrical bore', () => {
      const t = SYNTH_PRESETS.clarinet.harmonics.tweaks;
      expect(t[2]).toBeLessThan(t[3] / 5);
      expect(t[4]).toBeLessThan(t[5] / 5);
    });
    it('organ is a principal chorus: octave and fifth harmonics stand out from their neighbours', () => {
      const t = SYNTH_PRESETS.organ.harmonics.tweaks;
      expect(t[4]).toBeGreaterThan(t[5]);
      expect(t[6]).toBeGreaterThan(t[7]);
      expect(t[8]).toBeGreaterThan(t[7]);
      expect(t[12]).toBeGreaterThan(t[11]);
    });
    it('saved settings that still name the removed STRINGS preset show as CUSTOM', async () => {
      localStorage.setItem('ejis-settings', JSON.stringify({ state: { ...JSON.parse(localStorage.getItem('ejis-settings') ?? '{"state":{}}').state, preset: 'strings' }, version: 2 }));
      await useStore.persist.rehydrate();
      expect(s().preset).toBe('custom');
    });
  });

  it('saved envelopes with the old LIN/EXP/LOG curve names convert to curve amounts', async () => {
    const prev = JSON.parse(localStorage.getItem('ejis-settings') ?? '{"state":{}}').state;
    localStorage.setItem('ejis-settings', JSON.stringify({
      state: { ...prev, envelope: { attack: 10, decay: 200, sustain: 0.8, release: 400, attackCurve: 'lin', decayCurve: 'exp', releaseCurve: 'log' } },
      version: 3,
    }));
    await useStore.persist.rehydrate();
    expect(s().envelope).toMatchObject({ attackCurve: 0, decayCurve: 0.6, releaseCurve: -0.6 });
  });
});
