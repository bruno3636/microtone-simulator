# Microtone Simulator

Hear and compare pitches from just intonation, EDOs, Pythagorean tuning, meantone and well
temperaments — with an animated waveform / spectrum view, a harmonics editor with curved
roll-offs, and a draggable envelope editor.

**Live:** https://microtone-simulator.netlify.app

Based on [web_intonation](https://flappix.github.io/web_intonation/) by flappix.

## Using it

### Pick a tuning
In the **Tuning** panel:

- **Preset scale** loads a ready-made scale: just major/minor/pentatonic, harmonics 8–16,
  12EDO modes, 19/22/24/31/53EDO scales (incl. maqam Rast), Pythagorean, ¼- and ⅙-comma
  meantone, and Werckmeister / Kirnberger / Vallotti / Young well temperaments.
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
  pitches (and the root).
- The visualizer has two views, each from two sources:

  | View | Computed | Live |
  |---|---|---|
  | **Wave** | the theoretical waveform; Periods and Speed set the animation, Sum shows the combined wave | an oscilloscope of the actual output; Gain and Speed (real time down to frozen) |
  | **Spectrum** | each note's harmonics. Hover a line to list every partial there, including overlapping harmonics of different notes, with its amplitude relative to that note's fundamental | the measured spectrum, with 0 dB = the (lowest) fundamental. Hover to read the frequency and level under the pointer |

  Both spectra have a **Log / Lin** frequency axis.

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
