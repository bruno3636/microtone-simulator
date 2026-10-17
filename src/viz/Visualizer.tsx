import { useEffect, useRef } from 'react';
import { useStore, type VizSettings } from '../state/store';
import { engine } from '../audio/engine';
import { degreeFreq, degreeRatio, mod } from '../tuning/ratios';
import { degreeColor } from '../theme';
import { buildPartials, findCoincidences } from './partials';
import { drawComputedWave, drawLiveWave, drawHint, type DrawCtx, type WaveNote } from './drawWave';
import { drawComputedSpectrum, drawLiveSpectrum, type Hover } from './drawSpectrum';
import { drawRoughness, type RoughnessMarker } from './drawRoughness';
import { curveMinima, dissonanceCurve, totalRoughness } from '../audio/roughness';
import { NumberField, Segmented, Slider } from '../components/ui';

interface Drawn extends WaveNote { degree: number }

/** Held voices at their live level, plus shown (~) degrees that aren't sounding, dimmed at full level. */
function drawnNotes(dark: boolean): Drawn[] {
  const s = useStore.getState();
  const len = s.notes.length;
  const out: Drawn[] = [];
  const sounding = new Set<number>();
  for (const v of engine.getVoices()) {
    if (!/^-?\d+$/.test(v.id)) continue; // tuning-game voices aren't drawn (no peeking)
    const degree = Number(v.id);
    sounding.add(degree);
    out.push({ id: v.id, degree, freq: v.freq, level: v.level, brightness: v.brightness, color: degreeColor(mod(degree, len), dark), dim: false });
  }
  for (const d of s.shown) {
    if (sounding.has(d) || d >= len) continue;
    const freq = degreeFreq(s.notes, d, s.root.freq);
    if (freq == null) continue;
    out.push({ id: String(d), degree: d, freq, level: 1, color: degreeColor(d, dark), dim: true });
  }
  return out;
}

function cssColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return { text: v('--text'), secondary: v('--text-secondary'), muted: v('--text-muted'), border: v('--border-subtle'), bg: v('--bg') };
}

export function Visualizer() {
  const viz = useStore((s) => s.viz);
  const setViz = useStore((s) => s.setViz);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hover = useRef<Hover | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const ro = new ResizeObserver(() => {
      dpr = window.devicePixelRatio || 1;
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    });
    ro.observe(wrap);

    let raf = 0;
    let last = performance.now();
    let clock = 0;
    const sumState = { scale: 1 };
    let timeBuf: Float32Array<ArrayBuffer> | null = null;
    let freqBuf: Float32Array<ArrayBuffer> | null = null;
    let peaks: Float32Array | null = null;
    // live wave: frames' worth of time since the last capture (speed 1 = a new capture every frame)
    let liveAcc = 0;
    const liveRef = { db: null as number | null };
    // roughness view: the dissonance curve only changes with the timbre, root or range
    let roughKey = '';
    let roughCurve: { cents: number; value: number }[] = [];
    let roughMinima: { cents: number; value: number }[] = [];
    let captured = false;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (document.hidden || w === 0) return;
      const s = useStore.getState();
      const v: VizSettings = s.viz;
      clock += dt * v.speed;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const dc: DrawCtx = { ctx, w, h, colors: cssColors() };

      if (v.view === 'roughness') {
        const amps = engine.getAmplitudes();
        const range = (v.roughRange ?? 1) * 1200;
        const key = `${amps.join(',')}|${s.root.freq}|${range}`;
        if (key !== roughKey) {
          roughKey = key;
          roughCurve = dissonanceCurve(amps, s.root.freq, 0, range, range === 1200 ? 601 : 901);
          roughMinima = curveMinima(roughCurve, 0.03);
        }
        const len = s.notes.length;
        const markers: RoughnessMarker[] = [];
        for (let d = 0; d < len * (v.roughRange ?? 1) + 1; d++) {
          const r = degreeRatio(s.notes, d);
          if (r != null) markers.push({ cents: 1200 * Math.log2(r), color: degreeColor(mod(d, len), dark), sounding: false });
        }
        const sounding = drawnNotes(dark).filter((n) => !n.dim);
        for (const n of sounding) markers.push({ cents: 1200 * Math.log2(n.freq / s.root.freq), color: n.color, sounding: true });
        const partials = buildPartials(sounding, amps, 20000, engine.getDarkAmplitudes());
        drawRoughness(dc, {
          curve: roughCurve, minima: roughMinima, markers, rangeCents: range,
          current: sounding.length ? totalRoughness(partials) : null,
          rootLabel: `${s.root.note || 'root'} ${+s.root.freq.toFixed(2)} Hz`,
        }, hover.current);
        return;
      }

      if (v.source === 'computed') {
        const notes = drawnNotes(dark);
        if (v.view === 'wave') {
          drawComputedWave(dc, notes, engine.getWavetable(), s.root.freq, v.periods, clock, v.showSum, sumState, engine.getDarkWavetable());
        } else {
          const partials = buildPartials(notes, engine.getAmplitudes(), 20000, engine.getDarkAmplitudes());
          const colors = new Map(notes.map((n) => [n.id, n.color]));
          drawComputedSpectrum(dc, partials, findCoincidences(partials), (id) => colors.get(id) ?? dc.colors.text, v.freqScale, hover.current);
        }
        return;
      }

      const analyser = engine.getAnalyser();
      if (!analyser) return drawHint(dc, 'Play a note');
      if (v.view === 'wave') {
        if (!timeBuf || timeBuf.length !== analyser.fftSize) { timeBuf = new Float32Array(analyser.fftSize); captured = false; }
        liveAcc += dt * 60 * v.liveSpeed;
        if (!captured || liveAcc >= 1) {
          analyser.getFloatTimeDomainData(timeBuf);
          captured = true;
          liveAcc %= 1;
        }
        drawLiveWave(dc, timeBuf, v.liveGain);
      } else {
        if (!freqBuf || freqBuf.length !== analyser.frequencyBinCount) {
          freqBuf = new Float32Array(analyser.frequencyBinCount);
          peaks = new Float32Array(analyser.frequencyBinCount).fill(-200);
        }
        // 0 dB follows the lowest sounding fundamental; the linear axis spans its expected partials
        const voices = engine.getVoices().filter((x) => x.level > 1e-3);
        const fundamental = voices.length ? Math.min(...voices.map((x) => x.freq)) : null;
        const maxHz = voices.length ? Math.max(...voices.map((x) => x.freq)) * engine.getAmplitudes().length * 1.15 : 5000;
        drawLiveSpectrum(dc, analyser, freqBuf, peaks!, dt, hover.current, { scale: v.freqScale, fundamental, maxHz, ref: liveRef });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <section className="panel flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <Segmented<VizSettings['view']> label="View" value={viz.view} onChange={(view) => setViz({ view })}
          options={[{ value: 'wave', label: 'Wave' }, { value: 'spectrum', label: 'Spectrum' }, { value: 'roughness', label: 'Roughness' }]} />
        {viz.view === 'roughness' ? (
          <Segmented<'1' | '2'> label="Range" value={String(viz.roughRange ?? 1) as '1' | '2'} onChange={(r) => setViz({ roughRange: Number(r) as 1 | 2 })}
            options={[{ value: '1', label: '1 octave' }, { value: '2', label: '2 octaves' }]} />
        ) : (
          <Segmented<VizSettings['source']> label="Source" value={viz.source} onChange={(source) => setViz({ source })}
            options={[{ value: 'computed', label: 'Computed' }, { value: 'live', label: 'Live' }]} />
        )}
        {viz.view === 'wave' && viz.source === 'computed' && (
          <>
            <NumberField label="Periods" value={viz.periods} min={1} max={16} onChange={(periods) => setViz({ periods: Math.round(periods) })} />
            <Slider label="Speed" value={viz.speed} min={0} max={4} step={0.05}
              format={(x) => (x === 0 ? 'frozen' : `${x.toFixed(2)}×`)} onChange={(speed) => setViz({ speed })} />
            <button type="button" className="btn" aria-pressed={viz.showSum}
              data-active={viz.showSum} style={viz.showSum ? { background: 'var(--accent)', color: 'var(--bg)' } : undefined}
              onClick={() => setViz({ showSum: !viz.showSum })}>Sum</button>
          </>
        )}
        {viz.view === 'spectrum' && (
          <Segmented<VizSettings['freqScale']> label="Frequency axis" value={viz.freqScale} onChange={(freqScale) => setViz({ freqScale })}
            options={[{ value: 'log', label: 'Log' }, { value: 'lin', label: 'Lin' }]} />
        )}
        {viz.source === 'live' && viz.view === 'wave' && (
          <>
            <Slider label="Gain" value={viz.liveGain} min={1} max={8} step={0.5}
              format={(x) => `×${x}`} onChange={(liveGain) => setViz({ liveGain })} />
            <Slider label="Speed" value={viz.liveSpeed} min={0} max={1} step={0.01}
              format={(x) => (x === 0 ? 'frozen' : x === 1 ? 'real time' : `${Math.round(x * 60)} fps`)}
              onChange={(liveSpeed) => setViz({ liveSpeed })} />
          </>
        )}
      </div>
      <div ref={wrapRef} className="relative h-[320px] w-full sm:h-[380px]"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          hover.current = { x: e.clientX - r.left, y: e.clientY - r.top };
        }}
        onPointerLeave={() => { hover.current = null; }}>
        <canvas ref={canvasRef} className="absolute inset-0" aria-label="Wave and spectrum visualizer" />
      </div>
    </section>
  );
}
