import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useStore } from '../state/store';
import { filterPresets, SCALE_PRESETS, type ScalePreset } from '../tuning/scalePresets';

/**
 * The "Preset scale" menu: a button that opens a searchable list grouped by source. ↑ / ↓ move,
 * Enter loads, Esc closes; clicking outside closes too.
 */
export function ScalePicker() {
  const current = useStore((s) => s.scalePreset);
  const loadScalePreset = useStore((s) => s.loadScalePreset);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const results = useMemo(() => filterPresets(query), [query]);
  const groups = useMemo(() => {
    const out: { group: string; items: { preset: ScalePreset; index: number }[] }[] = [];
    results.forEach((preset, index) => {
      const last = out.at(-1);
      if (last?.group === preset.group) last.items.push({ preset, index });
      else out.push({ group: preset.group, items: [{ preset, index }] });
    });
    return out;
  }, [results]);
  const label = SCALE_PRESETS.find((p) => p.id === current)?.label ?? '—';

  // open on the current preset; close on an outside click
  useEffect(() => {
    if (!open) return;
    const i = results.findIndex((p) => p.id === current);
    setActive(i >= 0 ? i : 0);
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // keep the highlighted row in view
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const close = () => {
    setOpen(false);
    setQuery('');
    buttonRef.current?.focus(); // a focused button doesn't block note keys
  };
  const choose = (p: ScalePreset) => {
    loadScalePreset(p.id);
    close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  };

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <span className="label">Preset scale</span>
      <button ref={buttonRef} type="button" className="input flex min-w-[220px] items-center justify-between gap-3 text-left"
        aria-label={`Preset scale: ${label === '—' ? 'none' : label}`}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}>
        <span className="truncate">{label}</span>
        <span className="label" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="panel absolute left-0 top-full z-30 mt-1 flex w-[min(340px,calc(100vw-32px))] flex-col"
          style={{ borderColor: 'var(--border)' }}>
          <input className="input m-2 mb-1" autoFocus placeholder={`Search ${SCALE_PRESETS.length} scales…`} value={query}
            aria-label="Search scales" aria-controls={listId} aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKey} />
          <div ref={listRef} id={listId} role="listbox" aria-label="Scale presets" className="max-h-[min(60vh,420px)] overflow-y-auto pb-2">
            {groups.length === 0 && <p className="label px-3 py-2 normal-case tracking-normal">No scales match.</p>}
            {groups.map((g) => (
              <div key={g.group} role="group" aria-label={g.group}>
                <div className="label sticky top-0 bg-[var(--bg-raised)] px-3 pb-1 pt-2">{g.group}</div>
                {g.items.map(({ preset, index }) => (
                  <div key={preset.id} id={`${listId}-${preset.id}`} role="option" data-index={index}
                    aria-selected={preset.id === current}
                    className="flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1 text-sm"
                    style={{
                      background: index === active ? 'var(--accent)' : undefined,
                      color: index === active ? 'var(--bg)' : undefined,
                    }}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(e) => e.preventDefault() /* keep focus in the search box */}
                    onClick={() => choose(preset)}>
                    <span className="truncate">{preset.id === current ? '✓ ' : ''}{preset.label}</span>
                    <span className="mono shrink-0 text-xs opacity-70">{preset.notes.length}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
