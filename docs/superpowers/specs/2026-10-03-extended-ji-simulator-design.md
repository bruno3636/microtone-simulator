# Extended Just Intonation Simulator — Design

Date: 2026-10-03
Status: Approved 2026-10-03

## 1. Summary

_Renamed 2026-10-03: the app is now titled **Microtone Simulator**; the header wordmark uses DM Sans (sans-serif); section headings use Space Grotesk (replacing Newsreader); the scale-degree section is titled **Pitch Collection**._

A rebuild of [web_intonation](https://flappix.github.io/web_intonation/) as a new web app named
**Extended Just Intonation Simulator**. It keeps the original's tuning features and adds:

- an animated visualizer with wave and spectrum (Fourier) views, each computed or live
- a harmonic loudness curve with log/linear/exp shaping plus per-bar manual tweaks (1–64 harmonics)
- a draggable ADSR envelope editor with curved segments
- synth presets, click/touch playing, remembered settings, light/dark theme
- a sound engine designed so beating and consonance are easy to hear

The MIDI tab is removed. Visuals match trichordtrainer.com.

## 2. Stack & project layout

- Vite + React 19 + TypeScript + Tailwind CSS v4, Zustand (with `persist`), mathjs, Vitest.
- Fonts self-hosted via `@fontsource-variable/newsreader`, `@fontsource-variable/dm-sans`,
  `@fontsource-variable/jetbrains-mono`.
- Builds to static files in `dist/` with `base: './'` so it can be hosted anywhere (GitHub Pages included).

```
src/
  main.tsx, App.tsx, index.css          theme tokens, fonts, base styles
  audio/
    engine.ts       AudioEngine class: context, voices, master chain, analyser
    envelope.ts     pure ADSR math: level(t), curve sampling, release-from-level
    harmonics.ts    pure: amplitudes from {count, start, end, curve, filter, tweaks}
    timbre.ts       pure: RMS normalization, PeriodicWave coefficients, wavetable
    curves.ts       pure: shared convex/concave shaping used by harmonics + envelope
    reverb.ts       generated impulse response for the optional reverb
  tuning/
    presets.ts      tunings, scales, root note table, default key maps
    ratios.ts       parse/evaluate ratio expressions, octave handling, "pure" check
    interScale.ts   inter-scale ratio table (simplified fraction + decimal)
    keymaps.ts      key → degree lookup (including octave suffix syntax "f2")
  viz/
    Visualizer.tsx  canvas, rAF loop, mode switches
    drawWave.ts     computed + live wave drawing
    drawSpectrum.ts computed + live spectrum drawing
    partials.ts     pure: partial list, coincidence and near-miss detection
  components/       Header, TabBar, Segmented, Slider, NumberField, TuningPanel,
                    SynthPanel, HarmonicsEditor, EnvelopeEditor, PresetBar,
                    DegreeGrid, DegreeCard, AddDegreePopover, KeyboardMap,
                    InterScaleRatios, Section (collapsible)
  state/store.ts    Zustand store + persist
  hooks/useKeyboard.ts
```

Pure modules (`envelope`, `harmonics`, `timbre`, `curves`, `tuning/*`, `partials`) have no
React or Web Audio dependency and are unit tested.

## 3. Sound engine

### 3.1 Signal chain

```
per voice:  OscillatorNode(PeriodicWave) → envGain → voiceGain ┐
                                                                ├→ dryBus ──────────────┐
                                                                └→ ConvolverNode → wet ─┤
                                              masterGain ← DynamicsCompressor ← sum ←───┘
                                              masterGain → destination
                                              masterGain → AnalyserNode (live views)
```

- One `OscillatorNode` per voice using a shared `PeriodicWave` built from the current timbre.
  A new oscillator is created on every note-on (oscillators can't be restarted), so every note
  starts at phase 0 with all harmonics in sine phase. That gives identical timbre on every press
  and keeps the computed visualizer in sync with what you hear.
- The `AudioContext` is created lazily and resumed on the first user gesture (key, click, touch).

### 3.2 Engine interface (sound-generation agnostic)

```ts
class AudioEngine {
  noteOn(id: string, freq: number): void      // id = degree key, e.g. "7" or "-3"
  noteOff(id: string): void
  allNotesOff(): void
  setTimbre(t: TimbreSettings): void           // debounced 50 ms, updates held voices
  setEnvelope(e: EnvelopeSettings): void       // applies to new notes; held notes keep theirs
  setMasterVolume(v: number): void
  setReverbMix(wet: number): void
  getVoices(now?: number): VoiceSnapshot[]     // for the visualizer: id, freq, level, stage, stageT
  getAnalyser(): AnalyserNode | null
}
```

The UI depends only on this interface, so the generator can later become a dual-wave crossfade
or an AudioWorklet without UI changes.

### 3.3 Click-free envelopes

- Attack, decay, and release are each scheduled as 32 `linearRampToValueAtTime` points that follow
  the shared curve. This works in every browser (no `setValueCurveAtTime` overlap errors, no
  dependence on `cancelAndHoldAtTime`), and pending points cancel cleanly.
- Every ramp has a 3 ms minimum duration (de-click floor), even when the user sets 0 ms.
- **Release from current level:** on note-off the engine computes the voice's exact current level
  analytically (`envelope.levelAt(settings, elapsed)`), calls `cancelScheduledValues(now)` +
  `setValueAtTime(level, now)`, then schedules the release segment from that level to 0.
  Releasing mid-attack never jumps.
- **Re-strike:** a note-on for an id that's still sounding (held or releasing) reuses that voice:
  same oscillator (no phase reset, no second same-pitch voice) and the envelope restarts from the
  current level (attack from that level up to 1, then decay). There is no dip, so re-striking
  common tones in chord changes is click-free. Once the release has died away (level ≤ 0.001)
  a fresh voice starts instead. The 8 ms fast-fade is used only for voice stealing.
- Each voice keeps a snapshot of the envelope settings it started with, so editing the envelope
  never alters a note mid-flight.
- Oscillators are stopped and disconnected 50 ms after their release ends.

### 3.4 Gain staging

- **Timbre normalization:** `PeriodicWave` is created with `disableNormalization: true`.
  Amplitudes are RMS-normalized so that every timbre has the same RMS as a unit sine
  (`a_k' = a_k / sqrt(Σ a_k²)`). Switching SINE → ORGAN doesn't change perceived loudness.
- **Voice-count scaling:** each voice's `voiceGain` = `0.3 / sqrt(max(1, activeVoices))`.
  When the voice count changes, all held voices glide to the new value with
  `setTargetAtTime(…, τ = 15 ms)`, so adding a note to a chord never causes a jump.
- **Master compressor:** `DynamicsCompressorNode` at threshold −12 dB, knee 10 dB, ratio 4,
  attack 3 ms, release 250 ms. It catches peaks from dense chords and high-crest timbres.
- **Polyphony cap:** 24 voices. The oldest voice is stolen with the 8 ms fast-fade.

### 3.5 Live timbre edits

Changes to harmonics are debounced (50 ms). After the debounce a new `PeriodicWave` is built
and applied to every held voice with `setPeriodicWave`, so you hear timbre changes while a
chord rings. Envelope edits apply only to new notes (3.3).

### 3.6 Effects policy

No vibrato, chorus, detune, or modulation of any kind: these smear pitch and hide beating.
The only effect is an opt-in **reverb**: a `ConvolverNode` with a generated impulse response
(2.5 s stereo, exponentially decaying noise). It's controlled by a **Space** (dry/wet) slider in
the Synthesizer tab and defaults to **0 (fully dry)**.

### 3.7 Keyboard handling

- `keydown` with `event.repeat` is ignored (no machine-gun retriggers).
- Keys are ignored while focus is in an input, select, or textarea, so typing a ratio never plays
  notes (the original had this bug). Exception: after a pointer change, selects blur so note keys
  keep working; range/checkbox/button inputs never block note keys.
- On window `blur` or tab hide, all notes are released (no stuck notes).
- Pointer playing: `pointerdown` on a degree card plays it and `pointerup`/`pointercancel`/
  `pointerleave` releases it. Multi-touch plays chords. Pressing the card's inputs/buttons
  doesn't trigger a note.

## 4. Synthesizer

### 4.1 Shared curve rule (`curves.ts`)

A curve amount `c ∈ [−1, 1]` bends a segment between two levels `a → b` over `t ∈ [0, 1]`:

- `c = 0`: straight line.
- `c > 0` (**EXP**): bends **below** the straight line (convex), like exponential decay or growth.
- `c < 0` (**LOG**): bends **above** the straight line (concave), like a logarithm.

The rule holds whether the level rises or falls. Strength `k = 8·|c|`, using
`g(t) = (e^{k t} − 1)/(e^k − 1)` and its mirror `1 − g(1 − t)`, with the variant picked so the
result is convex for EXP and concave for LOG. The same function drives the harmonic curve and
envelope segments, so "EXP" looks the same everywhere.

### 4.2 Harmonics (`harmonics.ts`)

Settings:

| Field | Range | Default |
|---|---|---|
| count | 1–64 | 8 |
| start (fundamental level) | 0–1 | 1 |
| end (last harmonic level) | 0–1 | 0.1 |
| curve | −1 … +1 | 0.5 |
| filter | ALL / ODD / EVEN | ALL |
| tweaks | sparse map `harmonic → level (0–1)` | {} |

Computation for harmonic `n = 1…count`:
1. `t = (n − 1)/(count − 1)` (`t = 0` when count = 1); `base = shape(start, end, t, curve)`.
2. If `n` has a tweak, use the tweak value instead of `base`.
3. Filter: ODD zeroes even `n`, EVEN zeroes odd `n > 1`. The fundamental is always kept, so the
   pitch stays clear.
4. If every amplitude is 0, fall back to a pure sine.

Editor UI: number field + slider for count, sliders for start/end/curve (curve slider labeled
LOG · LIN · EXP), an ALL/ODD/EVEN segmented control, and a bar chart (canvas or SVG).
- Dragging vertically on a bar (or across several bars) sets tweaks. Tweaked bars are drawn
  as outlines with a filled inner level; untweaked bars are solid.
- Double-clicking a bar clears its tweak. **RESET TWEAKS** clears all.
- Lowering `count` hides tweaks above it but keeps them, so raising `count` again restores them.
- At 64 harmonics bars get thin; the chart keeps a 2 px minimum bar width and scrolls
  horizontally on narrow screens.

### 4.3 Envelope (`envelope.ts`)

| Field | Range | Default |
|---|---|---|
| attack | 0–5000 ms | 10 ms |
| decay | 0–5000 ms | 200 ms |
| sustain | 0–100 % | 80 % |
| release | 0–10000 ms | 400 ms |
| attackCurve / decayCurve / releaseCurve | curve amount −1 … +1 (0 = linear) | 0 / 0.6 / 0.6 |

Curves are continuous amounts in the shared rule (§4.1). Older saved settings with LIN/EXP/LOG names migrate to 0 / +0.6 / −0.6 (persist v4).

Pure functions:
- `levelAt(env, tHeld)`: level during attack/decay/sustain.
- `releaseLevelAt(env, fromLevel, tReleased)`: level during release.
- `sampleSegment(from, to, curve, points)`: `Float32Array` of curve samples. The engine itself schedules
  32-point linear ramps per §3.3 rather than `setValueCurveAtTime`.

Editor UI: an SVG graph. The x axis is time; the sustain portion is drawn as a fixed-width plateau.
- Draggable handles: attack peak (x = attack), decay end (x = decay, y = sustain), release
  end (x = release).
- The x scale auto-fits attack + decay + release (minimum span 50 ms) and is frozen while dragging.
- Number fields (ms, %) next to the graph stay in sync with the handles.
- Each sloped segment (attack, decay, release) has a small filled **curve dot** at its midpoint.
  Dragging it up or down moves the curve's midpoint and sets the curve amount (bisection on the
  shared rule); amounts within ±0.05 snap to linear, and a double-click resets to linear. Dragging
  a straight line's dot is how it becomes EXP or LOG — there are no LIN/EXP/LOG buttons. Flat
  segments (e.g. decay into 100 % sustain) show no curve dot. Each segment's amount is shown as a
  readout (LIN / EXP 0.60 / LOG 0.35) under its time field.
- Each held note shows a dot at its current position (from `engine.getVoices()`), in its
  degree color. On release the dot starts exactly where it was (the snapshot's `heldMs`) and
  glides to the end of the release segment over the release time; it never jumps.

### 4.4 Presets

Segmented bar, grouped by family (`PRESET_ORDER`): **SINE · SAW · SQUARE · TRIANGLE · PLUCK · ORGAN · PIANO · HARPSICHORD ·
GUITAR · HARP · VIOLIN · CELLO · VOICE · FLUTE · OBOE · CLARINET · SAXOPHONE · BASSOON · TRUMPET · FRENCH HORN ·
TROMBONE · TUBA · CUSTOM** (wraps on narrow screens). A preset sets harmonics, envelope and
brightness decay together; any later edit flips the selection to CUSTOM. SINE, SAW, SQUARE,
TRIANGLE and PLUCK are synthetic; every other preset uses a measured spectrum (§4.7). (STRINGS was removed 2026-10-03;
saved settings that name it migrate to CUSTOM.)

| Preset | Harmonics | Envelope (A/D/S/R, curves) |
|---|---|---|
| SINE | count 1 | 10 / 200 / 100 % / 300, LIN/EXP/EXP |
| SAW | exact Fourier series: 64 harmonics at (−1)^(k+1)/k (rising ramp) | 5 / 100 / 100 % / 120 |
| SQUARE | 64 harmonics, odd only, at 1/k | 5 / 100 / 100 % / 120 |
| TRIANGLE | 32 harmonics, odd only, at ±1/k² with alternating sign | 5 / 100 / 100 % / 120 |
| PLUCK | count 32, start 1, end 0.02, curve 0.85, ALL | 3 / 1200 / 0 % / 500, LIN/EXP/EXP |

Harmonic tweaks may be negative (−1 … 1): a phase-inverted harmonic. Sign doesn't change the
sound of a steady tone but does change the waveform's shape (needed for TRIANGLE and the rising
SAW). Bars, the spectrum view and normalization use magnitudes; dragging a bar sets a positive
level.

### 4.5 Other synth controls

- **Volume** (master), 0–1, default 0.6.
- **Space** (reverb wet), 0–1, default 0.

### 4.6 Brightness decay (added 2026-10-03)

Plucked and struck instruments get darker as they ring: upper partials die faster. A timbre can
optionally carry a second, **sustain spectrum** and a **darken time τ**.

- Settings: `darkHarmonics: HarmonicSettings | null` (null = off) and `brightnessTau` (ms, 50–5000).
- Engine: each voice runs two phase-locked oscillators (same frequency, same start time), one with
  the attack spectrum and one with the sustain spectrum, feeding the envelope gain through two
  weight gains. The attack weight w(t) = e^(−t/τ) (`setTargetAtTime`), the sustain weight 1 − w.
  Because both oscillators share phase and every harmonic is in sine phase, the sum is exactly the
  harmonic-by-harmonic blend `w·a_k + (1−w)·d_k`, with no phasing. Off → one oscillator per voice.
- Re-strike brightens again: the weights ramp back to fully bright over 5 ms, then darken anew.
- Both spectra are RMS-normalized independently; harmonic edits to either update held voices.
- UI: a **Brightness decay** toggle in the Harmonics editor; when on, an `ATTACK | SUSTAIN` switch
  picks which spectrum the controls and bars edit, and a **Darken** slider sets τ. Turning it on
  seeds the sustain spectrum from the attack spectrum with its end level lowered.
- Visualizer: each note's computed wave and spectrum use its current blend (`VoiceSnapshot.brightness`).

### 4.7 Instrument presets from spectral analysis (added 2026-10-03)

PIANO, GUITAR, VIOLIN and CELLO use measured harmonic spectra, stored as per-harmonic levels
(tweaks for every harmonic; values below −60 dB are dropped as noise floor).

| Preset | Spectrum source | Brightness decay |
|---|---|---|
| VIOLIN | SHARC (Sandell 1991, McGill Master Samples), `violin_vibrato`, median of 27 notes G3–A5, each normalized to its strongest harmonic | off |
| CELLO | SHARC `cello_vibrato`, median of 27 notes C2–D4 | off |
| PIANO | Univ. of Iowa MIS, Steinway, `Piano.mf.{C3,C4,A4}`, both channels: attack = 30–200 ms window, sustain = 0.8–1.2 s window, partial search allowing inharmonicity | on, τ = 1220 ms (fitted) |
| GUITAR | Univ. of Iowa MIS, `Guitar.mf.sulE.E2B2` + `sulA.C3B3`, 16 clean notes, same windows | on, τ = 570 ms (fitted) |
| ORGAN | Principal chorus 8′ + 4′ + 2⅔′ + 2′: each rank uses C. E. Pykett's measured Open Diapason spectral envelope (−6 dB/oct to harmonic 4.5, then −23 dB/oct); rank k feeds harmonics k, 2k, 3k…; ranks add in power at 0 / −3 / −6 / −6 dB | off |
| FLUTE | SHARC `flute_vibrato`, median of 25 notes C4–C6 | off |
| CLARINET | SHARC `Bb_clarinet`, median of 21 notes D3–A#4 (chalumeau/throat register) | off |
| TROMBONE | SHARC `trombone`, median of 26 notes E2–F4 | off |
| TRUMPET | SHARC `C_trumpet`, median of 31 notes F#3–C6 | off |
| OBOE | SHARC `oboe`, median of 27 notes A#3–C6 | off |
| BASSOON | SHARC `bassoon`, median of 32 notes A#1–F4 | off |
| TUBA | SHARC `tuba`, median of 26 notes C2–D4 | off |
| FRENCH HORN | SHARC `French_horn`, median of 37 notes D2–D5 | off |
| SAXOPHONE | Univ. of Iowa MIS Eb alto sax, `AltoSax.NoVib.mf.{Db3B3,C4B4}`, 23 notes, steady state 0.3–0.8 s | off |
| HARP | VSCO 2 CE (CC0) `KSHarp_{C3…E5}_mf`, 9 notes × 2 channels, attack/sustain windows as piano | on, τ = 595 ms |
| HARPSICHORD | Freesound "Harpsichord" pack by pjcohen (CC0), notes sounding D4/E4/D5/E5 (files labelled an octave lower), HQ MP3 previews, analysis capped at 16 kHz | on, τ = 475 ms |
| VOICE | Sung "ah", modelled from measured formants: Peterson & Barney (1952) /ɑ/ F1–F3 (mean of men and women: 790 / 1155 / 2625 Hz), typical F4/F5 and bandwidths, glottal source −12 dB/oct + radiation +6 dB/oct, evaluated at 220 Hz. Formants are fixed in Hz in a real voice; here the harmonic levels are fixed, so the vowel colour is exact at A3 and shifts at other pitches | off |

Envelopes: piano and guitar decay to silence while held, with the decay length chosen so the
measured median time to −20 dB (≈0.9 s) is matched by the EXP decay curve; bowed strings, winds,
brass and organ sustain, with onset times typical of each (organ ≈40 ms, flute 80, clarinet 40,
trombone 60, trumpet 35, violin 90, cello 130 ms).
Inharmonicity (piano) and vibrato (violin/cello/flute) are intentionally not reproduced: the synth keeps
exact integer harmonics and no pitch modulation, so beating and consonance stay readable.

## 5. Visualizer

A single `<canvas>` panel (DPR-aware, resizes with a `ResizeObserver`), redrawn on every
`requestAnimationFrame` while visible. It reads `engine.getVoices()` and the store directly
(through `useStore.getState()`), not through React renders.

Controls above the canvas:
- `WAVE | SPECTRUM` and `COMPUTED | LIVE` segmented switches.
- Mode-specific controls, described below.

### 5.1 Which notes are drawn (computed modes)

- **Held notes:** drawn at their live envelope level.
- **Shown notes** (eye toggle on a degree card, as in the original): drawn at full level, dimmed
  (60 % opacity), even when silent, so ratios can be compared without playing. Degree 1 is shown
  by default.
- A note that's both held and shown is drawn once, at its live level and full opacity.
- Colors come from the degree color (section 7.3). Notes beyond the scale length (other octaves)
  use their degree's color.

### 5.2 Computed wave

- Each note uses a precomputed single-cycle **wavetable** (2048 samples) built from the current
  normalized timbre and rebuilt only when the timbre changes. Drawing is a table lookup per pixel,
  so 64 harmonics × many notes stays at 60 fps.
- Time window = **periods** × one period of the root (field, 1–16, default 2).
- **Slow motion:** an animation clock advances the root by **speed** cycles per second on screen
  (slider 0–4, default 0.5; 0 = frozen). Each note's displayed phase = `(f_note / f_root) × rootCycles`.
  All notes are slowed by the same factor, so their ratios hold exactly.
- **SUM** toggle (default on): draws the sum of all drawn notes in the ink color, thicker,
  scaled to fit.
- Vertical scale: per-note traces at ±40 % of panel height times level; the sum auto-scales with
  smoothing so it doesn't jump around.

### 5.3 Computed spectrum

- Partials for every drawn note: frequency `k·f_note`, height `level × a_k` (normalized amplitude).
  Drawn as 2 px vertical lines in the degree color.
- X axis: **LOG | LIN** switch (default LOG). Range runs from half the lowest fundamental up to the
  highest partial, capped at 20 kHz. Y axis is linear amplitude.
- **Coincident partials** (within 0.5 cent of each other, from different notes) are stacked:
  the line is drawn in segments in each note's color, with a small ◆ marker on top.
- Near-miss beat-rate labels were removed (2026-10-03) to keep the display uncluttered.
- Hovering a line shows a tooltip with note, harmonic number, frequency, and level.

### 5.4 Live wave

- `AnalyserNode` (`fftSize` 8192) on the master output; reads `getFloatTimeDomainData`.
- **Trigger:** finds the first rising zero crossing after a small hysteresis, so the trace holds
  still for periodic sounds. Shows a fixed 2048-sample window starting from the trigger.
- Single ink-colored trace with a gain control (×1–×8).

### 5.5 Live spectrum

- `getFloatFrequencyData`, `smoothingTimeConstant` 0.6.
- Log frequency axis 20 Hz – 20 kHz, dB axis −100 … 0 dB, filled area in ink at 20 % plus a
  line on top.
- **Peak hold** line that decays at 20 dB/s.
- Gridlines at octave Cs plus labels for 100 Hz / 1 kHz / 10 kHz.
- When nothing is playing, the live views show a muted "Play a note" hint.

## 6. Tuning features (carried over)

Behavior matches the original unless noted.

- **Tunings** (menu order, `TUNING_ORDER`; revised 2026-10-03):
  - **Just intonation** — 5-limit 12-note JI (as the original).
  - **Tempered JI** — each degree is a just ratio ± a cents offset, written `5/4 -13.7c`
    (`c`, `¢` or `cents`). Degree cards show the ratio, and the "± cents" offset input sits on the Cents row beside the total; inter-scale ratios show the just ratio plus the cents difference.
  - **Harmonic series** — harmonics 1–12 (always chromatic).
  - **12EDO** — 2^(k/12) (always chromatic).
  - **Custom EDO** — 2^(k/N) with a "Divisions / octave" field, N = 1–96, default 31 (always
    chromatic; saved settings on the old default 19 migrate to 31, persist v6).
  Pitch sources can be mixed in one collection; each card's second row follows its note's source:
  **Interval** (read-only name, e.g. "Major 3rd", "Augmented unison", "Tritone") for notes picked by
  name — Pythagorean, meantone, well temperament, via the insert popover or those tunings'
  templates — which are stored tagged as `Major 3rd|expr` (`splitLabel`; the maths ignores the tag;
  names come from the chain of fifths for Pythagorean/meantone and from semitones for well
  temperament); **Step** for EDO steps; **Ratio** for everything else.
  Any pitch card whose note is an EDO step (`2^(k/N)`) shows a **Step [k] / N** row in place of
  Ratio, in every tuning — e.g. a 12EDO step inserted into a JI collection (editing k sets the
  note to 2^(k/N); N comes from the note). In 12EDO and Custom EDO the root "1" shows as step 0;
  non-EDO notes keep the Ratio field. The 19 → 31 migration is
  skipped while Custom EDO is in use.
  - **Pythagorean** — as the original.
  - **Meantone** — variant menu: ⅓-comma (pure minor thirds), ¼-comma (pure major thirds,
    default), ⅕-comma, ⅙-comma, 2/7-comma (Zarlino). Fifth = 3/2 · (80/81)^f; notes on the chain
    E♭ … G♯.
  - **Well temperament** — variant menu built from each temperament's tempered fifths (narrowings
    sum to a Pythagorean comma): Werckmeister III (C–G–D–A and B–F♯ by ¼ PC), Kirnberger III
    (C–G–D–A–E by ¼ SC, F♯–C♯ by a schisma), Vallotti (F–C–G–D–A–E–B by ⅙ PC), Young 1799
    (C–G–D–A–E–B–F♯ by ⅙ PC).
  Saved settings with the removed custom presets fall back to Just intonation (persist v5);
  "Equal temperament" migrates to 12EDO and the old meantone to ¼-comma.
- **Scales:** major, natural minor, harmonic minor, chromatic. Harmonic series, 12EDO and
  Custom EDO are always chromatic.
- **Insert degree popover** (`src/tuning/degreeInput.ts`): choose a value type and type the value —
  Just intonation (ratio), Tempered JI (ratio ± cents), 12EDO (steps), Custom EDO (steps of N),
  Pythagorean (note), Meantone (variant + note), Well temperament (variant + note), with the root
  as C. Pythagorean and meantone list 17 spelled notes (C C♯ D♭ D D♯ E♭ E F F♯ G♭ G G♯ A♭ A A♯ B♭ B),
  each placed by its position on the chain of fifths, so enharmonic pairs are distinct pitches
  (Pythagorean C♯ 2187/2048 vs D♭ 256/243); well temperament keeps 12 names (closed circle).
  **Cents** (stored as
  `1 +Nc`, editable on the card) or **Frequency** (stored as `Hz / rootHz` against the current
  root). A preview shows the expression, cents and Hz; Add is disabled until the value is valid.
  The popover opens on the value type matching the current tuning (Just intonation for the
  harmonic series).
- **Root:** note select (C … B, A = 440 Hz) plus a Hz field. Editing Hz clears the note name
  unless it matches one exactly.
- **Degree cards:** number + color chip, editable ratio expression (evaluated with mathjs; invalid
  input highlighted with the error color and the note is skipped), cents above the root (0.1¢),
  frequency in Hz,
  eye toggle, delete × in the top-right corner (not on degree 1), and "+" to insert a degree (see below).
  On computers (hover + fine pointer) each card's coloured chip shows the key(s) that play exactly
  that pitch (`keysForDegree`, from the current keyboard map, e.g. "A" or "KZY") instead of its
  number; on touch devices, or when no key is mapped, the chip shows the pitch number.
  Shift-click or Shift + its key sustains a pitch; clicking its card or pressing its key again
  (with or without Shift) releases it. With Shift held, letter/digit keys are matched by physical
  key (`baseKey`). Key releases and window blur don't stop sustained pitches; sustained cards get a 2px outline in their
  colour (not persisted).
  Cards can be reordered: drag a card's number chip onto another card (or focus it and press ← / →). The
  pitch moves; numbers, colours and key bindings stay positional, so they read 1…n in order
  afterwards; the visualizer toggle follows the moved pitch.
  Animated: while dragging, the card follows the pointer and the cards between it and the drop
  slot slide aside (160 ms); on release it glides into its slot (180 ms); arrow-key moves slide
  the two cards past each other. Skipped under `prefers-reduced-motion`. **RESET** and **CLEAR** buttons as in the original.
- **Octaves:** degree index `d` maps to `ratio[d mod len] × 2^floor(d / len)`, the same as the original.
- **Keyboard maps:** `scale` and `chords` presets, editable per degree. Comma-separated keys,
  and a digit suffix selects the octave (`f2` = one octave up), the same as the original. Degrees
  can be added and removed.
- **Inter-note ratios** (renamed from inter-scale ratios): for shown/held degrees, each pair's
  simplified ratio (mathjs `simplify`) and its size in cents (0.1¢). Collapsible section.
- **Removed:** the MIDI tab and the `@tonejs/midi` dependency.
- **Fixed from the original:** degree colors cycle past 12 degrees instead of breaking;
  typing in inputs doesn't play notes; held keys don't retrigger; the title typo is fixed.

## 7. Layout & visual style

### 7.1 Theme tokens (from trichordtrainer.com)

```
light: --bg #fffef8  --bg-raised #fff  --border oklch(22% .012 85)  --border-subtle #e0ddd4
       --text oklch(22% .018 85)  --text-secondary #777  --text-muted #aaa  --accent oklch(22% .026 85)
       --error #9c5b51
dark:  --bg #111  --bg-raised #1a1a1a  --border #2a2a2a  --border-subtle #222
       --text #e5e5e5  --text-secondary #888  --text-muted #555  --accent #e5e5e5  --error #e85450
```

`data-theme` on `<html>` is set before React mounts (an inline script reads the stored preference)
to avoid a flash. The mode is SYSTEM | LIGHT | DARK, defaulting to SYSTEM.

### 7.2 Typography & components

- Headings and wordmark: Newsreader. Body: DM Sans. Numbers, ratios, and Hz: JetBrains Mono.
- Labels: small uppercase with 0.1em tracking, in `--text-secondary`.
- Square corners everywhere, 1px borders, no shadows.
- Segmented controls: bordered row; the selected segment is filled with `--accent` and uses
  `--bg` text.
- Primary buttons are filled with the accent color; secondary buttons have a 1px border.
- Sliders are thin custom-styled tracks with square thumbs.

### 7.3 Degree colors

12 hues, 30° apart, starting at 25°. Light mode `oklch(64% 0.11 h)`, dark mode `oklch(72% 0.12 h)`.
They cycle for more than 12 degrees. Used for card chips, held-card fill (at 25 % alpha),
traces, spectrum lines, and envelope dots.

### 7.4 Page structure

```
┌ Header: "Extended Just Intonation Simulator" (Newsreader)        [theme ◐] ┐
├────────────────────────────────────────────────────────────────────────────┤
│ [ TUNING | SYNTHESIZER ]                                                   │
│ ┌ tab panel ─────────────────────────────────────────────────────────────┐ │
│ │ Tuning: tuning · scale · root · keyboard map · RESET · CLEAR          │ │
│ │ Synth:  presets · harmonics editor · envelope editor · volume · space │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│ ┌ Visualizer [WAVE|SPECTRUM] [COMPUTED|LIVE]  mode controls ─────────────┐ │
│ │ canvas (min-height 320px)                                              │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│ SCALE DEGREES  — grid of degree cards (press to play)                     │
│ KEYBOARD       — collapsible key map editor                               │
│ INTER-SCALE RATIOS — collapsible                                          │
└ footer: credit to the original web_intonation project ─────────────────────┘
```

- Max content width 1200px with a 16px side gutter.
- Under 768px: tab controls wrap, harmonics and envelope editors stack, the visualizer stays
  full width, and pitch cards are 2 per row (3 at ≥ 640px, 4 at ≥ 880px, 5 at ≥ 1024px, 6 at ≥ 1280px) so the tempered-JI Cents row fits on one line; on phones under ~395px it wraps inside the card.
- Master volume is also shown in the header, so it's reachable from either tab.

## 8. State & persistence

A single Zustand store with `persist` (localStorage key `ejis-settings`, `version: 1`, with a
`migrate` hook).

- **Persisted:** tuning name, scale, notes, root, key maps and the current map, harmonics,
  envelope, preset id, volume, space, visualizer modes and controls, open sections, theme.
- **Not persisted:** held notes and audio state.
- Storage access is wrapped in try/catch. If storage is unavailable or corrupt, the app falls
  back to defaults and keeps working.

## 9. Testing

**Vitest unit tests:**
- `curves`: endpoints exact; c=0 is linear; EXP is below the chord and LOG above it, for both
  rising and falling segments.
- `harmonics`: count 1 is a sine; ODD/EVEN filters keep the fundamental; tweaks override;
  hidden tweaks survive a count change; all-zero falls back to sine.
- `timbre`: RMS normalization gives unit-sine RMS; wavetable matches the analytic sum.
- `envelope`: `levelAt` at segment boundaries; sustain hold; the release starts from an arbitrary
  level; the 3 ms floor applies.
- `ratios`: evaluates all preset expressions; invalid input returns null; octave mapping for
  negative degrees; "pure" detection.
- `keymaps`: plain keys, multiple keys, octave suffix.
- `partials`: coincidence at 3:2 (JI) vs a near-miss in equal temperament with the correct beat rate.

**Browser verification (preview):**
- Notes play from keys and touch; no clicks on fast taps or mid-attack release.
- Chords don't clip.
- Timbre changes are audible on held notes.
- Every visualizer mode animates and matches what's heard.
- Envelope handles drag correctly.
- Theme toggle and persistence across reloads work.
- Mobile width layout works.

## 10. Out of scope (v1)

- MIDI file playback and MIDI input.
- Fully per-harmonic envelopes (brightness decay in §4.6 covers the main effect with two spectra).
- Saving or sharing custom tunings as files or links.
