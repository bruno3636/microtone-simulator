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
