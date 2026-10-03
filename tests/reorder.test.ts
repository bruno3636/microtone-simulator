import { describe, it, expect } from 'vitest';
import { previewIndex, nearestSlot } from '../src/components/reorder';

describe('drag-reorder geometry', () => {
  it('cards between the dragged card and the drop slot shift one place to make room', () => {
    // dragging 1 → 4: cards 2,3,4 slide left
    expect([0, 1, 2, 3, 4, 5].map((j) => previewIndex(j, 1, 4))).toEqual([0, 4, 1, 2, 3, 5]);
    // dragging 4 → 1: cards 1,2,3 slide right
    expect([0, 1, 2, 3, 4, 5].map((j) => previewIndex(j, 4, 1))).toEqual([0, 2, 3, 4, 1, 5]);
    // no move: everything stays
    expect([0, 1, 2].map((j) => previewIndex(j, 1, 1))).toEqual([0, 1, 2]);
  });
  it('the drop slot is the one whose centre is nearest the pointer', () => {
    const slots = [
      { left: 0, top: 0, width: 100, height: 80 },
      { left: 110, top: 0, width: 100, height: 80 },
      { left: 0, top: 90, width: 100, height: 80 },
    ];
    expect(nearestSlot(slots, 150, 40)).toBe(1);
    expect(nearestSlot(slots, 20, 160)).toBe(2);
    expect(nearestSlot(slots, 60, 30)).toBe(0);
  });
});
