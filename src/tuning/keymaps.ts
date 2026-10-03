/** Degrees triggered by a key. "f2" = key f, one octave up; plain "f" = base octave. */
export function degreesForKey(map: Record<string, string>, key: string, scaleLen: number): number[] {
  const k = key.toLowerCase();
  const out: number[] = [];
  for (const [deg, spec] of Object.entries(map)) {
    for (const raw of spec.split(',')) {
      const entry = raw.trim().toLowerCase();
      if (!entry) continue;
      if (entry.length === 1 && entry === k) out.push(Number(deg));
      else if (entry.length > 1 && entry[0] === k) {
        const octave = parseInt(entry.slice(1), 10);
        if (!Number.isNaN(octave)) out.push(Number(deg) + scaleLen * (octave - 1));
      }
    }
  }
  return out;
}
