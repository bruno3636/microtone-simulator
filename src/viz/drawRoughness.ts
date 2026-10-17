import { drawHint, type DrawCtx } from './drawWave';
import type { Hover } from './drawSpectrum';
import { nearestJust } from '../tuning/interScale';

export interface RoughnessMarker { cents: number; color: string; sounding: boolean }

export interface RoughnessView {
  curve: { cents: number; value: number }[];
  minima: { cents: number; value: number }[];
  /** scale degrees (dim) and sounding notes (bright), in cents above the root */
  markers: RoughnessMarker[];
  /** roughness of the notes sounding now, or null when nothing sounds */
  current: number | null;
  rangeCents: number;
  rootLabel: string;
}

const ratioText = (cents: number) => {
  const { a, b } = nearestJust(2 ** (cents / 1200));
  const d = cents - 1200 * Math.log2(a / b);
  return Math.abs(d) < 0.05 ? `${a}/${b}` : `${a}/${b} ${d > 0 ? '+' : '-'}${Math.abs(d).toFixed(1)}c`;
};

/** Sethares dissonance curve of the current timbre against the root, with the scale and the sounding notes on it. */
export function drawRoughness(dc: DrawCtx, v: RoughnessView, hover: Hover | null) {
  const { ctx, w, h, colors } = dc;
  if (v.curve.length === 0) return drawHint(dc, 'No harmonics to measure');
  const top = 46;
  const base = h - 18;
  // logarithmic y-axis: equal ratios of roughness get equal heights, so the dips after the
  // unison peak are as visible as their relative depth (a linear axis flattens them)
  // The unison and octaves are far smoother than anything else, so the scale is fitted to the
  // dips between them (they run off the bottom, still the deepest points).
  const nearOctave = (c: number) => Math.abs(c - 1200 * Math.round(c / 1200)) < 30;
  const values = v.curve.map((p) => p.value).filter((x) => x > 0);
  const interior = v.curve.filter((p) => p.value > 0 && !nearOctave(p.cents)).map((p) => p.value);
  const lo = Math.log(Math.min(...(interior.length ? interior : values)) * 0.8);
  const hi = Math.log(Math.max(...values) * 1.08);
  const xOf = (c: number) => (c / v.rangeCents) * w;
  const yOf = (val: number) => base - Math.max(0, (Math.log(Math.max(val, 1e-9)) - lo) / (hi - lo || 1)) * (base - top);
  const valueAt = (c: number) => {
    const i = Math.min(v.curve.length - 2, Math.max(0, Math.floor((c / v.rangeCents) * (v.curve.length - 1))));
    const p = v.curve[i];
    const q = v.curve[i + 1];
    const t = q.cents === p.cents ? 0 : (c - p.cents) / (q.cents - p.cents);
    return p.value + (q.value - p.value) * Math.min(1, Math.max(0, t));
  };

  // cents grid: every 100¢, labels as densely as fit
  ctx.font = '10px "JetBrains Mono Variable", monospace';
  ctx.lineWidth = 1;
  const labelEvery = w / (v.rangeCents / 100) >= 44 ? 100 : 200;
  for (let c = 0; c <= v.rangeCents; c += 100) {
    ctx.strokeStyle = colors.border;
    ctx.beginPath();
    ctx.moveTo(xOf(c) + 0.5, top - 6);
    ctx.lineTo(xOf(c) + 0.5, base);
    ctx.stroke();
    if (c % labelEvery === 0) {
      ctx.fillStyle = colors.muted;
      // the last label ends at the right edge; skip a label that would run into it
      const last = c === v.rangeCents;
      if (!last && xOf(c) + 3 + ctx.measureText(`${c}¢`).width > w - ctx.measureText(`${v.rangeCents}¢`).width - 8) continue;
      ctx.textAlign = last ? 'right' : 'start';
      ctx.fillText(`${c}¢`, last ? w - 2 : xOf(c) + 3, base + 13);
      ctx.textAlign = 'start';
    }
  }

  // the curve
  ctx.beginPath();
  ctx.moveTo(0, base);
  for (const p of v.curve) ctx.lineTo(xOf(p.cents), yOf(p.value));
  ctx.lineTo(w, base);
  ctx.closePath();
  ctx.globalAlpha = 0.05; // a faint fill keeps the markers and dip labels readable
  ctx.fillStyle = colors.text;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  v.curve.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, xOf(p.cents), yOf(p.value)));
  ctx.stroke();

  // dips: the nearest simple ratio
  ctx.fillStyle = colors.secondary;
  ctx.textAlign = 'center';
  for (const m of v.minima) {
    if (m.cents < 1 || m.cents > v.rangeCents - 1) continue;
    const { a, b } = nearestJust(2 ** (m.cents / 1200));
    // below the dip, or above it when that would run into the axis labels
    const y = yOf(m.value) + 14 > base - 4 ? yOf(m.value) - 8 : yOf(m.value) + 14;
    ctx.fillText(`${a}/${b}`, Math.min(w - 16, Math.max(16, xOf(m.cents))), y);
  }
  ctx.textAlign = 'start';

  // scale degrees (dim) and sounding notes (bright), standing on the curve
  for (const m of [...v.markers].sort((a, b) => Number(a.sounding) - Number(b.sounding))) {
    if (m.cents < -0.5 || m.cents > v.rangeCents + 0.5) continue;
    const x = xOf(Math.min(v.rangeCents, Math.max(0, m.cents)));
    const y = yOf(valueAt(m.cents));
    ctx.globalAlpha = m.sounding ? 1 : 0.55;
    ctx.strokeStyle = m.color;
    ctx.lineWidth = m.sounding ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.arc(x, y, m.sounding ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // readouts
  ctx.font = '12px "DM Sans Variable", sans-serif';
  ctx.fillStyle = colors.text;
  ctx.fillText(v.current == null ? 'Play notes to measure their roughness' : `Roughness of the sounding notes: ${v.current.toFixed(3)}`, 4, 16);
  ctx.font = '10px "JetBrains Mono Variable", monospace';
  ctx.fillStyle = colors.muted;
  ctx.fillText(`curve: this timbre vs the root (${v.rootLabel}) · Sethares · log scale`, 4, 32);

  if (hover && hover.x >= 0 && hover.x <= w) {
    const c = (hover.x / w) * v.rangeCents;
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(Math.floor(hover.x) + 0.5, top - 6);
    ctx.lineTo(Math.floor(hover.x) + 0.5, base);
    ctx.stroke();
    ctx.setLineDash([]);
    const lines = [`${c.toFixed(1)}¢ · ${ratioText(c)}`, `roughness ${valueAt(c).toFixed(3)}`];
    ctx.font = '11px "JetBrains Mono Variable", monospace';
    const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 12;
    const bh = lines.length * 15 + 8;
    const bx = hover.x + 12 + bw > w ? Math.max(2, hover.x - 12 - bw) : hover.x + 12;
    const by = Math.min(h - bh - 2, Math.max(2, hover.y - bh / 2));
    ctx.fillStyle = colors.bg;
    ctx.strokeStyle = colors.text;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.fillStyle = colors.text;
    lines.forEach((l, i) => ctx.fillText(l, bx + 6, by + 15 + i * 15));
  }
}
