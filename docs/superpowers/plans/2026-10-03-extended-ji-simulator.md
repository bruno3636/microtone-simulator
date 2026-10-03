# Extended Just Intonation Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React web app that rebuilds web_intonation with an animated wave/spectrum visualizer, a curved + tweakable harmonic editor (1–64), a draggable ADSR editor, a click-free gain-staged synth engine, and Trichord Trainer styling.

**Architecture:** Pure TypeScript modules (curves, harmonics, timbre, envelope, tuning, partials) hold all maths and are unit tested. An `AudioEngine` class outside React owns Web Audio (one `PeriodicWave` oscillator per voice). A Zustand store (persisted) holds settings. The visualizer canvas reads the engine and store every animation frame without React re-renders.

**Tech Stack:** Vite 8, React 19, TypeScript 5.9, Tailwind CSS 4 (`@tailwindcss/vite`), Zustand 5, mathjs 15, Vitest 5 + jsdom, @fontsource-variable (Newsreader, DM Sans, JetBrains Mono).

**Spec:** `docs/superpowers/specs/2026-10-03-extended-ji-simulator-design.md`

## Global Constraints

- App name, exactly: `Extended Just Intonation Simulator`.
- Harmonic count range: 1–64.
- No vibrato, chorus, detune, or modulation anywhere. The only effect is reverb ("Space"), default 0.
- Every envelope ramp is at least 3 ms. Retrigger and voice-steal fade: 8 ms. Polyphony cap: 24.
- Voice gain: `0.3 / sqrt(max(1, activeVoices))`, gliding with `setTargetAtTime` τ = 0.015 s.
- Compressor: threshold −12, knee 10, ratio 4, attack 0.003, release 0.25.
- Timbre RMS-normalized to a unit sine. `PeriodicWave` uses `disableNormalization: true`.
- Harmonic edits are debounced 50 ms and applied to held voices.
- Square corners, 1 px borders, no shadows. Fonts: Newsreader (display), DM Sans (body), JetBrains Mono (numbers).
- localStorage key `ejis-settings`, persist version 1. All storage access is try/catch-safe.
- No MIDI features or dependencies.
- Build output is static with `base: './'`.

## File Map

```
package.json, vite.config.ts, tsconfig.json, index.html
src/main.tsx                       mount + font imports
src/App.tsx                        page composition
src/index.css                      Tailwind import, theme tokens, base + component classes
src/audio/curves.ts                shapeCurve(a, b, t, c)
src/audio/harmonics.ts             HarmonicSettings, computeAmplitudes()
src/audio/timbre.ts                normalizeRms(), buildWavetable(), periodicWaveCoeffs()
src/audio/envelope.ts              EnvelopeSettings, levelAt(), releaseLevelAt(), sampleSegment()
src/audio/reverb.ts                createImpulseResponse()
src/audio/engine.ts                AudioEngine class + singleton `engine`
src/tuning/presets.ts              TUNINGS, SCALES, NOTE_FREQS, NOTE_NAMES, DEFAULT_KEYMAPS
src/tuning/ratios.ts               evalRatio(), degreeRatio(), degreeFreq(), isPure(), createFromTemplate()
src/tuning/interScale.ts           interScaleRatios()
src/tuning/keymaps.ts              degreesForKey()
src/viz/partials.ts                buildPartials(), findCoincidences()
src/viz/drawWave.ts                drawComputedWave(), drawLiveWave()
src/viz/drawSpectrum.ts            drawComputedSpectrum(), drawLiveSpectrum()
src/viz/Visualizer.tsx             canvas + rAF loop + mode controls
src/state/store.ts                 useStore (Zustand + persist), selectors
src/state/presets.ts               SYNTH_PRESETS
src/hooks/useKeyboard.ts           global key handling
src/hooks/useEngineSync.ts         pushes store settings into the engine
src/components/ui.tsx              Segmented, Slider, NumberField, Section, Button
src/components/Header.tsx          wordmark, volume, theme toggle
src/components/TuningPanel.tsx
src/components/SynthPanel.tsx      presets + editors + volume/space
src/components/HarmonicsEditor.tsx
src/components/EnvelopeEditor.tsx
src/components/DegreeGrid.tsx      grid + DegreeCard + AddDegreePopover
src/components/KeyboardMap.tsx
src/components/InterScaleRatios.tsx
src/theme.ts                       degreeColor(), theme mode helpers
public/theme-init.js               sets data-theme before React mounts
tests/*.test.ts                    unit tests for pure modules
```

---
### Task 1: Project scaffold, theme tokens, test runner

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `public/theme-init.js`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`, `tests/smoke.test.ts`, `.gitignore`

**Interfaces:**
- Produces: CSS tokens `--bg --bg-raised --border --border-subtle --text --text-secondary --text-muted --accent --error`; utility classes `.label`, `.panel`, `.btn`, `.btn-primary`, `.seg`, `.seg-item`, `.seg-item[data-active=true]`, `.input`, `.mono`, `.display`; `npm test`, `npm run dev`, `npm run build`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "extended-ji-simulator",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@fontsource-variable/dm-sans": "^5.3.0",
    "@fontsource-variable/jetbrains-mono": "^5.3.0",
    "@fontsource-variable/newsreader": "^5.3.0",
    "mathjs": "^15.2.0",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "zustand": "^5.0.15"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.1",
    "jsdom": "^30.1.1",
    "tailwindcss": "^4.3.3",
    "typescript": "~5.9.3",
    "vite": "^8.3.2",
    "vitest": "^5.0.3"
  }
}
```

- [ ] **Step 2: Write `vite.config.ts`, `tsconfig.json`, `.gitignore`, `src/vite-env.d.ts`**

`vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
});
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

`.gitignore`:
```
node_modules
dist
.DS_Store
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

- [ ] **Step 3: Write `index.html` and `public/theme-init.js`**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Extended Just Intonation Simulator</title>
    <meta name="description" content="Hear and see just intonation, temperaments and custom tunings with an additive synth, envelope editor and live wave/spectrum views." />
    <meta name="theme-color" content="#fffef8" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#111111" media="(prefers-color-scheme: dark)" />
    <script src="./theme-init.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`public/theme-init.js` (reads the persisted store; falls back to system):
```js
(function () {
  var mode = 'system';
  try {
    var raw = localStorage.getItem('ejis-settings');
    if (raw) mode = (JSON.parse(raw).state || {}).theme || 'system';
  } catch (e) {}
  var theme = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  document.documentElement.setAttribute('data-theme', theme);
})();
```

- [ ] **Step 4: Write `src/index.css`**

```css
@import 'tailwindcss';

@theme {
  --font-display: 'Newsreader Variable', Newsreader, serif;
  --font-body: 'DM Sans Variable', 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
}

:root,
[data-theme='light'] {
  --bg: #fffef8;
  --bg-raised: #fff;
  --border: oklch(22% 0.012 85);
  --border-subtle: #e0ddd4;
  --text: oklch(22% 0.018 85);
  --text-secondary: #777;
  --text-muted: #aaa;
  --accent: oklch(22% 0.026 85);
  --error: #9c5b51;
  color-scheme: light;
}

[data-theme='dark'] {
  --bg: #111;
  --bg-raised: #1a1a1a;
  --border: #2a2a2a;
  --border-subtle: #222;
  --text: #e5e5e5;
  --text-secondary: #888;
  --text-muted: #555;
  --accent: #e5e5e5;
  --error: #e85450;
  color-scheme: dark;
}

html, body { background: var(--bg); color: var(--text); }
body { font-family: var(--font-body); margin: 0; -webkit-font-smoothing: antialiased; }
* { border-radius: 0 !important; }

@layer components {
  .display { font-family: var(--font-display); font-weight: 400; letter-spacing: -0.01em; }
  .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
  .label { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-secondary); }
  .panel { background: var(--bg-raised); border: 1px solid var(--border-subtle); }
  .btn {
    border: 1px solid var(--border-subtle); background: transparent; color: var(--text);
    padding: 0.375rem 0.75rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em;
    cursor: pointer; transition: border-color 0.15s, background 0.15s;
  }
  .btn:hover { border-color: var(--border); }
  .btn-primary { background: var(--accent); color: var(--bg); border-color: var(--accent); }
  .seg { display: inline-flex; border: 1px solid var(--border-subtle); }
  .seg-item {
    padding: 0.375rem 0.75rem; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--text-secondary); background: transparent; border: 0; cursor: pointer;
  }
  .seg-item[data-active='true'] { background: var(--accent); color: var(--bg); }
  .input {
    background: var(--bg); color: var(--text); border: 1px solid var(--border-subtle);
    padding: 0.25rem 0.5rem; font-size: 0.8125rem;
  }
  .input:focus { outline: none; border-color: var(--border); }
  .input[aria-invalid='true'] { border-color: var(--error); color: var(--error); }
  input[type='range'] { accent-color: var(--accent); }
}
```

- [ ] **Step 5: Write `src/main.tsx` and placeholder `src/App.tsx`**

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/jetbrains-mono';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`:
```tsx
export default function App() {
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <h1 className="display text-3xl">Extended Just Intonation Simulator</h1>
    </main>
  );
}
```

- [ ] **Step 6: Write `tests/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('test runner', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Install and verify**

Run: `npm install && npm test && npm run build`
Expected: 1 test passes; build writes `dist/index.html` with no type errors.

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Vite + React + Tailwind app with theme tokens"
```

---
### Task 2: Curve shaping, harmonic amplitudes, timbre normalization

**Files:**
- Create: `src/audio/curves.ts`, `src/audio/harmonics.ts`, `src/audio/timbre.ts`
- Test: `tests/curves.test.ts`, `tests/harmonics.test.ts`, `tests/timbre.test.ts`

**Interfaces:**
- Produces:
  - `shapeCurve(a: number, b: number, t: number, c: number): number`. `c ∈ [−1,1]`; `c > 0` is convex (below the chord), `c < 0` concave.
  - `type HarmonicFilter = 'all' | 'odd' | 'even'`
  - `interface HarmonicSettings { count: number; start: number; end: number; curve: number; filter: HarmonicFilter; tweaks: Record<number, number> }` (tweak keys are harmonic numbers, 1-based)
  - `MAX_HARMONICS = 64`
  - `computeAmplitudes(s: HarmonicSettings): number[]`. Index 0 is harmonic 1; length = clamped count.
  - `normalizeRms(amps: number[]): number[]`. Σa² = 1.
  - `periodicWaveCoeffs(amps: number[]): { real: Float32Array<ArrayBuffer>; imag: Float32Array<ArrayBuffer> }`
  - `WAVETABLE_SIZE = 2048`; `buildWavetable(amps: number[], size?: number): Float32Array` (one cycle of Σ a_k sin(k·x))

- [ ] **Step 1: Write failing tests**

`tests/curves.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { shapeCurve } from '../src/audio/curves';

describe('shapeCurve', () => {
  it('hits endpoints exactly for any curve', () => {
    for (const c of [-1, -0.5, 0, 0.5, 1]) {
      expect(shapeCurve(0.2, 0.9, 0, c)).toBeCloseTo(0.2, 10);
      expect(shapeCurve(0.2, 0.9, 1, c)).toBeCloseTo(0.9, 10);
    }
  });
  it('is linear at c = 0', () => {
    expect(shapeCurve(0, 1, 0.25, 0)).toBeCloseTo(0.25);
    expect(shapeCurve(1, 0, 0.25, 0)).toBeCloseTo(0.75);
  });
  it('EXP (c > 0) bends below the chord, rising and falling', () => {
    expect(shapeCurve(0, 1, 0.5, 1)).toBeLessThan(0.5);
    expect(shapeCurve(1, 0, 0.5, 1)).toBeLessThan(0.5);
  });
  it('LOG (c < 0) bends above the chord, rising and falling', () => {
    expect(shapeCurve(0, 1, 0.5, -1)).toBeGreaterThan(0.5);
    expect(shapeCurve(1, 0, 0.5, -1)).toBeGreaterThan(0.5);
  });
  it('clamps t to [0, 1]', () => {
    expect(shapeCurve(0, 1, -2, 0.5)).toBe(0);
    expect(shapeCurve(0, 1, 3, 0.5)).toBeCloseTo(1);
  });
});
```

`tests/harmonics.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeAmplitudes, type HarmonicSettings } from '../src/audio/harmonics';

const base: HarmonicSettings = { count: 8, start: 1, end: 0.1, curve: 0, filter: 'all', tweaks: {} };

describe('computeAmplitudes', () => {
  it('count 1 is a pure sine', () => {
    expect(computeAmplitudes({ ...base, count: 1 })).toEqual([1]);
  });
  it('interpolates start to end linearly at curve 0', () => {
    const a = computeAmplitudes({ ...base, count: 3, start: 1, end: 0 });
    expect(a[0]).toBeCloseTo(1);
    expect(a[1]).toBeCloseTo(0.5);
    expect(a[2]).toBeCloseTo(0);
  });
  it('clamps count to 1..64', () => {
    expect(computeAmplitudes({ ...base, count: 100 })).toHaveLength(64);
    expect(computeAmplitudes({ ...base, count: 0 })).toHaveLength(1);
  });
  it('tweaks override the curve', () => {
    const a = computeAmplitudes({ ...base, tweaks: { 3: 0.77 } });
    expect(a[2]).toBeCloseTo(0.77);
  });
  it('ignores tweaks above count but they do not break anything', () => {
    expect(computeAmplitudes({ ...base, count: 2, tweaks: { 5: 1 } })).toHaveLength(2);
  });
  it('odd filter zeroes even harmonics, keeps fundamental', () => {
    const a = computeAmplitudes({ ...base, filter: 'odd' });
    expect(a[0]).toBeGreaterThan(0);
    expect(a[1]).toBe(0);
    expect(a[2]).toBeGreaterThan(0);
    expect(a[3]).toBe(0);
  });
  it('even filter zeroes odd harmonics above 1, keeps fundamental', () => {
    const a = computeAmplitudes({ ...base, filter: 'even' });
    expect(a[0]).toBeGreaterThan(0);
    expect(a[1]).toBeGreaterThan(0);
    expect(a[2]).toBe(0);
  });
  it('falls back to a sine when everything is zero', () => {
    expect(computeAmplitudes({ ...base, count: 4, start: 0, end: 0 })).toEqual([1, 0, 0, 0]);
  });
});
```

`tests/timbre.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalizeRms, periodicWaveCoeffs, buildWavetable } from '../src/audio/timbre';

describe('timbre', () => {
  it('normalizeRms gives sum of squares = 1', () => {
    expect(normalizeRms([3, 4])).toEqual([0.6, 0.8]);
    expect(normalizeRms([1])).toEqual([1]);
  });
  it('periodicWaveCoeffs puts amplitudes in imag[1..]', () => {
    const { real, imag } = periodicWaveCoeffs([0.5, 0.25]);
    expect(real).toHaveLength(3);
    expect(Array.from(imag)).toEqual([0, 0.5, 0.25]);
    expect(Array.from(real)).toEqual([0, 0, 0]);
  });
  it('wavetable matches the analytic sum', () => {
    const amps = [0.5, 0.25];
    const t = buildWavetable(amps, 64);
    const i = 5;
    const x = (2 * Math.PI * i) / 64;
    expect(t[i]).toBeCloseTo(0.5 * Math.sin(x) + 0.25 * Math.sin(2 * x), 5);
  });
  it('normalized timbre has unit-sine RMS', () => {
    const t = buildWavetable(normalizeRms([1, 0.5, 0.3, 0.2]), 2048);
    const rms = Math.sqrt(t.reduce((s, v) => s + v * v, 0) / t.length);
    expect(rms).toBeCloseTo(Math.SQRT1_2, 3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/curves.test.ts tests/harmonics.test.ts tests/timbre.test.ts`
Expected: FAIL (cannot resolve modules).

- [ ] **Step 3: Implement `src/audio/curves.ts`**

```ts
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Bend a segment a → b over t ∈ [0,1]. c > 0 (EXP) is convex (below the chord),
 * c < 0 (LOG) is concave (above the chord), whether the segment rises or falls.
 */
export function shapeCurve(a: number, b: number, t: number, c: number): number {
  const x = clamp01(t);
  if (Math.abs(c) < 1e-6 || a === b) return a + (b - a) * x;
  const k = 8 * Math.abs(c);
  const grow = (u: number) => (Math.exp(k * u) - 1) / (Math.exp(k) - 1); // convex, below diagonal
  const ease = (u: number) => 1 - grow(1 - u); // concave, above diagonal
  const rising = b > a;
  const convex = c > 0;
  const g = rising === convex ? grow : ease;
  return a + (b - a) * g(x);
}
```

- [ ] **Step 4: Implement `src/audio/harmonics.ts`**

```ts
import { shapeCurve } from './curves';

export type HarmonicFilter = 'all' | 'odd' | 'even';

export interface HarmonicSettings {
  count: number;
  start: number;
  end: number;
  curve: number;
  filter: HarmonicFilter;
  /** harmonic number (1-based) → level 0..1 */
  tweaks: Record<number, number>;
}

export const MAX_HARMONICS = 64;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function computeAmplitudes(s: HarmonicSettings): number[] {
  const count = Math.round(clamp(s.count, 1, MAX_HARMONICS));
  const out: number[] = [];
  for (let n = 1; n <= count; n++) {
    const t = count === 1 ? 0 : (n - 1) / (count - 1);
    let a = s.tweaks[n] ?? shapeCurve(s.start, s.end, t, s.curve);
    a = clamp(a, 0, 1);
    if (n > 1 && ((s.filter === 'odd' && n % 2 === 0) || (s.filter === 'even' && n % 2 === 1))) a = 0;
    out.push(a);
  }
  if (out.every((a) => a <= 0)) {
    out.fill(0);
    out[0] = 1;
  }
  return out;
}
```

- [ ] **Step 5: Implement `src/audio/timbre.ts`**

```ts
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/curves.test.ts tests/harmonics.test.ts tests/timbre.test.ts`
Expected: PASS (all).

- [ ] **Step 7: Commit**

```bash
git add src/audio/curves.ts src/audio/harmonics.ts src/audio/timbre.ts tests/curves.test.ts tests/harmonics.test.ts tests/timbre.test.ts
git commit -m "feat: curve shaping, harmonic amplitudes, RMS-normalized timbre"
```

---
### Task 3: Envelope maths

**Files:**
- Create: `src/audio/envelope.ts`
- Test: `tests/envelope.test.ts`

**Interfaces:**
- Consumes: `shapeCurve` (Task 2)
- Produces:
  - `type CurveKind = 'lin' | 'exp' | 'log'`; `CURVE_AMOUNT: Record<CurveKind, number>` = `{ lin: 0, exp: 0.6, log: -0.6 }`
  - `interface EnvelopeSettings { attack: number; decay: number; sustain: number; release: number; attackCurve: CurveKind; decayCurve: CurveKind; releaseCurve: CurveKind }`. Times in ms; sustain 0..1.
  - `MIN_RAMP_MS = 3`; `effMs(ms: number): number` (applies the floor)
  - `levelAt(env: EnvelopeSettings, tMs: number): number`. Level while held, `tMs` since note-on.
  - `releaseLevelAt(env: EnvelopeSettings, fromLevel: number, tMs: number): number`. `tMs` since note-off.
  - `sampleSegment(from: number, to: number, curve: CurveKind, points?: number): Float32Array` (default 256 points)

- [ ] **Step 1: Write failing tests** — `tests/envelope.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { levelAt, releaseLevelAt, sampleSegment, effMs, type EnvelopeSettings } from '../src/audio/envelope';

const env: EnvelopeSettings = {
  attack: 100, decay: 200, sustain: 0.5, release: 400,
  attackCurve: 'lin', decayCurve: 'lin', releaseCurve: 'lin',
};

describe('envelope', () => {
  it('starts at 0 and peaks at the end of attack', () => {
    expect(levelAt(env, 0)).toBe(0);
    expect(levelAt(env, 50)).toBeCloseTo(0.5);
    expect(levelAt(env, 100)).toBeCloseTo(1);
  });
  it('decays to sustain and holds', () => {
    expect(levelAt(env, 200)).toBeCloseTo(0.75);
    expect(levelAt(env, 300)).toBeCloseTo(0.5);
    expect(levelAt(env, 10_000)).toBeCloseTo(0.5);
  });
  it('releases from an arbitrary level to 0', () => {
    expect(releaseLevelAt(env, 0.3, 0)).toBeCloseTo(0.3);
    expect(releaseLevelAt(env, 0.3, 200)).toBeCloseTo(0.15);
    expect(releaseLevelAt(env, 0.3, 400)).toBe(0);
    expect(releaseLevelAt(env, 0.3, 1000)).toBe(0);
  });
  it('applies the 3 ms floor to zero-length segments', () => {
    expect(effMs(0)).toBe(3);
    const zero = { ...env, attack: 0 };
    expect(levelAt(zero, 1.5)).toBeCloseTo(0.5);
    expect(levelAt(zero, 3)).toBeCloseTo(1);
  });
  it('sampleSegment returns exact endpoints and the requested length', () => {
    const s = sampleSegment(1, 0.2, 'exp', 256);
    expect(s).toHaveLength(256);
    expect(s[0]).toBeCloseTo(1);
    expect(s[255]).toBeCloseTo(0.2);
    expect(s[128]).toBeLessThan(0.6); // EXP is below the chord
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/envelope.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/audio/envelope.ts`**

```ts
import { shapeCurve } from './curves';

export type CurveKind = 'lin' | 'exp' | 'log';
export const CURVE_AMOUNT: Record<CurveKind, number> = { lin: 0, exp: 0.6, log: -0.6 };

export interface EnvelopeSettings {
  attack: number; // ms
  decay: number; // ms
  sustain: number; // 0..1
  release: number; // ms
  attackCurve: CurveKind;
  decayCurve: CurveKind;
  releaseCurve: CurveKind;
}

export const MIN_RAMP_MS = 3;
export const effMs = (ms: number) => Math.max(MIN_RAMP_MS, ms);

export function levelAt(env: EnvelopeSettings, tMs: number): number {
  const a = effMs(env.attack);
  const d = effMs(env.decay);
  if (tMs <= 0) return 0;
  if (tMs < a) return shapeCurve(0, 1, tMs / a, CURVE_AMOUNT[env.attackCurve]);
  if (tMs < a + d) return shapeCurve(1, env.sustain, (tMs - a) / d, CURVE_AMOUNT[env.decayCurve]);
  return env.sustain;
}

export function releaseLevelAt(env: EnvelopeSettings, fromLevel: number, tMs: number): number {
  const r = effMs(env.release);
  if (tMs <= 0) return fromLevel;
  if (tMs >= r) return 0;
  return shapeCurve(fromLevel, 0, tMs / r, CURVE_AMOUNT[env.releaseCurve]);
}

export function sampleSegment(from: number, to: number, curve: CurveKind, points = 256): Float32Array {
  const out = new Float32Array(points);
  for (let i = 0; i < points; i++) out[i] = shapeCurve(from, to, i / (points - 1), CURVE_AMOUNT[curve]);
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/envelope.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/audio/envelope.ts tests/envelope.test.ts
git commit -m "feat: ADSR envelope maths with curved segments and 3ms floor"
```

---
### Task 4: Tuning data, ratio evaluation, key maps, inter-scale ratios

**Files:**
- Create: `src/tuning/presets.ts`, `src/tuning/ratios.ts`, `src/tuning/keymaps.ts`, `src/tuning/interScale.ts`
- Test: `tests/ratios.test.ts`, `tests/keymaps.test.ts`, `tests/interScale.test.ts`

**Interfaces:**
- Produces:
  - `interface Tuning { label: string; scalable: boolean; notes: string[] }`; `TUNINGS: Record<string, Tuning>`; `SCALES: Record<string, number[]>`
  - `NOTE_NAMES: string[]` (12 names); `NOTE_FREQS: Record<string, number>`; `DEFAULT_KEYMAPS: Record<string, Record<string, string>>` (`scale`, `chords`)
  - `mod(n: number, m: number): number`
  - `evalRatio(expr: string): number | null`
  - `degreeRatio(notes: string[], degree: number): number | null` (octave-aware)
  - `degreeFreq(notes: string[], degree: number, rootHz: number): number | null`
  - `isPure(expr: string): boolean`
  - `createFromTemplate(tuning: string, scale: string): { notes: string[]; scale: string }`
  - `degreesForKey(map: Record<string, string>, key: string, scaleLen: number): number[]`
  - `toFraction(v: number): string | null`
  - `interface InterRatio { lo: number; hi: number; exact: string; decimal: string }`
  - `interScaleRatios(notes: string[], degrees: number[]): InterRatio[][]`

- [ ] **Step 1: Write failing tests**

`tests/ratios.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { evalRatio, degreeRatio, degreeFreq, isPure, createFromTemplate, mod } from '../src/tuning/ratios';
import { TUNINGS } from '../src/tuning/presets';

describe('ratios', () => {
  it('evaluates every preset expression to a positive number', () => {
    for (const t of Object.values(TUNINGS)) for (const n of t.notes) expect(evalRatio(n)).toBeGreaterThan(0);
  });
  it('evaluates JI and ET expressions', () => {
    expect(evalRatio('1 + 1/2')).toBeCloseTo(1.5);
    expect(evalRatio('2^(7/12)')).toBeCloseTo(1.4983, 4);
    expect(evalRatio('nthRoot(5,4)')).toBeCloseTo(1.4953, 4);
  });
  it('returns null for invalid or non-positive input', () => {
    expect(evalRatio('1 +')).toBeNull();
    expect(evalRatio('foo')).toBeNull();
    expect(evalRatio('0')).toBeNull();
    expect(evalRatio('')).toBeNull();
  });
  it('mod handles negatives', () => {
    expect(mod(-1, 7)).toBe(6);
  });
  it('maps degrees across octaves', () => {
    const notes = ['1', '5/4', '3/2'];
    expect(degreeRatio(notes, 4)).toBeCloseTo(2.5);
    expect(degreeRatio(notes, -1)).toBeCloseTo(0.75);
    expect(degreeFreq(notes, 2, 440)).toBeCloseTo(660);
    expect(degreeRatio(['1', 'bad'], 1)).toBeNull();
  });
  it('detects pure intervals', () => {
    expect(isPure('3/2')).toBe(true);
    expect(isPure('1 + 1/4')).toBe(true);
    expect(isPure('2^(7/12)')).toBe(false);
  });
  it('builds a scale from a template and forces chromatic for non-scalable tunings', () => {
    const maj = createFromTemplate('just_intonation', 'major');
    expect(maj.notes).toHaveLength(7);
    expect(maj.notes[4]).toBe('1 + 1/2');
    const hs = createFromTemplate('harmonic_series', 'major');
    expect(hs.scale).toBe('chromatic');
    expect(hs.notes).toHaveLength(12);
  });
});
```

`tests/keymaps.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { degreesForKey } from '../src/tuning/keymaps';

const map = { 0: 'a', 1: 's', 2: 'a,f2', 7: 'k,z,y' };

describe('degreesForKey', () => {
  it('finds plain keys, including multiple degrees for one key', () => {
    expect(degreesForKey(map, 'a', 7)).toEqual([0, 2]);
    expect(degreesForKey(map, 'y', 7)).toEqual([7]);
  });
  it('octave suffix shifts by scale length', () => {
    expect(degreesForKey(map, 'f', 7)).toEqual([2 + 7]);
  });
  it('is case-insensitive and ignores unknown keys', () => {
    expect(degreesForKey(map, 'S', 7)).toEqual([1]);
    expect(degreesForKey(map, 'q', 7)).toEqual([]);
  });
});
```

`tests/interScale.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { interScaleRatios, toFraction } from '../src/tuning/interScale';

describe('inter-scale ratios', () => {
  it('toFraction finds small rationals and rejects irrationals', () => {
    expect(toFraction(1.2)).toBe('6/5');
    expect(toFraction(1.5)).toBe('3/2');
    expect(toFraction(2 ** (1 / 12))).toBeNull();
  });
  it('pairs every shown degree with every higher one', () => {
    const notes = ['1', '1 + 1/4', '1 + 1/2'];
    const rows = interScaleRatios(notes, [2, 0, 1]);
    expect(rows).toHaveLength(2);
    expect(rows[0].map((r) => [r.lo, r.hi, r.exact])).toEqual([[0, 1, '5/4'], [0, 2, '3/2']]);
    expect(rows[1][0]).toMatchObject({ lo: 1, hi: 2, exact: '6/5', decimal: '1.200' });
  });
  it('dedupes octave copies and needs at least two degrees', () => {
    expect(interScaleRatios(['1', '3/2'], [0, 2])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/ratios.test.ts tests/keymaps.test.ts tests/interScale.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `src/tuning/presets.ts`**

```ts
export interface Tuning { label: string; scalable: boolean; notes: string[] }

export const TUNINGS: Record<string, Tuning> = {
  just_intonation: {
    label: 'Just intonation', scalable: true,
    notes: ['1', '1 + 1/15', '1 + 1/8', '1 + 1/5', '1 + 1/4', '1 + 1/3', '1 + 13/32', '1 + 1/2', '1 + 3/5', '1 + 2/3', '1 + 4/5', '1 + 7/8'],
  },
  equal_temperament: {
    label: 'Equal temperament', scalable: true,
    notes: ['1', '2^(1/12)', '2^(2/12)', '2^(3/12)', '2^(4/12)', '2^(5/12)', '2^(6/12)', '2^(7/12)', '2^(8/12)', '2^(9/12)', '2^(10/12)', '2^(11/12)'],
  },
  pythagorean_tuning: {
    label: 'Pythagorean', scalable: true,
    notes: ['1', '2^8 / 3^5', '3^2 / 2^3', '2^5 / 3^3', '3^4 / 2^6', '2^2 / 3', '2^10 / 3^6', '3 / 2', '2^7 / 3^4', '3^3 / 2^4', '2^4 / 3^2', '3^5 / 2^7'],
  },
  meantone_temperament: {
    label: 'Meantone', scalable: true,
    notes: ['1', '5/16 * nthRoot(5^3, 4)', '1/2 * sqrt(5)', '4/5 * nthRoot(5,4)', '1 + 1/4', '2/5 * nthRoot(5^3,4)', '5/8 * sqrt(5)', 'nthRoot(5,4)', '25/16', '1/2 * nthRoot(5^3,4)', '4/5 * sqrt(5)', '5/4 * nthRoot(5,4)'],
  },
  harmonic_series: {
    label: 'Harmonic series', scalable: false,
    notes: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  },
  custom_equal_scale: {
    label: 'Custom equal (7)', scalable: false,
    notes: ['1', '1 + 1/7', '1 + 2/7', '1 + 3/7', '1 + 4/7', '1 + 5/7', '1 + 6/7'],
  },
  custom_spooky: {
    label: 'Custom spooky', scalable: false,
    notes: ['1/1', '1.6', '1.87'],
  },
};

export const SCALES: Record<string, number[]> = {
  major: [1, 3, 5, 6, 8, 10, 12],
  'natural minor': [1, 3, 4, 6, 8, 9, 11],
  'harmonic minor': [1, 3, 4, 6, 8, 9, 12],
  chromatic: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

export const NOTE_NAMES = ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'];

// Same octave layout as the original (A = 440 Hz, A4 … G#5).
const M = 8;
export const NOTE_FREQS: Record<string, number> = {
  A: 55 * M, 'A#/Bb': 58.2705 * M, B: 61.7354 * M, C: 65.4064 * M, 'C#/Db': 69.2957 * M, D: 73.4162 * M,
  'D#/Eb': 77.7817 * M, E: 82.4069 * M, F: 87.3071 * M, 'F#/Gb': 92.4986 * M, G: 97.9989 * M, 'G#/Ab': 103.826 * M,
};

export const DEFAULT_KEYMAPS: Record<string, Record<string, string>> = {
  scale: { 0: 'a', 1: 's', 2: 'd', 3: 'f', 4: 'g', 5: 'h', 6: 'j', 7: 'k,z,y', 8: 'l,x', 9: 'c', 10: 'v', 11: 'b', 12: 'n', 13: 'm' },
  chords: { 0: 'a,f2,h2', 1: 's,g2,j', 2: 'a,d,h2', 3: 's,f,j2', 4: 'a,d,g', 5: 's,f,h', 6: 'j,d,g', 7: 'z,y', 8: 'x', 9: 'c', 10: 'v', 11: 'b', 12: 'n', 13: 'm' },
};
```

- [ ] **Step 4: Implement `src/tuning/ratios.ts`**

```ts
import { evaluate } from 'mathjs';
import { TUNINGS, SCALES } from './presets';

export const mod = (n: number, m: number) => ((n % m) + m) % m;

export function evalRatio(expr: string): number | null {
  if (expr == null || String(expr).trim() === '') return null;
  try {
    const v = evaluate(String(expr));
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function degreeRatio(notes: string[], degree: number): number | null {
  const len = notes.length;
  if (len === 0) return null;
  const r = evalRatio(notes[mod(degree, len)]);
  return r == null ? null : r * 2 ** Math.floor(degree / len);
}

export function degreeFreq(notes: string[], degree: number, rootHz: number): number | null {
  const r = degreeRatio(notes, degree);
  return r == null ? null : r * rootHz;
}

const PURE = TUNINGS.just_intonation.notes.map((n) => evalRatio(n)!);

/** True when the ratio is an integer multiple of a just-intonation interval (same rule as the original). */
export function isPure(expr: string): boolean {
  const r = evalRatio(expr);
  if (r == null) return false;
  return PURE.some((p) => {
    const q = r / p;
    return Math.round(q) >= 1 && Math.abs(q - Math.round(q)) < 1e-9;
  });
}

export function createFromTemplate(tuning: string, scale: string): { notes: string[]; scale: string } {
  const t = TUNINGS[tuning];
  const s = t.scalable ? scale : 'chromatic';
  const idx = SCALES[s].slice(0, t.notes.length);
  return { notes: idx.map((n) => t.notes[n - 1]), scale: s };
}
```

- [ ] **Step 5: Implement `src/tuning/keymaps.ts`**

```ts
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
```

- [ ] **Step 6: Implement `src/tuning/interScale.ts`**

```ts
import { simplify } from 'mathjs';
import { evalRatio, mod } from './ratios';

export interface InterRatio { lo: number; hi: number; exact: string; decimal: string }

/** Best rational p/q with q ≤ 4096 within 1e-10, else null. Continued fractions. */
export function toFraction(v: number): string | null {
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  let x = v;
  for (let i = 0; i < 32; i++) {
    const a = Math.floor(x);
    [h0, h1] = [h1, a * h1 + h0];
    [k0, k1] = [k1, a * k1 + k0];
    if (k1 > 4096) return null;
    if (Math.abs(h1 / k1 - v) < 1e-10) return `${h1}/${k1}`;
    const frac = x - a;
    if (frac < 1e-12) return null;
    x = 1 / frac;
  }
  return null;
}

export function interScaleRatios(notes: string[], degrees: number[]): InterRatio[][] {
  const len = notes.length;
  const ds = [...new Set(degrees.map((d) => mod(d, len)))].sort((a, b) => a - b);
  const rows: InterRatio[][] = [];
  for (let i = 0; i < ds.length - 1; i++) {
    const row: InterRatio[] = [];
    for (let j = i + 1; j < ds.length; j++) {
      const lo = evalRatio(notes[ds[i]]);
      const hi = evalRatio(notes[ds[j]]);
      if (lo == null || hi == null) continue;
      const v = hi / lo;
      let exact = toFraction(v);
      if (exact == null) {
        try {
          exact = simplify(`(${notes[ds[j]]}) / (${notes[ds[i]]})`).toString().replace(/\s+/g, '');
        } catch {
          exact = '—';
        }
      }
      row.push({ lo: ds[i], hi: ds[j], exact, decimal: v.toFixed(3) });
    }
    rows.push(row);
  }
  return rows;
}
```

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run tests/ratios.test.ts tests/keymaps.test.ts tests/interScale.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/tuning tests/ratios.test.ts tests/keymaps.test.ts tests/interScale.test.ts
git commit -m "feat: tuning presets, ratio evaluation, key maps, inter-scale ratios"
```

---
### Task 5: Spectrum partials, coincidences and near-misses

**Files:**
- Create: `src/viz/partials.ts`
- Test: `tests/partials.test.ts`

**Interfaces:**
- Produces:
  - `interface NoteInput { id: string; degree: number; freq: number; level: number }`
  - `interface Partial { noteId: string; degree: number; harmonic: number; freq: number; amp: number }` (`amp` = level × normalized harmonic amp)
  - `buildPartials(notes: NoteInput[], amps: number[], maxHz?: number): Partial[]` (default `maxHz` 20000, skips amp ≤ 0)
  - `interface Coincidence { freq: number; members: Partial[] }`
  - `interface NearMiss { a: Partial; b: Partial; cents: number; beatHz: number }`
  - `findCoincidences(partials: Partial[], opts?: { coincideCents?: number; nearCents?: number; minAmp?: number; maxNear?: number }): { coincident: Coincidence[]; near: NearMiss[] }` (defaults 0.5 / 30 / 0.05 / 8)

- [ ] **Step 1: Write failing tests** — `tests/partials.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { buildPartials, findCoincidences } from '../src/viz/partials';

const amps = [1, 0.5, 0.4, 0.3];

describe('partials', () => {
  it('builds k·f partials scaled by level, capped at maxHz', () => {
    const p = buildPartials([{ id: '0', degree: 0, freq: 6000, level: 0.5 }], amps);
    expect(p.map((x) => x.freq)).toEqual([6000, 12000, 18000]);
    expect(p[1].amp).toBeCloseTo(0.25);
  });
  it('a just fifth (3:2) has coinciding partials', () => {
    const p = buildPartials(
      [{ id: '0', degree: 0, freq: 200, level: 1 }, { id: '4', degree: 4, freq: 300, level: 1 }],
      amps,
    );
    const { coincident, near } = findCoincidences(p);
    expect(coincident.map((c) => Math.round(c.freq))).toContain(600);
    expect(near).toHaveLength(0);
  });
  it('an equal-tempered fifth produces a near-miss with the right beat rate', () => {
    const f2 = 200 * 2 ** (7 / 12);
    const p = buildPartials(
      [{ id: '0', degree: 0, freq: 200, level: 1 }, { id: '7', degree: 7, freq: f2, level: 1 }],
      amps,
    );
    const { coincident, near } = findCoincidences(p);
    expect(coincident).toHaveLength(0);
    const m = near.find((n) => Math.round(Math.max(n.a.freq, n.b.freq)) === 600)!;
    expect(m.beatHz).toBeCloseTo(Math.abs(600 - 2 * f2), 3);
    expect(m.cents).toBeGreaterThan(1.5);
  });
  it('limits near-miss labels to maxNear, strongest first', () => {
    const notes = [0, 1, 2, 3, 4, 5].map((i) => ({ id: String(i), degree: i, freq: 200 * 2 ** (i / 120), level: 1 }));
    const { near } = findCoincidences(buildPartials(notes, amps), { maxNear: 3 });
    expect(near).toHaveLength(3);
    const strength = (n: (typeof near)[0]) => Math.min(n.a.amp, n.b.amp);
    expect(strength(near[0])).toBeGreaterThanOrEqual(strength(near[2]));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/partials.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/viz/partials.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/partials.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/viz/partials.ts tests/partials.test.ts
git commit -m "feat: spectrum partials with coincidence and near-miss detection"
```

---
### Task 6: Audio engine (voices, envelopes, gain staging, timbre, reverb)

**Files:**
- Create: `src/audio/reverb.ts`, `src/audio/engine.ts`, `tests/fakeAudio.ts`
- Test: `tests/engine.test.ts`

**Interfaces:**
- Consumes: `computeAmplitudes`, `HarmonicSettings` (Task 2); `normalizeRms`, `periodicWaveCoeffs`, `buildWavetable` (Task 2); `EnvelopeSettings`, `levelAt`, `releaseLevelAt`, `effMs` (Task 3); `shapeCurve` (Task 2); `CURVE_AMOUNT` (Task 3)
- Produces:
  - `createImpulseResponse(ctx: BaseAudioContext, seconds?: number): AudioBuffer`
  - `type VoiceStage = 'attack' | 'decay' | 'sustain' | 'release'`
  - `interface VoiceSnapshot { id: string; freq: number; level: number; stage: VoiceStage; elapsedMs: number; env: EnvelopeSettings }` (`elapsedMs` = since note-on, or since note-off when releasing)
  - `MAX_VOICES = 24`, `FADE_S = 0.008`, `BASE_VOICE_GAIN = 0.3`, `GAIN_TAU = 0.015`, `voiceGain(n: number): number`
  - `class AudioEngine` with `constructor(createContext?: () => AudioContext)`, `resume(): void`, `noteOn(id: string, freq: number): void`, `noteOff(id: string): void`, `allNotesOff(): void`, `setTimbre(h: HarmonicSettings): void`, `setEnvelope(e: EnvelopeSettings): void`, `setMasterVolume(v: number): void`, `setReverbMix(m: number): void`, `getVoices(): VoiceSnapshot[]`, `getAmplitudes(): number[]` (normalized), `getWavetable(): Float32Array`, `getAnalyser(): AnalyserNode | null`, `isHeld(id: string): boolean`
  - `export const engine: AudioEngine` (app singleton)

- [ ] **Step 1: Write the fake Web Audio test double** — `tests/fakeAudio.ts`

```ts
type Ev = { type: string; value?: number; time: number; tau?: number };

export class FakeParam {
  value: number;
  events: Ev[] = [];
  constructor(v = 0) { this.value = v; }
  setValueAtTime(value: number, time: number) { this.events.push({ type: 'set', value, time }); this.value = value; return this; }
  linearRampToValueAtTime(value: number, time: number) { this.events.push({ type: 'ramp', value, time }); return this; }
  setTargetAtTime(value: number, time: number, tau: number) { this.events.push({ type: 'target', value, time, tau }); return this; }
  cancelScheduledValues(time: number) { this.events.push({ type: 'cancel', time }); return this; }
  last(type: string) { return [...this.events].reverse().find((e) => e.type === type); }
}

class FakeNode {
  connections: unknown[] = [];
  connect<T>(n: T) { this.connections.push(n); return n; }
  disconnect() { this.connections = []; }
}

export class FakeGain extends FakeNode { gain = new FakeParam(1); }

export class FakeOsc extends FakeNode {
  frequency = new FakeParam(440);
  wave: unknown = null;
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  onended: (() => void) | null = null;
  setPeriodicWave(w: unknown) { this.wave = w; }
  start(t: number) { this.startedAt = t; }
  stop(t: number) { this.stoppedAt = t; }
  end() { this.onended?.(); }
}

export class FakeCompressor extends FakeNode {
  threshold = new FakeParam(); knee = new FakeParam(); ratio = new FakeParam();
  attack = new FakeParam(); release = new FakeParam();
}

export class FakeConvolver extends FakeNode { buffer: unknown = null; }
export class FakeAnalyser extends FakeNode { fftSize = 2048; smoothingTimeConstant = 0.8; }

export class FakeContext {
  currentTime = 0;
  sampleRate = 48000;
  state = 'running';
  destination = new FakeNode();
  oscillators: FakeOsc[] = [];
  waves: { real: Float32Array; imag: Float32Array; opts: unknown }[] = [];
  resume() { return Promise.resolve(); }
  createGain() { return new FakeGain(); }
  createOscillator() { const o = new FakeOsc(); this.oscillators.push(o); return o; }
  createDynamicsCompressor() { return new FakeCompressor(); }
  createConvolver() { return new FakeConvolver(); }
  createAnalyser() { return new FakeAnalyser(); }
  createPeriodicWave(real: Float32Array, imag: Float32Array, opts: unknown) {
    const w = { real, imag, opts }; this.waves.push(w); return w;
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, getChannelData: (c: number) => data[c] };
  }
}

export const asCtx = (f: FakeContext) => f as unknown as AudioContext;
```

- [ ] **Step 2: Implement `src/audio/reverb.ts`** (tiny and deterministic in shape; covered by engine tests)

```ts
/** Stereo exponentially decaying noise, used as a convolution reverb impulse. */
export function createImpulseResponse(ctx: BaseAudioContext, seconds = 2.5): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp((-6 * i) / length);
  }
  return buf;
}
```

- [ ] **Step 3: Write failing engine tests** — `tests/engine.test.ts`

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AudioEngine, MAX_VOICES, voiceGain } from '../src/audio/engine';
import { levelAt, type EnvelopeSettings } from '../src/audio/envelope';
import { FakeContext, FakeGain, asCtx } from './fakeAudio';

const env: EnvelopeSettings = {
  attack: 100, decay: 100, sustain: 0.5, release: 200,
  attackCurve: 'lin', decayCurve: 'lin', releaseCurve: 'lin',
};

let fake: FakeContext;
let eng: AudioEngine;

beforeEach(() => {
  fake = new FakeContext();
  eng = new AudioEngine(() => asCtx(fake));
  eng.setEnvelope(env);
});
afterEach(() => vi.useRealTimers());

// voice chain: osc → env gain → voice gain
const envOf = (i: number) => fake.oscillators[i].connections[0] as FakeGain;
const vgainOf = (i: number) => envOf(i).connections[0] as FakeGain;

describe('AudioEngine', () => {
  it('starts a voice at phase 0 with an attack ramp from 0', () => {
    eng.noteOn('0', 440);
    expect(fake.oscillators).toHaveLength(1);
    expect(fake.oscillators[0].startedAt).toBe(0);
    expect(fake.oscillators[0].frequency.value).toBe(440);
    const g = envOf(0).gain;
    expect(g.events[0]).toMatchObject({ type: 'set', value: 0, time: 0 });
    expect(g.events.filter((e) => e.type === 'ramp')).toHaveLength(64); // 32 attack + 32 decay
    expect(eng.getVoices()[0].stage).toBe('attack');
  });

  it('releases from the exact current level (no jump)', () => {
    eng.noteOn('0', 440);
    fake.currentTime = 0.05; // mid-attack
    eng.noteOff('0');
    const g = envOf(0).gain;
    const set = g.last('set')!;
    expect(set.time).toBeCloseTo(0.05);
    expect(set.value).toBeCloseTo(levelAt(env, 50));
    expect(g.last('ramp')).toMatchObject({ value: 0 });
    expect(g.last('ramp')!.time).toBeCloseTo(0.05 + 0.2);
    expect(eng.getVoices()[0].stage).toBe('release');
  });

  it('retrigger fast-fades the old voice over 8 ms', () => {
    eng.noteOn('0', 440);
    fake.currentTime = 0.5;
    eng.noteOn('0', 440);
    const old = envOf(0).gain;
    expect(old.last('ramp')).toMatchObject({ value: 0 });
    expect(old.last('ramp')!.time).toBeCloseTo(0.508);
    expect(eng.getVoices()).toHaveLength(1);
  });

  it('caps polyphony at 24 by stealing the oldest voice', () => {
    for (let i = 0; i <= MAX_VOICES; i++) { fake.currentTime = i * 0.01; eng.noteOn(String(i), 200 + i); }
    const ids = eng.getVoices().map((v) => v.id);
    expect(ids).toHaveLength(MAX_VOICES);
    expect(ids).not.toContain('0');
  });

  it('scales voice gain by 1/sqrt(n) with a smooth glide', () => {
    for (let i = 0; i < 4; i++) eng.noteOn(String(i), 200 + i);
    const t = vgainOf(0).gain.last('target')!;
    expect(t.value).toBeCloseTo(voiceGain(4));
    expect(voiceGain(4)).toBeCloseTo(0.15);
    expect(t.tau).toBeCloseTo(0.015);
  });

  it('removes a voice when its oscillator ends and rebalances the rest', () => {
    eng.noteOn('0', 200); eng.noteOn('1', 300);
    eng.noteOff('0');
    fake.oscillators[0].end();
    expect(eng.getVoices().map((v) => v.id)).toEqual(['1']);
    expect(vgainOf(1).gain.last('target')!.value).toBeCloseTo(voiceGain(1));
  });

  it('builds an un-normalized, RMS-normalized PeriodicWave', () => {
    eng.setTimbre({ count: 2, start: 1, end: 1, curve: 0, filter: 'all', tweaks: {} });
    eng.noteOn('0', 440);
    const w = fake.waves.at(-1)!;
    expect(w.opts).toEqual({ disableNormalization: true });
    expect(w.imag[1]).toBeCloseTo(Math.SQRT1_2);
    expect(w.imag[2]).toBeCloseTo(Math.SQRT1_2);
  });

  it('applies timbre edits to held voices after a 50 ms debounce', () => {
    vi.useFakeTimers();
    eng.noteOn('0', 440);
    const before = fake.oscillators[0].wave;
    eng.setTimbre({ count: 4, start: 1, end: 0.2, curve: 0, filter: 'all', tweaks: {} });
    vi.advanceTimersByTime(49);
    expect(fake.oscillators[0].wave).toBe(before);
    vi.advanceTimersByTime(2);
    expect(fake.oscillators[0].wave).not.toBe(before);
  });

  it('wires compressor settings and keeps reverb fully dry by default', () => {
    eng.resume();
    const v = eng as unknown as { comp: { threshold: { value: number }; ratio: { value: number } }; dry: FakeGain; wet: FakeGain };
    expect(v.comp.threshold.value).toBe(-12);
    expect(v.comp.ratio.value).toBe(4);
    expect(v.dry.gain.value).toBe(1);
    expect(v.wet.gain.value).toBe(0);
  });

  it('envelope edits do not change voices already sounding', () => {
    eng.noteOn('0', 440);
    eng.setEnvelope({ ...env, release: 5000 });
    fake.currentTime = 1;
    eng.noteOff('0');
    expect(envOf(0).gain.last('ramp')!.time).toBeCloseTo(1 + 0.2);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run tests/engine.test.ts`
Expected: FAIL (module `../src/audio/engine` not found).

- [ ] **Step 5: Implement `src/audio/engine.ts`**

```ts
import { computeAmplitudes, type HarmonicSettings } from './harmonics';
import { normalizeRms, periodicWaveCoeffs, buildWavetable } from './timbre';
import { levelAt, releaseLevelAt, effMs, CURVE_AMOUNT, type CurveKind, type EnvelopeSettings } from './envelope';
import { shapeCurve } from './curves';
import { createImpulseResponse } from './reverb';

export type VoiceStage = 'attack' | 'decay' | 'sustain' | 'release';
export interface VoiceSnapshot { id: string; freq: number; level: number; stage: VoiceStage; elapsedMs: number; env: EnvelopeSettings }

export const MAX_VOICES = 24;
export const FADE_S = 0.008;
export const BASE_VOICE_GAIN = 0.3;
export const GAIN_TAU = 0.015;
const RAMP_STEPS = 32;
const TIMBRE_DEBOUNCE_MS = 50;

export const voiceGain = (n: number) => BASE_VOICE_GAIN / Math.sqrt(Math.max(1, n));

interface Voice {
  id: string;
  freq: number;
  osc: OscillatorNode;
  env: GainNode;
  vgain: GainNode;
  start: number;
  releaseAt: number | null;
  releaseFrom: number;
  settings: EnvelopeSettings;
}

const DEFAULT_ENV: EnvelopeSettings = {
  attack: 10, decay: 200, sustain: 0.8, release: 400,
  attackCurve: 'lin', decayCurve: 'exp', releaseCurve: 'exp',
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sum!: GainNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private convolver!: ConvolverNode;
  private comp!: DynamicsCompressorNode;
  private master!: GainNode;
  private analyser!: AnalyserNode;
  private irLoaded = false;

  private voices = new Map<string, Voice>();
  private wave: PeriodicWave | null = null;
  private amps: number[] = [1];
  private wavetable: Float32Array = buildWavetable([1]);
  private timbreTimer: ReturnType<typeof setTimeout> | null = null;
  private envelope: EnvelopeSettings = { ...DEFAULT_ENV };
  private volume = 0.6;
  private reverbMix = 0;

  constructor(private createContext: () => AudioContext = () => new AudioContext()) {}

  /** Create/resume the context. Call from a user gesture. */
  resume(): void {
    this.ensureContext();
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const ctx = this.createContext();
      this.ctx = ctx;
      this.sum = ctx.createGain();
      this.dry = ctx.createGain();
      this.wet = ctx.createGain();
      this.convolver = ctx.createConvolver();
      this.comp = ctx.createDynamicsCompressor();
      this.master = ctx.createGain();
      this.analyser = ctx.createAnalyser();
      this.comp.threshold.value = -12;
      this.comp.knee.value = 10;
      this.comp.ratio.value = 4;
      this.comp.attack.value = 0.003;
      this.comp.release.value = 0.25;
      this.analyser.fftSize = 8192;
      this.analyser.smoothingTimeConstant = 0.6;
      this.master.gain.value = this.volume;
      this.sum.connect(this.dry).connect(this.comp);
      this.sum.connect(this.convolver).connect(this.wet).connect(this.comp);
      this.comp.connect(this.master);
      this.master.connect(ctx.destination);
      this.master.connect(this.analyser);
      this.applyReverb(0, true);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private getWave(): PeriodicWave {
    if (!this.wave) {
      const { real, imag } = periodicWaveCoeffs(this.amps);
      this.wave = this.ctx!.createPeriodicWave(real, imag, { disableNormalization: true });
    }
    return this.wave;
  }

  /** Schedule a curved segment as RAMP_STEPS linear ramps. Caller must have an event at t0 with value `from`. */
  private segment(p: AudioParam, from: number, to: number, curve: CurveKind, t0: number, dur: number) {
    const c = CURVE_AMOUNT[curve];
    for (let i = 1; i <= RAMP_STEPS; i++) {
      p.linearRampToValueAtTime(shapeCurve(from, to, i / RAMP_STEPS, c), t0 + (dur * i) / RAMP_STEPS);
    }
  }

  private levelOf(v: Voice, now: number): number {
    if (v.releaseAt == null) return levelAt(v.settings, (now - v.start) * 1000);
    return releaseLevelAt(v.settings, v.releaseFrom, (now - v.releaseAt) * 1000);
  }

  private fastFade(v: Voice, now: number) {
    const g = v.env.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(this.levelOf(v, now), now);
    g.linearRampToValueAtTime(0, now + FADE_S);
    v.osc.onended = () => this.disconnect(v);
    v.osc.stop(now + FADE_S + 0.01);
    this.voices.delete(v.id);
  }

  private disconnect(v: Voice) {
    v.osc.disconnect();
    v.env.disconnect();
    v.vgain.disconnect();
  }

  private rebalance(now: number) {
    const g = voiceGain(this.voices.size);
    for (const v of this.voices.values()) v.vgain.gain.setTargetAtTime(g, now, GAIN_TAU);
  }

  noteOn(id: string, freq: number): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const existing = this.voices.get(id);
    if (existing) this.fastFade(existing, now);
    while (this.voices.size >= MAX_VOICES) {
      let oldest: Voice | null = null;
      for (const v of this.voices.values()) if (!oldest || v.start < oldest.start) oldest = v;
      this.fastFade(oldest!, now);
    }

    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.getWave());
    osc.frequency.value = freq;
    const env = ctx.createGain();
    const vgain = ctx.createGain();
    vgain.gain.setValueAtTime(voiceGain(this.voices.size + 1), now);
    osc.connect(env).connect(vgain).connect(this.sum);

    const s = { ...this.envelope };
    const a = effMs(s.attack) / 1000;
    const d = effMs(s.decay) / 1000;
    env.gain.setValueAtTime(0, now);
    this.segment(env.gain, 0, 1, s.attackCurve, now, a);
    this.segment(env.gain, 1, s.sustain, s.decayCurve, now + a, d);
    osc.start(now);

    const voice: Voice = { id, freq, osc, env, vgain, start: now, releaseAt: null, releaseFrom: 0, settings: s };
    osc.onended = () => {
      this.disconnect(voice);
      if (this.voices.get(id) === voice) {
        this.voices.delete(id);
        this.rebalance(this.ctx!.currentTime);
      }
    };
    this.voices.set(id, voice);
    this.rebalance(now);
  }

  noteOff(id: string): void {
    const v = this.voices.get(id);
    if (!v || v.releaseAt != null || !this.ctx) return;
    const now = this.ctx.currentTime;
    const level = this.levelOf(v, now);
    const r = effMs(v.settings.release) / 1000;
    v.env.gain.cancelScheduledValues(now);
    v.env.gain.setValueAtTime(level, now);
    this.segment(v.env.gain, level, 0, v.settings.releaseCurve, now, r);
    v.releaseAt = now;
    v.releaseFrom = level;
    v.osc.stop(now + r + 0.05);
  }

  allNotesOff(): void {
    for (const id of [...this.voices.keys()]) this.noteOff(id);
  }

  isHeld(id: string): boolean {
    const v = this.voices.get(id);
    return !!v && v.releaseAt == null;
  }

  setTimbre(h: HarmonicSettings): void {
    this.amps = normalizeRms(computeAmplitudes(h));
    this.wavetable = buildWavetable(this.amps);
    this.wave = null; // new notes pick up the new wave immediately
    if (this.timbreTimer) clearTimeout(this.timbreTimer);
    this.timbreTimer = setTimeout(() => {
      this.timbreTimer = null;
      if (!this.ctx) return;
      const w = this.getWave();
      for (const v of this.voices.values()) v.osc.setPeriodicWave(w);
    }, TIMBRE_DEBOUNCE_MS);
  }

  setEnvelope(e: EnvelopeSettings): void {
    this.envelope = { ...e };
  }

  setMasterVolume(v: number): void {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  setReverbMix(m: number): void {
    this.reverbMix = Math.min(1, Math.max(0, m));
    if (this.ctx) this.applyReverb(this.ctx.currentTime, false);
  }

  private applyReverb(now: number, immediate: boolean) {
    const m = this.reverbMix;
    if (m > 0 && !this.irLoaded) {
      this.convolver.buffer = createImpulseResponse(this.ctx!);
      this.irLoaded = true;
    }
    const dry = Math.cos((m * Math.PI) / 2);
    const wet = Math.sin((m * Math.PI) / 2);
    if (immediate) {
      this.dry.gain.value = dry;
      this.wet.gain.value = wet;
    } else {
      this.dry.gain.setTargetAtTime(dry, now, 0.03);
      this.wet.gain.setTargetAtTime(wet, now, 0.03);
    }
  }

  getVoices(): VoiceSnapshot[] {
    if (!this.ctx) return [];
    const now = this.ctx.currentTime;
    const out: VoiceSnapshot[] = [];
    for (const v of this.voices.values()) {
      let stage: VoiceStage;
      let elapsedMs: number;
      if (v.releaseAt != null) {
        stage = 'release';
        elapsedMs = (now - v.releaseAt) * 1000;
      } else {
        elapsedMs = (now - v.start) * 1000;
        const a = effMs(v.settings.attack);
        stage = elapsedMs < a ? 'attack' : elapsedMs < a + effMs(v.settings.decay) ? 'decay' : 'sustain';
      }
      out.push({ id: v.id, freq: v.freq, level: this.levelOf(v, now), stage, elapsedMs, env: v.settings });
    }
    return out;
  }

  getAmplitudes(): number[] { return this.amps; }
  getWavetable(): Float32Array { return this.wavetable; }
  getAnalyser(): AnalyserNode | null { return this.ctx ? this.analyser : null; }
}

export const engine = new AudioEngine();
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run tests/engine.test.ts`
Expected: PASS (10 tests). If the "retrigger" test fails because `fastFade` cleared `onended` on the replaced voice, check that the old voice's handler is reassigned to `disconnect` only (it must not delete the new voice from the map).

- [ ] **Step 7: Run the full suite and type check**

Run: `npm test && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/audio/reverb.ts src/audio/engine.ts tests/fakeAudio.ts tests/engine.test.ts
git commit -m "feat: audio engine with click-free envelopes, gain staging, live timbre, reverb"
```

---
### Task 7: Store, synth presets, theme helpers, play helpers

**Files:**
- Create: `src/state/presets.ts`, `src/state/store.ts`, `src/theme.ts`, `src/audio/play.ts`
- Test: `tests/store.test.ts`, `tests/theme.test.ts`

**Interfaces:**
- Consumes: `HarmonicSettings` (Task 2), `EnvelopeSettings` (Task 3), `TUNINGS`, `NOTE_FREQS`, `DEFAULT_KEYMAPS` (Task 4), `createFromTemplate`, `degreeFreq`, `mod` (Task 4), `engine` (Task 6)
- Produces:
  - `type PresetId = 'sine' | 'organ' | 'strings' | 'pluck' | 'custom'`; `SYNTH_PRESETS: Record<Exclude<PresetId,'custom'>, { label: string; harmonics: HarmonicSettings; envelope: EnvelopeSettings }>`; `DEFAULT_HARMONICS`; `DEFAULT_ENVELOPE`
  - `type ThemeMode = 'system' | 'light' | 'dark'`; `degreeColor(i: number, dark: boolean, alpha?: number): string`; `resolveTheme(mode: ThemeMode): 'light' | 'dark'`; `applyTheme(mode: ThemeMode): 'light' | 'dark'`
  - `interface VizSettings { view: 'wave' | 'spectrum'; source: 'computed' | 'live'; periods: number; speed: number; showSum: boolean; freqScale: 'log' | 'lin'; liveGain: number }`
  - `useStore` (Zustand) with state fields `tab, tuning, scale, notes, root: { note: string; freq: number }, keymaps, keymap, shown: number[], held: number[], harmonics, envelope, preset, volume, space, viz, open: { keyboard: boolean; ratios: boolean }, theme` and actions:
    `setTab(t)`, `applyTemplate(tuning, scale)`, `resetNotes()`, `clearNotes()`, `setNote(i, expr)`, `deleteDegree(i)`, `insertDegree(after, expr)`, `setRootNote(name)`, `setRootFreq(hz)`, `setKeymap(name)`, `setKey(degree, keys)`, `addKeyDegree()`, `deleteKeyDegree(degree)`, `toggleShown(i)`, `setHeld(degree, on)`, `setHarmonics(partial)`, `setTweak(n, v | null)`, `resetTweaks()`, `setEnvelope(partial)`, `applyPreset(id)`, `setVolume(v)`, `setSpace(v)`, `setViz(partial)`, `toggleOpen(key)`, `setTheme(mode)`
  - `playDegree(degree: number): void`, `stopDegree(degree: number): void`, `stopAll(): void` (in `src/audio/play.ts`)

- [ ] **Step 1: Write failing tests**

`tests/theme.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { degreeColor } from '../src/theme';

describe('degreeColor', () => {
  it('spaces hues 30° apart from 25° and cycles past 12', () => {
    expect(degreeColor(0, false)).toBe('oklch(64% 0.11 25)');
    expect(degreeColor(1, false)).toBe('oklch(64% 0.11 55)');
    expect(degreeColor(12, false)).toBe(degreeColor(0, false));
    expect(degreeColor(-1, false)).toBe(degreeColor(11, false));
  });
  it('brightens in dark mode and supports alpha', () => {
    expect(degreeColor(0, true)).toBe('oklch(72% 0.12 25)');
    expect(degreeColor(0, false, 0.25)).toBe('oklch(64% 0.11 25 / 0.25)');
  });
});
```

`tests/store.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../src/state/store';
import { SYNTH_PRESETS } from '../src/state/presets';

const s = () => useStore.getState();

beforeEach(() => {
  localStorage.clear();
  s().applyTemplate('just_intonation', 'chromatic');
  s().applyPreset('sine');
});

describe('store', () => {
  it('applyTemplate builds notes and resets shown to degree 1', () => {
    s().toggleShown(4);
    s().applyTemplate('just_intonation', 'major');
    expect(s().notes).toHaveLength(7);
    expect(s().shown).toEqual([0]);
  });
  it('non-scalable tunings force chromatic', () => {
    s().applyTemplate('harmonic_series', 'major');
    expect(s().scale).toBe('chromatic');
  });
  it('deleteDegree shifts shown indices', () => {
    s().toggleShown(3);
    s().toggleShown(5);
    s().deleteDegree(3);
    expect(s().shown).toEqual([0, 4]);
  });
  it('insertDegree inserts after the index and shifts shown', () => {
    s().toggleShown(2);
    s().insertDegree(0, '9/8');
    expect(s().notes[1]).toBe('9/8');
    expect(s().shown).toEqual([0, 3]);
  });
  it('degree 1 cannot be deleted', () => {
    const n = s().notes.length;
    s().deleteDegree(0);
    expect(s().notes).toHaveLength(n);
  });
  it('editing harmonics or envelope flips the preset to custom', () => {
    expect(s().preset).toBe('sine');
    s().setHarmonics({ count: 12 });
    expect(s().preset).toBe('custom');
    s().applyPreset('organ');
    s().setEnvelope({ attack: 500 });
    expect(s().preset).toBe('custom');
  });
  it('applyPreset sets harmonics and envelope together', () => {
    s().applyPreset('pluck');
    expect(s().harmonics).toEqual(SYNTH_PRESETS.pluck.harmonics);
    expect(s().envelope).toEqual(SYNTH_PRESETS.pluck.envelope);
  });
  it('tweaks survive a count change and can be reset', () => {
    s().setHarmonics({ count: 16 });
    s().setTweak(10, 0.5);
    s().setHarmonics({ count: 4 });
    s().setHarmonics({ count: 16 });
    expect(s().harmonics.tweaks[10]).toBe(0.5);
    s().setTweak(10, null);
    expect(s().harmonics.tweaks[10]).toBeUndefined();
    s().setTweak(3, 0.2);
    s().resetTweaks();
    expect(s().harmonics.tweaks).toEqual({});
  });
  it('root freq edits keep the note name only on exact match', () => {
    s().setRootNote('C');
    expect(s().root.freq).toBeCloseTo(523.2512);
    s().setRootFreq(500);
    expect(s().root.note).toBe('');
    s().setRootFreq(440);
    expect(s().root.note).toBe('A');
  });
  it('persists settings but not held notes', () => {
    s().setHeld(3, true);
    s().setVolume(0.42);
    const saved = JSON.parse(localStorage.getItem('ejis-settings')!);
    expect(saved.state.volume).toBe(0.42);
    expect(saved.state.held).toBeUndefined();
    expect(saved.version).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/store.test.ts tests/theme.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `src/state/presets.ts`**

```ts
import type { HarmonicSettings } from '../audio/harmonics';
import type { EnvelopeSettings } from '../audio/envelope';

export type PresetId = 'sine' | 'organ' | 'strings' | 'pluck' | 'custom';

export const DEFAULT_HARMONICS: HarmonicSettings = { count: 8, start: 1, end: 0.1, curve: 0.5, filter: 'all', tweaks: {} };
export const DEFAULT_ENVELOPE: EnvelopeSettings = {
  attack: 10, decay: 200, sustain: 0.8, release: 400, attackCurve: 'lin', decayCurve: 'exp', releaseCurve: 'exp',
};

export const SYNTH_PRESETS: Record<Exclude<PresetId, 'custom'>, { label: string; harmonics: HarmonicSettings; envelope: EnvelopeSettings }> = {
  sine: {
    label: 'Sine',
    harmonics: { count: 1, start: 1, end: 1, curve: 0, filter: 'all', tweaks: {} },
    envelope: { attack: 10, decay: 200, sustain: 1, release: 300, attackCurve: 'lin', decayCurve: 'exp', releaseCurve: 'exp' },
  },
  organ: {
    label: 'Organ',
    harmonics: { count: 8, start: 1, end: 0.6, curve: -0.3, filter: 'all', tweaks: { 2: 0.9, 4: 0.7, 8: 0.5 } },
    envelope: { attack: 15, decay: 50, sustain: 1, release: 120, attackCurve: 'lin', decayCurve: 'lin', releaseCurve: 'exp' },
  },
  strings: {
    label: 'Strings',
    harmonics: { count: 24, start: 1, end: 0.05, curve: 0.7, filter: 'all', tweaks: {} },
    envelope: { attack: 350, decay: 300, sustain: 0.85, release: 900, attackCurve: 'log', decayCurve: 'exp', releaseCurve: 'exp' },
  },
  pluck: {
    label: 'Pluck',
    harmonics: { count: 32, start: 1, end: 0.02, curve: 0.85, filter: 'all', tweaks: {} },
    envelope: { attack: 3, decay: 1200, sustain: 0, release: 500, attackCurve: 'lin', decayCurve: 'exp', releaseCurve: 'exp' },
  },
};
```

- [ ] **Step 4: Implement `src/theme.ts`**

```ts
export type ThemeMode = 'system' | 'light' | 'dark';

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function degreeColor(i: number, dark: boolean, alpha = 1): string {
  const h = 25 + 30 * mod(i, 12);
  const base = dark ? '72% 0.12' : '64% 0.11';
  return alpha === 1 ? `oklch(${base} ${h})` : `oklch(${base} ${h} / ${alpha})`;
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(mode: ThemeMode): 'light' | 'dark' {
  const t = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', t);
  return t;
}
```

- [ ] **Step 5: Implement `src/state/store.ts`**

```ts
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { HarmonicSettings } from '../audio/harmonics';
import type { EnvelopeSettings } from '../audio/envelope';
import { DEFAULT_KEYMAPS, NOTE_FREQS } from '../tuning/presets';
import { createFromTemplate } from '../tuning/ratios';
import { DEFAULT_ENVELOPE, DEFAULT_HARMONICS, SYNTH_PRESETS, type PresetId } from './presets';
import type { ThemeMode } from '../theme';

export interface VizSettings {
  view: 'wave' | 'spectrum';
  source: 'computed' | 'live';
  periods: number;
  speed: number;
  showSum: boolean;
  freqScale: 'log' | 'lin';
  liveGain: number;
}

interface Data {
  tab: 'tuning' | 'synth';
  tuning: string;
  scale: string;
  notes: string[];
  root: { note: string; freq: number };
  keymaps: Record<string, Record<string, string>>;
  keymap: string;
  shown: number[];
  held: number[];
  harmonics: HarmonicSettings;
  envelope: EnvelopeSettings;
  preset: PresetId;
  volume: number;
  space: number;
  viz: VizSettings;
  open: { keyboard: boolean; ratios: boolean };
  theme: ThemeMode;
}

interface Actions {
  setTab(t: Data['tab']): void;
  applyTemplate(tuning: string, scale: string): void;
  resetNotes(): void;
  clearNotes(): void;
  setNote(i: number, expr: string): void;
  deleteDegree(i: number): void;
  insertDegree(after: number, expr: string): void;
  setRootNote(name: string): void;
  setRootFreq(hz: number): void;
  setKeymap(name: string): void;
  setKey(degree: number, keys: string): void;
  addKeyDegree(): void;
  deleteKeyDegree(degree: number): void;
  toggleShown(i: number): void;
  setHeld(degree: number, on: boolean): void;
  setHarmonics(p: Partial<HarmonicSettings>): void;
  setTweak(n: number, v: number | null): void;
  resetTweaks(): void;
  setEnvelope(p: Partial<EnvelopeSettings>): void;
  applyPreset(id: Exclude<PresetId, 'custom'>): void;
  setVolume(v: number): void;
  setSpace(v: number): void;
  setViz(p: Partial<VizSettings>): void;
  toggleOpen(k: keyof Data['open']): void;
  setTheme(m: ThemeMode): void;
}

export type StoreState = Data & Actions;

const safeStorage: StateStorage = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};

const initialTemplate = createFromTemplate('just_intonation', 'chromatic');

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      tab: 'tuning',
      tuning: 'just_intonation',
      scale: initialTemplate.scale,
      notes: initialTemplate.notes,
      root: { note: 'A', freq: NOTE_FREQS.A },
      keymaps: structuredClone(DEFAULT_KEYMAPS),
      keymap: 'scale',
      shown: [0],
      held: [],
      harmonics: structuredClone(DEFAULT_HARMONICS),
      envelope: { ...DEFAULT_ENVELOPE },
      preset: 'custom',
      volume: 0.6,
      space: 0,
      viz: { view: 'wave', source: 'computed', periods: 2, speed: 0.5, showSum: true, freqScale: 'log', liveGain: 1 },
      open: { keyboard: true, ratios: false },
      theme: 'system',

      setTab: (tab) => set({ tab }),
      applyTemplate: (tuning, scale) => {
        const t = createFromTemplate(tuning, scale);
        set({ tuning, scale: t.scale, notes: t.notes, shown: [0] });
      },
      resetNotes: () => get().applyTemplate(get().tuning, get().scale),
      clearNotes: () => set({ notes: ['1'], shown: [0] }),
      setNote: (i, expr) => set((s) => ({ notes: s.notes.map((n, j) => (j === i ? expr : n)) })),
      deleteDegree: (i) =>
        set((s) => {
          if (i <= 0 || i >= s.notes.length) return {};
          return {
            notes: s.notes.filter((_, j) => j !== i),
            shown: s.shown.filter((d) => d !== i).map((d) => (d > i ? d - 1 : d)),
          };
        }),
      insertDegree: (after, expr) =>
        set((s) => {
          const p = after + 1;
          const notes = [...s.notes];
          notes.splice(p, 0, expr);
          return { notes, shown: s.shown.map((d) => (d >= p ? d + 1 : d)) };
        }),
      setRootNote: (name) => set({ root: { note: name, freq: NOTE_FREQS[name] ?? get().root.freq } }),
      setRootFreq: (hz) => {
        const match = Object.entries(NOTE_FREQS).find(([, f]) => Math.abs(f - hz) < 1e-6);
        set({ root: { note: match ? match[0] : '', freq: hz } });
      },
      setKeymap: (keymap) => set({ keymap }),
      setKey: (degree, keys) =>
        set((s) => ({ keymaps: { ...s.keymaps, [s.keymap]: { ...s.keymaps[s.keymap], [degree]: keys } } })),
      addKeyDegree: () =>
        set((s) => {
          const map = s.keymaps[s.keymap];
          const next = Math.max(-1, ...Object.keys(map).map(Number)) + 1;
          return { keymaps: { ...s.keymaps, [s.keymap]: { ...map, [next]: '' } } };
        }),
      deleteKeyDegree: (degree) =>
        set((s) => {
          const map = { ...s.keymaps[s.keymap] };
          delete map[degree];
          return { keymaps: { ...s.keymaps, [s.keymap]: map } };
        }),
      toggleShown: (i) =>
        set((s) => ({ shown: s.shown.includes(i) ? s.shown.filter((d) => d !== i) : [...s.shown, i] })),
      setHeld: (degree, on) =>
        set((s) => ({ held: on ? [...new Set([...s.held, degree])] : s.held.filter((d) => d !== degree) })),
      setHarmonics: (p) => set((s) => ({ harmonics: { ...s.harmonics, ...p }, preset: 'custom' })),
      setTweak: (n, v) =>
        set((s) => {
          const tweaks = { ...s.harmonics.tweaks };
          if (v == null) delete tweaks[n];
          else tweaks[n] = Math.min(1, Math.max(0, v));
          return { harmonics: { ...s.harmonics, tweaks }, preset: 'custom' };
        }),
      resetTweaks: () => set((s) => ({ harmonics: { ...s.harmonics, tweaks: {} }, preset: 'custom' })),
      setEnvelope: (p) => set((s) => ({ envelope: { ...s.envelope, ...p }, preset: 'custom' })),
      applyPreset: (id) =>
        set({
          harmonics: structuredClone(SYNTH_PRESETS[id].harmonics),
          envelope: { ...SYNTH_PRESETS[id].envelope },
          preset: id,
        }),
      setVolume: (volume) => set({ volume }),
      setSpace: (space) => set({ space }),
      setViz: (p) => set((s) => ({ viz: { ...s.viz, ...p } })),
      toggleOpen: (k) => set((s) => ({ open: { ...s.open, [k]: !s.open[k] } })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ejis-settings',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ held: _held, ...rest }) => {
        void _held;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Partial<StoreState>;
      },
      migrate: (persisted) => persisted as StoreState,
    },
  ),
);
```

- [ ] **Step 6: Implement `src/audio/play.ts`**

```ts
import { engine } from './engine';
import { useStore } from '../state/store';
import { degreeFreq } from '../tuning/ratios';

export function playDegree(degree: number): void {
  const s = useStore.getState();
  const f = degreeFreq(s.notes, degree, s.root.freq);
  if (f == null) return;
  engine.noteOn(String(degree), f);
  s.setHeld(degree, true);
}

export function stopDegree(degree: number): void {
  engine.noteOff(String(degree));
  useStore.getState().setHeld(degree, false);
}

export function stopAll(): void {
  engine.allNotesOff();
  for (const d of useStore.getState().held) useStore.getState().setHeld(d, false);
}
```

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run tests/store.test.ts tests/theme.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/state src/theme.ts src/audio/play.ts tests/store.test.ts tests/theme.test.ts
git commit -m "feat: persisted store, synth presets, theme helpers, play helpers"
```

---
### Task 8: UI primitives, header, app shell, keyboard + engine sync

**Files:**
- Create: `src/components/ui.tsx`, `src/components/Header.tsx`, `src/hooks/useKeyboard.ts`, `src/hooks/useEngineSync.ts`, `src/hooks/useTheme.ts`
- Modify: `src/App.tsx` (full replacement)

**Interfaces:**
- Consumes: `useStore` (Task 7), `engine` (Task 6), `playDegree`/`stopDegree`/`stopAll` (Task 7), `degreesForKey` (Task 4), `applyTheme`/`resolveTheme` (Task 7)
- Produces:
  - `Segmented<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange(v: T): void; label?: string })`
  - `Slider(props: { label: string; value: number; min: number; max: number; step: number; onChange(v: number): void; format?(v: number): string })`
  - `NumberField(props: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange(v: number): void })`
  - `Section(props: { title: string; open: boolean; onToggle(): void; children: React.ReactNode; right?: React.ReactNode })`
  - `useResolvedTheme(): 'light' | 'dark'`, `useKeyboard(): void`, `useEngineSync(): void`
  - `App.tsx` with marker comments `{/* TUNING_PANEL */}`, `{/* SYNTH_PANEL */}`, `{/* VISUALIZER */}`, `{/* DEGREE_GRID */}`, `{/* KEYBOARD_MAP */}`, `{/* INTER_SCALE */}` that later tasks replace.

- [ ] **Step 1: Write `src/components/ui.tsx`**

```tsx
import { useEffect, useState, type ReactNode } from 'react';

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange(v: T): void; label?: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value}
          data-active={o.value === value} className="seg-item" onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step: number; onChange(v: number): void; format?(v: number): string;
}) {
  return (
    <label className="flex min-w-[140px] flex-col gap-1">
      <span className="label flex justify-between gap-2">
        <span>{label}</span>
        <span className="mono normal-case tracking-normal">{format ? format(value) : value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/** Text-backed number input: keeps the user's typing, commits only valid in-range numbers. */
export function NumberField({ label, value, min, max, step = 1, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange(v: number): void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const invalid = text.trim() === '' || Number.isNaN(Number(text)) || Number(text) < min || Number(text) > max;
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <span className="flex items-center gap-1">
        <input className="input mono w-20" inputMode="decimal" value={text} aria-invalid={invalid}
          step={step}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value.trim() !== '' && !Number.isNaN(n) && n >= min && n <= max) onChange(n);
          }}
          onBlur={() => setText(String(value))} />
        {suffix && <span className="label">{suffix}</span>}
      </span>
    </label>
  );
}

export function Section({ title, open, onToggle, children, right }: {
  title: string; open: boolean; onToggle(): void; children: ReactNode; right?: ReactNode;
}) {
  return (
    <section className="border-t border-[var(--border-subtle)] pt-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <button type="button" className="flex items-center gap-2 bg-transparent p-0 text-[var(--text)]"
          aria-expanded={open} onClick={onToggle}>
          <span className="label w-3">{open ? '▾' : '▸'}</span>
          <h2 className="display m-0 text-xl">{title}</h2>
        </button>
        {right}
      </div>
      {open && children}
    </section>
  );
}
```

- [ ] **Step 2: Write `src/hooks/useTheme.ts`**

```ts
import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { applyTheme, resolveTheme } from '../theme';

export function useResolvedTheme(): 'light' | 'dark' {
  const mode = useStore((s) => s.theme);
  const [resolved, setResolved] = useState(() => resolveTheme(mode));
  useEffect(() => {
    setResolved(applyTheme(mode));
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(applyTheme('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);
  return resolved;
}
```

- [ ] **Step 3: Write `src/hooks/useKeyboard.ts`**

```ts
import { useEffect } from 'react';
import { useStore } from '../state/store';
import { engine } from '../audio/engine';
import { playDegree, stopDegree, stopAll } from '../audio/play';
import { degreesForKey } from '../tuning/keymaps';

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
};

const lookup = (key: string) => {
  const s = useStore.getState();
  return degreesForKey(s.keymaps[s.keymap] ?? {}, key, s.notes.length);
};

export function useKeyboard(): void {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
      const ds = lookup(e.key);
      if (ds.length === 0) return;
      engine.resume();
      ds.forEach(playDegree);
    };
    // keyup is never filtered by focus, so a note can't get stuck if focus moves mid-press
    const up = (e: KeyboardEvent) => lookup(e.key).forEach(stopDegree);
    const onHide = () => { if (document.hidden) stopAll(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', stopAll);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', stopAll);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);
}
```

- [ ] **Step 4: Write `src/hooks/useEngineSync.ts`**

```ts
import { useEffect } from 'react';
import { useStore } from '../state/store';
import { engine } from '../audio/engine';

export function useEngineSync(): void {
  const harmonics = useStore((s) => s.harmonics);
  const envelope = useStore((s) => s.envelope);
  const volume = useStore((s) => s.volume);
  const space = useStore((s) => s.space);
  useEffect(() => engine.setTimbre(harmonics), [harmonics]);
  useEffect(() => engine.setEnvelope(envelope), [envelope]);
  useEffect(() => engine.setMasterVolume(volume), [volume]);
  useEffect(() => engine.setReverbMix(space), [space]);
}
```

- [ ] **Step 5: Write `src/components/Header.tsx`**

```tsx
import { useStore } from '../state/store';
import type { ThemeMode } from '../theme';

const NEXT: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };

export function Header() {
  const volume = useStore((s) => s.volume);
  const setVolume = useStore((s) => s.setVolume);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  return (
    <header className="border-b border-[var(--border-subtle)]">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h1 className="display m-0 text-lg sm:text-xl">Extended Just Intonation Simulator</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="label">Volume</span>
            <input type="range" min={0} max={1} step={0.01} value={volume} aria-label="Master volume"
              onChange={(e) => setVolume(Number(e.target.value))} className="w-24" />
          </label>
          <button type="button" className="btn" onClick={() => setTheme(NEXT[theme])}
            aria-label={`Theme: ${theme}. Click to change.`}>
            ◐ {theme}
          </button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Replace `src/App.tsx`**

```tsx
import { Header } from './components/Header';
import { Segmented } from './components/ui';
import { useStore } from './state/store';
import { useKeyboard } from './hooks/useKeyboard';
import { useEngineSync } from './hooks/useEngineSync';
import { useResolvedTheme } from './hooks/useTheme';

export default function App() {
  useResolvedTheme();
  useKeyboard();
  useEngineSync();
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-3">
          <Segmented label="Panel" value={tab} onChange={setTab}
            options={[{ value: 'tuning', label: 'Tuning' }, { value: 'synth', label: 'Synthesizer' }]} />
          <div className="panel p-4">
            {tab === 'tuning' ? <>{/* TUNING_PANEL */}</> : <>{/* SYNTH_PANEL */}</>}
          </div>
        </div>
        {/* VISUALIZER */}
        {/* DEGREE_GRID */}
        {/* KEYBOARD_MAP */}
        {/* INTER_SCALE */}
      </main>
      <footer className="mx-auto max-w-[1200px] px-4 pb-8">
        <p className="label normal-case tracking-normal">
          Based on <a className="underline" href="https://github.com/flappix/web_intonation">web_intonation</a> by flappix.
        </p>
      </footer>
    </>
  );
}
```

- [ ] **Step 7: Verify build and dev server**

Run: `npm run build`
Expected: no type errors.
Then start the dev server (`npm run dev`, or the preview tool) and check: the header shows the serif title; the theme button cycles SYSTEM → LIGHT → DARK and the background switches between `#fffef8` and `#111`; after a reload the theme persists; pressing `a` (after one click on the page) plays an A sine with no click at note start or end.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui.tsx src/components/Header.tsx src/hooks src/App.tsx
git commit -m "feat: app shell, header, theme switching, keyboard playing, engine sync"
```

---
### Task 9: Tuning panel, degree grid, keyboard map, inter-scale ratios

**Files:**
- Create: `src/components/TuningPanel.tsx`, `src/components/DegreeGrid.tsx`, `src/components/KeyboardMap.tsx`, `src/components/InterScaleRatios.tsx`
- Modify: `src/App.tsx` (replace markers `TUNING_PANEL`, `DEGREE_GRID`, `KEYBOARD_MAP`, `INTER_SCALE`)

**Interfaces:**
- Consumes: `useStore` actions (Task 7), `TUNINGS`, `SCALES`, `NOTE_NAMES` (Task 4), `evalRatio`, `degreeFreq`, `isPure` (Task 4), `interScaleRatios` (Task 4), `degreeColor` (Task 7), `useResolvedTheme` (Task 8), `playDegree`/`stopDegree` (Task 7), `engine.resume` (Task 6), `NumberField`, `Section` (Task 8)
- Produces: `TuningPanel()`, `DegreeGrid()`, `KeyboardMap()`, `InterScaleRatios()`, all with no props

- [ ] **Step 1: Write `src/components/TuningPanel.tsx`**

```tsx
import { useStore } from '../state/store';
import { TUNINGS, SCALES, NOTE_NAMES } from '../tuning/presets';
import { NumberField } from './ui';

const scalable = Object.entries(TUNINGS).filter(([, t]) => t.scalable);
const fixed = Object.entries(TUNINGS).filter(([, t]) => !t.scalable);

export function TuningPanel() {
  const s = useStore();
  const canScale = TUNINGS[s.tuning].scalable;
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex flex-col gap-1">
        <span className="label">Tuning</span>
        <select className="input" value={s.tuning} onChange={(e) => s.applyTemplate(e.target.value, s.scale)}>
          {scalable.map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          <option disabled>────────</option>
          {fixed.map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Scale</span>
        <select className="input" value={s.scale} onChange={(e) => s.applyTemplate(s.tuning, e.target.value)}>
          {Object.keys(SCALES).map((k) => (
            <option key={k} value={k} disabled={!canScale && k !== 'chromatic'}>{k}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Root</span>
        <select className="input" value={s.root.note} onChange={(e) => s.setRootNote(e.target.value)}>
          {NOTE_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
          <option value="">—</option>
        </select>
      </label>
      <NumberField label="Root Hz" value={Number(s.root.freq.toFixed(3))} min={20} max={5000} step={0.01}
        suffix="Hz" onChange={s.setRootFreq} />
      <label className="flex flex-col gap-1">
        <span className="label">Keyboard</span>
        <select className="input" value={s.keymap} onChange={(e) => s.setKeymap(e.target.value)}>
          {Object.keys(s.keymaps).map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={s.resetNotes}>Reset</button>
        <button type="button" className="btn" onClick={s.clearNotes}>Clear</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/DegreeGrid.tsx`**

```tsx
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useStore } from '../state/store';
import { TUNINGS, SCALES } from '../tuning/presets';
import { evalRatio, degreeFreq, isPure } from '../tuning/ratios';
import { degreeColor } from '../theme';
import { useResolvedTheme } from '../hooks/useTheme';
import { playDegree, stopDegree } from '../audio/play';
import { engine } from '../audio/engine';

function AddDegreePopover({ after, onClose }: { after: number; onClose(): void }) {
  const insertDegree = useStore((s) => s.insertDegree);
  const [tuning, setTuning] = useState('just_intonation');
  const [scale, setScale] = useState('major');
  const [degree, setDegree] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose]);
  const degrees = SCALES[scale].filter((n) => n <= TUNINGS[tuning].notes.length);
  return (
    <div ref={ref} className="panel absolute right-0 top-full z-20 mt-1 flex w-64 flex-col gap-3 p-3"
      style={{ borderColor: 'var(--border)' }}>
      <span className="label">Insert degree from preset</span>
      <select className="input" value={tuning} onChange={(e) => { setTuning(e.target.value); setDegree(0); }}>
        {Object.entries(TUNINGS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
      </select>
      <select className="input" value={scale} onChange={(e) => { setScale(e.target.value); setDegree(0); }}>
        {Object.keys(SCALES).map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <select className="input" value={degree} onChange={(e) => setDegree(Number(e.target.value))}>
        {degrees.map((n, i) => <option key={i} value={i}>{i + 1} — {TUNINGS[tuning].notes[n - 1]}</option>)}
      </select>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary"
          onClick={() => { insertDegree(after, TUNINGS[tuning].notes[degrees[degree] - 1]); onClose(); }}>Add</button>
      </div>
    </div>
  );
}

function DegreeCard({ i }: { i: number }) {
  const dark = useResolvedTheme() === 'dark';
  const note = useStore((s) => s.notes[i]);
  const notes = useStore((s) => s.notes);
  const rootHz = useStore((s) => s.root.freq);
  const held = useStore((s) => s.held.some((d) => ((d % s.notes.length) + s.notes.length) % s.notes.length === i));
  const shown = useStore((s) => s.shown.includes(i));
  const { setNote, deleteDegree, toggleShown } = useStore.getState();
  const [adding, setAdding] = useState(false);
  const pointers = useRef(new Set<number>());
  const valid = evalRatio(note) != null;
  const hz = degreeFreq(notes, i, rootHz);

  const release = (e: RPointerEvent) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size === 0) stopDegree(i);
  };

  return (
    <div
      className="relative flex cursor-pointer select-none flex-col gap-2 border p-3"
      style={{
        borderColor: held ? degreeColor(i, dark) : 'var(--border-subtle)',
        background: held ? degreeColor(i, dark, 0.25) : 'var(--bg-raised)',
        touchAction: 'manipulation',
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('input,button,select,[data-popover]')) return;
        engine.resume();
        if (pointers.current.size === 0) playDegree(i);
        pointers.current.add(e.pointerId);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="mono px-2 py-0.5 text-sm" style={{ background: degreeColor(i, dark), color: '#111' }}>{i + 1}</span>
        {i > 0 && isPure(note) && <span className="label italic">pure</span>}
        <div className="flex items-center gap-1">
          <button type="button" className="btn px-1.5 py-0.5" aria-pressed={shown} title="Show in visualizer"
            style={{ color: shown ? 'var(--text)' : 'var(--text-muted)' }} onClick={() => toggleShown(i)}>~</button>
          {i > 0 && (
            <button type="button" className="btn px-1.5 py-0.5" title="Delete degree" onClick={() => deleteDegree(i)}>×</button>
          )}
          <div className="relative" data-popover>
            <button type="button" className="btn px-1.5 py-0.5" title="Insert degree after" onClick={() => setAdding(true)}>+</button>
            {adding && <AddDegreePopover after={i} onClose={() => setAdding(false)} />}
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2">
        <span className="label">Ratio</span>
        <input className="input mono w-full text-right" value={note} aria-invalid={!valid}
          onChange={(e) => setNote(i, e.target.value)} />
      </label>
      <div className="flex justify-between">
        <span className="label">Freq</span>
        <span className="mono text-sm">{hz == null ? '—' : `${hz.toFixed(2)} Hz`}</span>
      </div>
    </div>
  );
}

export function DegreeGrid() {
  const count = useStore((s) => s.notes.length);
  const [adding, setAdding] = useState(false);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="display m-0 text-xl">Scale degrees</h2>
        <span className="label">press a card or key to play</span>
      </div>
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: count }, (_, i) => <DegreeCard key={i} i={i} />)}
        <div className="relative" data-popover>
          <button type="button" className="btn h-full min-h-24 w-full text-lg" onClick={() => setAdding(true)}>+</button>
          {adding && <AddDegreePopover after={count - 1} onClose={() => setAdding(false)} />}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Write `src/components/KeyboardMap.tsx`**

```tsx
import { useStore } from '../state/store';
import { degreeColor } from '../theme';
import { useResolvedTheme } from '../hooks/useTheme';
import { Section } from './ui';

const EMPTY: Record<string, string> = {};

export function KeyboardMap() {
  const dark = useResolvedTheme() === 'dark';
  const open = useStore((s) => s.open.keyboard);
  const map = useStore((s) => s.keymaps[s.keymap]) ?? EMPTY; // stable fallback: zustand v5 needs referentially stable selector results
  const len = useStore((s) => s.notes.length);
  const held = useStore((s) => s.held);
  const { toggleOpen, setKey, deleteKeyDegree, addKeyDegree } = useStore.getState();
  return (
    <Section title="Keyboard" open={open} onToggle={() => toggleOpen('keyboard')}
      right={<span className="label">comma-separated keys · “f2” = one octave up</span>}>
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-4 lg:grid-cols-7">
        {Object.entries(map).map(([deg, keys]) => {
          const d = Number(deg);
          return (
            <div key={deg} className="flex items-center gap-2 border p-2"
              style={{
                borderColor: 'var(--border-subtle)',
                background: held.includes(d) ? degreeColor(d % len, dark, 0.25) : 'var(--bg-raised)',
              }}>
              <span className="mono px-1.5 text-xs" style={{ background: degreeColor(d % len, dark), color: '#111' }}>{d + 1}</span>
              <input className="input mono w-full text-center" value={keys} aria-label={`Keys for degree ${d + 1}`}
                onChange={(e) => setKey(d, e.target.value)} />
              <button type="button" className="btn px-1.5 py-0.5" title="Remove" onClick={() => deleteKeyDegree(d)}>×</button>
            </div>
          );
        })}
        <button type="button" className="btn" onClick={addKeyDegree}>+</button>
      </div>
    </Section>
  );
}
```

- [ ] **Step 4: Write `src/components/InterScaleRatios.tsx`**

```tsx
import { useStore } from '../state/store';
import { interScaleRatios } from '../tuning/interScale';
import { degreeColor } from '../theme';
import { useResolvedTheme } from '../hooks/useTheme';
import { Section } from './ui';

export function InterScaleRatios() {
  const dark = useResolvedTheme() === 'dark';
  const open = useStore((s) => s.open.ratios);
  const notes = useStore((s) => s.notes);
  const shown = useStore((s) => s.shown);
  const held = useStore((s) => s.held);
  const toggleOpen = useStore((s) => s.toggleOpen);
  const rows = open ? interScaleRatios(notes, [...shown, ...held]) : [];
  const chip = (i: number) => (
    <span className="mono px-1.5" style={{ background: degreeColor(i, dark), color: '#111' }}>f{i + 1}</span>
  );
  return (
    <Section title="Inter-scale ratios" open={open} onToggle={() => toggleOpen('ratios')}>
      {rows.length === 0 ? (
        <p className="label normal-case tracking-normal">Show (~) or play at least two scale degrees.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {rows.map((row, r) => (
            <div key={r} className="panel flex flex-col gap-2 p-3">
              {row.map((x) => (
                <div key={`${x.lo}-${x.hi}`} className="flex items-center gap-2 text-sm">
                  {chip(x.hi)}<span>/</span>{chip(x.lo)}<span>=</span>
                  <span className="mono">{x.exact}</span><span className="label">≈</span>
                  <span className="mono">{x.decimal}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
```

- [ ] **Step 5: Wire into `src/App.tsx`**

Add imports:
```tsx
import { TuningPanel } from './components/TuningPanel';
import { DegreeGrid } from './components/DegreeGrid';
import { KeyboardMap } from './components/KeyboardMap';
import { InterScaleRatios } from './components/InterScaleRatios';
```
Replace markers:
- `<>{/* TUNING_PANEL */}</>` → `<TuningPanel />`
- `{/* DEGREE_GRID */}` → `<DegreeGrid />`
- `{/* KEYBOARD_MAP */}` → `<KeyboardMap />`
- `{/* INTER_SCALE */}` → `<InterScaleRatios />`

- [ ] **Step 6: Verify**

Run: `npm run build && npm test`
Expected: no type errors, all tests pass.
In the dev server, check:
- Switching tuning or scale rebuilds the cards (major = 7 cards).
- Typing `1 +` into a ratio turns the field red, and typing there doesn't play notes.
- Pressing and holding a card plays it and fills it with its color; releasing stops it. Two fingers on a touch device play two cards.
- "+" inserts a degree from a preset; "×" deletes it.
- Keys `a s d f` play degrees 1–4. Holding a key doesn't retrigger.
- Inter-scale ratios show `3/2` for degrees 1 and 8 in chromatic JI.
- Switching windows while holding a key releases the note.

- [ ] **Step 7: Commit**

```bash
git add src/components/TuningPanel.tsx src/components/DegreeGrid.tsx src/components/KeyboardMap.tsx src/components/InterScaleRatios.tsx src/App.tsx
git commit -m "feat: tuning panel, playable degree cards, keyboard map, inter-scale ratios"
```

---
### Task 10: Harmonics editor (curve controls + draggable bars)

**Files:**
- Create: `src/components/HarmonicsEditor.tsx`

**Interfaces:**
- Consumes: `useStore` (`harmonics`, `setHarmonics`, `setTweak`, `resetTweaks`), `computeAmplitudes`, `MAX_HARMONICS`, `HarmonicFilter` (Task 2), `NumberField`, `Slider`, `Segmented` (Task 8)
- Produces: `HarmonicsEditor()` (no props)

- [ ] **Step 1: Write `src/components/HarmonicsEditor.tsx`**

```tsx
import { useRef, type PointerEvent as RPointerEvent } from 'react';
import { useStore } from '../state/store';
import { computeAmplitudes, MAX_HARMONICS, type HarmonicFilter } from '../audio/harmonics';
import { NumberField, Segmented, Slider } from './ui';

const fmtCurve = (c: number) => (Math.abs(c) < 0.005 ? 'LIN' : c > 0 ? `EXP ${c.toFixed(2)}` : `LOG ${(-c).toFixed(2)}`);

export function HarmonicsEditor() {
  const h = useStore((s) => s.harmonics);
  const { setHarmonics, setTweak, resetTweaks } = useStore.getState();
  const amps = computeAmplitudes(h);
  const count = amps.length;
  const svgRef = useRef<SVGSVGElement>(null);
  const last = useRef<number | null>(null);

  const hit = (e: RPointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const n = Math.min(count, Math.max(1, Math.floor(((e.clientX - r.left) / r.width) * count) + 1));
    const level = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    return { n, level };
  };

  const paint = (e: RPointerEvent) => {
    const { n, level } = hit(e);
    const from = last.current ?? n;
    const [lo, hi] = from < n ? [from, n] : [n, from];
    for (let k = lo; k <= hi; k++) setTweak(k, level); // fill bars skipped by a fast drag
    last.current = n;
  };

  const hasTweaks = Object.keys(h.tweaks).some((k) => Number(k) <= count);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h3 className="display m-0 text-lg">Harmonics</h3>
        <button type="button" className="btn" disabled={!hasTweaks} onClick={resetTweaks}
          style={{ opacity: hasTweaks ? 1 : 0.4 }}>Reset tweaks</button>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <NumberField label="Count" value={h.count} min={1} max={MAX_HARMONICS}
          onChange={(v) => setHarmonics({ count: Math.round(v) })} />
        <Slider label="Start" value={h.start} min={0} max={1} step={0.01} format={(v) => v.toFixed(2)}
          onChange={(v) => setHarmonics({ start: v })} />
        <Slider label="End" value={h.end} min={0} max={1} step={0.01} format={(v) => v.toFixed(2)}
          onChange={(v) => setHarmonics({ end: v })} />
        <Slider label="Curve  log · lin · exp" value={h.curve} min={-1} max={1} step={0.01} format={fmtCurve}
          onChange={(v) => setHarmonics({ curve: Math.abs(v) < 0.03 ? 0 : v })} />
        <Segmented<HarmonicFilter> label="Harmonic filter" value={h.filter} onChange={(filter) => setHarmonics({ filter })}
          options={[{ value: 'all', label: 'All' }, { value: 'odd', label: 'Odd' }, { value: 'even', label: 'Even' }]} />
      </div>
      <div className="overflow-x-auto">
        <svg ref={svgRef} viewBox={`0 0 ${count} 1`} preserveAspectRatio="none"
          className="block h-36 w-full cursor-ns-resize border border-[var(--border-subtle)]"
          style={{ minWidth: count * 4, touchAction: 'none' }}
          role="img" aria-label="Harmonic levels. Drag bars to tweak, double-click to reset a bar."
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); last.current = null; paint(e); }}
          onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) paint(e); }}
          onPointerUp={() => { last.current = null; }}
          onDoubleClick={(e) => setTweak(hit(e as unknown as RPointerEvent).n, null)}>
          {amps.map((a, i) => {
            const tweaked = h.tweaks[i + 1] != null;
            const pad = count > 32 ? 0.1 : 0.15;
            return (
              <g key={i}>
                <rect x={i + pad} y={1 - a} width={1 - 2 * pad} height={a}
                  fill="var(--accent)" opacity={tweaked ? 0.35 : 0.9} />
                {tweaked && (
                  <rect x={i + pad} y={1 - a} width={1 - 2 * pad} height={a} fill="none"
                    stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                )}
              </g>
            );
          })}
        </svg>
        <div className="mono mt-1 flex justify-between text-[10px] text-[var(--text-muted)]" style={{ minWidth: count * 4 }}>
          <span>1</span>
          {count > 2 && <span>{Math.ceil(count / 2)}</span>}
          {count > 1 && <span>{count}</span>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors. (The editor is mounted in Task 12; it's checked visually there.)

- [ ] **Step 3: Commit**

```bash
git add src/components/HarmonicsEditor.tsx
git commit -m "feat: harmonics editor with log/lin/exp curve and draggable bar tweaks"
```

---
### Task 11: Envelope editor (draggable ADSR graph + live note dots)

**Files:**
- Create: `src/components/EnvelopeEditor.tsx`

**Interfaces:**
- Consumes: `useStore` (`envelope`, `setEnvelope`, `notes`), `shapeCurve` (Task 2), `CURVE_AMOUNT`, `CurveKind`, `EnvelopeSettings` (Task 3), `engine.getVoices()` (Task 6), `degreeColor` (Task 7), `useResolvedTheme` (Task 8), `NumberField`, `Segmented` (Task 8)
- Produces: `EnvelopeEditor()` (no props)

- [ ] **Step 1: Write `src/components/EnvelopeEditor.tsx`**

```tsx
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useStore } from '../state/store';
import { shapeCurve } from '../audio/curves';
import { CURVE_AMOUNT, type CurveKind, type EnvelopeSettings } from '../audio/envelope';
import { engine, type VoiceSnapshot } from '../audio/engine';
import { degreeColor } from '../theme';
import { useResolvedTheme } from '../hooks/useTheme';
import { NumberField, Segmented } from './ui';

const W = 600;
const H = 200;
const PAD = 12;
const IW = W - 2 * PAD;
const IH = H - 2 * PAD;
const PLATEAU = IW * 0.2;
const MAX = { attack: 5000, decay: 5000, release: 10000 };
const CURVES: { value: CurveKind; label: string }[] = [
  { value: 'lin', label: 'Lin' }, { value: 'exp', label: 'Exp' }, { value: 'log', label: 'Log' },
];

type Handle = 'attack' | 'decay' | 'release';

const scaleFor = (e: EnvelopeSettings) => (IW - PLATEAU) / Math.max(50, e.attack + e.decay + e.release);
const yOf = (level: number) => PAD + (1 - level) * IH;

function geometry(e: EnvelopeSettings, k: number) {
  const x0 = PAD;
  const x1 = x0 + e.attack * k;
  const x2 = x1 + e.decay * k;
  const x3 = x2 + PLATEAU;
  const x4 = x3 + e.release * k;
  return { x0, x1, x2, x3, x4 };
}

function segPath(xa: number, xb: number, la: number, lb: number, curve: CurveKind) {
  let d = '';
  for (let i = 1; i <= 32; i++) {
    const t = i / 32;
    d += ` L ${xa + (xb - xa) * t} ${yOf(shapeCurve(la, lb, t, CURVE_AMOUNT[curve]))}`;
  }
  return d;
}

function dotPosition(v: VoiceSnapshot, e: EnvelopeSettings, k: number) {
  const g = geometry(e, k);
  switch (v.stage) {
    case 'attack': return g.x0 + v.elapsedMs * k;
    case 'decay': return g.x1 + (v.elapsedMs - e.attack) * k;
    case 'sustain': return g.x2 + PLATEAU * Math.min(1, (v.elapsedMs - e.attack - e.decay) / 1000);
    case 'release': return g.x3 + v.elapsedMs * k;
  }
}

export function EnvelopeEditor() {
  const dark = useResolvedTheme() === 'dark';
  const env = useStore((s) => s.envelope);
  const len = useStore((s) => s.notes.length);
  const setEnvelope = useStore((s) => s.setEnvelope);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ handle: Handle; k: number } | null>(null);
  const [voices, setVoices] = useState<VoiceSnapshot[]>([]);

  const k = drag.current?.k ?? scaleFor(env);
  const g = geometry(env, k);

  // live dots: poll the engine each frame while anything is sounding
  useEffect(() => {
    let raf = 0;
    let had = false;
    const tick = () => {
      const vs = engine.getVoices();
      if (vs.length || had) setVoices(vs);
      had = vs.length > 0;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toLocal = (e: RPointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toLocal(e);
    const gg = geometry(env, d.k);
    const ms = (from: number, max: number) => Math.round(Math.min(max, Math.max(0, (p.x - from) / d.k)));
    if (d.handle === 'attack') setEnvelope({ attack: ms(gg.x0, MAX.attack) });
    if (d.handle === 'decay') {
      setEnvelope({
        decay: ms(gg.x1, MAX.decay),
        sustain: Math.round(Math.min(1, Math.max(0, 1 - (p.y - PAD) / IH)) * 100) / 100,
      });
    }
    if (d.handle === 'release') setEnvelope({ release: ms(gg.x3, MAX.release) });
  };

  const start = (handle: Handle) => (e: RPointerEvent) => {
    svgRef.current!.setPointerCapture(e.pointerId);
    drag.current = { handle, k: scaleFor(env) };
  };

  const handle = (h: Handle, x: number, y: number) => (
    <circle cx={x} cy={y} r={7} fill="var(--bg-raised)" stroke="var(--accent)" strokeWidth={2}
      className="cursor-grab" onPointerDown={start(h)} role="slider" aria-label={`${h} handle`} />
  );

  const path =
    `M ${g.x0} ${yOf(0)}` +
    segPath(g.x0, g.x1, 0, 1, env.attackCurve) +
    segPath(g.x1, g.x2, 1, env.sustain, env.decayCurve) +
    ` L ${g.x3} ${yOf(env.sustain)}` +
    segPath(g.x3, g.x4, env.sustain, 0, env.releaseCurve);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="display m-0 text-lg">Envelope</h3>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full border border-[var(--border-subtle)]"
        style={{ touchAction: 'none' }}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}>
        {[0.25, 0.5, 0.75].map((l) => (
          <line key={l} x1={PAD} x2={W - PAD} y1={yOf(l)} y2={yOf(l)} stroke="var(--border-subtle)" strokeDasharray="2 4" />
        ))}
        <line x1={g.x2} x2={g.x2} y1={PAD} y2={H - PAD} stroke="var(--border-subtle)" />
        <line x1={g.x3} x2={g.x3} y1={PAD} y2={H - PAD} stroke="var(--border-subtle)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {voices.map((v) => (
          <circle key={v.id} cx={dotPosition(v, env, k)} cy={yOf(v.level)} r={5}
            fill={degreeColor(((Number(v.id) % len) + len) % len, dark)} />
        ))}
        {handle('attack', g.x1, yOf(1))}
        {handle('decay', g.x2, yOf(env.sustain))}
        {handle('release', g.x4, yOf(0))}
      </svg>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-2">
          <NumberField label="Attack" suffix="ms" value={env.attack} min={0} max={MAX.attack} onChange={(v) => setEnvelope({ attack: v })} />
          <Segmented<CurveKind> label="Attack curve" value={env.attackCurve} options={CURVES} onChange={(c) => setEnvelope({ attackCurve: c })} />
        </div>
        <div className="flex flex-col gap-2">
          <NumberField label="Decay" suffix="ms" value={env.decay} min={0} max={MAX.decay} onChange={(v) => setEnvelope({ decay: v })} />
          <Segmented<CurveKind> label="Decay curve" value={env.decayCurve} options={CURVES} onChange={(c) => setEnvelope({ decayCurve: c })} />
        </div>
        <NumberField label="Sustain" suffix="%" value={Math.round(env.sustain * 100)} min={0} max={100}
          onChange={(v) => setEnvelope({ sustain: v / 100 })} />
        <div className="flex flex-col gap-2">
          <NumberField label="Release" suffix="ms" value={env.release} min={0} max={MAX.release} onChange={(v) => setEnvelope({ release: v })} />
          <Segmented<CurveKind> label="Release curve" value={env.releaseCurve} options={CURVES} onChange={(c) => setEnvelope({ releaseCurve: c })} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors. (Mounted and checked visually in Task 12.)

- [ ] **Step 3: Commit**

```bash
git add src/components/EnvelopeEditor.tsx
git commit -m "feat: draggable ADSR envelope editor with curved segments and live note dots"
```

---
### Task 12: Synth panel (presets, editors, volume, space)

**Files:**
- Create: `src/components/SynthPanel.tsx`
- Modify: `src/App.tsx` (replace marker `SYNTH_PANEL`)

**Interfaces:**
- Consumes: `useStore` (`preset`, `applyPreset`, `volume`, `setVolume`, `space`, `setSpace`), `SYNTH_PRESETS`, `PresetId` (Task 7), `HarmonicsEditor` (Task 10), `EnvelopeEditor` (Task 11), `Segmented`, `Slider` (Task 8)
- Produces: `SynthPanel()` (no props)

- [ ] **Step 1: Write `src/components/SynthPanel.tsx`**

```tsx
import { useStore } from '../state/store';
import { SYNTH_PRESETS, type PresetId } from '../state/presets';
import { HarmonicsEditor } from './HarmonicsEditor';
import { EnvelopeEditor } from './EnvelopeEditor';
import { Segmented, Slider } from './ui';

const OPTIONS: { value: PresetId; label: string }[] = [
  ...Object.entries(SYNTH_PRESETS).map(([value, p]) => ({ value: value as PresetId, label: p.label })),
  { value: 'custom', label: 'Custom' },
];

export function SynthPanel() {
  const preset = useStore((s) => s.preset);
  const volume = useStore((s) => s.volume);
  const space = useStore((s) => s.space);
  const { applyPreset, setVolume, setSpace } = useStore.getState();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="label">Preset</span>
          <Segmented<PresetId> label="Synth preset" value={preset} options={OPTIONS}
            onChange={(id) => { if (id !== 'custom') applyPreset(id); }} />
        </div>
        <div className="flex flex-wrap gap-6">
          <Slider label="Volume" value={volume} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={setVolume} />
          <Slider label="Space (reverb)" value={space} min={0} max={1} step={0.01}
            format={(v) => (v === 0 ? 'dry' : `${Math.round(v * 100)}%`)} onChange={setSpace} />
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <HarmonicsEditor />
        <EnvelopeEditor />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `src/App.tsx`**

Add `import { SynthPanel } from './components/SynthPanel';` and replace `<>{/* SYNTH_PANEL */}</>` with `<SynthPanel />`.

- [ ] **Step 3: Verify**

Run: `npm run build && npm test`
Expected: no type errors, all tests pass.
In the dev server's Synthesizer tab, check:
- Each preset changes the sound and the bar and envelope graphs. Editing any control flips the preset to CUSTOM.
- Count goes to 64, and the bar chart scrolls horizontally on a narrow window.
- Curve at +1 bends the bars below a straight line, and at −1 above it.
- Dragging across bars sets outlined tweak bars. Double-click clears one; RESET TWEAKS clears all.
- While holding a chord, dragging the curve audibly changes the timbre with no dropout.
- Envelope handles drag, and the number fields follow. LIN/EXP/LOG reshape the segments.
- Held notes show colored dots moving along the envelope.
- Releasing mid-attack makes no click, and the PLUCK preset decays to silence while held.
- Space at 0 is fully dry; raising it adds reverb.
- A 10-note chord doesn't distort.

- [ ] **Step 4: Commit**

```bash
git add src/components/SynthPanel.tsx src/App.tsx
git commit -m "feat: synth panel with presets, harmonics and envelope editors, volume and space"
```

---
### Task 13: Drawing functions (computed + live wave and spectrum)

**Files:**
- Create: `src/viz/drawWave.ts`, `src/viz/drawSpectrum.ts`
- Test: `tests/drawHelpers.test.ts`

**Interfaces:**
- Consumes: `Partial`, `Coincidence`, `NearMiss` (Task 5)
- Produces:
  - `interface DrawCtx { ctx: CanvasRenderingContext2D; w: number; h: number; colors: { text: string; secondary: string; muted: string; border: string; bg: string } }` (CSS pixel units; caller has applied DPR transform)
  - `interface WaveNote { id: string; freq: number; level: number; color: string; dim: boolean }`
  - `sampleTable(table: Float32Array, cycles: number): number` (linear interpolation, wraps)
  - `tablePeak(table: Float32Array): number` (cached per table)
  - `drawComputedWave(dc: DrawCtx, notes: WaveNote[], table: Float32Array, rootHz: number, periods: number, clock: number, showSum: boolean, sumState: { scale: number }): void`
  - `findTrigger(buf: Float32Array, window: number): number`
  - `drawLiveWave(dc: DrawCtx, analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>, gain: number): void`
  - `freqToX(f: number, fmin: number, fmax: number, w: number, scale: 'log' | 'lin'): number`
  - `drawComputedSpectrum(dc: DrawCtx, partials: Partial[], found: { coincident: Coincidence[]; near: NearMiss[] }, colorOf: (noteId: string) => string, scale: 'log' | 'lin', hoverX: number | null): void`
  - `drawLiveSpectrum(dc: DrawCtx, analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>, peaks: Float32Array, dt: number): void`
  - `drawHint(dc: DrawCtx, text: string): void`

- [ ] **Step 1: Write failing tests** — `tests/drawHelpers.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { sampleTable, tablePeak, findTrigger } from '../src/viz/drawWave';
import { freqToX } from '../src/viz/drawSpectrum';

describe('draw helpers', () => {
  const table = new Float32Array([0, 1, 0, -1]);
  it('sampleTable interpolates and wraps', () => {
    expect(sampleTable(table, 0)).toBe(0);
    expect(sampleTable(table, 0.25)).toBeCloseTo(1);
    expect(sampleTable(table, 0.125)).toBeCloseTo(0.5);
    expect(sampleTable(table, 1.25)).toBeCloseTo(1);
    expect(sampleTable(table, -0.75)).toBeCloseTo(1);
  });
  it('tablePeak finds the max absolute value', () => {
    expect(tablePeak(new Float32Array([0.2, -0.9, 0.5]))).toBeCloseTo(0.9);
  });
  it('findTrigger returns the first rising zero crossing after a negative excursion', () => {
    const buf = new Float32Array(400);
    for (let i = 0; i < 400; i++) buf[i] = Math.sin((2 * Math.PI * (i + 10.5)) / 100); // crossing falls between samples 89 and 90
    const t = findTrigger(buf, 200);
    expect(buf[t - 1]).toBeLessThanOrEqual(0);
    expect(buf[t]).toBeGreaterThan(0);
    expect(t).toBe(90);
  });
  it('freqToX maps endpoints and octaves', () => {
    expect(freqToX(100, 100, 400, 200, 'log')).toBe(0);
    expect(freqToX(400, 100, 400, 200, 'log')).toBe(200);
    expect(freqToX(200, 100, 400, 200, 'log')).toBeCloseTo(100);
    expect(freqToX(250, 100, 400, 300, 'lin')).toBeCloseTo(150);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/drawHelpers.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `src/viz/drawWave.ts`**

```ts
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
```

- [ ] **Step 4: Implement `src/viz/drawSpectrum.ts`**

```ts
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

function vline(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number) {
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
}

export function drawComputedSpectrum(
  dc: DrawCtx, partials: Partial[], found: { coincident: Coincidence[]; near: NearMiss[] },
  colorOf: (noteId: string) => string, scale: 'log' | 'lin', hoverX: number | null,
) {
  const { ctx, w, h, colors } = dc;
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

  // coincident partials: stacked segments in each note's colour, ◆ on top
  ctx.font = '10px "JetBrains Mono Variable", monospace';
  for (const c of found.coincident) {
    const cx = x(c.freq);
    let y = base;
    for (const m of c.members) {
      const l = len(m.amp);
      ctx.strokeStyle = colorOf(m.noteId);
      vline(ctx, cx, y, y - l);
      y -= l;
    }
    ctx.fillStyle = colors.text;
    ctx.fillText('◆', cx - 4, y - 4);
  }

  // near-misses: bracket + beat rate
  ctx.lineWidth = 1;
  for (const n of found.near) {
    const xa = x(n.a.freq);
    const xb = x(n.b.freq);
    const yt = base - Math.max(len(n.a.amp), len(n.b.amp)) - 10;
    ctx.strokeStyle = colors.secondary;
    ctx.beginPath();
    ctx.moveTo(xa, yt + 5);
    ctx.lineTo(xa, yt);
    ctx.lineTo(xb, yt);
    ctx.lineTo(xb, yt + 5);
    ctx.stroke();
    const label = `${n.beatHz.toFixed(2)} Hz`;
    ctx.fillStyle = colors.secondary;
    ctx.fillText(label, Math.min(w - ctx.measureText(label).width, Math.max(0, (xa + xb) / 2 - ctx.measureText(label).width / 2)), yt - 4);
  }

  if (hoverX != null) {
    let best: Partial | null = null;
    let bestD = 6;
    for (const p of partials) {
      const d = Math.abs(x(p.freq) - hoverX);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best) {
      const text = `degree ${best.degree + 1} · harmonic ${best.harmonic} · ${best.freq.toFixed(1)} Hz · ${best.amp.toFixed(2)}`;
      ctx.font = '11px "JetBrains Mono Variable", monospace';
      const tw = ctx.measureText(text).width + 12;
      const bx = Math.min(w - tw - 2, Math.max(2, hoverX + 8));
      ctx.fillStyle = colors.bg;
      ctx.strokeStyle = colors.text;
      ctx.fillRect(bx, 4, tw, 20);
      ctx.strokeRect(bx + 0.5, 4.5, tw - 1, 19);
      ctx.fillStyle = colors.text;
      ctx.fillText(text, bx + 6, 18);
    }
  }
}

export function drawLiveSpectrum(dc: DrawCtx, analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>, peaks: Float32Array, dt: number) {
  const { ctx, w, h, colors } = dc;
  analyser.getFloatFrequencyData(buf);
  const binHz = analyser.context.sampleRate / analyser.fftSize;
  const fmin = 20;
  const fmax = 20000;
  const base = h - 18;
  const top = 10;
  const yOf = (db: number) => top + (Math.min(0, Math.max(-100, db)) / -100) * (base - top);
  const fAt = (px: number) => fmin * (fmax / fmin) ** (px / w);

  // octave Cs as faint gridlines, labels at 100 / 1k / 10k
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.border;
  for (let f = 32.703; f < fmax; f *= 2) vline(ctx, freqToX(f, fmin, fmax, w, 'log'), 0, base);
  ctx.font = '10px "JetBrains Mono Variable", monospace';
  ctx.fillStyle = colors.muted;
  for (const f of [100, 1000, 10000]) ctx.fillText(fmtHz(f), freqToX(f, fmin, fmax, w, 'log') + 3, base + 13);

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
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/drawHelpers.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/viz/drawWave.ts src/viz/drawSpectrum.ts tests/drawHelpers.test.ts
git commit -m "feat: canvas drawing for computed/live wave and spectrum"
```

---
### Task 14: Visualizer component (canvas, animation loop, mode controls)

**Files:**
- Create: `src/viz/Visualizer.tsx`
- Modify: `src/App.tsx` (replace marker `VISUALIZER`)

**Interfaces:**
- Consumes: `useStore` (`viz`, `setViz`, `notes`, `root`, `shown`), `engine` (`getVoices`, `getWavetable`, `getAmplitudes`, `getAnalyser`), `degreeFreq`, `mod` (Task 4), `degreeColor` (Task 7), `buildPartials`, `findCoincidences` (Task 5), all draw functions (Task 13), `Segmented`, `Slider`, `NumberField` (Task 8)
- Produces: `Visualizer()` (no props)

- [ ] **Step 1: Write `src/viz/Visualizer.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { useStore, type VizSettings } from '../state/store';
import { engine } from '../audio/engine';
import { degreeFreq, mod } from '../tuning/ratios';
import { degreeColor } from '../theme';
import { buildPartials, findCoincidences } from './partials';
import { drawComputedWave, drawLiveWave, drawHint, type DrawCtx, type WaveNote } from './drawWave';
import { drawComputedSpectrum, drawLiveSpectrum } from './drawSpectrum';
import { NumberField, Segmented, Slider } from '../components/ui';

interface Drawn extends WaveNote { degree: number }

/** Held voices at their live level, plus shown (~) degrees that aren't sounding, dimmed at full level. */
function drawnNotes(dark: boolean): Drawn[] {
  const s = useStore.getState();
  const len = s.notes.length;
  const out: Drawn[] = [];
  const sounding = new Set<number>();
  for (const v of engine.getVoices()) {
    const degree = Number(v.id);
    sounding.add(degree);
    out.push({ id: v.id, degree, freq: v.freq, level: v.level, color: degreeColor(mod(degree, len), dark), dim: false });
  }
  for (const d of s.shown) {
    if (sounding.has(d) || d >= len) continue;
    const freq = degreeFreq(s.notes, d, s.root.freq);
    if (freq == null) continue;
    out.push({ id: String(d), degree: d, freq, level: 1, color: degreeColor(d, dark), dim: true });
  }
  return out;
}

function cssColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return { text: v('--text'), secondary: v('--text-secondary'), muted: v('--text-muted'), border: v('--border-subtle'), bg: v('--bg') };
}

export function Visualizer() {
  const viz = useStore((s) => s.viz);
  const setViz = useStore((s) => s.setViz);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverX = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const ro = new ResizeObserver(() => {
      dpr = window.devicePixelRatio || 1;
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    });
    ro.observe(wrap);

    let raf = 0;
    let last = performance.now();
    let clock = 0;
    const sumState = { scale: 1 };
    let timeBuf: Float32Array<ArrayBuffer> | null = null;
    let freqBuf: Float32Array<ArrayBuffer> | null = null;
    let peaks: Float32Array | null = null;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (document.hidden || w === 0) return;
      const s = useStore.getState();
      const v: VizSettings = s.viz;
      clock += dt * v.speed;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const dc: DrawCtx = { ctx, w, h, colors: cssColors() };

      if (v.source === 'computed') {
        const notes = drawnNotes(dark);
        if (v.view === 'wave') {
          drawComputedWave(dc, notes, engine.getWavetable(), s.root.freq, v.periods, clock, v.showSum, sumState);
        } else {
          const partials = buildPartials(notes, engine.getAmplitudes());
          const colors = new Map(notes.map((n) => [n.id, n.color]));
          drawComputedSpectrum(dc, partials, findCoincidences(partials), (id) => colors.get(id) ?? dc.colors.text, v.freqScale, hoverX.current);
        }
        return;
      }

      const analyser = engine.getAnalyser();
      if (!analyser) return drawHint(dc, 'Play a note');
      if (v.view === 'wave') {
        if (!timeBuf || timeBuf.length !== analyser.fftSize) timeBuf = new Float32Array(analyser.fftSize);
        drawLiveWave(dc, analyser, timeBuf, v.liveGain);
      } else {
        if (!freqBuf || freqBuf.length !== analyser.frequencyBinCount) {
          freqBuf = new Float32Array(analyser.frequencyBinCount);
          peaks = new Float32Array(analyser.frequencyBinCount).fill(-200);
        }
        drawLiveSpectrum(dc, analyser, freqBuf, peaks!, dt);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <section className="panel flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <Segmented<VizSettings['view']> label="View" value={viz.view} onChange={(view) => setViz({ view })}
          options={[{ value: 'wave', label: 'Wave' }, { value: 'spectrum', label: 'Spectrum' }]} />
        <Segmented<VizSettings['source']> label="Source" value={viz.source} onChange={(source) => setViz({ source })}
          options={[{ value: 'computed', label: 'Computed' }, { value: 'live', label: 'Live' }]} />
        {viz.source === 'computed' && viz.view === 'wave' && (
          <>
            <NumberField label="Periods" value={viz.periods} min={1} max={16} onChange={(periods) => setViz({ periods: Math.round(periods) })} />
            <Slider label="Speed" value={viz.speed} min={0} max={4} step={0.05}
              format={(x) => (x === 0 ? 'frozen' : `${x.toFixed(2)}×`)} onChange={(speed) => setViz({ speed })} />
            <button type="button" className="btn" aria-pressed={viz.showSum}
              data-active={viz.showSum} style={viz.showSum ? { background: 'var(--accent)', color: 'var(--bg)' } : undefined}
              onClick={() => setViz({ showSum: !viz.showSum })}>Sum</button>
          </>
        )}
        {viz.source === 'computed' && viz.view === 'spectrum' && (
          <Segmented<VizSettings['freqScale']> label="Frequency axis" value={viz.freqScale} onChange={(freqScale) => setViz({ freqScale })}
            options={[{ value: 'log', label: 'Log' }, { value: 'lin', label: 'Lin' }]} />
        )}
        {viz.source === 'live' && viz.view === 'wave' && (
          <Slider label="Gain" value={viz.liveGain} min={1} max={8} step={0.5}
            format={(x) => `×${x}`} onChange={(liveGain) => setViz({ liveGain })} />
        )}
      </div>
      <div ref={wrapRef} className="relative h-[320px] w-full sm:h-[380px]"
        onPointerMove={(e) => { hoverX.current = e.clientX - e.currentTarget.getBoundingClientRect().left; }}
        onPointerLeave={() => { hoverX.current = null; }}>
        <canvas ref={canvasRef} className="absolute inset-0" aria-label="Wave and spectrum visualizer" />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire into `src/App.tsx`**

Add `import { Visualizer } from './viz/Visualizer';` and replace `{/* VISUALIZER */}` with `<Visualizer />`.

- [ ] **Step 3: Verify**

Run: `npm run build && npm test`
Expected: no type errors, all tests pass.
In the dev server, check:
- **Computed wave:** degree 1 shows dimmed at rest. Playing degrees 1 and 8 in chromatic JI draws two colored traces that line up every 2 root cycles, plus a thick sum trace. Speed 0 freezes. Traces swell with attack and fade on release.
- **Computed spectrum:** the JI fifth shows ◆ markers on shared partials. In equal temperament the same fifth shows brackets with beat rates (≈1.5 Hz where 3×440 meets 2×659.26 for root A). Hovering a line shows the tooltip. LOG/LIN switches the axis.
- **Live wave:** the trace holds still on a sustained note; the gain slider scales it.
- **Live spectrum:** peaks appear at the harmonics, and the peak-hold line decays.
- Every mode shows the "Play a note" hint when silent.
- Theme switching recolors the canvas on the next frame.
- At 64 harmonics with 10 notes held, animation stays smooth.

- [ ] **Step 4: Commit**

```bash
git add src/viz/Visualizer.tsx src/App.tsx
git commit -m "feat: animated visualizer with computed/live wave and spectrum views"
```

---
### Task 15: End-to-end verification and polish

**Files:**
- Create: `.claude/launch.json` (dev server config for the preview tool)
- Modify: only files where verification finds defects (each fix gets its own commit with a test first when the defect is in a pure module)

**Interfaces:**
- Consumes: the whole app.
- Produces: a verified build in `dist/`.

- [ ] **Step 1: Add `.claude/launch.json`**

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev", "--", "--port", "5173", "--strictPort"], "port": 5173 }
  ]
}
```

- [ ] **Step 2: Full automated check**

Run: `npm test && npm run build`
Expected: all test files pass (smoke, curves, harmonics, timbre, envelope, ratios, keymaps, interScale, partials, engine, store, theme, drawHelpers); build succeeds with no type errors.

- [ ] **Step 3: Desktop browser pass (1280 px)**

Start the `dev` preview and go through every check from Tasks 8, 9, 12 and 14. Also confirm:
- No console errors or warnings, especially React "getSnapshot should be cached" warnings from Zustand selectors.
- Reload keeps tuning, notes, synth, envelope, visualizer mode, open sections, and theme; held notes are not restored.
- With localStorage blocked (e.g. a private window that throws), the app still loads with defaults.

- [ ] **Step 4: Mobile pass (375 px, touch emulation)**

- No horizontal page scroll (only the harmonics chart scrolls when count is high).
- Degree cards are 2 per row; tapping plays; two-finger taps play two notes; scrolling the page past cards doesn't leave stuck notes.
- Envelope handles drag with touch.

- [ ] **Step 5: Dark mode pass**

Set the theme to DARK: the background is `#111`, the degree colors are brighter, canvas text and grids use dark tokens, and the inputs are readable.

- [ ] **Step 6: Sound-quality pass**

- Rapid repeated taps on one card: no clicks and no phasing between overlapping copies.
- 0 ms attack and 0 ms release: a soft edge, not a click (3 ms floor).
- A 12-note chord on the STRINGS preset: no distortion.
- Switching SINE ↔ ORGAN while holding: loudness roughly constant.
- Space 0: no audible reverb tail.

- [ ] **Step 7: Commit**

```bash
git add .claude/launch.json
git commit -m "chore: add dev preview config after end-to-end verification"
```
