import { h } from "../util/h.js";
import { BRAND } from "../brand.js";

export const MASCOT_ANIMATIONS = Object.freeze([
  "airplane",
  "check",
  "cool",
  "eyes",
  "idle",
  "leave",
  "listen",
  "music",
  "noted",
  "office",
  "point down",
  "point left",
  "point right",
  "point up",
  "read",
  "showel",
  "sleep",
  "spyglass",
  "think",
  "tired",
  "wakeup",
  "watch front",
  "watch left",
  "watch right",
  "weird",
]);
const intersects = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** Keep the whole helper/bubble clear of the active window, including on small TVs. */
export function mascotPlacement(work, active, ui = 1, bubble = false) {
  const w = Math.min(work.w, (bubble ? 260 : 180) * ui),
    h = Math.min(work.h, (bubble ? 300 : 180) * ui),
    pad = 12 * ui;
  const rect = {
    x: Math.max(work.x, work.x + work.w - w - pad),
    y: Math.max(work.y, work.y + work.h - h - pad),
    w,
    h,
  };
  if (active && intersects(rect, active))
    rect.x = Math.max(work.x, Math.min(work.x + pad, work.x + work.w - w));
  return { ...rect, hidden: !!active && intersects(rect, active) };
}
export class BubbleBudget {
  constructor() {
    this.count = 0;
    this.last = -Infinity;
  }
  allow(time, solicited = false) {
    if (solicited) return true;
    if (this.count >= 3 || time - this.last < 60000) return false;
    this.count++;
    this.last = time;
    return true;
  }
}
/** Match outcomes remain server-owned; never celebrate a forfeit or invent a tie winner. */
export function mascotWinner(room) {
  const scores = room?.result?.scores || [];
  if (room?.result?.status === "no-contest" || scores.length < 2) return null;
  const first = scores[0],
    rank = first.rank || 1;
  if (
    (first.outcome && first.outcome !== "finished") ||
    scores.filter((score, index) => (score.rank || index + 1) === rank)
      .length !== 1
  )
    return null;
  return (
    room.players?.find((player) => player.slot === first.slot)?.name || null
  );
}

/** One timer, exact source durations, blank-frame holds, and a bounded queue. */
export function createSpritePlayer({
  skin,
  render,
  load = async () => {},
  now = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  reduced = false,
}) {
  const cache = new Map(),
    queue = [];
  let timer = null,
    generation = 0,
    current = null,
    destroyed = false,
    visible = true;
  const clear = () => {
    clearTimer(timer);
    timer = null;
  };
  async function play(name, options = {}) {
    if (destroyed || !skin.anims[name]) return false;
    if (options.queue && current && current.name !== "idle" && !current.loop) {
      if (queue.length === 2) queue.shift();
      queue.push([name, { ...options, queue: false }]);
      return true;
    }
    clear();
    const token = ++generation,
      animation = skin.anims[name];
    current = {
      name,
      loop: options.loop ?? name === "idle",
      then: options.then || "idle",
    };
    if (!cache.has(animation.file))
      cache.set(
        animation.file,
        Promise.resolve()
          .then(() => load(animation.file))
          .catch(() => false),
      );
    const loaded = await cache.get(animation.file);
    if (destroyed || generation !== token || !visible || loaded === false)
      return false;
    const began = now();
    let index = 0;
    const next = () => {
      if (destroyed || generation !== token || !visible) return;
      if (queue.length) {
        const args = queue.shift();
        void play(...args);
      } else if (current.loop && !reduced) {
        index = 0;
        frame();
      } else if (name !== current.then) void play(current.then, { loop: true });
    };
    const show = (i) => {
      if (!animation.emptyFrames?.includes(i))
        render({
          name,
          file: animation.file,
          index: i,
          frames: animation.frames,
          frame: skin.frame,
        });
    };
    const frame = () => {
      if (destroyed || generation !== token || !visible) return;
      show(index);
      if (reduced) {
        if (name !== "idle") timer = setTimer(() => void play("idle"), 1500);
        return;
      }
      timer = setTimer(
        () => {
          if (options.duration && now() - began >= options.duration) {
            current.loop = false;
            next();
          } else if (++index < animation.frames) frame();
          else next();
        },
        options.duration
          ? Math.max(
              1,
              Math.min(
                animation.frameDurationsMs[index],
                options.duration - (now() - began),
              ),
            )
          : animation.frameDurationsMs[index],
      );
    };
    frame();
    return true;
  }
  return {
    play,
    current: () => current?.name,
    queueSize: () => queue.length,
    setReduced(value) {
      reduced = !!value;
      if (current && visible)
        void play(current.name, { loop: current.loop, then: current.then });
    },
    setVisible(value) {
      if (visible === !!value) return;
      visible = !!value;
      clear();
      generation++;
      queue.length = 0;
      if (visible) void play("idle");
    },
    destroy() {
      destroyed = true;
      clear();
      generation++;
      queue.length = 0;
      cache.clear();
    },
  };
}

/** Lazy skin/sprite mounting. ready resolves after the descriptor, never all 47MB of sheets. */
export function mountMascot(
  root,
  {
    theme,
    settings = {},
    scale,
    store,
    wm,
    fetch = globalThis.fetch.bind(globalThis),
    document = globalThis.document,
    window = globalThis.window,
  } = {},
) {
  const sprite = h("div", { class: "os-mascot-sprite", "aria-hidden": "true" });
  const bubbleText = h("span"),
    bubbleClose = h("button", {
      type: "button",
      text: "×",
      "aria-label": "Dismiss helper message",
      dataset: { nav: "", id: "dismiss-helper" },
    });
  const bubble = h(
    "div",
    {
      class: "os-mascot-bubble",
      role: "status",
      "aria-live": "polite",
      hidden: true,
    },
    bubbleText,
    bubbleClose,
  );
  const el = h(
    "aside",
    {
      class: "os-mascot",
      "aria-label": `${BRAND.mascot}, desktop helper`,
      hidden: true,
    },
    sprite,
    bubble,
  );
  root.append(el);
  const budget = new BubbleBudget(),
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)"),
    pending = [];
  let player = null,
    destroyed = false,
    bubbleTimer = 0,
    idleTimer = 0,
    lastInput = performance.now(),
    lastLook = -Infinity,
    nextWatch = lastInput + 20000,
    sleeping = false,
    attracting = false,
    loading = false,
    booted = false,
    propertiesSeen = false,
    visible = false,
    skinRequested = false,
    resultShown = null;
  let latest = store?.get() || {},
    snapshot = null;
  function placement() {
    const state = scale?.get(),
      work = state?.work || {
        x: 0,
        y: 0,
        w: window.innerWidth,
        h: window.innerHeight - 42,
      },
      ui = state?.ui || 1;
    const windows = wm?.list?.() || [];
    const active = windows.find(
      (entry) => entry.active && entry.state !== "minimised",
    )?.rect;
    const rect = mascotPlacement(work, active, ui, !bubble.hidden);
    el.style.left = `${rect.x}px`;
    el.style.top = `${rect.y}px`;
    el.style.width = `${rect.w}px`;
    el.style.height = `${rect.h}px`;
    const room = latest.room;
    const loadingVisible =
      loading &&
      windows.some(
        (entry) => entry.id === "loading" && entry.state !== "minimised",
      );
    const inGame =
      !loadingVisible &&
      ["classic", "practice", "countdown", "playing"].includes(room?.phase);
    const previouslyVisible = visible;
    visible =
      !destroyed &&
      settings.mascot !== false &&
      !document.hidden &&
      !rect.hidden &&
      !inGame &&
      (room?.operatingMode !== "kiosk" || attracting);
    el.hidden = !visible;
    player?.setVisible(visible);
    const watch = visible && !loading && !attracting;
    if (!watch && idleTimer) {
      clearInterval(idleTimer);
      idleTimer = 0;
    } else if (watch && !idleTimer) idleTimer = setInterval(idleTick, 1000);
    if (visible && !previouslyVisible && player) {
      if (loading) void player.play("airplane", { loop: true });
      else if (sleeping) void player.play("sleep", { loop: true });
    }
  }
  function dismiss() {
    clearTimeout(bubbleTimer);
    bubble.hidden = true;
    placement();
  }
  bubbleClose.onclick = dismiss;
  function say(text, solicited = false) {
    if (!text || !visible || !budget.allow(performance.now(), solicited))
      return;
    bubbleText.textContent = String(text).slice(0, 300);
    bubble.hidden = false;
    placement();
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(dismiss, 6000);
  }
  function play(name, options = {}) {
    if (destroyed || !visible) return;
    if (!player) {
      if (pending.length === 2) pending.shift();
      pending.push([name, options]);
      ensurePlayer();
      return;
    }
    if (visible) void player.play(name, options);
  }
  function activity() {
    if (attracting) {
      attracting = false;
      placement();
    }
    lastInput = performance.now();
    nextWatch = lastInput + 20000;
    if (!player && visible) play("idle");
    if (sleeping) {
      sleeping = false;
      play("wakeup");
    }
  }
  function event(name, data = {}) {
    if (name === "boot") {
      if (booted) return;
      booted = true;
      play("wakeup");
    } else if (name === "joined") {
      activity();
      play("check", { queue: true });
      say(`${data.name || "A player"} joined`);
    } else if (name === "ready") play("check", { queue: true });
    else if (name === "properties") {
      if (propertiesSeen) return;
      propertiesSeen = true;
      play("point left");
      say("Pick how you want to play", true);
    } else if (name === "disabled") {
      play("think");
      say(data.reason || data.message, true);
    } else if (name === "loading") {
      loading = true;
      placement();
      play("airplane", { loop: true });
    } else if (name === "loaded") {
      loading = false;
      placement();
      play("idle");
    } else if (name === "win" || name === "record" || name === "results") {
      const resultKey = latest.room?.result
        ? `${latest.room.code}:${latest.room.roundId}:${JSON.stringify(latest.room.result)}`
        : null;
      if (resultKey && resultShown === resultKey) return;
      resultShown = resultKey;
      loading = false;
      placement();
      play("cool");
      const winner = data.name || mascotWinner(latest.room);
      if (winner) say(`${winner} takes it!`);
    } else if (name === "error" || name === "disconnect") {
      play("weird");
      say(data.message, data.solicited !== false);
    } else if (name === "reconnecting") play("tired");
    else if (name === "attract") {
      attracting = true;
      placement();
      sleeping = true;
      play("tired", { then: "sleep" });
    } else if (name === "invite") play("spyglass");
    else if (name === "staff") play("office");
    else if (name === "volume") play("music", { duration: 2000 });
    else if (name === "shutdown") {
      play("leave");
      say("See you!", true);
    } else if (name === "activity") activity();
  }
  function update(next = store?.get() || latest) {
    latest = next;
    if (
      !["classic", "practice", "countdown", "playing"].includes(
        next.room?.phase,
      )
    )
      loading = false;
    placement();
    const room = next.room,
      people = new Map((room?.players || []).map((p) => [p.slot, p]));
    if (snapshot) {
      if (
        next.connection === "reconnecting" &&
        snapshot.connection !== "reconnecting"
      )
        event("reconnecting");
      if (next.error && next.error !== snapshot.error)
        event("error", { message: String(next.error), solicited: false });
      if (
        room?.phase === "results" &&
        (snapshot.phase !== "results" || snapshot.result !== room.result)
      )
        event("results");
      if (room?.attract && !snapshot.attract) event("attract");
      if (!room?.attract && snapshot.attract) activity();
      for (const [slot, p] of people) {
        const previous = snapshot.people.get(slot);
        if (p.connected && !previous?.connected) event("joined", p);
        else if (!p.connected && previous?.connected)
          event("disconnect", {
            message: `${p.name || "A player"} disconnected.`,
            solicited: false,
          });
        else if (p.ready && !previous?.ready) event("ready");
      }
    }
    snapshot = {
      people,
      connection: next.connection,
      attract: !!room?.attract,
      phase: room?.phase,
      result: room?.result,
      error: next.error,
    };
  }
  function look(x) {
    activity();
    if (
      !Number.isFinite(x) ||
      performance.now() - lastLook < 250 ||
      loading ||
      !visible ||
      player?.current() === "wakeup" ||
      pending.some(([name]) => name === "wakeup")
    )
      return;
    lastLook = performance.now();
    play(x < window.innerWidth / 2 ? "watch left" : "watch right");
  }
  // Retained phone cursors move via transforms and .click(), not native pointer events.
  function pointer(point) {
    if (
      Number.isFinite(point?.x) &&
      Number.isFinite(point?.y) &&
      document.elementFromPoint(point.x, point.y)?.closest?.("[data-desktop]")
    )
      look(point.x);
    else activity();
  }
  const move = (e) => {
    if (e.target.closest?.("[data-desktop]")) look(e.clientX);
  };
  root.addEventListener("pointermove", move);
  document.addEventListener("pointerdown", activity, { passive: true });
  document.addEventListener("keydown", activity);
  document.addEventListener("visibilitychange", placement);
  document.documentElement.addEventListener("os:resize", placement);
  const reduce = () =>
    player?.setReduced(settings.gentle || reducedMotion.matches);
  reducedMotion.addEventListener("change", reduce);
  const unsubscribe = store?.subscribe((value) => value, update);
  function idleTick() {
    if (!visible || loading || attracting) return;
    const time = performance.now(),
      idle = time - lastInput;
    if (idle >= 60000 && !sleeping) {
      sleeping = true;
      play("tired", { then: "sleep" });
    } else if (!sleeping && idle >= 20000 && time >= nextWatch) {
      play(
        ["watch left", "watch right", "watch front"][
          Math.floor(Math.random() * 3)
        ],
      );
      nextWatch = time + 8000 + Math.random() * 6000;
    }
  }
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  async function ensurePlayer() {
    if (skinRequested || destroyed) return;
    skinRequested = true;
    try {
      const response = await fetch(theme.asset("mascot"));
      if (!response.ok) {
        resolveReady(false);
        return;
      }
      const skin = await response.json();
      if (destroyed) {
        resolveReady(false);
        return;
      }
      player = createSpritePlayer({
        skin,
        reduced: settings.gentle || reducedMotion.matches,
        load(file) {
          return new Promise((resolve) => {
            const image = new window.Image();
            image.onload = () => resolve(true);
            image.onerror = () => resolve(false);
            image.src = theme.url(file);
          });
        },
        render(frame) {
          sprite.style.backgroundImage = `url("${theme.url(frame.file)}")`;
          sprite.style.setProperty("--mascot-frame", frame.index);
          sprite.style.setProperty("--mascot-frames", frame.frames);
        },
      });
      update();
      if (latest.room?.attract) event("attract");
      else if (pending.length) {
        const requests = pending.splice(0);
        for (const [name, opts] of requests) play(name, opts);
      } else play("idle");
      resolveReady(true);
    } catch {
      resolveReady(false);
    }
  }
  update();
  return {
    el,
    ready,
    play,
    event,
    pointer,
    update,
    position: placement,
    updateSettings(next) {
      Object.assign(settings, next);
      reduce();
      placement();
    },
    hide() {
      settings.mascot = false;
      placement();
    },
    destroy() {
      destroyed = true;
      resolveReady(false);
      clearInterval(idleTimer);
      clearTimeout(bubbleTimer);
      player?.destroy();
      unsubscribe?.();
      root.removeEventListener("pointermove", move);
      document.removeEventListener("pointerdown", activity);
      document.removeEventListener("keydown", activity);
      document.removeEventListener("visibilitychange", placement);
      document.documentElement.removeEventListener("os:resize", placement);
      reducedMotion.removeEventListener("change", reduce);
      el.remove();
    },
  };
}
