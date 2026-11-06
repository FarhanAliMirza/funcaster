import { h } from "../util/h.js";
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function choosePets(descriptor, random = Math.random) {
  const pool = Object.keys(descriptor.pets),
    result = [];
  while (pool.length && result.length < Math.min(2, descriptor.maxVisible || 2))
    result.push(
      pool.splice(
        Math.min(pool.length - 1, Math.floor(random() * pool.length)),
        1,
      )[0],
    );
  return result;
}
/** Positions and timers are in design units; pausing never catches up lost wall time. */
export class PetMotion {
  constructor({ x = 0, direction = 1, width = 48, random = Math.random } = {}) {
    this.x = x;
    this.direction = direction;
    this.width = width;
    this.random = random;
    this.mode = "idle";
    this.remaining = 2 + random() * 4;
    this.elapsed = 0;
  }
  sit(direction = this.direction) {
    this.mode = "idle";
    this.direction = direction < 0 ? -1 : 1;
    this.remaining = 2 + this.random() * 4;
    this.elapsed = 0;
  }
  step(seconds, { width, paused = false, gentle = false } = {}) {
    const limit = Math.max(0, width - this.width);
    this.x = clamp(this.x, 0, limit);
    if (paused || gentle) return;
    const dt = clamp(Number(seconds) || 0, 0, 0.25);
    this.elapsed += dt;
    this.remaining -= dt;
    if (this.mode === "walk") {
      const next = this.x + this.direction * 40 * dt;
      if (next <= 0 || next >= limit) {
        this.x = clamp(next, 0, limit);
        this.direction = next <= 0 ? 1 : -1;
        this.sit();
      } else this.x = next;
    }
    if (this.remaining <= 0) {
      this.mode = this.mode === "walk" ? "idle" : "walk";
      this.remaining =
        this.mode === "idle" ? 2 + this.random() * 4 : 4 + this.random() * 5;
      this.elapsed = 0;
    }
  }
  frame(frames, gentle = false) {
    return gentle ? 0 : Math.floor(this.elapsed / 0.12) % frames;
  }
}

export function mountPets(
  root,
  {
    theme,
    settings = {},
    scale,
    store,
    fetch = globalThis.fetch.bind(globalThis),
    document = globalThis.document,
    window = globalThis.window,
    random = Math.random,
  } = {},
) {
  const el = h("div", {
    class: "os-pets",
    "aria-label": "Street pets",
    hidden: true,
  });
  root.append(el);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)"),
    entries = [];
  let destroyed = false,
    frame = 0,
    last = 0,
    latest = store?.get() || {};
  const inGame = () =>
    ["classic", "practice", "countdown", "playing"].includes(
      latest.room?.phase,
    );
  const gentle = () => settings.gentle || reduced.matches;
  const canShow = () =>
    !destroyed && settings.pets !== false && !document.hidden && !inGame();
  function metrics() {
    const s = scale?.get();
    return {
      work: s?.work || {
        x: 0,
        y: 0,
        w: window.innerWidth,
        h: window.innerHeight - 42,
      },
      ui: s?.ui || 1,
      pixel: s?.pixelScale || 1,
    };
  }
  function draw() {
    const { work, ui, pixel } = metrics();
    el.hidden = !canShow();
    if (el.hidden) return;
    for (const { sprite, button, motion } of entries) {
      const mode = gentle() ? "idle" : motion.mode,
        anim = sprite.anims[mode],
        size = sprite.frame[0] * pixel;
      button.style.width = `${Math.max(48 * ui, size)}px`;
      button.style.height = `${Math.max(48 * ui, size)}px`;
      button.style.left = `${Math.round(work.x + motion.x * ui)}px`;
      button.style.top = `${Math.round(work.y + work.h - Math.max(48 * ui, size))}px`;
      button.style.setProperty("--pet-size", `${size}px`);
      button.style.setProperty("--pet-frames", anim.frames);
      button.style.setProperty(
        "--pet-frame",
        motion.frame(anim.frames, gentle()),
      );
      button.style.setProperty("--pet-direction", motion.direction);
      const file = theme.url(anim.file);
      if (button.dataset.sheet !== file) {
        button.dataset.sheet = file;
        button.firstElementChild.style.backgroundImage = `url("${file}")`;
      }
    }
  }
  function tick(time) {
    frame = 0;
    if (!canShow() || gentle()) {
      last = 0;
      draw();
      return;
    }
    const { work, ui } = metrics(),
      dt = last ? (time - last) / 1000 : 0;
    last = time;
    for (const entry of entries) entry.motion.step(dt, { width: work.w / ui });
    draw();
    frame = window.requestAnimationFrame(tick);
  }
  function update(next = store?.get() || latest) {
    latest = next;
    const { work, ui, pixel } = metrics();
    for (const entry of entries) {
      entry.motion.width = Math.max(48, (entry.sprite.frame[0] * pixel) / ui);
      entry.motion.step(0, { width: work.w / ui, paused: true });
    }
    draw();
    if (!canShow() || gentle()) {
      window.cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
    } else if (entries.length && !frame) {
      frame = window.requestAnimationFrame(tick);
    }
  }
  const unsubscribe = store?.subscribe(
    (state) => state.room,
    () => update(),
  );
  const changed = () => update();
  reduced.addEventListener("change", changed);
  document.addEventListener("visibilitychange", changed);
  document.documentElement.addEventListener("os:resize", changed);
  const ready = (async () => {
    try {
      const response = await fetch(theme.asset("pets"));
      if (!response.ok) return false;
      const descriptor = await response.json();
      if (destroyed) return false;
      const { work, ui } = metrics();
      for (const [index, id] of choosePets(descriptor, random).entries()) {
        const sprite = descriptor.pets[id],
          motion = new PetMotion({
            x: Math.max(
              0,
              (work.w / ui - sprite.frame[0]) * (index ? 0.7 : 0.3),
            ),
            direction: index ? -1 : 1,
            width: sprite.frame[0],
            random,
          });
        const art = h("span", { "aria-hidden": "true" }),
          button = h(
            "button",
            {
              class: "os-pet",
              type: "button",
              "aria-label": `Pet the ${id.startsWith("dog") ? "dog" : id.startsWith("cat") ? "cat" : "crow"}`,
              dataset: { nav: "", id: `pet-${id}` },
            },
            art,
          );
        button.onclick = (event) => {
          const rect = button.getBoundingClientRect();
          motion.sit(
            event.detail
              ? event.clientX < rect.left + rect.width / 2
                ? -1
                : 1
              : motion.direction,
          );
          draw();
        };
        button.addEventListener("pointermove", (event) => {
          if (motion.mode === "idle") {
            const rect = button.getBoundingClientRect();
            motion.direction =
              event.clientX < rect.left + rect.width / 2 ? -1 : 1;
            draw();
          }
        });
        entries.push({ sprite, button, motion });
        el.append(button);
      }
      update();
      return true;
    } catch {
      return false;
    }
  })();
  return {
    el,
    ready,
    update,
    updateSettings(next) {
      Object.assign(settings, next);
      update();
    },
    destroy() {
      destroyed = true;
      window.cancelAnimationFrame(frame);
      unsubscribe?.();
      reduced.removeEventListener("change", changed);
      document.removeEventListener("visibilitychange", changed);
      document.documentElement.removeEventListener("os:resize", changed);
      el.remove();
    },
  };
}
