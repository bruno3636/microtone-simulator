# Microtone Simulator

Hear and compare pitches from just intonation, EDOs, Pythagorean tuning, meantone and well
temperaments — with an animated waveform / spectrum view, a harmonics editor with curved
roll-offs, and a draggable envelope editor.

**Live:** https://microtone-simulator.netlify.app

Based on [web_intonation](https://flappix.github.io/web_intonation/) by flappix.

## Using it

### Pick a tuning
A first visit starts on the **7-limit chromatic** just scale (12 notes, played with the piano
key layout). In the **Tuning** panel:

- **Preset scale** opens a searchable menu of about 95 scales, grouped by source (type to filter,
  ↑ / ↓ and Enter to pick):
  - **Just intonation:** Ptolemy major/minor, modes, pentatonics, 12-note 5-/7-/11-/13-limit
    chromatics, harmonic and subharmonic series, Archytas / Didymus / Ptolemy tetrachord scales.
  - **12EDO:** church modes, harmonic/melodic minor, pentatonics, blues, whole tone, octatonic,
    Hirajōshi and more.
  - **Other EDOs:** 5, 7, 17, 19, 22, 24 (maqam Rast, Bayati, Hijaz, quarter-tones), 31, 41 and 53.
  - **Pythagorean**, **meantone** (⅓-, ¼-, ⅕-, ⅙-, 2/7-comma, incl. 17-note split keys) and
    **well temperaments** (Werckmeister III, Kirnberger III, Vallotti, Young).
- Or choose a **Tuning** (+ **Variant** or **Divisions / octave**) and a **Scale**.
- **Root** / **Root Hz** set the pitch of the first note. **Reset** reloads the tuning or preset;
  **Clear** leaves only the root.

### Play
- **Click and hold** a pitch card, or press its **key**. The coloured box on each card shows its key.
  - Default layout: home row `A S D F G H J K L ; '` and up.
  - 12-note presets switch to a **piano layout**: `A W S E D F T G Y H U J` (white keys on the
    home row, black keys above), continuing into the next octave with `K O L P ; '`.
  - Change keys in the **Keyboard** section, or pick another layout in the Tuning panel.
- **Shift-click** (or **Shift + key**) sustains a pitch; click it or press its key again to release.
- **Pitch bend** (above the cards) bends every note you're holding live. Sustained notes stay put.
  It springs back when you let go; **Range** sets ±1, ±2 or ±12 semitones.

### Edit a pitch card
- The label next to the coloured box (e.g. `JI`, `12EDO`, `Pyth`, `1/4 MT`, `Werck`) is the
  pitch's **source**. Click it to switch the pitch to the nearest note of another source.
- **Ratio** (JI), **Step** (EDO) or the **interval picker** (Pythagorean, meantone, well
  temperament) sets the pitch.
- **± cents** detunes any pitch. Use ↑ / ↓ for 1¢ steps. Changes are heard live while the note
  sounds. In number boxes only digits type; any other key still plays its note.
- **Octave − / +** moves the pitch down or up an octave.
- **Drag the coloured box** to reorder (or focus it and use ← / →). **×** deletes a pitch, and the
  **+** tile at the end adds one.

### Compare
- **Inter-Note Ratio** lists the ratio, size in cents and interval name between the sounding
  pitches (and the root). Non-just intervals also show how far they are from the nearest just
  interval (e.g. "−3.2¢ Major 3rd").
- The visualizer has three views. **Wave** and **Spectrum** each come from two sources:

  | View | Computed | Live |
  |---|---|---|
  | **Wave** | the theoretical waveform; Periods and Speed set the animation, Sum shows the combined wave | an oscilloscope of the actual output; Gain and Speed (real time down to frozen) |
  | **Spectrum** | each note's harmonics. A crosshair shows the frequency under the pointer; hover a line to list every partial there, including overlapping harmonics of different notes, with its amplitude relative to that note's fundamental | the measured spectrum, with 0 dB = the (lowest) fundamental. Hover to read the frequency and level under the pointer |

  Both spectra have a **Log / Lin** frequency axis.

  **Roughness** measures sensory dissonance with William Sethares' model: every pair of partials
  adds a Plomp–Levelt roughness term, d = min(a₁, a₂)·(e^(−3.5·s·Δf) − e^(−5.75·s·Δf)) with
  s = 0.24 / (0.0207·f₁ + 18.96). It shows:
  - the total roughness of the notes sounding right now (their partials at their live levels);
  - the **dissonance curve** of the current timbre against the root over 1 or 2 octaves, on a
    logarithmic roughness axis so the dips stand out: dips are
    labelled with nearby just ratios, scale degrees stand on the curve in their colours, sounding
    notes are highlighted, and hovering reads the interval and its roughness. Change the harmonics
    in the Synthesizer tab to see how the timbre moves the dips.

### Tuning game
The **Tuning game** tab trains your ear:

1. Type the **interval ratio** you want to practise — any just interval above 1/1 up to 8/1, e.g.
   `3/2`, `13/8`, `21:16` or `1.625` — and press **Use** (or Enter).
2. Press **▶ Play** and move the **slider** until your note sounds perfectly in tune with the base
   note. Listen to **Both** for the beating (it slows down and stops as you get close), or to
   the **Bottom** (base) or **Top** (your) note alone. The slider shows no numbers; its range is shifted every round
   and your note starts 25–120¢ off. The ±¢ buttons make fine adjustments.
3. Press **Reveal result** to see how many cents sharp or flat you were, with a rating from
   *Perfect* (under 1¢) to *Keep practising*. Then **Hear the target**, or go to the **Next round**.

**Base note:** *Random* picks a new one between G3 and G4 every round; *Choose* lets you pick a
note and octave (C1–B7, A4 = 440 Hz) or type any frequency in Hz.
Your rounds, average error and best result are tracked for the session.

### Shape the sound
The **Synthesizer** tab has instrument presets (measured spectra), a harmonics editor (count,
slope curve, per-harmonic tweaks, brightness decay), an ADSR envelope with draggable curves,
volume and reverb. Settings are saved in your browser.

## Develop

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # vitest
npm run build   # type-check + production build in dist/
```

Pushes to `main` deploy to Netlify automatically (settings in `netlify.toml`).
