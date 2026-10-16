import { useState } from 'react';
import { useStore } from '../state/store';

const RANGES = [100, 200, 1200];

/**
 * Pitch bend for live notes (held by key or pointer; shift-sustained notes stay put). Like a pitch
 * wheel it springs back to 0 when released.
 */
export function PitchBend() {
  const bend = useStore((s) => s.bend);
  const setBend = useStore((s) => s.setBend);
  const [range, setRange] = useState(200);
  const release = () => setBend(0);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="label">Pitch bend</span>
      <input type="range" className="min-w-0 max-w-md flex-1" min={-range} max={range} step={1} value={bend}
        aria-label="Pitch bend (cents)" aria-valuetext={`${bend > 0 ? '+' : ''}${bend} cents`}
        onChange={(e) => setBend(Number(e.target.value))}
        onPointerUp={release} onPointerCancel={release} onKeyUp={release} onBlur={release} />
      <span className="mono w-16 text-sm">{bend > 0 ? '+' : ''}{bend}¢</span>
      <label className="flex items-center gap-1">
        <span className="label">Range</span>
        <select className="input py-0.5 text-sm" value={range} onChange={(e) => { setRange(Number(e.target.value)); release(); e.currentTarget.blur(); /* note keys resume */ }}>
          {RANGES.map((r) => <option key={r} value={r}>±{r / 100} st</option>)}
        </select>
      </label>
    </div>
  );
}
