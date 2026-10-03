/**
 * Tracks which degrees each physical key (KeyboardEvent.code) started, with a per-degree
 * reference count, so keyup releases exactly what keydown started and a degree shared by
 * two held keys stops only when the last one is released.
 */
export function createKeyTracker() {
  const byKey = new Map<string, number[]>();
  const counts = new Map<number, number>();

  return {
    /** Registers a press; returns the degrees that should start sounding (count 0 -> 1). */
    press(code: string, degrees: number[]): number[] {
      if (byKey.has(code)) return [];
      byKey.set(code, degrees);
      const started: number[] = [];
      for (const d of degrees) {
        const n = counts.get(d) ?? 0;
        counts.set(d, n + 1);
        if (n === 0) started.push(d);
      }
      return started;
    },
    /** Returns the degrees that should stop (count -> 0), or null if the key isn't tracked. */
    release(code: string): number[] | null {
      const degrees = byKey.get(code);
      if (!degrees) return null;
      byKey.delete(code);
      const stopped: number[] = [];
      for (const d of degrees) {
        const n = (counts.get(d) ?? 0) - 1;
        if (n <= 0) { counts.delete(d); stopped.push(d); } else counts.set(d, n);
      }
      return stopped;
    },
    isActive(degree: number): boolean {
      return (counts.get(degree) ?? 0) > 0;
    },
    clear(): void {
      byKey.clear();
      counts.clear();
    },
  };
}
