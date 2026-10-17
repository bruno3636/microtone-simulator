import { describe, it, expect } from 'vitest';
import { parseEdt, edtExpr, degreeRatio, evalRatio } from '../src/tuning/ratios';
import { tuningNotes, TUNINGS } from '../src/tuning/presets';
import { sourceBadge } from '../src/tuning/sourceBadge';
import { convertSource, SOURCE_TARGETS, targetKey } from '../src/tuning/convertSource';
import { buildDegree, DEGREE_SOURCES } from '../src/tuning/degreeInput';
import { SCALE_PRESETS } from '../src/tuning/scalePresets';
import { useStore } from '../src/state/store';

describe('EDT: equal divisions of the tritave (3/1)', () => {
  it('parses and writes 3^(k/N) steps', () => {
    expect(parseEdt('3^(5/13)')).toEqual({ step: 5, divisions: 13 });
    expect(parseEdt(' 3^( -2 / 13 ) ')).toEqual({ step: -2, divisions: 13 });
    expect(parseEdt('2^(5/13)')).toBeNull();
    expect(edtExpr(0, 13)).toBe('1');
    expect(edtExpr(13, 13)).toBe('3^(13/13)');
    expect(evalRatio(edtExpr(13, 13))).toBeCloseTo(3, 12);
  });
  it('a Custom EDT tuning with N divisions of the tritave, repeating at 3/1', () => {
    expect(TUNINGS.custom_edt).toMatchObject({ edt: true, period: 3, scalable: false });
    const n = tuningNotes('custom_edt', undefined, 31, 13);
    expect(n).toHaveLength(13);
    expect(n[12]).toBe('3^(12/13)');
    // the 14th degree is the next tritave's root when the period is 3
    expect(degreeRatio(n, 13, 3)).toBeCloseTo(3, 12);
    expect(degreeRatio(n, 13)).toBeCloseTo(2, 12); // octave period by default
  });
  it('labels, insert source and source switching', () => {
    expect(sourceBadge('3^(5/13)', 'just_intonation')).toBe('13EDT');
    expect(sourceBadge('1', 'custom_edt', 31, 13)).toBe('13EDT');
    expect(DEGREE_SOURCES.map((s) => s.id)).toContain('custom_edt');
    expect(buildDegree({ source: 'custom_edt', steps: 5, divisions: 13 })).toBe('3^(5/13)');
    const targets = SOURCE_TARGETS(31, undefined, 13);
    expect(targets.map(targetKey)).toContain('13EDT');
    const edt13 = targets.find((t) => targetKey(t) === '13EDT')!;
    expect(convertSource('3/2', edt13)).toBe('3^(5/13)'); // 702¢ → 5 × 146.3¢
    expect(convertSource('9/7 +2c', edt13)).toBe('3^(3/13) +2c');
  });
  it('Bohlen–Pierce presets', () => {
    const bp = SCALE_PRESETS.find((p) => p.id === 'edt13-bp')!;
    expect(bp).toMatchObject({ tuning: 'custom_edt', edt: 13, period: 3 });
    expect(bp.notes).toHaveLength(13);
    const just = SCALE_PRESETS.find((p) => p.id === 'bp-just')!;
    expect(just.period).toBe(3);
    expect(just.notes).toEqual(['1', '27/25', '25/21', '9/7', '7/5', '75/49', '5/3', '9/5', '49/25', '15/7', '7/3', '63/25', '25/9']);
    const lambda = SCALE_PRESETS.find((p) => p.id === 'edt13-lambda')!;
    expect(lambda.notes).toHaveLength(9);
  });
  it('loading a tritave preset sets the period; picking an octave tuning restores 2', () => {
    const s = () => useStore.getState();
    s().loadScalePreset('edt13-bp');
    expect(s()).toMatchObject({ tuning: 'custom_edt', edt: 13, period: 3 });
    s().loadScalePreset('bp-just');
    expect(s()).toMatchObject({ tuning: 'just_intonation', period: 3 });
    s().applyTemplate('just_intonation', 'chromatic');
    expect(s().period).toBe(2);
    s().applyTemplate('custom_edt', 'chromatic');
    expect(s()).toMatchObject({ period: 3 });
    expect(s().notes).toHaveLength(s().edt);
    s().setEdt(9);
    expect(s().notes).toHaveLength(9);
    s().applyTemplate('just_intonation', 'chromatic');
  });
});
