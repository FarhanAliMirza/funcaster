/** The original remote's three small synth cues, on the gate-unlocked context. */
export function playPhoneCue(context, kind = "click", random = Math.random) {
  if (!context || context.state !== "running") return false;
  const time = context.currentTime,
    gain = context.createGain();
  gain.connect(context.destination);
  if (kind === "swoosh") {
    const frames = Math.floor(context.sampleRate * 0.12);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index++)
      data[index] = (random() * 2 - 1) * (1 - index / frames);
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(2400, time);
    filter.frequency.exponentialRampToValueAtTime(500, time + 0.12);
    gain.gain.value = 0.12;
    source.connect(filter).connect(gain);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start(time);
  } else {
    const oscillator = context.createOscillator(),
      thud = kind === "thud";
    oscillator.type = thud ? "sine" : "square";
    oscillator.frequency.setValueAtTime(thud ? 160 : 660, time);
    if (thud)
      oscillator.frequency.exponentialRampToValueAtTime(50, time + 0.25);
    gain.gain.setValueAtTime(thud ? 0.18 : 0.05, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (thud ? 0.28 : 0.05));
    oscillator.connect(gain);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(time);
    oscillator.stop(time + (thud ? 0.3 : 0.06));
  }
  return true;
}
