import { describe, it, expect, vi } from 'vitest';

describe('first visit (nothing saved)', () => {
  it('starts on the 7-limit chromatic preset with the piano key layout', async () => {
    localStorage.clear();
    vi.resetModules();
    const { useStore } = await import('../src/state/store');
    const s = useStore.getState();
    expect(s.scalePreset).toBe('ji12-7limit');
    expect(s.tuning).toBe('just_intonation');
    expect(s.notes).toEqual(['1', '16/15', '9/8', '7/6', '5/4', '4/3', '7/5', '3/2', '8/5', '5/3', '7/4', '15/8']);
    expect(s.keymap).toBe('piano');
    s.resetNotes(); // Reset reloads the preset
    expect(useStore.getState().notes[3]).toBe('7/6');
  });
});

describe('1/k harmonic presets', () => {
  it('64, 32, 16 and 8 harmonics, harmonic k at 1/k of the fundamental', async () => {
    const { SYNTH_PRESETS, PRESET_ORDER } = await import('../src/state/presets');
    const { computeAmplitudes: harmonicAmplitudes } = await import('../src/audio/harmonics');
    for (const n of [64, 32, 16, 8]) {
      const p = SYNTH_PRESETS[`harm${n}` as keyof typeof SYNTH_PRESETS];
      expect(p.label).toBe(`1/k ×${n}`);
      const amps = harmonicAmplitudes(p.harmonics);
      expect(amps).toHaveLength(n);
      amps.forEach((a, i) => expect(a, `${n}: harmonic ${i + 1}`).toBeCloseTo(1 / (i + 1), 12));
      expect(PRESET_ORDER).toContain(`harm${n}`);
    }
  });
  it('a first visit uses the 64-harmonic 1/k synth', async () => {
    localStorage.clear();
    vi.resetModules();
    const { useStore } = await import('../src/state/store');
    const { SYNTH_PRESETS } = await import('../src/state/presets');
    expect(useStore.getState().preset).toBe('harm64');
    expect(useStore.getState().harmonics).toEqual(SYNTH_PRESETS.harm64.harmonics);
    expect(useStore.getState().envelope).toEqual(SYNTH_PRESETS.harm64.envelope);
  });
});
