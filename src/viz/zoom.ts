/** A visible stretch of the roughness view's interval axis, in cents above the root. */
export interface ZoomView { from: number; to: number }

/** narrowest window you can zoom in to */
export const MIN_ZOOM_WIDTH = 5;

const clampView = (from: number, width: number, extent: number): ZoomView => {
  const w = Math.min(extent, Math.max(MIN_ZOOM_WIDTH, width));
  const f = Math.min(extent - w, Math.max(0, from));
  return { from: f, to: f + w };
};

/** Scale the window by `factor` (< 1 zooms in) around `at` cents, kept inside 0 … extent. */
export function zoomAt(v: ZoomView, at: number, factor: number, extent: number): ZoomView {
  const width = v.to - v.from;
  const next = Math.min(extent, Math.max(MIN_ZOOM_WIDTH, width * factor));
  const t = width > 0 ? (at - v.from) / width : 0.5; // where `at` sits in the window, kept fixed
  return clampView(at - t * next, next, extent);
}

/** Move the window by `delta` cents, kept inside 0 … extent. */
export function panBy(v: ZoomView, delta: number, extent: number): ZoomView {
  return clampView(v.from + delta, v.to - v.from, extent);
}

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];

/** The finest grid step (cents) whose labels are at least `minPx` apart across `px` pixels. */
export function gridStep(widthCents: number, px: number, minPx = 44): number {
  return STEPS.find((s) => (s / widthCents) * px >= minPx) ?? STEPS.at(-1)!;
}
