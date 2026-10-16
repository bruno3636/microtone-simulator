import { parseEdo, splitCents, splitLabel } from './ratios';

export const MEANTONE_BADGES: Record<string, string> = {
  third: '1/3 MT', quarter: '1/4 MT', fifth: '1/5 MT', sixth: '1/6 MT', twoSevenths: '2/7 MT',
};
export const WELL_BADGES: Record<string, string> = { werckmeister3: 'Werck', kirnberger3: 'Kirn', vallotti: 'Val', young: 'Yng' };

/** Short label for where a pitch came from, shown right of its coloured chip. */
export function sourceBadge(note: string, tuning: string, edo = 31): string {
  const { tag } = splitLabel(note);
  if (tag?.family === 'pythagorean') return 'Pyth';
  if (tag?.family === 'meantone') return MEANTONE_BADGES[tag.variant ?? 'quarter'] ?? 'Meantone';
  if (tag?.family === 'well') return WELL_BADGES[tag.variant ?? 'werckmeister3'] ?? 'Well';
  // the value without its cents offset decides the source
  const value = splitCents(note).ratio;
  const step = parseEdo(value);
  if (step) return `${step.divisions}EDO`;
  // the root "1" of an EDO tuning (with or without an offset) belongs to that EDO
  if (value.trim() === '1' && tuning === 'edo12') return '12EDO';
  if (value.trim() === '1' && tuning === 'custom_edo') return `${edo}EDO`;
  return 'JI';
}
