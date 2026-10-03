export const WAVETABLE_SIZE = 2048;

/** Scale so Σa² = 1, i.e. the same RMS as a unit sine. */
export function normalizeRms(amps: number[]): number[] {
  const s = Math.sqrt(amps.reduce((acc, a) => acc + a * a, 0));
  return s > 0 ? amps.map((a) => a / s) : amps.slice();
}

/** Coefficients for createPeriodicWave: index 0 is DC, index k is harmonic k (sine phase). */
export function periodicWaveCoeffs(amps: number[]): { real: Float32Array<ArrayBuffer>; imag: Float32Array<ArrayBuffer> } {
  const real = new Float32Array(amps.length + 1);
  const imag = new Float32Array(amps.length + 1);
  amps.forEach((a, i) => (imag[i + 1] = a));
  return { real, imag };
}

/** One cycle of Σ a_k sin(k·x), x ∈ [0, 2π). */
export function buildWavetable(amps: number[], size = WAVETABLE_SIZE): Float32Array {
  const table = new Float32Array(size);
  for (let k = 0; k < amps.length; k++) {
    const a = amps[k];
    if (a === 0) continue;
    const h = k + 1;
    for (let i = 0; i < size; i++) table[i] += a * Math.sin((2 * Math.PI * h * i) / size);
  }
  return table;
}
