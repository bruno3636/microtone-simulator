export interface NoteInput { id: string; degree: number; freq: number; level: number }
export interface Partial { noteId: string; degree: number; harmonic: number; freq: number; amp: number }
export interface Coincidence { freq: number; members: Partial[] }
export interface NearMiss { a: Partial; b: Partial; cents: number; beatHz: number }

export function buildPartials(notes: NoteInput[], amps: number[], maxHz = 20000): Partial[] {
  const out: Partial[] = [];
  for (const n of notes) {
    for (let k = 1; k <= amps.length; k++) {
      const freq = k * n.freq;
      if (freq > maxHz) break;
      const amp = n.level * amps[k - 1];
      if (amp > 0) out.push({ noteId: n.id, degree: n.degree, harmonic: k, freq, amp });
    }
  }
  return out;
}

const cents = (f1: number, f2: number) => Math.abs(1200 * Math.log2(f2 / f1));

export function findCoincidences(
  partials: Partial[],
  { coincideCents = 0.5, nearCents = 30, minAmp = 0.05, maxNear = 8 } = {},
): { coincident: Coincidence[]; near: NearMiss[] } {
  const sorted = [...partials].sort((a, b) => a.freq - b.freq);
  const coincident: Coincidence[] = [];
  const near: NearMiss[] = [];

  // coincidence clusters: consecutive partials within coincideCents of the cluster's first member
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && cents(sorted[i].freq, sorted[j].freq) <= coincideCents) j++;
    const members = sorted.slice(i, j);
    if (new Set(members.map((m) => m.noteId)).size > 1) coincident.push({ freq: members[0].freq, members });
    i = j;
  }

  // near-misses: pairs from different notes, coincideCents < Δ ≤ nearCents
  for (let a = 0; a < sorted.length; a++) {
    for (let b = a + 1; b < sorted.length; b++) {
      const c = cents(sorted[a].freq, sorted[b].freq);
      if (c > nearCents) break;
      const pa = sorted[a];
      const pb = sorted[b];
      if (pa.noteId === pb.noteId || c <= coincideCents) continue;
      if (pa.amp < minAmp || pb.amp < minAmp) continue;
      near.push({ a: pa, b: pb, cents: c, beatHz: Math.abs(pb.freq - pa.freq) });
    }
  }
  near.sort((x, y) => Math.min(y.a.amp, y.b.amp) - Math.min(x.a.amp, x.b.amp));
  return { coincident, near: near.slice(0, maxNear) };
}
