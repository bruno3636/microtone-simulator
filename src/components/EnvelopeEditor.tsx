import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useStore } from '../state/store';
import { curveForMidpoint, shapeCurve } from '../audio/curves';
import type { EnvelopeSettings } from '../audio/envelope';
import { engine, type VoiceSnapshot } from '../audio/engine';
import { degreeColor } from '../theme';
import { useResolvedTheme } from '../hooks/useTheme';
import { NumberField, fmtCurve } from './ui';
import { H, IH, PAD, W, dotX, geometry, scaleFor, yOf } from './envelopeGeometry';

const MAX = { attack: 5000, decay: 5000, release: 10000 };
/** curve amounts this close to 0 snap to a straight line */
const LINEAR_SNAP = 0.05;

type TimeHandle = 'attack' | 'decay' | 'release';
type CurveKey = 'attackCurve' | 'decayCurve' | 'releaseCurve';
type Handle = TimeHandle | CurveKey;

interface Segment { key: CurveKey; label: string; xa: number; xb: number; la: number; lb: number }

function segPath(s: Segment, curve: number) {
  let d = '';
  for (let i = 1; i <= 32; i++) {
    const t = i / 32;
    d += ` L ${s.xa + (s.xb - s.xa) * t} ${yOf(shapeCurve(s.la, s.lb, t, curve))}`;
  }
  return d;
}

const levelAtY = (y: number) => Math.min(1, Math.max(0, 1 - (y - PAD) / IH));

export function EnvelopeEditor() {
  const dark = useResolvedTheme() === 'dark';
  const env = useStore((s) => s.envelope);
  const len = useStore((s) => s.notes.length);
  const setEnvelope = useStore((s) => s.setEnvelope);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ handle: Handle; k: number } | null>(null);
  const [voices, setVoices] = useState<VoiceSnapshot[]>([]);
  const [dragging, setDragging] = useState(false); // re-renders when a drag ends so the scale unfreezes

  const k = dragging && drag.current ? drag.current.k : scaleFor(env);
  const g = geometry(env, k);
  const segments: Segment[] = [
    { key: 'attackCurve', label: 'Attack', xa: g.x0, xb: g.x1, la: 0, lb: 1 },
    { key: 'decayCurve', label: 'Decay', xa: g.x1, xb: g.x2, la: 1, lb: env.sustain },
    { key: 'releaseCurve', label: 'Release', xa: g.x3, xb: g.x4, la: env.sustain, lb: 0 },
  ];

  // live dots: poll the engine each frame while anything is sounding
  useEffect(() => {
    let raf = 0;
    let had = false;
    const tick = () => {
      const vs = engine.getVoices().filter((v) => /^-?\d+$/.test(v.id)); // degrees only, not game voices
      if (vs.length || had) setVoices(vs);
      had = vs.length > 0;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toLocal = (e: RPointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toLocal(e);
    const gg = geometry(env, d.k);
    const ms = (from: number, max: number) => Math.round(Math.min(max, Math.max(0, (p.x - from) / d.k)));
    switch (d.handle) {
      case 'attack': return setEnvelope({ attack: ms(gg.x0, MAX.attack) });
      case 'decay': return setEnvelope({ decay: ms(gg.x1, MAX.decay), sustain: Math.round(levelAtY(p.y) * 100) / 100 });
      case 'release': return setEnvelope({ release: ms(gg.x3, MAX.release) });
      default: {
        // curve handle: the segment's midpoint follows the pointer vertically
        const seg = segments.find((s) => s.key === d.handle)!;
        const c = curveForMidpoint(seg.la, seg.lb, levelAtY(p.y));
        const patch: Partial<EnvelopeSettings> = { [d.handle]: Math.abs(c) < LINEAR_SNAP ? 0 : Math.round(c * 100) / 100 };
        return setEnvelope(patch);
      }
    }
  };

  const start = (handle: Handle) => (e: RPointerEvent) => {
    svgRef.current!.setPointerCapture(e.pointerId);
    drag.current = { handle, k: scaleFor(env) };
    setDragging(true);
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const timeHandle = (h: TimeHandle, x: number, y: number) => (
    <circle cx={x} cy={y} r={7} fill="var(--bg-raised)" stroke="var(--accent)" strokeWidth={2}
      className="cursor-grab" onPointerDown={start(h)} role="slider" aria-label={`${h} handle`} />
  );

  // a small filled dot at the middle of each sloped segment; drag up/down to bend it, double-click for linear
  const curveHandle = (s: Segment) => {
    if (Math.abs(s.lb - s.la) < 1e-3 || s.xb - s.xa < 4) return null; // flat or zero-length: nothing to bend
    const c = env[s.key];
    const cx = (s.xa + s.xb) / 2;
    const cy = yOf(shapeCurve(s.la, s.lb, 0.5, c));
    return (
      <g key={s.key} className="cursor-ns-resize" onPointerDown={start(s.key)}
        onDoubleClick={() => setEnvelope({ [s.key]: 0 })}
        role="slider" aria-label={`${s.label} curve`} aria-valuemin={-1} aria-valuemax={1} aria-valuenow={c}
        aria-valuetext={fmtCurve(c)}>
        <circle cx={cx} cy={cy} r={14} fill="transparent" />
        <circle cx={cx} cy={cy} r={4.5} fill="var(--accent)" />
      </g>
    );
  };

  const path =
    `M ${g.x0} ${yOf(0)}` +
    segPath(segments[0], env.attackCurve) +
    segPath(segments[1], env.decayCurve) +
    ` L ${g.x3} ${yOf(env.sustain)}` +
    segPath(segments[2], env.releaseCurve);

  const curveReadout = (key: CurveKey) => (
    <span className="label flex gap-2">
      <span>Curve</span>
      <span className="mono normal-case tracking-normal text-[var(--text)]">{fmtCurve(env[key])}</span>
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="display m-0 text-lg">Envelope</h3>
        <span className="label">drag the middle dots to bend a slope</span>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full border border-[var(--border-subtle)]"
        style={{ touchAction: 'none' }}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}>
        {[0.25, 0.5, 0.75].map((l) => (
          <line key={l} x1={PAD} x2={W - PAD} y1={yOf(l)} y2={yOf(l)} stroke="var(--border-subtle)" strokeDasharray="2 4" />
        ))}
        <line x1={g.x2} x2={g.x2} y1={PAD} y2={H - PAD} stroke="var(--border-subtle)" />
        <line x1={g.x3} x2={g.x3} y1={PAD} y2={H - PAD} stroke="var(--border-subtle)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {voices.map((v) => (
          <circle key={v.id} cx={dotX(v, g)} cy={yOf(v.level)} r={5}
            fill={degreeColor(((Number(v.id) % len) + len) % len, dark)} />
        ))}
        {segments.map(curveHandle)}
        {timeHandle('attack', g.x1, yOf(1))}
        {timeHandle('decay', g.x2, yOf(env.sustain))}
        {timeHandle('release', g.x4, yOf(0))}
      </svg>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <NumberField label="Attack" suffix="ms" value={env.attack} min={0} max={MAX.attack} onChange={(v) => setEnvelope({ attack: v })} />
          {curveReadout('attackCurve')}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <NumberField label="Decay" suffix="ms" value={env.decay} min={0} max={MAX.decay} onChange={(v) => setEnvelope({ decay: v })} />
          {curveReadout('decayCurve')}
        </div>
        <NumberField label="Sustain" suffix="%" value={Math.round(env.sustain * 100)} min={0} max={100}
          onChange={(v) => setEnvelope({ sustain: v / 100 })} />
        <div className="flex min-w-0 flex-col gap-2">
          <NumberField label="Release" suffix="ms" value={env.release} min={0} max={MAX.release} onChange={(v) => setEnvelope({ release: v })} />
          {curveReadout('releaseCurve')}
        </div>
      </div>
    </div>
  );
}
