import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { nearestSlot, previewIndex, type SlotRect } from './reorder';
import { useStore } from '../state/store';
import { evalRatio, degreeFreq, isPure, splitCents, joinCents } from '../tuning/ratios';
import { NumberField } from './ui';
import { AddDegreePopover } from './AddDegreePopover';
import { degreeColor } from '../theme';
import { useResolvedTheme } from '../hooks/useTheme';
import { playDegree, stopDegree } from '../audio/play';
import { engine } from '../audio/engine';

interface GripHandlers {
  down(i: number, e: RPointerEvent): void;
  move(e: RPointerEvent): void;
  up(): void;
  cancel(): void;
  key(i: number, e: KeyboardEvent<HTMLButtonElement>): void;
}

function DegreeCard({ i, dragStyle, grip }: { i: number; dragStyle: CSSProperties; grip: GripHandlers }) {
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
      data-degree={i}
      className="relative flex cursor-pointer select-none flex-col gap-2 border p-3"
      style={{
        borderColor: held ? degreeColor(i, dark) : 'var(--border-subtle)',
        background: held ? degreeColor(i, dark, 0.25) : 'var(--bg-raised)',
        touchAction: 'manipulation',
        ...dragStyle,
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
      {i > 0 && (
        <button type="button" className="absolute right-0.5 top-0.5 border-0 bg-transparent px-1 leading-none text-[var(--text-muted)] hover:text-[var(--text)]"
          title="Delete degree" aria-label={`Delete pitch ${i + 1}`} onClick={() => deleteDegree(i)}>×</button>
      )}
      <div className="flex items-center justify-between gap-1 pr-3">
        {/* the number is the drag handle: drag to move this pitch; ← / → move it with the keyboard */}
        <button type="button" className="mono cursor-grab border-0 px-2 py-0.5 text-sm"
          style={{ background: degreeColor(i, dark), color: '#111', touchAction: 'none' }}
          title="Drag to move (or ← / →)" aria-label={`Move pitch ${i + 1}`}
          onPointerDown={(e) => grip.down(i, e)}
          onPointerMove={grip.move}
          onPointerUp={grip.up}
          onPointerCancel={grip.cancel}
          onKeyDown={(e) => grip.key(i, e)}>{i + 1}</button>
        {i > 0 && isPure(note) && <span className="label italic">pure</span>}
        <div className="flex items-center gap-0.5">
          <button type="button" className="btn px-1 py-0.5" aria-pressed={shown} aria-label="Show in visualizer" title="Show in visualizer"
            style={{ color: shown ? 'var(--text)' : 'var(--text-muted)' }} onClick={() => toggleShown(i)}>~</button>
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
  const { moveDegree } = useStore.getState();
  // live drag: which card, the slot it would drop into, and how far the pointer has moved
  const [drag, setDrag] = useState<{ from: number; over: number; dx: number; dy: number } | null>(null);
  const slots = useRef<SlotRect[]>([]);
  const start = useRef({ x: 0, y: 0 });
  const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const measure = () =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-degree]'), (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
  /** Slide the card now at `index` from an offset back into place. */
  const settle = (index: number, x: number, y: number) => {
    if (reduceMotion() || (x === 0 && y === 0)) return;
    requestAnimationFrame(() => {
      document.querySelector(`[data-degree="${index}"]`)?.animate(
        [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }],
        { duration: 180, easing: 'cubic-bezier(.2, .8, .2, 1)' },
      );
    });
  };

  const grip: GripHandlers = {
    down: (i, e) => {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already released (e.g. synthetic events): moves still reach the grip */
      }
      slots.current = measure();
      start.current = { x: e.clientX, y: e.clientY };
      setDrag({ from: i, over: i, dx: 0, dy: 0 });
    },
    move: (e) => {
      if (!drag) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      const s0 = slots.current[drag.from];
      const over = nearestSlot(slots.current, s0.left + s0.width / 2 + dx, s0.top + s0.height / 2 + dy);
      setDrag({ ...drag, over, dx, dy });
    },
    up: () => {
      if (!drag) return;
      const { from, over, dx, dy } = drag;
      setDrag(null);
      if (over !== from) moveDegree(from, over);
      // the card lands where it was dropped, then glides into its slot
      const a = slots.current[from];
      const b = slots.current[over];
      settle(over, a.left + dx - b.left, a.top + dy - b.top);
    },
    cancel: () => {
      if (drag) settle(drag.from, drag.dx, drag.dy);
      setDrag(null);
    },
    key: (i, e) => {
      const to = e.key === 'ArrowLeft' ? i - 1 : e.key === 'ArrowRight' ? i + 1 : null;
      if (to == null || to < 0 || to >= count) return;
      e.preventDefault();
      const r = measure();
      moveDegree(i, to);
      // the two cards slide past each other
      settle(to, r[i].left - r[to].left, r[i].top - r[to].top);
      settle(i, r[to].left - r[i].left, r[to].top - r[i].top);
      requestAnimationFrame(() => (document.querySelector(`[data-degree="${to}"] button[aria-label^="Move"]`) as HTMLElement | null)?.focus());
    },
  };

  /** Per-card transform while dragging: the dragged card follows the pointer; the others slide aside. */
  const dragStyle = (j: number): CSSProperties => {
    if (!drag) return {};
    if (j === drag.from) {
      return { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 10, borderColor: 'var(--accent)', cursor: 'grabbing' };
    }
    const p = previewIndex(j, drag.from, drag.over);
    const a = slots.current[j];
    const b = slots.current[p];
    return {
      transform: `translate(${b.left - a.left}px, ${b.top - a.top}px)`,
      transition: reduceMotion() ? undefined : 'transform 160ms cubic-bezier(.2, .8, .2, 1)',
    };
  };
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="display m-0 text-xl">Pitch Collection</h2>
        <span className="label">press a card or key to play · drag a number to reorder</span>
      </div>
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: count }, (_, i) => <DegreeCard key={i} i={i} dragStyle={dragStyle(i)} grip={grip} />)}
        <div className="relative" data-popover>
          <button type="button" className="btn h-full min-h-24 w-full text-lg" onClick={() => setAdding(true)}>+</button>
          {adding && <AddDegreePopover after={count - 1} onClose={() => setAdding(false)} />}
        </div>
      </div>
    </section>
  );
}
