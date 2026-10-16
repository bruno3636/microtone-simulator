import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { nearestSlot, previewIndex, type SlotRect } from './reorder';
import { useStore } from '../state/store';
import { evalRatio, degreeFreq, splitCents, joinCents, setCents, parseEdo, edoExpr, splitLabel } from '../tuning/ratios';
import { NumberField } from './ui';
import { AddDegreePopover } from './AddDegreePopover';
import { degreeColor } from '../theme';
import { useResolvedTheme } from '../hooks/useTheme';
import { playDegree, stopDegree, toggleLatch } from '../audio/play';
import { keysForDegree } from '../tuning/keymaps';
import { alternativesFor } from '../tuning/degreeInput';
import { sourceBadge } from '../tuning/sourceBadge';
import { convertSource, SOURCE_TARGETS, targetKey } from '../tuning/convertSource';
import { octaveOf, shiftOctave } from '../tuning/octave';
import { PitchBend } from './PitchBend';
import { useFinePointer } from '../hooks/useFinePointer';
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
  const { setNote, deleteDegree } = useStore.getState();
  const latched = useStore((s) => s.latched.includes(i));
  const keymap = useStore((s) => s.keymaps[s.keymap]);
  const finePointer = useFinePointer();
  const keys = finePointer && keymap ? keysForDegree(keymap, i, notes.length) : [];
  const pointers = useRef(new Set<number>());
  const valid = evalRatio(note) != null;
  // every note can carry a cents offset ("5/4 -13.7c", "2^(7/12) +3c"): the value and the offset
  // are edited separately
  const { ratio, cents } = splitCents(note);
  // notes picked by name (Pythagorean, meantone, well temperament) show their interval name in place
  // of the ratio, as a picker over the other intervals of the same tuning
  const { tag, body } = splitLabel(note);
  // 12EDO / Custom EDO: edit the step number instead of the ratio expression
  const tuning = useStore((s) => s.tuning);
  const edo = useStore((s) => s.edo);
  const edoTuning = tuning === 'edo12' || tuning === 'custom_edo';
  // any note written as an EDO step shows Step k / N (N from the note), whatever the tuning —
  // e.g. a 12EDO step inserted into a just-intonation collection; the root "1" counts as step 0
  // only in an EDO tuning (the cents offset is ignored here)
  const parsed = parseEdo(ratio) ?? (edoTuning && ratio.trim() === '1' ? { step: 0, divisions: tuning === 'edo12' ? 12 : edo } : null);
  const step = parsed?.step ?? null;
  const divisions = parsed?.divisions ?? null;
  const hz = degreeFreq(notes, i, rootHz);
  const ratioValue = evalRatio(note);
  const centsAboveRoot = ratioValue == null ? null : 1200 * Math.log2(ratioValue);
  const badge = sourceBadge(note, tuning, edo);
  // the badge opens a menu of every source; picking one moves the pitch to that source's nearest note
  const targets = SOURCE_TARGETS(edo, divisions ?? undefined);
  const octave = octaveOf(note);
  const shiftOct = (k: number) =>
    setNote(i, step != null && divisions != null ? setCents(edoExpr(step + k * divisions, divisions), cents ?? 0) : shiftOctave(note, k));

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
        // sustained (shift-clicked) cards get a heavier border; an inset outline keeps the size fixed
        outline: latched ? `2px solid ${degreeColor(i, dark)}` : undefined,
        outlineOffset: latched ? -2 : undefined,
        background: held ? degreeColor(i, dark, 0.25) : 'var(--bg-raised)',
        touchAction: 'manipulation',
        ...dragStyle,
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('input,button,select,[data-popover]')) return;
        engine.resume();
        // shift-click sustains; clicking a sustained card (with or without shift) releases it
        if (e.shiftKey || latched) {
          toggleLatch(i);
          return;
        }
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
      <div className="flex items-center gap-1 pr-3">
        <div className="flex min-w-0 items-center gap-1">
        {/* the number is the drag handle: drag to move this pitch; ← / → move it with the keyboard */}
        {/* shows the key(s) that play this pitch on computers, else the pitch number */}
        <button type="button"
          className={`mono w-10 shrink-0 cursor-grab border-0 px-0 py-0.5 text-center ${keys.join('').length > 2 ? 'text-xs' : 'text-sm'}`}
          style={{ background: degreeColor(i, dark), color: '#111', touchAction: 'none' }}
          title={`Pitch ${i + 1}${keys.length ? ` · key ${keys.join(', ')}` : ''} — drag to move (or ← / →)`}
          aria-label={`Move pitch ${i + 1}${keys.length ? ` (key ${keys.join(', ')})` : ''}`}
          onPointerDown={(e) => grip.down(i, e)}
          onPointerMove={grip.move}
          onPointerUp={grip.up}
          onPointerCancel={grip.cancel}
          onKeyDown={(e) => grip.key(i, e)}>{keys.length ? keys.join('') : i + 1}</button>
          <label className="relative ml-1 flex shrink-0 items-center" title="Change source">
            <span className="sr-only">Source of pitch {i + 1}</span>
            <select className="label cursor-pointer appearance-none border-0 bg-transparent py-0 pl-0 pr-3 text-sm normal-case tracking-normal hover:text-[var(--text)]"
              style={{ fieldSizing: 'content' } as CSSProperties}
              value={badge} onChange={(e) => {
                const t = targets.find((x) => targetKey(x) === e.target.value);
                if (t) setNote(i, convertSource(note, t));
              }}>
              {!targets.some((t) => targetKey(t) === badge) && <option value={badge}>{badge}</option>}
              {targets.map((t) => <option key={targetKey(t)} value={targetKey(t)}>{targetKey(t)}</option>)}
            </select>
            <span className="label pointer-events-none absolute right-0 text-[9px]" aria-hidden>▾</span>
          </label>
        </div>
      </div>
      {tag ? (
        // the interval name stands in for the ratio: pick another to move this pitch within its tuning
        <select className="input w-full min-w-0 text-sm" value={tag.pos} aria-label={`Interval of pitch ${i + 1}`}
          onChange={(e) => {
            const alt = alternativesFor(tag).find((a) => a.pos === Number(e.target.value));
            if (alt) setNote(i, setCents(shiftOctave(alt.note, octave), cents ?? 0)); // keeps octave and offset
          }}>
          {alternativesFor(tag).map((a) => <option key={a.pos} value={a.pos}>{a.name}</option>)}
        </select>
      ) : step != null && divisions != null ? (
        <div className="flex items-center justify-between gap-2">
          <span className="label">Step</span>
          <NumberField hideLabel label="EDO step" value={step} min={-999} max={999} suffix={`/ ${divisions}`}
            onChange={(k) => setNote(i, setCents(edoExpr(Math.round(k), divisions), cents ?? 0))} />
        </div>
      ) : (
        <label className="flex items-center gap-2">
          <span className="label">Ratio</span>
          {/* editing a named note's ratio drops its name tag: it becomes a plain ratio */}
          <input className="input mono w-full text-right" value={cents == null ? body : ratio} aria-invalid={!valid}
            onChange={(e) => setNote(i, cents == null ? e.target.value : joinCents(e.target.value, cents))} />
        </label>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-1">
        <span className="label">Cents</span>
        <span className="ml-auto flex min-w-0 items-center gap-1">
          {/* every source: the offset sits beside the total it produces (0 = no offset) */}
          <span className="label" aria-hidden>±</span>
          <NumberField hideLabel label="Cents offset" value={cents ?? 0} min={-1200} max={1200} step={0.1} arrowStep={1}
            onChange={(c) => setNote(i, setCents(note, c))} />
          <span className="mono text-xs">{centsAboveRoot == null ? '—' : `${centsAboveRoot.toFixed(1)}¢`}</span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="label">Octave</span>
        <span className="flex items-center gap-1">
          <button type="button" className="btn px-1.5 py-0 leading-tight" aria-label={`Pitch ${i + 1} down an octave`} title="Down an octave"
            onClick={() => shiftOct(-1)}>−</button>
          <span className="mono w-6 text-center text-sm">{octave > 0 ? `+${octave}` : octave}</span>
          <button type="button" className="btn px-1.5 py-0 leading-tight" aria-label={`Pitch ${i + 1} up an octave`} title="Up an octave"
            onClick={() => shiftOct(1)}>+</button>
        </span>
      </div>
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
        <span className="label">press a card or key to play · shift-click to sustain · drag a number to reorder</span>
      </div>
      <PitchBend />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 min-[880px]:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: count }, (_, i) => <DegreeCard key={i} i={i} dragStyle={dragStyle(i)} grip={grip} />)}
        <div className="relative" data-popover>
          <button type="button" className="btn h-full min-h-24 w-full text-lg" onClick={() => setAdding(true)}>+</button>
          {adding && <AddDegreePopover after={count - 1} onClose={() => setAdding(false)} />}
        </div>
      </div>
    </section>
  );
}
