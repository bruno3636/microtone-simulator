import { describe, it, expect } from 'vitest';
import { degreeColor } from '../src/theme';

describe('degreeColor', () => {
  it('spaces hues 30° apart from 25° and cycles past 12', () => {
    expect(degreeColor(0, false)).toBe('oklch(64% 0.11 25)');
    expect(degreeColor(1, false)).toBe('oklch(64% 0.11 55)');
    expect(degreeColor(12, false)).toBe(degreeColor(0, false));
    expect(degreeColor(-1, false)).toBe(degreeColor(11, false));
  });
  it('brightens in dark mode and supports alpha', () => {
    expect(degreeColor(0, true)).toBe('oklch(72% 0.12 25)');
    expect(degreeColor(0, false, 0.25)).toBe('oklch(64% 0.11 25 / 0.25)');
  });
});
