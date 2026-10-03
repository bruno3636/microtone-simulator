import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useStore } from '../state/store';
import { evalRatio, degreeFreq, isPure, splitCents, joinCents } from '../tuning/ratios';
import { NumberField } from './ui';
import { AddDegreePopover } from './AddDegreePopover';
import { degreeColor } from '../theme';
import { useResolvedTheme } from '../hooks/useTheme';
import { playDegree, stopDegree } from '../audio/play';
import { engine } from '../audio/engine';

interface DragState { from: number; over: number }

/** Index of the pitch card under a screen point, or null. */
function cardAt(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y)?.closest('[data-degree]');
  return el ? Number(el.getAttribute('data-degree')) : null;
}

function DegreeCard({ i, drag, setDrag }: { i: number; drag: DragState | null; setDrag(d: DragState | null): void }) {
  const dark = useResolvedTheme() === 'dark';
  const note = useStore((s) => s.notes[i]);
  const notes = useStore((s) => s.notes);
  const rootHz = useStore((s) => s.root.freq);
  const held = useStore((s) => s.held.some((d) => ((d % s.notes.length) + s.notes.length) % s.notes.length === i));
  const shown = useStore((s) => s.shown.includes(i));
  const { setNote, deleteDegree, toggleShown, moveDegree } = useStore.getState();
  const count = useStore((s) => s.notes.length);
  const dragging = drag?.from === i;
  const target = drag != null && drag.over === i && drag.from !== i;
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
      data-degree={i}
      className="relative flex cursor-pointer select-none flex-col gap-2 border p-3"
      style={{
        borderColor: target ? 'var(--accent)' : held ? degreeColor(i, dark) : 'var(--border-subtle)',
        borderStyle: target ? 'dashed' : 'solid',
        background: held ? degreeColor(i, dark, 0.25) : 'var(--bg-raised)',
        opacity: dragging ? 0.4 : 1,
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
      {/* drag grip: drag to move this pitch; ← / → move it with the keyboard */}
      <button type="button" className="absolute right-0.5 top-0.5 cursor-grab border-0 bg-transparent px-1 leading-none text-[var(--text-muted)]"
        style={{ touchAction: 'none' }} title="Drag to move (or ← / →)" aria-label={`Move pitch ${i + 1}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag({ from: i, over: i });
        }}
        onPointerMove={(e) => {
          if (!drag || drag.from !== i) return;
          const over = cardAt(e.clientX, e.clientY);
          if (over != null && over !== drag.over) setDrag({ from: i, over });
        }}
        onPointerUp={() => {
          if (drag && drag.from === i && drag.over !== i) moveDegree(i, drag.over);
          setDrag(null);
        }}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={(e) => {
          const to = e.key === 'ArrowLeft' ? i - 1 : e.key === 'ArrowRight' ? i + 1 : null;
          if (to == null || to < 0 || to >= count) return;
          e.preventDefault();
          moveDegree(i, to);
          // keep focus on the moved pitch's grip
          requestAnimationFrame(() => (document.querySelector(`[data-degree="${to}"] button[aria-label^="Move"]`) as HTMLElement | null)?.focus());
        }}>⠿</button>
      <div className="flex items-center justify-between gap-1 pr-3">
        <span className="mono px-2 py-0.5 text-sm" style={{ background: degreeColor(i, dark), color: '#111' }}>{i + 1}</span>
        {i > 0 && isPure(note) && <span className="label italic">pure</span>}
        <div className="flex items-center gap-0.5">
          <button type="button" className="btn px-1 py-0.5" aria-pressed={shown} aria-label="Show in visualizer" title="Show in visualizer"
            style={{ color: shown ? 'var(--text)' : 'var(--text-muted)' }} onClick={() => toggleShown(i)}>~</button>
          {i > 0 && (
            <button type="button" className="btn px-1 py-0.5" title="Delete degree" onClick={() => deleteDegree(i)}>×</button>
          )}
          <div className="relative" data-popover>
            <button type="button" className="btn px-1 py-0.5" title="Insert degree after" onClick={() => setAdding(true)}>+</button>
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
  const [drag, setDrag] = useState<DragState | null>(null);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="display m-0 text-xl">Pitch Collection</h2>
        <span className="label">press a card or key to play · drag ⠿ to reorder</span>
      </div>
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: count }, (_, i) => <DegreeCard key={i} i={i} drag={drag} setDrag={setDrag} />)}
        <div className="relative" data-popover>
          <button type="button" className="btn h-full min-h-24 w-full text-lg" onClick={() => setAdding(true)}>+</button>
          {adding && <AddDegreePopover after={count - 1} onClose={() => setAdding(false)} />}
        </div>
      </div>
    </section>
  );
}
