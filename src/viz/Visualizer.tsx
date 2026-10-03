import { useEffect, useRef } from 'react';
import { useStore, type VizSettings } from '../state/store';
import { engine } from '../audio/engine';
import { degreeFreq, mod } from '../tuning/ratios';
import { degreeColor } from '../theme';
import { buildPartials, findCoincidences } from './partials';
import { drawComputedWave, drawLiveWave, drawHint, type DrawCtx, type WaveNote } from './drawWave';
import { drawComputedSpectrum, drawLiveSpectrum } from './drawSpectrum';
import { NumberField, Segmented, Slider } from '../components/ui';

interface Drawn extends WaveNote { degree: number }

/** Held voices at their live level, plus shown (~) degrees that aren't sounding, dimmed at full level. */
function drawnNotes(dark: boolean): Drawn[] {
  const s = useStore.getState();
  const len = s.notes.length;
  const out: Drawn[] = [];
  const sounding = new Set<number>();
  for (const v of engine.getVoices()) {
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
  const hoverX = useRef<number | null>(null);

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

      if (v.source === 'computed') {
        const notes = drawnNotes(dark);
        if (v.view === 'wave') {
          drawComputedWave(dc, notes, engine.getWavetable(), s.root.freq, v.periods, clock, v.showSum, sumState, engine.getDarkWavetable());
        } else {
          const partials = buildPartials(notes, engine.getAmplitudes(), 20000, engine.getDarkAmplitudes());
          const colors = new Map(notes.map((n) => [n.id, n.color]));
          drawComputedSpectrum(dc, partials, findCoincidences(partials), (id) => colors.get(id) ?? dc.colors.text, v.freqScale, hoverX.current);
        }
        return;
      }

      const analyser = engine.getAnalyser();
      if (!analyser) return drawHint(dc, 'Play a note');
      if (v.view === 'wave') {
        if (!timeBuf || timeBuf.length !== analyser.fftSize) timeBuf = new Float32Array(analyser.fftSize);
        drawLiveWave(dc, analyser, timeBuf, v.liveGain);
      } else {
        if (!freqBuf || freqBuf.length !== analyser.frequencyBinCount) {
          freqBuf = new Float32Array(analyser.frequencyBinCount);
          peaks = new Float32Array(analyser.frequencyBinCount).fill(-200);
        }
        drawLiveSpectrum(dc, analyser, freqBuf, peaks!, dt);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <section className="panel flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <Segmented<VizSettings['view']> label="View" value={viz.view} onChange={(view) => setViz({ view })}
          options={[{ value: 'wave', label: 'Wave' }, { value: 'spectrum', label: 'Spectrum' }]} />
        <Segmented<VizSettings['source']> label="Source" value={viz.source} onChange={(source) => setViz({ source })}
          options={[{ value: 'computed', label: 'Computed' }, { value: 'live', label: 'Live' }]} />
        {viz.source === 'computed' && viz.view === 'wave' && (
          <>
            <NumberField label="Periods" value={viz.periods} min={1} max={16} onChange={(periods) => setViz({ periods: Math.round(periods) })} />
            <Slider label="Speed" value={viz.speed} min={0} max={4} step={0.05}
              format={(x) => (x === 0 ? 'frozen' : `${x.toFixed(2)}×`)} onChange={(speed) => setViz({ speed })} />
            <button type="button" className="btn" aria-pressed={viz.showSum}
              data-active={viz.showSum} style={viz.showSum ? { background: 'var(--accent)', color: 'var(--bg)' } : undefined}
              onClick={() => setViz({ showSum: !viz.showSum })}>Sum</button>
          </>
        )}
        {viz.source === 'computed' && viz.view === 'spectrum' && (
          <Segmented<VizSettings['freqScale']> label="Frequency axis" value={viz.freqScale} onChange={(freqScale) => setViz({ freqScale })}
            options={[{ value: 'log', label: 'Log' }, { value: 'lin', label: 'Lin' }]} />
        )}
        {viz.source === 'live' && viz.view === 'wave' && (
          <Slider label="Gain" value={viz.liveGain} min={1} max={8} step={0.5}
            format={(x) => `×${x}`} onChange={(liveGain) => setViz({ liveGain })} />
        )}
      </div>
      <div ref={wrapRef} className="relative h-[320px] w-full sm:h-[380px]"
        onPointerMove={(e) => { hoverX.current = e.clientX - e.currentTarget.getBoundingClientRect().left; }}
        onPointerLeave={() => { hoverX.current = null; }}>
        <canvas ref={canvasRef} className="absolute inset-0" aria-label="Wave and spectrum visualizer" />
      </div>
    </section>
  );
}
