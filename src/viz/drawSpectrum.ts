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

export interface Hover { x: number; y: number }

/** Tooltip box near the pointer (right of it, flipped left at the edge), its top at the pointer's height. */
function tooltip(dc: DrawCtx, lines: { text: string; color?: string }[], hx: number, hy: number) {
  const { ctx, w, h, colors } = dc;
  ctx.font = '11px "JetBrains Mono Variable", monospace';
  const sw = 10; // colour swatch
  const lw = Math.max(...lines.map((l) => ctx.measureText(l.text).width + (l.color ? sw + 6 : 0)));
  const bw = lw + 12;
  const bh = lines.length * 15 + 8;
  const bx = hx + 12 + bw > w ? Math.max(2, hx - 12 - bw) : hx + 12;
  const by = Math.min(h - bh - 2, Math.max(2, hy - bh / 2));
  ctx.fillStyle = colors.bg;
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 1;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  lines.forEach((l, i) => {
    const ty = by + 15 + i * 15;
    let tx = bx + 6;
    if (l.color) {
      ctx.fillStyle = l.color;
      ctx.fillRect(tx, ty - 9, sw, sw);
      tx += sw + 6;
    }
    ctx.fillStyle = colors.text;
    ctx.fillText(l.text, tx, ty);
  });
}

/**
 * Partials under the pointer: the nearest line within `radius` px, plus every other partial drawn
 * on (practically) the same line — overlapping harmonics of several notes.
 */
export function partialsAt(partials: Partial[], hoverX: number, xOf: (f: number) => number, radius = 6): Partial[] {
  let best: Partial | null = null;
  let bestD = radius;
  for (const p of partials) {
    const d = Math.abs(xOf(p.freq) - hoverX);
    if (d < bestD) { bestD = d; best = p; }
  }
  if (!best) return [];
  const bx = xOf(best.freq);
  return partials
    .filter((p) => Math.abs(xOf(p.freq) - bx) < 1.5 || Math.abs(1200 * Math.log2(p.freq / best!.freq)) <= 0.5)
    .sort((a, b) => a.freq - b.freq || a.degree - b.degree);
}

/** A partial's amplitude as a ratio of its own note's fundamental ("0.25× fund."), or plain if it has none. */
export function ampVsFundamental(p: Partial, partials: Partial[]): string {
  if (p.harmonic === 1) return 'fundamental';
  const f = partials.find((q) => q.noteId === p.noteId && q.harmonic === 1);
  if (!f || f.amp === 0) return p.amp.toFixed(2);
  return `${+(p.amp / f.amp).toFixed(2)}× fund.`;
}

/** Live spectrum frequency gridlines; labels are thinned so they never collide. */
export const LIVE_TICKS = [20, 30, 40, 50, 60, 80, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 8000, 10000, 15000, 20000];
export function liveLabels(w: number, fmin = 20, fmax = 20000, minGap = 30): number[] {
  const out: number[] = [];
  let last = -Infinity;
  for (const f of LIVE_TICKS) {
    const x = freqToX(f, fmin, fmax, w, 'log');
    if (x - last >= minGap && x <= w - 16) { out.push(f); last = x; }
  }
  return out;
}

function vline(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number) {
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
}

export function drawComputedSpectrum(
  dc: DrawCtx, partials: Partial[], found: { coincident: Coincidence[]; near: NearMiss[] },
  colorOf: (noteId: string) => string, scale: 'log' | 'lin', hover: Hover | null,
) {
  const { ctx, w, h } = dc;
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

  // coincident partials: stacked segments in each note's colour
  for (const c of found.coincident) {
    const cx = x(c.freq);
    let y = base;
    for (const m of c.members) {
      const l = len(m.amp);
      ctx.strokeStyle = colorOf(m.noteId);
      vline(ctx, cx, y, y - l);
      y -= l;
    }
  }

  if (hover) {
    // every partial on the hovered line, one row each (several notes' harmonics can overlap)
    const under = partialsAt(partials, hover.x, x);
    if (under.length) {
      tooltip(dc, under.map((p) => ({
        color: colorOf(p.noteId),
        text: `pitch ${p.degree + 1} · harmonic ${p.harmonic} · ${p.freq.toFixed(1)} Hz · ${ampVsFundamental(p, partials)}`,
      })), hover.x, hover.y);
    }
  }
}

/** Live spectrum options: frequency axis, the fundamental that sets 0 dB, and the lin-axis top. */
export interface LiveSpectrumOpts {
  scale: 'log' | 'lin';
  /** lowest sounding fundamental (Hz), or null when nothing sounds */
  fundamental: number | null;
  /** highest partial expected (Hz), the top of the linear axis */
  maxHz: number;
  /** level of the fundamental in dBFS, smoothed and kept across frames (null = none measured yet) */
  ref: { db: number | null };
}

/** Level of the fundamental: the strongest bin within ±3 % of its frequency. */
export function fundamentalDb(buf: Float32Array, binHz: number, f0: number | null): number | null {
  if (f0 == null) return null;
  const b0 = Math.max(0, Math.floor((f0 * 0.97) / binHz));
  const b1 = Math.min(buf.length - 1, Math.ceil((f0 * 1.03) / binHz));
  let m = -Infinity;
  for (let b = b0; b <= b1; b++) m = Math.max(m, buf[b]);
  return Number.isFinite(m) ? m : null;
}

/** Linear-axis gridlines from 0 Hz: a 1-2-5 step that keeps labels at least `minGap` px apart. */
function linTicks(fmax: number, w: number, minGap = 48): number[] {
  const raw = (fmax / w) * minGap;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= raw)!;
  const out: number[] = [];
  for (let f = step; f <= fmax; f += step) out.push(f);
  return out;
}

const DB_TOP = 10;
const DB_BOTTOM = -90;

export function drawLiveSpectrum(
  dc: DrawCtx, analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>, peaks: Float32Array, dt: number, hover: Hover | null,
  opts: LiveSpectrumOpts,
) {
  const { ctx, w, h, colors } = dc;
  analyser.getFloatFrequencyData(buf);
  const binHz = analyser.context.sampleRate / analyser.fftSize;
  const { scale } = opts;
  const fmin = scale === 'log' ? 20 : 0;
  const fmax = scale === 'log' ? 20000 : Math.min(20000, Math.max(1000, opts.maxHz));
  const base = h - 18;
  const top = 10;

  // 0 dB = the (lowest) fundamental's level; with nothing measured yet, plain dBFS
  const measured = fundamentalDb(buf, binHz, opts.fundamental);
  if (measured != null && measured > -100) {
    opts.ref.db = opts.ref.db == null ? measured : opts.ref.db + (measured - opts.ref.db) * Math.min(1, dt * 8);
  }
  const refDb = opts.ref.db ?? 0;
  const rel = (db: number) => db - refDb;
  const yOf = (db: number) => top + ((DB_TOP - Math.min(DB_TOP, Math.max(DB_BOTTOM, rel(db)))) / (DB_TOP - DB_BOTTOM)) * (base - top);
  const fAt = (px: number) => (scale === 'log' ? fmin * (fmax / fmin) ** (px / w) : fmin + (px / w) * (fmax - fmin));
  const xOf = (f: number) => freqToX(f, scale === 'log' ? fmin : 0, fmax, w, scale);

  // frequency gridlines (log: 1-2-3-5 per decade; lin: even steps), labelled as densely as fits
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.border;
  const grid = scale === 'log' ? LIVE_TICKS : linTicks(fmax, w);
  const labels = scale === 'log' ? liveLabels(w, fmin, fmax) : grid;
  for (const f of grid) vline(ctx, xOf(f), 0, base);
  ctx.font = '10px "JetBrains Mono Variable", monospace';
  ctx.fillStyle = colors.muted;
  for (const f of labels) if (xOf(f) <= w - 16) ctx.fillText(fmtHz(f), xOf(f) + 3, base + 13);

  // level gridlines every 20 dB; 0 dB is the fundamental
  for (let db = 0; db >= DB_BOTTOM + 10; db -= 20) {
    const y = yOf(db + refDb);
    ctx.strokeStyle = colors.border;
    ctx.setLineDash(db === 0 ? [] : [2, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colors.muted;
    ctx.fillText(db === 0 && opts.ref.db != null ? '0 dB = fundamental' : `${db} dB`, 4, y - 3);
  }

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

  if (hover && hover.x >= 0 && hover.x < cols) {
    // crosshair with the frequency under the pointer and the level there, relative to the fundamental
    const px = Math.floor(hover.x);
    ctx.strokeStyle = colors.secondary;
    ctx.setLineDash([3, 3]);
    vline(ctx, px + 0.5, 0, base);
    ctx.setLineDash([]);
    const db = level[px];
    const f = fAt(hover.x);
    tooltip(dc, [
      { text: `${f.toFixed(f < 100 ? 1 : 0)} Hz` },
      { text: Number.isFinite(db) && db > -200 ? `${rel(db).toFixed(1)} dB${opts.ref.db != null ? ' re fund.' : ''}` : '— dB' },
    ], hover.x, hover.y);
  }
}
