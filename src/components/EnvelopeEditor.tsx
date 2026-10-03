import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useStore } from '../state/store';
import { shapeCurve } from '../audio/curves';
import { CURVE_AMOUNT, type CurveKind, type EnvelopeSettings } from '../audio/envelope';
import { engine, type VoiceSnapshot } from '../audio/engine';
import { degreeColor } from '../theme';
import { useResolvedTheme } from '../hooks/useTheme';
import { NumberField, Segmented } from './ui';

const W = 600;
const H = 200;
const PAD = 12;
const IW = W - 2 * PAD;
const IH = H - 2 * PAD;
const PLATEAU = IW * 0.2;
const MAX = { attack: 5000, decay: 5000, release: 10000 };
const CURVES: { value: CurveKind; label: string }[] = [
  { value: 'lin', label: 'Lin' }, { value: 'exp', label: 'Exp' }, { value: 'log', label: 'Log' },
];

type Handle = 'attack' | 'decay' | 'release';

const scaleFor = (e: EnvelopeSettings) => (IW - PLATEAU) / Math.max(50, e.attack + e.decay + e.release);
const yOf = (level: number) => PAD + (1 - level) * IH;

function geometry(e: EnvelopeSettings, k: number) {
  const x0 = PAD;
  const x1 = x0 + e.attack * k;
  const x2 = x1 + e.decay * k;
  const x3 = x2 + PLATEAU;
  const x4 = x3 + e.release * k;
  return { x0, x1, x2, x3, x4 };
}

function segPath(xa: number, xb: number, la: number, lb: number, curve: CurveKind) {
  let d = '';
  for (let i = 1; i <= 32; i++) {
    const t = i / 32;
    d += ` L ${xa + (xb - xa) * t} ${yOf(shapeCurve(la, lb, t, CURVE_AMOUNT[curve]))}`;
  }
  return d;
}

function dotPosition(v: VoiceSnapshot, e: EnvelopeSettings, k: number) {
  const g = geometry(e, k);
  switch (v.stage) {
    case 'attack': return g.x0 + v.elapsedMs * k;
    case 'decay': return g.x1 + (v.elapsedMs - e.attack) * k;
    case 'sustain': return g.x2 + PLATEAU * Math.min(1, (v.elapsedMs - e.attack - e.decay) / 1000);
    case 'release': return g.x3 + v.elapsedMs * k;
  }
}

export function EnvelopeEditor() {
  const dark = useResolvedTheme() === 'dark';
  const env = useStore((s) => s.envelope);
  const len = useStore((s) => s.notes.length);
  const setEnvelope = useStore((s) => s.setEnvelope);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ handle: Handle; k: number } | null>(null);
  const [voices, setVoices] = useState<VoiceSnapshot[]>([]);

  const k = drag.current?.k ?? scaleFor(env);
  const g = geometry(env, k);

  // live dots: poll the engine each frame while anything is sounding
  useEffect(() => {
    let raf = 0;
    let had = false;
    const tick = () => {
      const vs = engine.getVoices();
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
    if (d.handle === 'attack') setEnvelope({ attack: ms(gg.x0, MAX.attack) });
    if (d.handle === 'decay') {
      setEnvelope({
        decay: ms(gg.x1, MAX.decay),
        sustain: Math.round(Math.min(1, Math.max(0, 1 - (p.y - PAD) / IH)) * 100) / 100,
      });
    }
    if (d.handle === 'release') setEnvelope({ release: ms(gg.x3, MAX.release) });
  };

  const start = (handle: Handle) => (e: RPointerEvent) => {
    svgRef.current!.setPointerCapture(e.pointerId);
    drag.current = { handle, k: scaleFor(env) };
  };

  const handle = (h: Handle, x: number, y: number) => (
    <circle cx={x} cy={y} r={7} fill="var(--bg-raised)" stroke="var(--accent)" strokeWidth={2}
      className="cursor-grab" onPointerDown={start(h)} role="slider" aria-label={`${h} handle`} />
  );

  const path =
    `M ${g.x0} ${yOf(0)}` +
    segPath(g.x0, g.x1, 0, 1, env.attackCurve) +
    segPath(g.x1, g.x2, 1, env.sustain, env.decayCurve) +
    ` L ${g.x3} ${yOf(env.sustain)}` +
    segPath(g.x3, g.x4, env.sustain, 0, env.releaseCurve);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="display m-0 text-lg">Envelope</h3>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full border border-[var(--border-subtle)]"
        style={{ touchAction: 'none' }}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}>
        {[0.25, 0.5, 0.75].map((l) => (
          <line key={l} x1={PAD} x2={W - PAD} y1={yOf(l)} y2={yOf(l)} stroke="var(--border-subtle)" strokeDasharray="2 4" />
        ))}
        <line x1={g.x2} x2={g.x2} y1={PAD} y2={H - PAD} stroke="var(--border-subtle)" />
        <line x1={g.x3} x2={g.x3} y1={PAD} y2={H - PAD} stroke="var(--border-subtle)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {voices.map((v) => (
          <circle key={v.id} cx={dotPosition(v, env, k)} cy={yOf(v.level)} r={5}
            fill={degreeColor(((Number(v.id) % len) + len) % len, dark)} />
        ))}
        {handle('attack', g.x1, yOf(1))}
        {handle('decay', g.x2, yOf(env.sustain))}
        {handle('release', g.x4, yOf(0))}
      </svg>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <NumberField label="Attack" suffix="ms" value={env.attack} min={0} max={MAX.attack} onChange={(v) => setEnvelope({ attack: v })} />
          <Segmented<CurveKind> label="Attack curve" value={env.attackCurve} options={CURVES} onChange={(c) => setEnvelope({ attackCurve: c })} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <NumberField label="Decay" suffix="ms" value={env.decay} min={0} max={MAX.decay} onChange={(v) => setEnvelope({ decay: v })} />
          <Segmented<CurveKind> label="Decay curve" value={env.decayCurve} options={CURVES} onChange={(c) => setEnvelope({ decayCurve: c })} />
        </div>
        <NumberField label="Sustain" suffix="%" value={Math.round(env.sustain * 100)} min={0} max={100}
          onChange={(v) => setEnvelope({ sustain: v / 100 })} />
        <div className="flex min-w-0 flex-col gap-2">
          <NumberField label="Release" suffix="ms" value={env.release} min={0} max={MAX.release} onChange={(v) => setEnvelope({ release: v })} />
          <Segmented<CurveKind> label="Release curve" value={env.releaseCurve} options={CURVES} onChange={(c) => setEnvelope({ releaseCurve: c })} />
        </div>
      </div>
    </div>
  );
}
