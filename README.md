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
  - **Tritave (EDT):** Bohlen–Pierce (13EDT), its Lambda mode, the just Bohlen–Pierce scale and
    9EDT. These repeat at the tritave (3/1, an octave plus a fifth) instead of the octave.
  - **Pythagorean**, **meantone** (⅓-, ¼-, ⅕-, ⅙-, 2/7-comma, incl. 17-note split keys) and
    **well temperaments** (Werckmeister III, Kirnberger III, Vallotti, Young).
- Or choose a **Tuning** (+ **Variant**, **Divisions / octave** or **Divisions / tritave**) and a
  **Scale**. **Custom EDT** divides the tritave (3/1) into N equal steps (3^(k/N)); its notes
  repeat every tritave, so the keys and cards wrap at 3/1 instead of 2/1.
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
  adds a Plomp–Levelt roughness term, d = 5·min(a₁, a₂)·(e^(−3.51·s·Δf) − e^(−5.75·s·Δf)) with
  s = 0.24 / (0.0207·f₁ + 18.96). It shows:
  - the total roughness of the notes sounding right now (their partials at their live levels);
  - the **dissonance curve** of the current timbre against the root over 1 or 2 octaves, on a
    logarithmic roughness axis so the dips stand out: dips are
    labelled with nearby just ratios, scale degrees stand on the curve in their colours, sounding
    notes are highlighted, and hovering reads the interval and its roughness. Change the harmonics
    in the Synthesizer tab to see how the timbre moves the dips.
  - **Zoom** in on the curve with ⌘/Ctrl + scroll or a trackpad pinch (or **Zoom + / −**), drag
    to pan, and double-click (or **Reset**) to see the whole range. Zooming recomputes the curve
    for the visible stretch, down to a 5¢ window. The deepest dips are labelled at full view;
    smaller dips get their ratio as soon as you zoom in a little.

### Tuning game
The **Tuning game** tab trains your ear:

1. Choose how to give the target — **Ratio** or **Cents** — and type it, then press **Use** (or Enter):
   - **Ratio:** any just interval above 1/1 up to 32/1, e.g. `3/2`, `13/8`, `21:16`, `1.625` or
     `531441/524288` — numbers of any size are read exactly.
   - **Cents:** any size above 0¢ up to 6000¢, e.g. `386.3` or `700` (handy for tempered intervals).
2. Press **▶ Play** and move the **slider** until your note sounds perfectly in tune with the base
   note. Listen to **Both** for the beating (it slows down and stops as you get close), or to
   the **Bottom** (base) or **Top** (your) note alone. The slider shows no numbers; its range is shifted every round
   (it spans a random 64–128¢) and your note starts at least 15¢ off. The ±¢ buttons make fine adjustments.
3. Press **Reveal result** to see how many cents sharp or flat you were, with a rating from
   *Perfect* (under 1¢) to *Keep practising*, plus the **Sethares roughness** of your interval and of
   the target, labelled on a small dissonance curve across the slider's range. Then **Hear the target**, or
   go to the **Next round**.

**Base note:** *Random* picks a new one between 220 and 440 Hz every round; *Choose* lets you pick a
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
