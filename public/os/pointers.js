import { Pointer } from "../../core/pointer.js";
import { SEATS } from "../../core/seats.js";
import { h } from "./util/h.js";
import { visibleTargets } from "./nav.js";
import { NAV_STRINGS as S } from "./strings.js";

export function steeringSeat(room) {
  const players = (room?.players || []).filter((p) => p.connected && !p.away);
  if (players.some((p) => p.slot === room.hostSeat)) return room.hostSeat;
  return (
    players.filter((p) => p.ready).sort((a, b) => a.slot - b.slot)[0]?.slot ??
    null
  );
}
export function pointerSample(packet) {
  const sample = packet.q
    ? { quat: packet.q }
    : packet.x != null
      ? { party: { active: true, x: packet.x, y: packet.y } }
      : { alpha: packet.a, beta: packet.b, gamma: packet.g };
  if (packet.r)
    sample.motion = { rx: packet.r[0], ry: packet.r[1], rz: packet.r[2] };
  return sample;
}
export function nearestTarget(x, y, entries, distance = 28) {
  return (
    entries
      .map(({ target, rect }) => ({
        target,
        distance: Math.hypot(
          Math.max(rect.left - x, 0, x - rect.right),
          Math.max(rect.top - y, 0, y - rect.bottom),
        ),
      }))
      .filter((e) => e.distance <= distance)
      .sort((a, b) => a.distance - b.distance)[0]?.target || null
  );
}
// Keyboard navigation deliberately retains offscreen targets so it can scroll to
// them. Pointer magnetism instead uses only the visible portion of each target,
// and may not reach across the boundary of its scroll/clipping container.
export function pointerTargetRect(
  target,
  x,
  y,
  {
    width = innerWidth,
    height = innerHeight,
    styleFor = getComputedStyle,
  } = {},
) {
  const rect = target.getBoundingClientRect();
  let left = Math.max(0, rect.left),
    top = Math.max(0, rect.top),
    right = Math.min(width, rect.right),
    bottom = Math.min(height, rect.bottom);
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  for (
    let parent = target.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const style = styleFor(parent),
      clipsX = /^(auto|scroll|hidden|clip)$/.test(
        style.overflowX || style.overflow,
      ),
      clipsY = /^(auto|scroll|hidden|clip)$/.test(
        style.overflowY || style.overflow,
      );
    if (!clipsX && !clipsY) continue;
    const box = parent.getBoundingClientRect(),
      sx = parent.offsetWidth > 0 ? box.width / parent.offsetWidth : 1,
      sy = parent.offsetHeight > 0 ? box.height / parent.offsetHeight : 1,
      l = box.left + (parent.clientLeft || 0) * sx,
      t = box.top + (parent.clientTop || 0) * sy,
      r = l + (parent.clientWidth ?? box.width) * sx,
      b = t + (parent.clientHeight ?? box.height) * sy;
    if (clipsX) {
      if (x < l || x >= r) return null;
      left = Math.max(left, l);
      right = Math.min(right, r);
    }
    if (clipsY) {
      if (y < t || y >= b) return null;
      top = Math.max(top, t);
      bottom = Math.min(bottom, b);
    }
  }
  return right > left && bottom > top ? { left, top, right, bottom } : null;
}
// Sensor delivery is not user activity: a phone continues sending at rest.
// Keep an anchor until movement exceeds the small jitter radius; slow deliberate
// motion still accumulates, while reconnects, stale samples and resizes do not.
export class PointerActivity {
  constructor(distance = 4) {
    this.distance = distance;
    this.anchors = new Map();
  }
  moved(point) {
    const previous = this.anchors.get(point.slot);
    if (point.stale) {
      this.anchors.delete(point.slot);
      return false;
    }
    if (!previous) {
      this.anchors.set(point.slot, point);
      return false;
    }
    if (Math.hypot(point.x - previous.x, point.y - previous.y) < this.distance)
      return false;
    this.anchors.set(point.slot, point);
    return true;
  }
  clear(slot) {
    if (slot == null) this.anchors.clear();
    else this.anchors.delete(slot);
  }
}
export function cursorAppearance(
  manifest,
  skin = "arrow",
  viewportWidth = 1280,
) {
  const glove = skin === "glove" && !!manifest.cursors.glove,
    role = glove ? "glove" : "arrow",
    [file, x, y] = manifest.cursors[role],
    width = viewportWidth >= 1920 ? 96 : 64,
    factor = width / (glove ? 128 : 32);
  return { role, file, width, tipX: x * factor, tipY: y * factor };
}
export class SeatPointers {
  constructor({ width = 1280, height = 720, sensitivity = 1 } = {}) {
    this.seats = new Map();
    this.resize(width, height);
    this.sensitivity = sensitivity;
  }
  feed(packet, now) {
    if (!Number.isInteger(packet.slot) || packet.slot < 0 || packet.slot > 3)
      return null;
    let seat = this.seats.get(packet.slot);
    if (!seat) {
      seat = {
        ptr: new Pointer({
          aspect: this.height / this.width,
          degPerScreen: 20,
          sensitivity: this.sensitivity,
        }),
        last: null,
      };
      seat.ptr.setViewport(this.width, this.height);
      this.seats.set(packet.slot, seat);
    }
    const dt =
      seat.last == null
        ? 0
        : Math.max(0, Math.min(0.1, (now - seat.last) / 1000));
    seat.last = now;
    seat.ptr.update(pointerSample(packet), dt, now);
    return seat;
  }
  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    for (const { ptr } of this.seats.values()) {
      ptr.setViewport(this.width, this.height);
      ptr.aspect = this.height / this.width;
    }
  }
  frame(now) {
    return [...this.seats].map(([slot, seat]) => {
      if (now - seat.last > 500) seat.ptr.live = false;
      const p = seat.ptr.sampleAt(now);
      return {
        slot,
        x: p.x * this.width,
        y: p.y * this.height,
        stale: now - seat.last > 500,
        hidden: now - seat.last > 3000,
      };
    });
  }
  recentre(slot) {
    this.seats.get(slot)?.ptr.recentre();
  }
  setSensitivity(value) {
    this.sensitivity = Math.max(0.2, Math.min(6, value));
    for (const { ptr } of this.seats.values())
      ptr.sensitivity = this.sensitivity;
    return this.sensitivity;
  }
  clear() {
    this.seats.clear();
  }
}
export function mountPointers({
  root,
  session,
  nav,
  theme,
  storage,
  settings = {},
  tray,
  balloons,
  getRoom,
  onActivity = () => {},
  cue = () => {},
}) {
  const model = new SeatPointers({
    width: innerWidth,
    height: innerHeight,
    sensitivity: Number(storage.read("openwii.sensitivity.v2", 1)) || 1,
  });
  const layer = h("div", { class: "os-pointers", "aria-hidden": "true" });
  root.append(layer);
  const cursors = new Map(),
    activity = new PointerActivity();
  let cursorSkin = settings.cursorSkin;
  let hover = null,
    raf = null,
    dead = false,
    focusTimer = null,
    lastMode = "focus",
    enabled = false,
    requested = false;
  function hit(x, y) {
    const targets = visibleTargets(nav.scope()),
      actual = document.elementFromPoint(x, y)?.closest("[data-nav]");
    if (targets.includes(actual)) return actual;
    return nearestTarget(
      x,
      y,
      targets.flatMap((target) => {
        const rect = pointerTargetRect(target, x, y);
        return rect ? [{ target, rect }] : [];
      }),
    );
  }
  function clearHover() {
    hover?.classList.remove("hover");
    hover = null;
  }
  function mode(value) {
    clearTimeout(focusTimer);
    lastMode = value;
    if (value === "pointer") layer.classList.remove("focus-mode");
    else focusTimer = setTimeout(() => layer.classList.add("focus-mode"), 600);
  }
  function feed(packet) {
    if (!enabled) return;
    model.feed(packet, performance.now());
  }
  function button(packet) {
    if (
      !enabled ||
      packet.slot !== steeringSeat(getRoom()) ||
      packet.pressed !== true
    )
      return;
    onActivity();
    if (packet.button === "1") {
      model.recentre(packet.slot);
      return;
    }
    if (
      ["plus", "minus"].includes(packet.button) &&
      nav.getMode() === "pointer"
    ) {
      const value = model.setSensitivity(
        model.sensitivity + (packet.button === "plus" ? 0.1 : -0.1),
      );
      storage.write("openwii.sensitivity.v2", value);
      balloons.show({
        title: S.pointer,
        text: S.speed(value),
        key: "pointer-speed",
        duration: 1500,
      });
      return;
    }
    if (packet.button === "A" && nav.getMode() === "pointer") {
      const position = model
        .frame(performance.now())
        .find((p) => p.slot === packet.slot && !p.stale);
      if (position) {
        const target = hit(position.x, position.y);
        if (target) {
          target.focus();
          target.click();
          cue("click");
        }
      }
      return;
    }
    nav.route(packet.button);
  }
  const off = [session.on("pointer", feed), session.on("shell-button", button)];
  const update = (state) => {
    const desired =
      state.connection === "connected" &&
      ["lobby", "results"].includes(state.room?.phase);
    enabled = desired && state.room?.pointerMode === true;
    if (desired && !requested && state.room?.pointerMode !== true) {
      requested = true;
      void session.pointerMode(true).then((answer) => {
        if (answer.error) requested = false;
      });
    } else if (!desired) requested = false;
    if (!enabled) {
      cancelAnimationFrame(raf);
      raf = null;
      clearTimeout(focusTimer);
      focusTimer = null;
      lastMode = null;
      layer.hidden = true;
      model.clear();
      activity.clear();
      clearHover();
      cursors.forEach((el) => el.remove());
      cursors.clear();
      for (let slot = 0; slot < 4; slot++) tray.pointing(slot, false);
    } else {
      layer.hidden = false;
      if (raf === null && !dead) raf = requestAnimationFrame(frame);
    }
    const active = new Set(
      (state.room?.players || [])
        .filter((p) => p.connected && !p.away)
        .map((p) => p.slot),
    );
    for (const slot of model.seats.keys())
      if (!active.has(slot)) {
        model.seats.delete(slot);
        activity.clear(slot);
        cursors.get(slot)?.remove();
        cursors.delete(slot);
        tray.pointing(slot, false);
      }
  };
  off.push(session.store.subscribe((state) => state, update));
  update(session.get());
  function paintCursor(el) {
    const art = cursorAppearance(theme.manifest, cursorSkin, innerWidth);
    el.dataset.skin = art.role;
    el.firstElementChild.src = theme.url(art.file);
    el.style.setProperty("--pointer-size", `${art.width}px`);
    el.style.setProperty("--pointer-tip-x", `${art.tipX}px`);
    el.style.setProperty("--pointer-tip-y", `${art.tipY}px`);
  }
  function frame(now) {
    raf = null;
    if (dead || !enabled) return;
    if (nav.getMode() !== lastMode) mode(nav.getMode());
    const steering = steeringSeat(getRoom());
    for (const point of model.frame(now)) {
      let el = cursors.get(point.slot);
      if (!el) {
        const seat = SEATS[point.slot];
        el = h(
          "div",
          { class: "os-pointer", dataset: { slot: point.slot } },
          h("img", { alt: "" }),
          h("span", { text: seat.shape }),
        );
        el.style.setProperty("--seat", seat.color);
        paintCursor(el);
        layer.append(el);
        cursors.set(point.slot, el);
      }
      if (activity.moved(point)) {
        onActivity(point);
        if (point.slot === steering) nav.setMode("pointer");
      }
      el.style.transform = `translate3d(${point.x}px,${point.y}px,0)`;
      el.classList.toggle("idle", point.hidden);
      tray.pointing(point.slot, !point.stale);
      if (point.slot === steering && nav.getMode() === "pointer") {
        const target = point.stale ? null : hit(point.x, point.y);
        if (target !== hover) {
          clearHover();
          hover = target;
          hover?.classList.add("hover");
        }
      }
    }
    if (nav.getMode() === "focus") clearHover();
    raf = requestAnimationFrame(frame);
  }
  const resize = () => {
    model.resize(innerWidth, innerHeight);
    activity.clear();
    cursors.forEach(paintCursor);
  };
  addEventListener("resize", resize);
  return {
    model,
    updateSettings(next) {
      cursorSkin = next.cursorSkin;
      cursors.forEach(paintCursor);
    },
    setSensitivity: (v) => {
      const value = model.setSensitivity(v);
      storage.write("openwii.sensitivity.v2", value);
      return value;
    },
    destroy() {
      dead = true;
      off.forEach((fn) => fn());
      cancelAnimationFrame(raf);
      clearTimeout(focusTimer);
      removeEventListener("resize", resize);
      clearHover();
      layer.remove();
    },
  };
}
