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
