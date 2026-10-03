/** Geometry for animated drag-reordering of the pitch cards. */

export interface SlotRect { left: number; top: number; width: number; height: number }

/** Where card `j` previews while card `from` is dragged over slot `over`: the cards in between shift one place. */
export function previewIndex(j: number, from: number, over: number): number {
  if (j === from) return over;
  if (from < over && j > from && j <= over) return j - 1;
  if (from > over && j >= over && j < from) return j + 1;
  return j;
}

/** Index of the slot whose centre is nearest (x, y). */
export function nearestSlot(slots: SlotRect[], x: number, y: number): number {
  let best = 0;
  let bestD = Infinity;
  slots.forEach((s, i) => {
    const d = (s.left + s.width / 2 - x) ** 2 + (s.top + s.height / 2 - y) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}
