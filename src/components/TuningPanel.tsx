import { useRef, type ChangeEvent } from 'react';
import { useStore } from '../state/store';
import { TUNINGS, TUNING_ORDER, SCALES, NOTE_NAMES } from '../tuning/presets';
import { NumberField } from './ui';

export function TuningPanel() {
  const s = useStore();
  const tuning = TUNINGS[s.tuning] ?? TUNINGS.just_intonation;
  const canScale = tuning.scalable;
  // After a pointer-driven change, blur the select so note keys keep working (keyboard users keep focus).
  const pointer = useRef(false);
  const pick = (apply: (v: string) => void) => (e: ChangeEvent<HTMLSelectElement>) => {
    apply(e.target.value);
    if (pointer.current) e.currentTarget.blur();
    pointer.current = false;
  };
  const sel = { className: 'input', onPointerDown: () => { pointer.current = true; }, onKeyDown: () => { pointer.current = false; } };
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex flex-col gap-1">
        <span className="label">Tuning</span>
        <select {...sel} value={s.tuning} onChange={pick((v) => s.applyTemplate(v, s.scale))}>
          {TUNING_ORDER.map((k) => <option key={k} value={k}>{TUNINGS[k].label}</option>)}
        </select>
      </label>
      {tuning.variants && (
        <label className="flex flex-col gap-1">
          <span className="label">Variant</span>
          <select {...sel} value={s.tuningVariant || tuning.defaultVariant} onChange={pick(s.setTuningVariant)}>
            {Object.entries(tuning.variants).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
      )}
      {tuning.edo && (
        <NumberField label="Divisions / octave" value={s.edo} min={1} max={96} onChange={s.setEdo} />
      )}
      <label className="flex flex-col gap-1">
        <span className="label">Scale</span>
        <select {...sel} value={s.scale} onChange={pick((v) => s.applyTemplate(s.tuning, v))}>
          {Object.keys(SCALES).map((k) => (
            <option key={k} value={k} disabled={!canScale && k !== 'chromatic'}>{k}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Root</span>
        <select {...sel} value={s.root.note} onChange={pick(s.setRootNote)}>
          {NOTE_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
          <option value="">—</option>
        </select>
      </label>
      <NumberField label="Root Hz" value={Number(s.root.freq.toFixed(3))} min={20} max={5000} step={0.01}
        suffix="Hz" onChange={s.setRootFreq} />
      <label className="flex flex-col gap-1">
        <span className="label">Keyboard</span>
        <select {...sel} value={s.keymap} onChange={pick(s.setKeymap)}>
          {Object.keys(s.keymaps).map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={s.resetNotes}>Reset</button>
        <button type="button" className="btn" onClick={s.clearNotes}>Clear</button>
      </div>
    </div>
  );
}
