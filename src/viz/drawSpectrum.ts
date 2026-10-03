import type { Partial, Coincidence, NearMiss } from './partials';
import { drawHint, type DrawCtx } from './drawWave';

export function freqToX(f: number, fmin: number, fmax: number, w: number, scale: 'log' | 'lin'): number {
  return scale === 'log' ? (Math.log(f / fmin) / Math.log(fmax / fmin)) * w : ((f - fmin) / (fmax - fmin)) * w;
}

const fmtHz = (f: number) => (f >= 1000 ? `${+(f / 1000).toFixed(f >= 10000 ? 0 : 1)}k` : `${Math.round(f)}`);

function ticks(fmin: number, fmax: number, scale: 'log' | 'lin'): number[] {
  if (scale === 'log') {
    return [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter((f) => f >= fmin && f <= fmax);
  }
  const raw = (fmax - fmin) / 6;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const out: number[] = [];
  for (let f = Math.ceil(fmin / step) * step; f <= fmax; f += step) out.push(f);
  return out;
}

function axis(dc: DrawCtx, fmin: number, fmax: number, scale: 'log' | 'lin', base: number) {
  const { ctx, w, colors } = dc;
  ctx.font = '10px "JetBrains Mono Variable", monospace';
  ctx.lineWidth = 1;
  for (const f of ticks(fmin, fmax, scale)) {
    const x = freqToX(f, fmin, fmax, w, scale);
    ctx.strokeStyle = colors.border;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, base);
    ctx.stroke();
    ctx.fillStyle = colors.muted;
    ctx.fillText(fmtHz(f), Math.min(w - 24, x + 3), base + 13);
  }
  ctx.strokeStyle = colors.border;
  ctx.beginPath();
  ctx.moveTo(0, base);
  ctx.lineTo(w, base);
  ctx.stroke();
}

function vline(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number) {
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
}

export function drawComputedSpectrum(
  dc: DrawCtx, partials: Partial[], found: { coincident: Coincidence[]; near: NearMiss[] },
  colorOf: (noteId: string) => string, scale: 'log' | 'lin', hoverX: number | null,
) {
  const { ctx, w, h, colors } = dc;
  if (partials.length === 0) return drawHint(dc, 'Play a note or show (~) a degree');
  const freqs = partials.map((p) => p.freq);
  const fmin = Math.max(10, Math.min(...freqs) / 2);
  const fmax = Math.min(20000, Math.max(...freqs) * 1.15);
  const base = h - 18;
  const top = 28;
  const inCluster = new Set(found.coincident.flatMap((c) => c.members));
  const clusterSums = found.coincident.map((c) => c.members.reduce((s, m) => s + m.amp, 0));
  const maxAmp = Math.max(0.25, ...partials.filter((p) => !inCluster.has(p)).map((p) => p.amp), ...clusterSums);
  const len = (a: number) => (a / maxAmp) * (base - top);
  const x = (f: number) => freqToX(f, fmin, fmax, w, scale);

  axis(dc, fmin, fmax, scale, base);

  ctx.lineWidth = 2;
  for (const p of partials) {
    if (inCluster.has(p)) continue;
    ctx.strokeStyle = colorOf(p.noteId);
    vline(ctx, x(p.freq), base, base - len(p.amp));
  }

  // coincident partials: stacked segments in each note's colour, ◆ on top
  ctx.font = '10px "JetBrains Mono Variable", monospace';
  for (const c of found.coincident) {
    const cx = x(c.freq);
    let y = base;
    for (const m of c.members) {
      const l = len(m.amp);
      ctx.strokeStyle = colorOf(m.noteId);
      vline(ctx, cx, y, y - l);
      y -= l;
    }
    ctx.fillStyle = colors.text;
    ctx.fillText('◆', cx - 4, y - 4);
  }

  // near-misses: bracket + beat rate
  ctx.lineWidth = 1;
  for (const n of found.near) {
    const xa = x(n.a.freq);
    const xb = x(n.b.freq);
    const yt = base - Math.max(len(n.a.amp), len(n.b.amp)) - 10;
    ctx.strokeStyle = colors.secondary;
    ctx.beginPath();
    ctx.moveTo(xa, yt + 5);
    ctx.lineTo(xa, yt);
    ctx.lineTo(xb, yt);
    ctx.lineTo(xb, yt + 5);
    ctx.stroke();
    const label = `${n.beatHz.toFixed(2)} Hz`;
    ctx.fillStyle = colors.secondary;
    ctx.fillText(label, Math.min(w - ctx.measureText(label).width, Math.max(0, (xa + xb) / 2 - ctx.measureText(label).width / 2)), yt - 4);
  }

  if (hoverX != null) {
    let best: Partial | null = null;
    let bestD = 6;
    for (const p of partials) {
      const d = Math.abs(x(p.freq) - hoverX);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best) {
      const text = `degree ${best.degree + 1} · harmonic ${best.harmonic} · ${best.freq.toFixed(1)} Hz · ${best.amp.toFixed(2)}`;
      ctx.font = '11px "JetBrains Mono Variable", monospace';
      const tw = ctx.measureText(text).width + 12;
      const bx = Math.min(w - tw - 2, Math.max(2, hoverX + 8));
      ctx.fillStyle = colors.bg;
      ctx.strokeStyle = colors.text;
      ctx.fillRect(bx, 4, tw, 20);
      ctx.strokeRect(bx + 0.5, 4.5, tw - 1, 19);
      ctx.fillStyle = colors.text;
      ctx.fillText(text, bx + 6, 18);
    }
  }
}

export function drawLiveSpectrum(dc: DrawCtx, analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>, peaks: Float32Array, dt: number) {
  const { ctx, w, h, colors } = dc;
  analyser.getFloatFrequencyData(buf);
  const binHz = analyser.context.sampleRate / analyser.fftSize;
  const fmin = 20;
  const fmax = 20000;
  const base = h - 18;
  const top = 10;
  const yOf = (db: number) => top + (Math.min(0, Math.max(-100, db)) / -100) * (base - top);
  const fAt = (px: number) => fmin * (fmax / fmin) ** (px / w);

  // octave Cs as faint gridlines, labels at 100 / 1k / 10k
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.border;
  for (let f = 32.703; f < fmax; f *= 2) vline(ctx, freqToX(f, fmin, fmax, w, 'log'), 0, base);
  ctx.font = '10px "JetBrains Mono Variable", monospace';
  ctx.fillStyle = colors.muted;
  for (const f of [100, 1000, 10000]) ctx.fillText(fmtHz(f), freqToX(f, fmin, fmax, w, 'log') + 3, base + 13);

  for (let i = 0; i < buf.length; i++) peaks[i] = Math.max(buf[i], (Number.isFinite(peaks[i]) ? peaks[i] : -200) - 20 * dt);

  const cols = Math.ceil(w);
  const level = new Float32Array(cols);
  const peak = new Float32Array(cols);
  let loudest = -Infinity;
  for (let px = 0; px < cols; px++) {
    const b0 = Math.min(buf.length - 1, Math.floor(fAt(px) / binHz));
    const b1 = Math.min(buf.length - 1, Math.max(b0, Math.floor(fAt(px + 1) / binHz)));
    let m = -Infinity;
    let pk = -Infinity;
    for (let b = b0; b <= b1; b++) { m = Math.max(m, buf[b]); pk = Math.max(pk, peaks[b]); }
    level[px] = m;
    peak[px] = pk;
    loudest = Math.max(loudest, m);
  }

  ctx.beginPath();
  ctx.moveTo(0, base);
  for (let px = 0; px < cols; px++) ctx.lineTo(px, yOf(level[px]));
  ctx.lineTo(w, base);
  ctx.closePath();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = colors.text;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let px = 0; px < cols; px++) (px ? ctx.lineTo : ctx.moveTo).call(ctx, px, yOf(level[px]));
  ctx.stroke();

  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let px = 0; px < cols; px++) (px ? ctx.lineTo : ctx.moveTo).call(ctx, px, yOf(peak[px]));
  ctx.stroke();

  if (loudest < -95) drawHint(dc, 'Play a note');
}
