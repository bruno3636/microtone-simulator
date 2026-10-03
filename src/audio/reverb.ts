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
