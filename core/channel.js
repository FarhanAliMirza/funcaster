import { Pointer } from "./pointer.js";
import { GameLink } from "./net.js";
import { AudioEngine } from "./audio.js";
import { goHome } from "./splash.js";
import { saveSensitivity, loadSensitivity } from "./calibration.js";
import { clamp } from "./orientation.js";

/**
 * Channel bootstrap — the wiring every game repeats.
 *
 * Pointer with persisted sensitivity, relay link, phone A/B buttons, re-centre,
 * mouse fallback for desk testing, ←/→ live speed adjust, D for the debug
 * overlay. Games get hooks and a per-frame `poll(now)` that returns where the
 * pointer is this frame. Extracted after the second game made the duplication
 * real rather than speculative.
 */
export function createChannel({
  onA = () => {},
  onB = null, // default: HOME chime + fade back to the menu
  onCommand = () => {},
  onPresence = () => {},
  onSample = null, // (sample, dt, now) — raw attitude for tilt games
} = {}) {
  const $ = (id) => document.getElementById(id);
  const pointer = new Pointer({});
  const pointers = new Map([[0, pointer]]),
    samples = new Map(),
    sampleTimes = new Map();
  const pointerFor = (slot) => {
    if (!pointers.has(slot)) pointers.set(slot, new Pointer({}));
    return pointers.get(slot);
  };
  pointer.sensitivity = loadSensitivity() ?? 1;
  const audio = new AudioEngine();

  let lastSampleAt = 0;
  let lastSample = null;

  const link = new GameLink({
    onOrientation: (sample, slot) => {
      const now = performance.now(),
        previous = sampleTimes.get(slot);
      const dt = previous
        ? clamp((now - previous) / 1000, 1 / 240, 0.1)
        : 1 / 60;
      sampleTimes.set(slot, now);
      samples.set(slot, sample);
      if (slot === 0) {
        lastSampleAt = now;
        lastSample = sample;
      }
      pointerFor(slot).update(sample, dt, now);
      if (onSample) onSample(sample, dt, now, slot);
    },
    onCommand: (cmd, slot) => {
      if (cmd.type === "button" && cmd.button === "A") {
        audio.unlock();
        onA(slot, cmd);
      } else if (cmd.type === "button" && cmd.button === "B" && slot === 0)
        (onB || (() => goHome(audio)))();
      else if (cmd.type === "calibrate" || cmd.type === "recentre") {
        pointer.recentre();
        onCommand(cmd); // games with their own neutral re-zero too
      } else if (cmd.type === "speed") {
        pointer.sensitivity = clamp(
          pointer.sensitivity * (cmd.factor || 1),
          0.2,
          6,
        );
        saveSensitivity(pointer.sensitivity);
      } else onCommand(cmd);
    },
    onPresence: (presence) => {
      const { controller } = presence;
      onPresence(presence);
      const on = controller > 0;
      const dot = $("dot");
      const label = $("link-t");
      if (dot) dot.classList.toggle("on", on);
      if (label)
        label.textContent = on ? "remote connected" : "no remote connected";
    },
  });

  const mouse = { x: 0.5, y: 0.5, active: false };
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = e.clientY / window.innerHeight;
    mouse.active = true;
  });
  window.addEventListener("pointerdown", (e) => {
    // A click IS a position report — some input paths (touch, synthetic
    // clicks) never send the mousemove first, so take it from the press.
    if (Number.isFinite(e.clientX)) {
      mouse.x = e.clientX / window.innerWidth;
      mouse.y = e.clientY / window.innerHeight;
      mouse.active = true;
    }
    audio.unlock();
    if (link.authority && !link.paused) onA();
  });

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      audio.unlock();
      if (link.authority && !link.paused) onA();
    } else if (k === "b" || e.key === "Escape")
      (onB || (() => goHome(audio)))();
    else if (k === "c" || k === "r") pointer.recentre();
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1.12 : 1 / 1.12;
      pointer.sensitivity = clamp(pointer.sensitivity * step, 0.2, 6);
      saveSensitivity(pointer.sensitivity);
    } else if (k === "d") {
      const dbg = $("debug");
      if (dbg) dbg.classList.toggle("on");
    }
  });

  /** Call once per render frame; keeps fallbacks honest and returns the aim. */
  function poll(now, slot = 0) {
    const p = pointerFor(slot);
    if (slot === 0 && !p.live && mouse.active) p.setFromMouse(mouse.x, mouse.y);
    if (p.live && now - p.lastSeen > 500) p.live = false;
    return p.sampleAt(now);
  }

  return {
    pointer,
    pointers,
    pointerFor,
    samples,
    link,
    audio,
    mouse,
    poll,
    feedback: (m) => link.feedback(m),
    lastSample: () => lastSample,
  };
}
