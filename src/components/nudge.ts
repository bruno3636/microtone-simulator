/**
 * New value for an ArrowUp / ArrowDown press in a number field: one `step` up or down, clamped to
 * [min, max] and rounded to 6 decimals so repeated presses don't accumulate float error.
 * Null for any other key.
 */
export function nudge(key: string, value: number, step: number, min: number, max: number): number | null {
  const dir = key === 'ArrowUp' ? 1 : key === 'ArrowDown' ? -1 : 0;
  if (!dir) return null;
  const v = Math.min(max, Math.max(min, value + dir * step));
  return Math.round(v * 1e6) / 1e6;
}
