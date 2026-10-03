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
    expect(saved.version).toBe(1);
  });
});
