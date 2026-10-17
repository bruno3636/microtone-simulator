import { TUNINGS } from './presets';
import { edoExpr, edtExpr, evalRatio, setCents, splitCents, toFraction } from './ratios';
import { alternativesFor } from './degreeInput';
import { shiftOctave } from './octave';
import { MEANTONE_BADGES, WELL_BADGES } from './sourceBadge';

/** A pitch source a card can be switched to (the dropdown behind its badge). */
export type SourceTarget =
  | { kind: 'ji' }
  | { kind: 'edo'; divisions: number }
  | { kind: 'edt'; divisions: number }
  | { kind: 'pythagorean' }
  | { kind: 'meantone'; variant: string }
  | { kind: 'well'; variant: string };

/** The badge text for a target, matching `sourceBadge`. */
export function targetKey(t: SourceTarget): string {
  switch (t.kind) {
    case 'ji': return 'JI';
    case 'edo': return `${t.divisions}EDO`;
    case 'edt': return `${t.divisions}EDT`;
    case 'pythagorean': return 'Pyth';
    case 'meantone': return MEANTONE_BADGES[t.variant];
    case 'well': return WELL_BADGES[t.variant];
  }
}

/**
 * Every source, in menu order: JI, 12EDO, the custom EDO (plus `extraEdo`), the custom EDT (plus
 * `extraEdt`), Pythagorean, meantones, wells.
 */
export function SOURCE_TARGETS(edo: number, extraEdo?: number, edt = 13, extraEdt?: number): SourceTarget[] {
  const edts = [...new Set([edt, ...(extraEdt ? [extraEdt] : [])])].sort((a, b) => a - b);
  const edos = [...new Set([12, edo, ...(extraEdo ? [extraEdo] : [])])].sort((a, b) => a - b);
  return [
    { kind: 'ji' },
    ...edos.map((divisions): SourceTarget => ({ kind: 'edo', divisions })),
    ...edts.map((divisions): SourceTarget => ({ kind: 'edt', divisions })),
    { kind: 'pythagorean' },
    ...Object.keys(TUNINGS.meantone.variants!).map((variant): SourceTarget => ({ kind: 'meantone', variant })),
    ...Object.keys(TUNINGS.well_temperament.variants!).map((variant): SourceTarget => ({ kind: 'well', variant })),
  ];
}

const JI_NOTES = TUNINGS.just_intonation.notes!;
const centsOf = (expr: string) => 1200 * Math.log2(evalRatio(expr)!);

/** Of `candidates` (notes within one octave), the one nearest `within` cents, allowing the next octave's root. */
function nearest(candidates: string[], within: number): { note: string; octave: number } {
  let best = { note: candidates[0], octave: 0, d: Infinity };
  for (const note of candidates) {
    const c = centsOf(note);
    for (const octave of [0, 1]) {
      const d = Math.abs(c + 1200 * octave - within);
      if (d < best.d - 1e-6) best = { note, octave, d };
    }
  }
  return best;
}

/**
 * Re-express a pitch in another source: the nearest pitch of that source (same octave), keeping the
 * card's cents offset. JI uses the 12-note just scale.
 */
export function convertSource(note: string, target: SourceTarget): string {
  const { ratio, cents } = splitCents(note);
  const v = evalRatio(ratio);
  if (v == null) return note;
  const c = 1200 * Math.log2(v);
  const octave = Math.floor(c / 1200 + 1e-9);
  const within = c - 1200 * octave;
  let pick: { note: string; octave: number };
  switch (target.kind) {
    case 'edo':
      return setCents(edoExpr(Math.round((c * target.divisions) / 1200), target.divisions), cents ?? 0);
    case 'edt':
      return setCents(edtExpr(Math.round((c * target.divisions) / (1200 * Math.log2(3))), target.divisions), cents ?? 0);
    case 'ji': {
      // written as a plain fraction ("5/4", "5/2"), not the template's "1 + 1/4"
      pick = nearest(JI_NOTES, within);
      const frac = toFraction(evalRatio(pick.note)! * 2 ** (octave + pick.octave))!;
      return setCents(frac.replace(/\/1$/, ''), cents ?? 0);
    }
    case 'pythagorean':
      pick = nearest(alternativesFor({ family: 'pythagorean', variant: null, pos: 0 }).map((a) => a.note), within);
      break;
    case 'meantone':
      pick = nearest(alternativesFor({ family: 'meantone', variant: target.variant, pos: 0 }).map((a) => a.note), within);
      break;
    case 'well':
      pick = nearest(alternativesFor({ family: 'well', variant: target.variant, pos: 0 }).map((a) => a.note), within);
      break;
  }
  return setCents(shiftOctave(pick.note, octave + pick.octave), cents ?? 0);
}
