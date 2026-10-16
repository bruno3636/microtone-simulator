import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../src/state/store';
import { SYNTH_PRESETS, PRESET_ORDER } from '../src/state/presets';
import { computeAmplitudes } from '../src/audio/harmonics';
import { buildWavetable, normalizeRms } from '../src/audio/timbre';

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
    expect(saved.version).toBe(10);
    expect(saved.state.bend).toBeUndefined();
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

  describe('orchestral additions', () => {
    it('adds sustained oboe, bassoon, tuba, French horn and saxophone from measured spectra', () => {
      for (const id of ['oboe', 'bassoon', 'tuba', 'horn', 'sax'] as const) {
        expect(SYNTH_PRESETS[id].harmonics.count).toBeGreaterThan(8);
        expect(SYNTH_PRESETS[id].dark).toBeUndefined();
      }
    });
    it('harp and harpsichord are plucked: they darken and decay to silence', () => {
      for (const id of ['harp', 'harpsichord'] as const) {
        expect(SYNTH_PRESETS[id].dark).toBeDefined();
        expect(SYNTH_PRESETS[id].tauMs).toBeGreaterThan(0);
        expect(SYNTH_PRESETS[id].envelope.sustain).toBe(0);
      }
    });
    it('harp (plucked near mid-string) has a weak 2nd harmonic; harpsichord (plucked near the end) stays bright', () => {
      const harp = SYNTH_PRESETS.harp.harmonics.tweaks;
      expect(harp[2]).toBeLessThan(harp[3]);
      expect(SYNTH_PRESETS.harpsichord.harmonics.tweaks[16]).toBeGreaterThan(0.05);
    });
    it('the preset bar lists every preset exactly once, grouped by family', () => {
      expect([...PRESET_ORDER].sort()).toEqual(Object.keys(SYNTH_PRESETS).sort());
      expect(PRESET_ORDER.indexOf('harpsichord')).toBeLessThan(PRESET_ORDER.indexOf('violin'));
      expect(PRESET_ORDER.indexOf('tuba')).toBe(PRESET_ORDER.length - 1);
    });
  });

  it('voice is an "ah" vowel: harmonics near the first two formants and the third-formant bump stand out', () => {
    const t = SYNTH_PRESETS.voice.harmonics.tweaks; // reference pitch 220 Hz
    expect(Math.max(t[4], t[5])).toBe(1); // F1/F2 ≈ 790/1155 Hz
    expect(t[12]).toBeGreaterThan(t[11]); // F3 ≈ 2625 Hz
    expect(t[12]).toBeGreaterThan(t[13]);
    expect(PRESET_ORDER).toContain('voice');
    expect(SYNTH_PRESETS.voice.dark).toBeUndefined();
  });

  describe('classic waveforms', () => {
    const wave = (id: 'saw' | 'square' | 'triangle') => {
      const h = SYNTH_PRESETS[id].harmonics;
      return buildWavetable(normalizeRms(computeAmplitudes(h)), 1024);
    };
    it('saw: every harmonic at 1/k, alternating sign (rising ramp)', () => {
      const t = SYNTH_PRESETS.saw.harmonics.tweaks;
      expect(SYNTH_PRESETS.saw.harmonics.count).toBe(64);
      expect(t[1]).toBeCloseTo(1);
      expect(t[2]).toBeCloseTo(-1 / 2);
      expect(t[7]).toBeCloseTo(1 / 7);
    });
    it('square: odd harmonics only at 1/k', () => {
      const t = SYNTH_PRESETS.square.harmonics.tweaks;
      expect(t[2]).toBe(0);
      expect(t[3]).toBeCloseTo(1 / 3);
      expect(t[64]).toBe(0);
    });
    it('triangle: odd harmonics at 1/k² with alternating sign', () => {
      const t = SYNTH_PRESETS.triangle.harmonics.tweaks;
      expect(t[2]).toBe(0);
      expect(t[3]).toBeCloseTo(-1 / 9);
      expect(t[5]).toBeCloseTo(1 / 25);
    });
    it('the waveforms have the right shapes', () => {
      const tri = wave('triangle');
      expect(tri[128] / tri[256]).toBeCloseTo(0.5, 1); // straight ramp up to the peak at 1/4 period
      const sq = wave('square');
      expect(Math.abs(sq[200] - sq[300]) / sq[256]).toBeLessThan(0.05); // flat top
      expect(sq[712]).toBeCloseTo(-sq[200], 1); // half-wave symmetry
      const saw = wave('saw');
      expect(saw[250] - saw[100]).toBeCloseTo(saw[400] - saw[250], 1); // constant slope (rising ramp)
      expect(saw[250]).toBeGreaterThan(saw[100]);
    });
    it('appear first in the preset bar after sine', () => {
      expect(PRESET_ORDER.slice(0, 4)).toEqual(['sine', 'saw', 'square', 'triangle']);
    });
  });

  describe('tuning variants and custom EDO', () => {
    it('meantone defaults to ¼-comma; changing the variant rebuilds the notes', () => {
      s().applyTemplate('meantone', 'chromatic');
      expect(s().tuningVariant).toBe('quarter');
      const quarterG = s().notes[7];
      s().setTuningVariant('third');
      expect(s().tuningVariant).toBe('third');
      expect(s().notes[7]).not.toBe(quarterG);
    });
    it('custom EDO uses the chosen number of divisions', () => {
      s().applyTemplate('custom_edo', 'major');
      expect(s().scale).toBe('chromatic');
      expect(s().notes).toHaveLength(s().edo);
      s().setEdo(31);
      expect(s().notes).toHaveLength(31);
    });
    it('saved settings with removed or renamed tunings migrate', async () => {
      const prev = JSON.parse(localStorage.getItem('ejis-settings') ?? '{"state":{}}').state;
      localStorage.setItem('ejis-settings', JSON.stringify({ state: { ...prev, tuning: 'equal_temperament' }, version: 4 }));
      await useStore.persist.rehydrate();
      expect(s().tuning).toBe('edo12');
      localStorage.setItem('ejis-settings', JSON.stringify({ state: { ...prev, tuning: 'meantone_temperament' }, version: 4 }));
      await useStore.persist.rehydrate();
      expect(s()).toMatchObject({ tuning: 'meantone', tuningVariant: 'quarter' });
      localStorage.setItem('ejis-settings', JSON.stringify({ state: { ...prev, tuning: 'custom_spooky' }, version: 4 }));
      await useStore.persist.rehydrate();
      expect(s().tuning).toBe('just_intonation');
      // Tempered JI was merged into Just intonation (v7); its "+0c" notes still play
      localStorage.setItem('ejis-settings', JSON.stringify({ state: { ...prev, tuning: 'tempered_ji', notes: ['1 +0c', '5/4 -13.7c'] }, version: 6 }));
      await useStore.persist.rehydrate();
      expect(s()).toMatchObject({ tuning: 'just_intonation', notes: ['1 +0c', '5/4 -13.7c'] });
    });
    it("v10: customised scale keymaps without ; or ' gain them on degrees 9 and 10", async () => {
      const prev = JSON.parse(localStorage.getItem('ejis-settings') ?? '{"state":{}}').state;
      const custom = { scale: { 0: 'q', 9: 'x', 10: 'v' }, chords: { 0: 'a' } };
      localStorage.setItem('ejis-settings', JSON.stringify({ state: { ...prev, keymaps: custom }, version: 9 }));
      await useStore.persist.rehydrate();
      expect(s().keymaps.scale).toMatchObject({ 0: 'q', 9: 'x,;', 10: "v,'" });
      // already present somewhere: left alone
      const has = { scale: { 3: ';', 9: 'x', 10: "v,'" }, chords: { 0: 'a' } };
      localStorage.setItem('ejis-settings', JSON.stringify({ state: { ...prev, keymaps: has }, version: 9 }));
      await useStore.persist.rehydrate();
      expect(s().keymaps.scale).toMatchObject({ 3: ';', 9: 'x', 10: "v,'" });
    });
    it("v8: saved default keymaps gain ; and ' after L", async () => {
      const prev = JSON.parse(localStorage.getItem('ejis-settings') ?? '{"state":{}}').state;
      const old = { scale: { 0: 'a', 8: 'l,x', 9: 'c', 10: 'v' }, chords: { 0: 'a' } };
      localStorage.setItem('ejis-settings', JSON.stringify({ state: { ...prev, keymaps: old }, version: 7 }));
      await useStore.persist.rehydrate();
      expect(s().keymaps.scale).toMatchObject({ 9: 'c,;', 10: "v,'" });
      expect(s().keymaps.chords).toEqual({ 0: 'a' });
      expect(s().keymaps.piano).toMatchObject({ 1: 'w,o2', 6: 't' });
    });
  });
  it('12EDO is always chromatic', () => {
    s().applyTemplate('edo12', 'major');
    expect(s().scale).toBe('chromatic');
    expect(s().notes).toHaveLength(12);
  });

  describe('reordering the pitch collection', () => {
    beforeEach(() => {
      s().applyTemplate('just_intonation', 'major'); // 1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8
    });
    it('moves a pitch to a new position; the others close up in order', () => {
      const before = [...s().notes];
      s().moveDegree(4, 1);
      expect(s().notes).toEqual([before[0], before[4], before[1], before[2], before[3], before[5], before[6]]);
      s().moveDegree(1, 4);
      expect(s().notes).toEqual(before);
    });
    it('the visualizer toggle follows the pitch it was set on', () => {
      s().toggleShown(4); // shown = [0, 4]
      s().moveDegree(4, 1);
      expect([...s().shown].sort()).toEqual([0, 1]);
      s().moveDegree(0, 6); // root moves to the end; everything shifts left
      expect([...s().shown].sort()).toEqual([0, 6]);
    });
    it('ignores out-of-range or no-op moves', () => {
      const before = [...s().notes];
      s().moveDegree(2, 2);
      s().moveDegree(-1, 3);
      s().moveDegree(2, 99);
      expect(s().notes).toEqual(before);
    });
  });

  it('tracks sustained (shift-clicked) pitches without persisting them', () => {
    s().setLatched(3, true);
    s().setLatched(5, true);
    s().setLatched(3, true);
    expect(s().latched).toEqual([3, 5]);
    s().setLatched(3, false);
    expect(s().latched).toEqual([5]);
    const saved = JSON.parse(localStorage.getItem('ejis-settings')!);
    expect(saved.state.latched).toBeUndefined();
    s().setLatched(5, false);
  });
  it('Custom EDO starts at 31 divisions', () => {
    expect(useStore.getInitialState().edo).toBe(31);
  });
  it('saved settings still on the old 19-division default move to 31', async () => {
    const prev = JSON.parse(localStorage.getItem('ejis-settings') ?? '{"state":{}}').state;
    localStorage.setItem('ejis-settings', JSON.stringify({ state: { ...prev, edo: 19 }, version: 5 }));
    await useStore.persist.rehydrate();
    expect(s().edo).toBe(31);
    localStorage.setItem('ejis-settings', JSON.stringify({ state: { ...prev, edo: 22 }, version: 5 }));
    await useStore.persist.rehydrate();
    expect(s().edo).toBe(22);
  });
  it('does not move 19 → 31 while Custom EDO is in use (its notes are 19-EDO)', async () => {
    const prev = JSON.parse(localStorage.getItem('ejis-settings') ?? '{"state":{}}').state;
    localStorage.setItem('ejis-settings', JSON.stringify({ state: { ...prev, tuning: 'custom_edo', edo: 19 }, version: 5 }));
    await useStore.persist.rehydrate();
    expect(s().edo).toBe(19);
  });

  describe('scale presets', () => {
    it('loading sets tuning, variant, EDO and notes; Reset reloads it; picking a tuning clears it', () => {
      s().loadScalePreset('edo24-rast');
      expect(s()).toMatchObject({ tuning: 'custom_edo', edo: 24, scalePreset: 'edo24-rast' });
      expect(s().notes).toHaveLength(7);
      s().setNote(1, '9/8');
      s().resetNotes();
      expect(s().notes[1]).toBe('2^(4/24)');
      s().loadScalePreset('mt-sixth-major');
      expect(s()).toMatchObject({ tuning: 'meantone', tuningVariant: 'sixth' });
      s().applyTemplate('just_intonation', 'major');
      expect(s().scalePreset).toBeNull();
    });
    it('12-note presets use the piano key layout; others switch back to the scale layout', () => {
      s().loadScalePreset('well-vallotti-chromatic');
      expect(s().keymap).toBe('piano');
      s().loadScalePreset('ji-major');
      expect(s().keymap).toBe('scale');
    });
  });

  it('pitch bend: live notes bend, sustained notes do not', async () => {
    const { liveFreq } = await import('../src/audio/play');
    s().applyTemplate('just_intonation', 'chromatic');
    const st = { notes: s().notes, root: { note: 'A', freq: 440 }, latched: [2], bend: 100 };
    expect(liveFreq(st, 0)).toBeCloseTo(440 * 2 ** (1 / 12), 9);
    expect(liveFreq(st, 2)).toBeCloseTo(440 * 9 / 8, 9);
    s().setBend(5000);
    expect(s().bend).toBe(1200);
    s().setBend(0);
  });
});
