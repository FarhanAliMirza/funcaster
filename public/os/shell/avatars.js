/** Seat identity is fixed; only the winner's decoration runs. */
export function avatarAssignment(
  descriptor,
  slot,
  { empty = false, winner = false, gentle = false, elapsed = 0 } = {},
) {
  const id = descriptor.seats[slot],
    sprite = descriptor.avatars[id];
  if (!sprite) return null;
  const name = winner && !empty ? "run" : "idle",
    anim = sprite.anims[name];
  return {
    id,
    name,
    empty,
    file: anim.file,
    frames: anim.frames,
    frame:
      empty || gentle
        ? 0
        : Math.floor(elapsed / (descriptor.frameMs || 120)) % anim.frames,
    size: sprite.frame[0],
  };
}
export function mountAvatars(
  root,
  {
    theme,
    settings = {},
    scale,
    store,
    fetch = globalThis.fetch.bind(globalThis),
    document = globalThis.document,
    window = globalThis.window,
  } = {},
) {
  const targets = new Set(),
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let descriptor = null,
    destroyed = false,
    queued = false,
    timer = null,
    elapsed = 0,
    last = performance.now();
  const inGame = () =>
    ["classic", "practice", "countdown", "playing"].includes(
      store?.get().room?.phase,
    );
  function animate() {
    const running =
      descriptor &&
      !destroyed &&
      !inGame() &&
      !document.hidden &&
      settings.avatars !== false &&
      !settings.gentle &&
      !reduced.matches;
    if (!running) {
      clearInterval(timer);
      timer = null;
    } else if (timer === null) {
      last = performance.now();
      timer = setInterval(() => {
        const now = performance.now();
        elapsed += Math.min(250, now - last);
        last = now;
        paint();
      }, descriptor.frameMs || 120);
    }
  }
  function paint() {
    if (!descriptor || destroyed || document.hidden || inGame()) return;
    const players = store?.get().room?.players || [],
      pixel = scale?.get().pixelScale || 1,
      gentle = settings.gentle || reduced.matches;
    for (const target of targets) {
      if (!target.isConnected) {
        targets.delete(target);
        continue;
      }
      target.classList.toggle("is-disabled", settings.avatars === false);
      if (settings.avatars === false || target.closest("[hidden]")) continue;
      const slot = Number(target.dataset.avatarSlot),
        empty =
          target.dataset.avatarEmpty === "true" ||
          (target.dataset.avatarEmpty !== "false" &&
            !players.some((player) => player.slot === slot));
      const choice = avatarAssignment(descriptor, slot, {
        empty,
        winner: target.dataset.avatarWinner === "true",
        gentle,
        elapsed,
      });
      if (!choice) continue;
      target.classList.add("os-seat-avatar");
      target.classList.toggle("is-empty", choice.empty);
      target.setAttribute("aria-hidden", "true");
      target.style.setProperty("--avatar-size", `${choice.size * pixel}px`);
      target.style.setProperty("--avatar-frames", choice.frames);
      target.style.setProperty("--avatar-frame", choice.frame);
      const url = theme.url(choice.file);
      if (target.dataset.avatarSheet !== url) {
        target.dataset.avatarSheet = url;
        target.style.backgroundImage = `url("${url}")`;
      }
    }
  }
  function update() {
    queued = false;
    if (destroyed) return;
    for (const target of root.querySelectorAll("[data-avatar-slot]"))
      targets.add(target);
    paint();
    animate();
  }
  function schedule() {
    animate();
    if (!queued) {
      queued = true;
      queueMicrotask(update);
    }
  }
  const observer = window.MutationObserver
    ? new window.MutationObserver(schedule)
    : null;
  observer?.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      "data-avatar-slot",
      "data-avatar-empty",
      "data-avatar-winner",
    ],
  });
  const unsubscribe = store?.subscribe((state) => state.room, schedule);
  const changed = () => {
    last = performance.now();
    update();
  };
  document.addEventListener("visibilitychange", changed);
  document.documentElement.addEventListener("os:resize", changed);
  reduced.addEventListener("change", changed);
  const ready = (async () => {
    try {
      const response = await fetch(theme.asset("avatars"));
      if (!response.ok) return false;
      const value = await response.json();
      if (destroyed) return false;
      descriptor = value;
      update();
      return true;
    } catch {
      return false;
    }
  })();
  return {
    ready,
    update,
    updateSettings(next) {
      Object.assign(settings, next);
      update();
    },
    destroy() {
      destroyed = true;
      clearInterval(timer);
      observer?.disconnect();
      unsubscribe?.();
      document.removeEventListener("visibilitychange", changed);
      document.documentElement.removeEventListener("os:resize", changed);
      reduced.removeEventListener("change", changed);
      targets.clear();
    },
  };
}
export const applyAvatars = mountAvatars;
