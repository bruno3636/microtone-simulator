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

/**
 * Keys that play exactly `degree` (inverse of degreesForKey), uppercased and de-duplicated, in map
 * order — used for the key labels on the pitch cards.
 */
export function keysForDegree(map: Record<string, string>, degree: number, scaleLen: number): string[] {
  const out: string[] = [];
  for (const [deg, spec] of Object.entries(map)) {
    for (const raw of spec.split(',')) {
      const entry = raw.trim().toLowerCase();
      if (!entry) continue;
      let plays: number | null = null;
      if (entry.length === 1) plays = Number(deg);
      else {
        const octave = parseInt(entry.slice(1), 10);
        if (!Number.isNaN(octave)) plays = Number(deg) + scaleLen * (octave - 1);
      }
      const key = entry[0].toUpperCase();
      if (plays === degree && !out.includes(key)) out.push(key);
    }
  }
  return out;
}
