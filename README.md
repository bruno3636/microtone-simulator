# Microtone Simulator

Hear and compare pitches from just intonation, EDOs, Pythagorean tuning, meantone and well
temperaments — with an animated waveform / spectrum view, a harmonics editor with curved
roll-offs, and a draggable envelope editor.

**Live:** https://microtone-simulator.netlify.app

Based on [web_intonation](https://flappix.github.io/web_intonation/) by flappix.

## Develop

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # vitest
npm run build   # type-check + production build in dist/
```

Pushes to `main` deploy to Netlify automatically (settings in `netlify.toml`).
