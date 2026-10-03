import { useEffect, useState, type ReactNode } from 'react';

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange(v: T): void; label?: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value}
          data-active={o.value === value} className="seg-item" onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step: number; onChange(v: number): void; format?(v: number): string;
}) {
  return (
    <label className="flex min-w-[140px] flex-col gap-1">
      <span className="label flex justify-between gap-2">
        <span>{label}</span>
        <span className="mono normal-case tracking-normal">{format ? format(value) : value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/** Text-backed number input: keeps the user's typing, commits only valid in-range numbers. */
export function NumberField({ label, value, min, max, step = 1, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange(v: number): void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const invalid = text.trim() === '' || Number.isNaN(Number(text)) || Number(text) < min || Number(text) > max;
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <span className="flex items-center gap-1">
        <input className="input mono w-20" inputMode="decimal" value={text} aria-invalid={invalid}
          step={step}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value.trim() !== '' && !Number.isNaN(n) && n >= min && n <= max) onChange(n);
          }}
          onBlur={() => setText(String(value))} />
        {suffix && <span className="label">{suffix}</span>}
      </span>
    </label>
  );
}

export function Section({ title, open, onToggle, children, right }: {
  title: string; open: boolean; onToggle(): void; children: ReactNode; right?: ReactNode;
}) {
  return (
    <section className="border-t border-[var(--border-subtle)] pt-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <button type="button" className="flex items-center gap-2 bg-transparent p-0 text-[var(--text)]"
          aria-expanded={open} onClick={onToggle}>
          <span className="label w-3">{open ? '▾' : '▸'}</span>
          <h2 className="display m-0 text-xl">{title}</h2>
        </button>
        {right}
      </div>
      {open && children}
    </section>
  );
}
