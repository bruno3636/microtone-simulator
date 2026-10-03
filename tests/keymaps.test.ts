import { describe, it, expect } from 'vitest';
import { degreesForKey } from '../src/tuning/keymaps';

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
});
