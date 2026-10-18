import { describe, it, expect } from 'vitest';
import { zoomAt, panBy, gridStep, MIN_ZOOM_WIDTH } from '../src/viz/zoom';

describe('roughness zoom', () => {
  const full = { from: 0, to: 1200 };
  it('zooms around a point, keeping that point under the pointer', () => {
    const v = zoomAt(full, 600, 0.5, 1200);
    expect(v).toEqual({ from: 300, to: 900 });
    const w = zoomAt(full, 1200, 0.25, 1200); // at the right edge
    expect(w).toEqual({ from: 900, to: 1200 });
  });
  it('never zooms out past the full range or in past the minimum width', () => {
    expect(zoomAt({ from: 300, to: 900 }, 600, 10, 1200)).toEqual(full);
    const tiny = zoomAt({ from: 700, to: 704 }, 702, 0.1, 1200);
    expect(tiny.to - tiny.from).toBeCloseTo(MIN_ZOOM_WIDTH, 9);
    expect(tiny.from).toBeLessThanOrEqual(702);
    expect(tiny.to).toBeGreaterThanOrEqual(702);
  });
  it('pans within the range', () => {
    expect(panBy({ from: 300, to: 900 }, 100, 1200)).toEqual({ from: 400, to: 1000 });
    expect(panBy({ from: 300, to: 900 }, 1000, 1200)).toEqual({ from: 600, to: 1200 });
    expect(panBy({ from: 300, to: 900 }, -1000, 1200)).toEqual({ from: 0, to: 600 });
  });
  it('picks a grid step that keeps labels apart', () => {
    expect(gridStep(1200, 960)).toBe(100);
    expect(gridStep(100, 960)).toBe(5);
    expect(gridStep(10, 960)).toBe(1);
    expect(gridStep(2400, 480)).toBe(500);
  });
});
