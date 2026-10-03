import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { TUNINGS } from '../tuning/presets';
import { intervalBySemitones } from '../tuning/intervals';
import { evalRatio } from '../tuning/ratios';
import { buildDegree, DEGREE_SOURCES, SPELLED_NOTES, spelledInterval, type DegreeSourceId } from '../tuning/degreeInput';
import { NumberField } from './ui';

/** The typed-input source that matches the current tuning, so the popover opens on the familiar one. */
const SOURCE_FOR_TUNING: Record<string, DegreeSourceId> = {
  just_intonation: 'ji', tempered_ji: 'tempered_ji', harmonic_series: 'ji', edo12: 'edo12',
  custom_edo: 'custom_edo', pythagorean_tuning: 'pythagorean', meantone: 'meantone', well_temperament: 'well',
};

export function AddDegreePopover({ after, onClose }: { after: number; onClose(): void }) {
  const { insertDegree, tuning, tuningVariant, edo, root } = useStore.getState();
  const [source, setSource] = useState<DegreeSourceId>(SOURCE_FOR_TUNING[tuning] ?? 'ji');
  const [ratio, setRatio] = useState('3/2');
  const [cents, setCents] = useState(0);
  const [steps, setSteps] = useState(7);
  const [divisions, setDivisions] = useState(edo);
  const [meantone, setMeantone] = useState(tuning === 'meantone' && tuningVariant ? tuningVariant : 'quarter');
  const [well, setWell] = useState(tuning === 'well_temperament' && tuningVariant ? tuningVariant : 'werckmeister3');
  const [note, setNote] = useState(7);
  const [spelling, setSpelling] = useState('G');
  const [hz, setHz] = useState(Math.round(root.freq * 1.5 * 100) / 100);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const variant = source === 'meantone' ? meantone : source === 'well' ? well : undefined;
  const built = buildDegree({ source, ratio, cents, steps, divisions, variant, spelling, note, hz, rootHz: root.freq });
  const value = built == null ? null : evalRatio(built);
  const add = () => {
    if (built == null) return;
    insertDegree(after, built);
    onClose();
  };

  const variantSelect = (key: 'meantone' | 'well_temperament', v: string, set: (v: string) => void) => (
    <label className="flex flex-col gap-1">
      <span className="label">Variant</span>
      <select className="input" value={v} onChange={(e) => set(e.target.value)}>
        {Object.entries(TUNINGS[key].variants!).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}
      </select>
    </label>
  );

  return (
    <div ref={ref} className="panel fixed inset-x-4 top-24 z-20 flex flex-col gap-3 p-3 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:w-72"
      style={{ borderColor: 'var(--border)' }}
      onKeyDown={(e) => { if (e.key === 'Enter') add(); }}>
      <span className="label">Insert degree</span>
      <select className="input" value={source} aria-label="Value type" onChange={(e) => setSource(e.target.value as DegreeSourceId)}>
        {DEGREE_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>

      {(source === 'ji' || source === 'tempered_ji') && (
        <label className="flex flex-col gap-1">
          <span className="label">Ratio</span>
          <input className="input mono" value={ratio} autoFocus aria-invalid={evalRatio(ratio) == null}
            onChange={(e) => setRatio(e.target.value)} placeholder="e.g. 7/4" />
        </label>
      )}
      {(source === 'tempered_ji' || source === 'cents') && (
        <NumberField label={source === 'cents' ? 'Cents above root' : '± cents'} value={cents} min={-2400} max={2400} step={0.1} onChange={setCents} />
      )}
      {(source === 'edo12' || source === 'custom_edo') && (
        <div className="flex gap-3">
          <NumberField label="Steps" value={steps} min={-96} max={96} onChange={setSteps} />
          {source === 'custom_edo' && <NumberField label="Divisions" value={divisions} min={1} max={96} onChange={setDivisions} />}
        </div>
      )}
      {source === 'meantone' && variantSelect('meantone', meantone, setMeantone)}
      {source === 'well' && variantSelect('well_temperament', well, setWell)}
      {(source === 'pythagorean' || source === 'meantone') && (
        <label className="flex flex-col gap-1">
          <span className="label">Interval above root</span>
          <select className="input" value={spelling} onChange={(e) => setSpelling(e.target.value)}>
            {SPELLED_NOTES.map((n) => <option key={n.name} value={n.name}>{spelledInterval(n)}</option>)}
          </select>
        </label>
      )}
      {source === 'well' && (
        <label className="flex flex-col gap-1">
          <span className="label">Interval above root</span>
          <select className="input" value={note} onChange={(e) => setNote(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, k) => <option key={k} value={k}>{intervalBySemitones(k)}</option>)}
          </select>
        </label>
      )}
      {source === 'frequency' && <NumberField label="Frequency" suffix="Hz" value={hz} min={1} max={20000} step={0.01} onChange={setHz} />}

      <div className="mono border-t border-[var(--border-subtle)] pt-2 text-xs" aria-live="polite">
        {built == null || value == null ? (
          <span className="text-[var(--error)]">Enter a valid value</span>
        ) : (
          <span className="flex flex-col gap-0.5">
            <span className="break-all">{built}</span>
            <span className="text-[var(--text-secondary)]">
              {(1200 * Math.log2(value)).toFixed(1)}¢ · {(value * root.freq).toFixed(2)} Hz
            </span>
          </span>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={built == null} style={{ opacity: built == null ? 0.4 : 1 }}
          onClick={add}>Add</button>
      </div>
    </div>
  );
}
