import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useStore } from '../state/store';
import { TUNINGS, TUNING_ORDER, SCALES, tuningNotes } from '../tuning/presets';
import { evalRatio, degreeFreq, isPure, splitCents, joinCents } from '../tuning/ratios';
import { NumberField } from './ui';
import { degreeColor } from '../theme';
import { useResolvedTheme } from '../hooks/useTheme';
import { playDegree, stopDegree } from '../audio/play';
import { engine } from '../audio/engine';

function AddDegreePopover({ after, onClose }: { after: number; onClose(): void }) {
  const insertDegree = useStore((s) => s.insertDegree);
  const [tuning, setTuning] = useState('just_intonation');
  const [variant, setVariant] = useState('');
  const [scale, setScale] = useState('major');
  const edo = useStore((s) => s.edo);
  const [degree, setDegree] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose]);
  const t = TUNINGS[tuning];
  const all = tuningNotes(tuning, variant, edo);
  // indexes (1-based) into the tuning's notes: the scale template for 12-note tunings, else every note
  const degrees = t.scalable ? SCALES[scale].filter((n) => n <= all.length) : all.map((_, k) => k + 1);
  return (
    <div ref={ref} className="panel fixed inset-x-4 top-24 z-20 flex flex-col gap-3 p-3 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:w-64"
      style={{ borderColor: 'var(--border)' }}>
      <span className="label">Insert degree from preset</span>
      <select className="input" value={tuning} onChange={(e) => { setTuning(e.target.value); setVariant(''); setDegree(0); }}>
        {TUNING_ORDER.map((k) => <option key={k} value={k}>{TUNINGS[k].label}</option>)}
      </select>
      {t.variants && (
        <select className="input" value={variant || t.defaultVariant} onChange={(e) => { setVariant(e.target.value); setDegree(0); }}>
          {Object.entries(t.variants).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      )}
      {t.scalable && (
        <select className="input" value={scale} onChange={(e) => { setScale(e.target.value); setDegree(0); }}>
          {Object.keys(SCALES).map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      )}
      <select className="input" value={degree} onChange={(e) => setDegree(Number(e.target.value))}>
        {degrees.map((n, i) => <option key={i} value={i}>{i + 1} — {all[n - 1]}</option>)}
      </select>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary"
          onClick={() => { insertDegree(after, all[degrees[degree] - 1]); onClose(); }}>Add</button>
      </div>
    </div>
  );
}

function DegreeCard({ i }: { i: number }) {
  const dark = useResolvedTheme() === 'dark';
  const note = useStore((s) => s.notes[i]);
  const notes = useStore((s) => s.notes);
  const rootHz = useStore((s) => s.root.freq);
  const held = useStore((s) => s.held.some((d) => ((d % s.notes.length) + s.notes.length) % s.notes.length === i));
  const shown = useStore((s) => s.shown.includes(i));
  const { setNote, deleteDegree, toggleShown } = useStore.getState();
  const [adding, setAdding] = useState(false);
  const pointers = useRef(new Set<number>());
  const valid = evalRatio(note) != null;
  // tempered JI degrees carry a cents offset ("5/4 -13.7c"): edit the ratio and the offset separately
  const { ratio, cents } = splitCents(note);
  const hz = degreeFreq(notes, i, rootHz);

  const release = (e: RPointerEvent) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size === 0) stopDegree(i);
  };

  return (
    <div
      className="relative flex cursor-pointer select-none flex-col gap-2 border p-3"
      style={{
        borderColor: held ? degreeColor(i, dark) : 'var(--border-subtle)',
        background: held ? degreeColor(i, dark, 0.25) : 'var(--bg-raised)',
        touchAction: 'manipulation',
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('input,button,select,[data-popover]')) return;
        engine.resume();
        if (pointers.current.size === 0) playDegree(i);
        pointers.current.add(e.pointerId);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="mono px-2 py-0.5 text-sm" style={{ background: degreeColor(i, dark), color: '#111' }}>{i + 1}</span>
        {i > 0 && isPure(note) && <span className="label italic">pure</span>}
        <div className="flex items-center gap-1">
          <button type="button" className="btn px-1.5 py-0.5" aria-pressed={shown} aria-label="Show in visualizer" title="Show in visualizer"
            style={{ color: shown ? 'var(--text)' : 'var(--text-muted)' }} onClick={() => toggleShown(i)}>~</button>
          {i > 0 && (
            <button type="button" className="btn px-1.5 py-0.5" title="Delete degree" onClick={() => deleteDegree(i)}>×</button>
          )}
          <div className="relative" data-popover>
            <button type="button" className="btn px-1.5 py-0.5" title="Insert degree after" onClick={() => setAdding(true)}>+</button>
            {adding && <AddDegreePopover after={i} onClose={() => setAdding(false)} />}
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2">
        <span className="label">Ratio</span>
        <input className="input mono w-full text-right" value={cents == null ? note : ratio} aria-invalid={!valid}
          onChange={(e) => setNote(i, cents == null ? e.target.value : joinCents(e.target.value, cents))} />
      </label>
      {cents != null && (
        <NumberField label="± cents" value={cents} min={-1200} max={1200} step={0.1}
          onChange={(c) => setNote(i, joinCents(ratio, c))} />
      )}
      <div className="flex justify-between">
        <span className="label">Freq</span>
        <span className="mono text-sm">{hz == null ? '—' : `${hz.toFixed(2)} Hz`}</span>
      </div>
    </div>
  );
}

export function DegreeGrid() {
  const count = useStore((s) => s.notes.length);
  const [adding, setAdding] = useState(false);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="display m-0 text-xl">Scale degrees</h2>
        <span className="label">press a card or key to play</span>
      </div>
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: count }, (_, i) => <DegreeCard key={i} i={i} />)}
        <div className="relative" data-popover>
          <button type="button" className="btn h-full min-h-24 w-full text-lg" onClick={() => setAdding(true)}>+</button>
          {adding && <AddDegreePopover after={count - 1} onClose={() => setAdding(false)} />}
        </div>
      </div>
    </section>
  );
}
