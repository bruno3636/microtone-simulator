export interface DrawCtx {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  colors: { text: string; secondary: string; muted: string; border: string; bg: string };
}

export interface WaveNote { id: string; freq: number; level: number; color: string; dim: boolean }

export function sampleTable(table: Float32Array, cycles: number): number {
  const n = table.length;
  const pos = (((cycles % 1) + 1) % 1) * n;
  const i = Math.floor(pos);
  const f = pos - i;
  return table[i % n] * (1 - f) + table[(i + 1) % n] * f;
}

const peaks = new WeakMap<Float32Array, number>();
export function tablePeak(table: Float32Array): number {
  let p = peaks.get(table);
  if (p == null) {
    p = 0;
    for (const v of table) p = Math.max(p, Math.abs(v));
    peaks.set(table, p || 1);
  }
  return p || 1;
}

export function drawHint(dc: DrawCtx, text: string) {
  const { ctx, w, h, colors } = dc;
  ctx.fillStyle = colors.muted;
  ctx.font = '12px "DM Sans Variable", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text.toUpperCase(), w / 2, h / 2 - 12);
  ctx.textAlign = 'start';
}

function centerLine(dc: DrawCtx) {
  dc.ctx.strokeStyle = dc.colors.border;
  dc.ctx.lineWidth = 1;
  dc.ctx.beginPath();
  dc.ctx.moveTo(0, dc.h / 2);
  dc.ctx.lineTo(dc.w, dc.h / 2);
  dc.ctx.stroke();
}

/**
 * Slow-motion computed wave. `clock` is the root's phase in cycles (advanced by the caller at
 * `speed` cycles/s). Each note's phase is clock × (f/f_root), so ratios between notes stay exact.
 */
export function drawComputedWave(
  dc: DrawCtx, notes: WaveNote[], table: Float32Array, rootHz: number,
  periods: number, clock: number, showSum: boolean, sumState: { scale: number },
) {
  const { ctx, w, h } = dc;
  centerLine(dc);
  if (notes.length === 0) return drawHint(dc, 'Play a note or show (~) a degree');
  const peak = tablePeak(table);
  const amp = h * 0.4;
  const step = 1; // px
  const sum = showSum ? new Float32Array(Math.ceil(w / step) + 1) : null;

  for (const n of notes) {
    const ratio = n.freq / rootHz;
    ctx.strokeStyle = n.color;
    ctx.globalAlpha = n.dim ? 0.6 : 1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let px = 0, j = 0; px <= w; px += step, j++) {
      const v = (sampleTable(table, (clock + (periods * px) / w) * ratio) / peak) * n.level;
      if (sum) sum[j] += v;
      const y = h / 2 - v * amp;
      if (px === 0) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (sum && notes.length > 1) {
    let m = 0;
    for (const v of sum) m = Math.max(m, Math.abs(v));
    sumState.scale = sumState.scale * 0.9 + Math.max(m, 1e-3) * 0.1; // smoothed auto-scale
    ctx.strokeStyle = dc.colors.text;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let px = 0, j = 0; px <= w; px += step, j++) {
      const y = h / 2 - (sum[j] / sumState.scale) * h * 0.42;
      if (px === 0) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();
  }
}

/** First rising zero crossing after the signal has dipped below -0.01, leaving room for `window` samples. */
export function findTrigger(buf: Float32Array, window: number): number {
  const limit = buf.length - window;
  let armed = false;
  for (let i = 1; i < limit; i++) {
    if (buf[i] < -0.01) armed = true;
    if (armed && buf[i - 1] <= 0 && buf[i] > 0) return i;
  }
  return 0;
}

export function drawLiveWave(dc: DrawCtx, analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>, gain: number) {
  const { ctx, w, h } = dc;
  analyser.getFloatTimeDomainData(buf);
  centerLine(dc);
  let rms = 0;
  for (const v of buf) rms += v * v;
  if (Math.sqrt(rms / buf.length) < 1e-4) return drawHint(dc, 'Play a note');
  const win = 2048;
  const t = findTrigger(buf, win);
  ctx.strokeStyle = dc.colors.text;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < win; i++) {
    const x = (i / (win - 1)) * w;
    const y = h / 2 - Math.max(-1, Math.min(1, buf[t + i] * gain)) * h * 0.45;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
