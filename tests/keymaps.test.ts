import { describe, it, expect } from 'vitest';
import { degreesForKey, keysForDegree } from '../src/tuning/keymaps';
import { DEFAULT_KEYMAPS } from '../src/tuning/presets';

const map = { 0: 'a', 1: 's', 2: 'a,f2', 7: 'k,z,y' };

describe('degreesForKey', () => {
  it('finds plain keys, including multiple degrees for one key', () => {
    expect(degreesForKey(map, 'a', 7)).toEqual([0, 2]);
    expect(degreesForKey(map, 'y', 7)).toEqual([7]);
  });
  it('octave suffix shifts by scale length', () => {
    expect(degreesForKey(map, 'f', 7)).toEqual([2 + 7]);
  });
  it('is case-insensitive and ignores unknown keys', () => {
    expect(degreesForKey(map, 'S', 7)).toEqual([1]);
    expect(degreesForKey(map, 'q', 7)).toEqual([]);
  });

describe('keysForDegree (key labels on the pitch cards)', () => {
  it('lists the keys that play exactly this degree, uppercased', () => {
    expect(keysForDegree(DEFAULT_KEYMAPS.scale, 0, 12)).toEqual(['A']);
    expect(keysForDegree(DEFAULT_KEYMAPS.scale, 7, 12)).toEqual(['K', 'Z', 'Y']);
    expect(keysForDegree(DEFAULT_KEYMAPS.scale, 11, 12)).toEqual(['B']);
  });
  it('includes keys from other entries and octave-suffixed keys when they land on this degree', () => {
    // chords map: 3 → 's,f,j2'; 5 → 's,f,h'; with 3 notes per octave 'j2' on degree 3 → 3 + 3 = 6
    const map = { 0: 'a', 3: 's,f,j2', 6: 'g' };
    expect(keysForDegree(map, 3, 3)).toEqual(['S', 'F']);
    expect(keysForDegree(map, 6, 3)).toEqual(['J', 'G']);
  });
  it('is empty when no key plays the degree', () => {
    expect(keysForDegree({ 0: 'a' }, 4, 12)).toEqual([]);
  });
});
});
