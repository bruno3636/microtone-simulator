import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { MAX_CUSTOM, NOTE_NAMES, OCTAVES, describeError, nearestNote, newRound, noteHz, parseCustomInterval, rate, type GameInterval, type Round } from '../game/tuningGame';
import { NumberField, Segmented } from './ui';

type Listen = 'both' | 'base' | 'yours' | 'target';

/** Game voices: not degrees, so the visualizer and envelope dots leave them out (no peeking). */
const BASE = 'game-base';
const TUNED = 'game-tuned';
const TARGET = 'game-target';

/** The game survives switching tabs for this session (the panel unmounts when hidden). */
const firstRound = newRound(parseCustomInterval('3/2')!);
const session = {
  baseMode: 'random' as 'random' | 'choose', baseHz: Math.round(noteHz('C', 4) * 100) / 100, round: firstRound, value: firstRound.start, revealed: false,
  ratioText: '3/2', interval: firstRound.interval,
  stats: { rounds: 0, total: 0, best: Infinity },
};

/**
 * Tuning game: tune your note to the chosen just interval above a base note by ear, then reveal how
 * far off you were. The slider shows no numbers and its range is shifted each round.
 */
export function TuningGame() {
  // base note: random each round, or one the user chooses (note + octave, or any Hz)
  const [baseMode, setBaseMode] = useState(session.baseMode);
  const [baseHz, setBaseHz] = useState(session.baseHz);
  const [round, setRound] = useState<Round>(session.round);
  const [value, setValue] = useState(session.value);
  const [revealed, setRevealed] = useState(session.revealed);
  const [playing, setPlaying] = useState(false);
  const [listen, setListen] = useState<Listen>('both');
  const [stats, setStats] = useState(session.stats);
  // the interval to tune: any just ratio the user types
  const [ratioText, setRatioText] = useState(session.ratioText);
  const [interval, setGameInterval] = useState<GameInterval>(session.interval);
  const parsed = parseCustomInterval(ratioText);
  const sounding = useRef(new Map<string, number>());

  const freq = (cents: number) => round.baseHz * 2 ** (cents / 1200);
  const error = value - round.interval.cents;

  // keep the engine's game voices in step with what should be heard
  useEffect(() => {
    const want = new Map<string, number>();
    if (playing) {
      if (listen !== 'yours') want.set(BASE, round.baseHz);
      if (listen === 'both' || listen === 'yours') want.set(TUNED, freq(value));
      if (listen === 'target') want.set(TARGET, freq(round.interval.cents));
    }
    for (const id of sounding.current.keys()) if (!want.has(id)) engine.noteOff(id);
    for (const [id, f] of want) {
      const was = sounding.current.get(id);
      if (was == null) engine.noteOn(id, f);
      else if (was !== f) engine.retune(id, f);
    }
    sounding.current = want;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, listen, value, round]);

  useEffect(() => { Object.assign(session, { baseMode, baseHz, round, value, revealed, stats, ratioText, interval }); },
    [baseMode, baseHz, round, value, revealed, stats, ratioText, interval]);

  // leaving the game silences it
  useEffect(() => () => { for (const id of sounding.current.keys()) engine.noteOff(id); }, []);

  // a new round uses the ratio in the box (if valid), so a typed ratio is never lost
  const start = (iv: GameInterval = parsed ?? interval) => {
    setGameInterval(iv);
    const r = newRound(iv, Math.random, baseMode === 'choose' ? baseHz : null);
    setRound(r);
    setValue(r.start);
    setRevealed(false);
    if (listen === 'target') setListen('both');
  };
  const reveal = () => {
    setRevealed(true);
    setStats((s) => ({ rounds: s.rounds + 1, total: s.total + Math.abs(error), best: Math.min(s.best, Math.abs(error)) }));
  };
  /** Choosing a base retunes the current round (your slider position is kept). */
  const chooseBase = (hz: number) => {
    const f = Math.round(hz * 100) / 100;
    setBaseHz(f);
    setRound((r) => ({ ...r, baseHz: f }));
  };
  const base = nearestNote(baseHz);
  const togglePlay = () => {
    engine.resume();
    setPlaying((p) => !p);
  };
  const nudge = (d: number) => setValue((v) => Math.min(round.max, Math.max(round.min, Math.round((v + d) * 10) / 10)));
  const verdict = rate(error);
  const marker = Math.max(-50, Math.min(50, error));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <form className="flex items-end gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (!parsed) return;
          setGameInterval(parsed);
          start(parsed);
        }}>
          <label className="flex flex-col gap-1">
            <span className="label">Interval ratio</span>
            <input className="input mono w-28" value={ratioText} placeholder="e.g. 13/8" aria-invalid={!parsed}
              aria-describedby="game-ratio-help" onChange={(e) => setRatioText(e.target.value)} />
          </label>
          <button type="submit" className="btn" disabled={!parsed} style={{ opacity: parsed ? 1 : 0.4 }}>Use</button>
          <span id="game-ratio-help" className="label pb-2 normal-case tracking-normal"
            style={{ color: parsed ? undefined : 'var(--error)' }}>
            {parsed ? `${parsed.name ? `${parsed.name} · ` : ''}${parsed.ratio}` : `a just ratio above 1/1, up to ${MAX_CUSTOM}/1 (e.g. 3/2, 13/8, 21:16)`}
          </span>
        </form>
        <Segmented<'random' | 'choose'> label="Base note" value={baseMode}
          onChange={(m) => {
            setBaseMode(m);
            if (m === 'choose') chooseBase(baseHz);
            else {
              // back to random: a fresh round with a random base
              const r = newRound(interval, Math.random, null);
              setRound(r);
              setValue(r.start);
              setRevealed(false);
            }
          }}
          options={[{ value: 'random', label: 'Random' }, { value: 'choose', label: 'Choose' }]} />
        {baseMode === 'choose' && (
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="label">Note</span>
              <select className="input" value={base.name}
                onChange={(e) => { chooseBase(noteHz(e.target.value, base.octave)); e.currentTarget.blur(); }}>
                {NOTE_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="label">Octave</span>
              <select className="input" value={base.octave}
                onChange={(e) => { chooseBase(noteHz(base.name, Number(e.target.value))); e.currentTarget.blur(); }}>
                {OCTAVES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <NumberField label="Hz" value={baseHz} min={20} max={2500} step={0.01} suffix="Hz" onChange={chooseBase} />
          </div>
        )}
        <button type="button" className="btn" onClick={() => start()}>New round</button>
      </div>

      <p className="m-0 text-lg">
        {round.interval.name ? (
          <>Tune your note to a <strong>{round.interval.name}</strong> <span className="mono">({round.interval.ratio})</span> above the base note.</>
        ) : (
          <>Tune your note to <strong className="mono">{round.interval.ratio}</strong> above the base note.</>
        )}
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <Segmented<Listen> label="Listen to" value={listen} onChange={setListen}
          options={[
            { value: 'both', label: 'Both' }, { value: 'base', label: 'Bottom' }, { value: 'yours', label: 'Top' },
            ...(revealed ? [{ value: 'target' as const, label: 'Target' }] : []),
          ]} />
        <button type="button" className="btn btn-primary" aria-pressed={playing} onClick={togglePlay}>
          {playing ? '■ Stop' : '▶ Play'}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="label">Your note</span>
          <span className="label normal-case tracking-normal">flatter ← → sharper · no numbers until you reveal</span>
        </div>
        <input type="range" className="w-full" min={round.min} max={round.max} step={0.1} value={value} disabled={revealed}
          aria-label="Tune your note (cents)" aria-valuetext={revealed ? `${value.toFixed(1)} cents` : 'hidden'}
          onChange={(e) => setValue(Number(e.target.value))} />
        <div className="flex flex-wrap gap-2">
          {[-5, -1, -0.1, 0.1, 1, 5].map((d) => (
            <button key={d} type="button" className="btn px-2 py-0.5 text-sm" disabled={revealed} onClick={() => nudge(d)}>
              {d > 0 ? '+' : '−'}{Math.abs(d)}¢
            </button>
          ))}
        </div>
      </div>

      {!revealed ? (
        <div>
          <button type="button" className="btn btn-primary" onClick={reveal}>Reveal result</button>
        </div>
      ) : (
        <div className="panel flex flex-col gap-3 p-4" aria-live="polite">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="display text-2xl">{verdict.label}</span>
            <span className="text-lg">{describeError(error)}</span>
            <span className="label normal-case tracking-normal">{verdict.detail}</span>
          </div>
          <p className="mono m-0 text-sm">
            your interval {value.toFixed(1)}¢ · target {round.interval.ratio} = {round.interval.cents.toFixed(1)}¢ · base {round.baseHz.toFixed(2)} Hz
          </p>
          {/* error scale: ±50¢ around the target */}
          <div className="relative h-8 border-b border-[var(--border)]" aria-hidden>
            <div className="absolute bottom-0 left-1/2 h-8 w-px bg-[var(--text)]" />
            {[-50, -25, 25, 50].map((c) => (
              <span key={c} className="label absolute bottom-1 -translate-x-1/2 text-[10px]" style={{ left: `${50 + c}%` }}>{c > 0 ? '+' : ''}{c}¢</span>
            ))}
            <div className="absolute bottom-0 h-5 w-1.5 -translate-x-1/2 bg-[var(--accent)]" style={{ left: `${50 + marker}%` }} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => { engine.resume(); setListen('target'); setPlaying(true); }}>Hear the target</button>
            <button type="button" className="btn btn-primary" onClick={() => start()}>Next round</button>
          </div>
        </div>
      )}

      {stats.rounds > 0 && (
        <p className="label m-0 normal-case tracking-normal">
          Rounds {stats.rounds} · average error {(stats.total / stats.rounds).toFixed(1)}¢ · best {stats.best.toFixed(1)}¢
        </p>
      )}
    </div>
  );
}
