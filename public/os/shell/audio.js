import { assetUrl } from "../theme.js";
const clamp = (n) => Math.min(100, Math.max(0, Number(n) || 0));
const ANIMATION_CUES = new Set([
  "startup",
  "shutdown",
  "minimise",
  "restore",
  "joined",
  "left",
  "win",
  "lose",
]);
export function soundPath(cue, canPlayType = () => "") {
  if (!cue || cue.synth) return null;
  const path = canPlayType('audio/ogg; codecs="vorbis"')
    ? cue.ogg || cue.mp3
    : cue.mp3 || cue.ogg;
  return assetUrl(path);
}
/** One gesture-unlocked context; decoded files and aliases share a cache. */
export function createAudioBus({
  theme,
  volume = 70,
  gentle = false,
  document = globalThis.document,
  AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext,
  fetch = globalThis.fetch?.bind(globalThis),
} = {}) {
  const cues = theme?.manifest?.sounds || {},
    cache = new Map(),
    sources = new Set();
  const media = document?.createElement?.("audio");
  let context = null,
    master = null,
    activation = null,
    destroyed = false;
  volume = clamp(volume);
  function setVolume(next) {
    volume = clamp(next);
    if (master) master.gain.value = volume / 100;
    return volume;
  }
  function unlock() {
    if (destroyed || !AudioContext) return Promise.resolve(false);
    try {
      if (!context) {
        context = new AudioContext();
        master = context.createGain();
        master.connect(context.destination);
        setVolume(volume);
      }
      activation = Promise.resolve(context.resume())
        .then(() => context.state === "running")
        .catch(() => false);
      return activation;
    } catch {
      return Promise.resolve(false);
    }
  }
  const gesture = () => {
    void unlock();
  };
  document?.addEventListener("pointerdown", gesture, { passive: true });
  document?.addEventListener("keydown", gesture);
  const allowed = (name, animation) =>
    !destroyed &&
    volume > 0 &&
    (!gentle ||
      name === "error" ||
      (name !== "startup" && !animation && !ANIMATION_CUES.has(name)));
  function track(source, extra = null) {
    sources.add(source);
    source.onended = () => {
      sources.delete(source);
      source.disconnect();
      extra?.disconnect();
    };
  }
  function synth(name) {
    const tones = {
      countdown: [[440, 0, 0.08]],
      go: [[880, 0, 0.18]],
      win: [
        [523, 0, 0.1],
        [659, 0.12, 0.1],
        [784, 0.24, 0.25],
      ],
      lose: [
        [392, 0, 0.15],
        [294, 0.17, 0.25],
      ],
    }[name];
    if (!tones) return false;
    for (const [frequency, delay, duration] of tones) {
      const oscillator = context.createOscillator(),
        gain = context.createGain(),
        start = context.currentTime + delay;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(master);
      track(oscillator, gain);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    }
    return true;
  }
  async function cue(name, { animation = false } = {}) {
    if (!context || !cues[name] || !allowed(name, animation)) return false;
    if (activation && !(await activation)) return false;
    if (context.state !== "running") return false;
    const descriptor = cues[name];
    if (descriptor.synth) return synth(descriptor.synth);
    const url = soundPath(descriptor, media?.canPlayType?.bind(media));
    if (!url || !fetch) return false;
    try {
      if (!cache.has(url))
        cache.set(
          url,
          (async () => {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Sound unavailable");
            return context.decodeAudioData(await response.arrayBuffer());
          })().catch((error) => {
            cache.delete(url);
            throw error;
          }),
        );
      const buffer = await cache.get(url);
      if (!allowed(name, animation) || context.state !== "running")
        return false;
      const source = context.createBufferSource();
      source.buffer = buffer;
      // prepare.py already normalised the file; gainDb is provenance, not another gain.
      source.connect(master);
      track(source);
      source.start();
      return true;
    } catch {
      return false;
    }
  }
  return {
    unlock,
    cue,
    setVolume,
    setGentle(value) {
      gentle = !!value;
    },
    getVolume: () => volume,
    destroy() {
      destroyed = true;
      document?.removeEventListener("pointerdown", gesture);
      document?.removeEventListener("keydown", gesture);
      for (const source of sources) {
        try {
          source.stop();
        } catch {}
      }
      sources.clear();
      cache.clear();
      void context?.close()?.catch(() => {});
    },
  };
}
