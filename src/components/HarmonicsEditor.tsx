import { useRef, type PointerEvent as RPointerEvent } from 'react';
import { useStore } from '../state/store';
import { computeAmplitudes, MAX_HARMONICS, type HarmonicFilter } from '../audio/harmonics';
import { NumberField, Segmented, Slider } from './ui';

const fmtCurve = (c: number) => (Math.abs(c) < 0.005 ? 'LIN' : c > 0 ? `EXP ${c.toFixed(2)}` : `LOG ${(-c).toFixed(2)}`);

export function HarmonicsEditor() {
  const h = useStore((s) => s.harmonics);
  const { setHarmonics, setTweak, resetTweaks } = useStore.getState();
  const amps = computeAmplitudes(h);
  const count = amps.length;
  const svgRef = useRef<SVGSVGElement>(null);
  const last = useRef<number | null>(null);

  const hit = (e: RPointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const n = Math.min(count, Math.max(1, Math.floor(((e.clientX - r.left) / r.width) * count) + 1));
    const level = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    return { n, level };
  };

  const paint = (e: RPointerEvent) => {
    const { n, level } = hit(e);
    const from = last.current ?? n;
    const [lo, hi] = from < n ? [from, n] : [n, from];
    for (let k = lo; k <= hi; k++) setTweak(k, level); // fill bars skipped by a fast drag
    last.current = n;
  };

  const hasTweaks = Object.keys(h.tweaks).some((k) => Number(k) <= count);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h3 className="display m-0 text-lg">Harmonics</h3>
        <button type="button" className="btn" disabled={!hasTweaks} onClick={resetTweaks}
          style={{ opacity: hasTweaks ? 1 : 0.4 }}>Reset tweaks</button>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <NumberField label="Count" value={h.count} min={1} max={MAX_HARMONICS}
          onChange={(v) => setHarmonics({ count: Math.round(v) })} />
        <Slider label="Start" value={h.start} min={0} max={1} step={0.01} format={(v) => v.toFixed(2)}
          onChange={(v) => setHarmonics({ start: v })} />
        <Slider label="End" value={h.end} min={0} max={1} step={0.01} format={(v) => v.toFixed(2)}
          onChange={(v) => setHarmonics({ end: v })} />
        <Slider label="Curve  log · lin · exp" value={h.curve} min={-1} max={1} step={0.01} format={fmtCurve}
          onChange={(v) => setHarmonics({ curve: Math.abs(v) < 0.03 ? 0 : v })} />
        <Segmented<HarmonicFilter> label="Harmonic filter" value={h.filter} onChange={(filter) => setHarmonics({ filter })}
          options={[{ value: 'all', label: 'All' }, { value: 'odd', label: 'Odd' }, { value: 'even', label: 'Even' }]} />
      </div>
      <div className="overflow-x-auto">
        <svg ref={svgRef} viewBox={`0 0 ${count} 1`} preserveAspectRatio="none"
          className="block h-36 w-full cursor-ns-resize border border-[var(--border-subtle)]"
          style={{ minWidth: count * 4, touchAction: 'none' }}
          role="img" aria-label="Harmonic levels. Drag bars to tweak, double-click to reset a bar."
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); last.current = null; paint(e); }}
          onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) paint(e); }}
          onPointerUp={() => { last.current = null; }}
          onDoubleClick={(e) => setTweak(hit(e as unknown as RPointerEvent).n, null)}>
          {amps.map((a, i) => {
            const tweaked = h.tweaks[i + 1] != null;
            const pad = count > 32 ? 0.1 : 0.15;
            return (
              <g key={i}>
                <rect x={i + pad} y={1 - a} width={1 - 2 * pad} height={a}
                  fill="var(--accent)" opacity={tweaked ? 0.35 : 0.9} />
                {tweaked && (
                  <rect x={i + pad} y={1 - a} width={1 - 2 * pad} height={a} fill="none"
                    stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                )}
              </g>
            );
          })}
        </svg>
        <div className="mono mt-1 flex justify-between text-[10px] text-[var(--text-muted)]" style={{ minWidth: count * 4 }}>
          <span>1</span>
          {count > 2 && <span>{Math.ceil(count / 2)}</span>}
          {count > 1 && <span>{count}</span>}
        </div>
      </div>
    </div>
  );
}
