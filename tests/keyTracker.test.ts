import { describe, it, expect } from 'vitest';
import { createKeyTracker } from '../src/hooks/keyTracker';

describe('createKeyTracker', () => {
  it('releases exactly what a key started, ref-counting shared degrees', () => {
    const t = createKeyTracker();
    expect(t.press('KeyA', [0, 2])).toEqual([0, 2]);
    expect(t.press('KeyD', [2, 4])).toEqual([4]); // 2 already sounding
    expect(t.release('KeyA')).toEqual([0]); // 2 still held by KeyD
    expect(t.release('KeyD')).toEqual([2, 4]);
  });
  it('returns null for a key it never saw and ignores a repeated press', () => {
    const t = createKeyTracker();
    expect(t.release('KeyZ')).toBeNull();
    t.press('KeyA', [0]);
    expect(t.press('KeyA', [0])).toEqual([]);
    expect(t.release('KeyA')).toEqual([0]);
    expect(t.release('KeyA')).toBeNull();
  });
  it('isActive and clear', () => {
    const t = createKeyTracker();
    t.press('KeyA', [0, 2]);
    expect(t.isActive(2)).toBe(true);
    t.clear();
    expect(t.isActive(2)).toBe(false);
    expect(t.release('KeyA')).toBeNull();
  });
});
