import { describe, it, expect } from 'vitest';
import { nudge } from '../src/components/nudge';

describe('nudge (arrow keys in a number field)', () => {
  it('ArrowUp / ArrowDown add or subtract one step', () => {
    expect(nudge('ArrowUp', -13.7, 1, -1200, 1200)).toBeCloseTo(-12.7, 10);
    expect(nudge('ArrowDown', -13.7, 1, -1200, 1200)).toBeCloseTo(-14.7, 10);
  });
  it('keeps decimals clean (no float drift)', () => {
    expect(nudge('ArrowUp', 0.1, 1, -1200, 1200)).toBe(1.1);
    expect(nudge('ArrowDown', 0.3, 1, -1200, 1200)).toBe(-0.7);
  });
  it('clamps to the range', () => {
    expect(nudge('ArrowUp', 1199.5, 1, -1200, 1200)).toBe(1200);
    expect(nudge('ArrowDown', -1200, 1, -1200, 1200)).toBe(-1200);
  });
  it('ignores other keys', () => {
    expect(nudge('ArrowLeft', 5, 1, 0, 10)).toBeNull();
    expect(nudge('a', 5, 1, 0, 10)).toBeNull();
  });
});
