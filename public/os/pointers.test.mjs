import test from "node:test";
import assert from "node:assert/strict";
import {
  SeatPointers,
  pointerSample,
  nearestTarget,
  steeringSeat,
  pointerTargetRect,
  PointerActivity,
  cursorAppearance,
  mountPointers,
} from "./pointers.js";
test("touch samples wrap calibrated coordinates and retained Pointer ends within20px", () => {
  const model = new SeatPointers({ width: 1280, height: 720 });
  for (const [i, p] of [
    [0, [-0.8, -0.5]],
    [1, [-0.4, -0.1]],
    [2, [0, 0]],
    [3, [0.5, 0.25]],
  ]) {
    model.feed({ slot: 2, x: p[0], y: p[1] }, 100 + i * 16);
    model.frame(100 + i * 16);
  }
  const final = model.frame(164)[0];
  assert.ok(Math.abs(final.x - 960) < 20);
  assert.ok(Math.abs(final.y - 450) < 20);
  assert.deepEqual(pointerSample({ x: 0.5, y: 0.25 }), {
    party: { active: true, x: 0.5, y: 0.25 },
  });
  model.recentre(2);
  assert.equal(model.frame(165)[0].x, 640);
});
test("raw quaternion and rate packets retain their units, axes and separate per-seat Pointer", () => {
  const model = new SeatPointers();
  const q = [0, 0, 0, 1],
    r = [4, 5, 6];
  assert.deepEqual(pointerSample({ q, r }), {
    quat: q,
    motion: { rx: 4, ry: 5, rz: 6 },
  });
  model.feed({ slot: 0, q, r }, 100);
  model.feed({ slot: 1, x: -1, y: 1 }, 100);
  assert.equal(model.seats.get(0).ptr.source, "quaternion");
  assert.notEqual(model.seats.get(0).ptr, model.seats.get(1).ptr);
  model.resize(720, 1280);
  assert.equal(model.seats.get(0).ptr.aspect, 1280 / 720);
});
test("cursor freezes and fades at the specified timeouts, invalid seats are ignored", () => {
  const model = new SeatPointers();
  assert.equal(model.feed({ slot: 4, x: 0, y: 0 }, 100), null);
  model.feed({ slot: 0, x: 0, y: 0 }, 100);
  assert.equal(model.frame(601)[0].stale, true);
  assert.equal(model.seats.get(0).ptr.live, false);
  assert.equal(model.frame(3101)[0].hidden, true);
  assert.equal(model.setSensitivity(99), 6);
  assert.equal(model.setSensitivity(-1), 0.2);
});
test("only the designated host or lowest ready seat steers; disconnected hosts do not keep control", () => {
  const room = {
    hostSeat: 2,
    players: [
      { slot: 0, ready: true, connected: true },
      { slot: 2, ready: false, connected: true },
    ],
  };
  assert.equal(steeringSeat(room), 2);
  room.players[1].connected = false;
  assert.equal(steeringSeat(room), 0);
  room.players[0].ready = false;
  assert.equal(steeringSeat(room), null);
});
test("magnetism chooses the nearest eligible edge within28px", () => {
  const a = { target: "a", rect: { left: 0, right: 40, top: 0, bottom: 40 } },
    b = { target: "b", rect: { left: 80, right: 120, top: 0, bottom: 40 } };
  assert.equal(nearestTarget(65, 20, [a, b]), "b");
  assert.equal(nearestTarget(200, 20, [a, b]), null);
});

function box(left, top, width, height) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}
function element(rect, parentElement = null, overflow = "visible") {
  return {
    parentElement,
    getBoundingClientRect: () => rect,
    style: { overflow },
  };
}
const hitOptions = { width: 640, height: 360, styleFor: (el) => el.style };
test("pointer assistance ignores scrolled-away targets while keyboard targets remain available", () => {
  const pane = element(box(20, 30, 300, 200), null, "auto"),
    visible = element(box(30, 190, 120, 30), pane),
    below = element(box(30, 232, 120, 30), pane);
  assert.deepEqual(pointerTargetRect(visible, 100, 218, hitOptions), {
    left: 30,
    top: 190,
    right: 150,
    bottom: 220,
  });
  assert.equal(pointerTargetRect(below, 100, 220, hitOptions), null);
  // Neither a hidden button nor a visible last row may attract across a footer.
  assert.equal(pointerTargetRect(below, 100, 240, hitOptions), null);
  assert.equal(pointerTargetRect(visible, 100, 240, hitOptions), null);
});
test("magnetism clips partial targets through nested overflow boxes and excludes scrollbars", () => {
  const outer = element(box(10, 10, 250, 180), null, "hidden"),
    inner = element(box(30, 50, 200, 160), outer, "scroll"),
    target = element(box(0, 170, 280, 50), inner);
  Object.assign(inner, {
    clientLeft: 2,
    clientTop: 2,
    clientWidth: 180,
    clientHeight: 140,
    offsetWidth: 200,
    offsetHeight: 160,
  });
  assert.deepEqual(pointerTargetRect(target, 100, 180, hitOptions), {
    left: 32,
    top: 170,
    right: 212,
    bottom: 190,
  });
  assert.equal(pointerTargetRect(target, 220, 180, hitOptions), null);
  assert.equal(
    pointerTargetRect(element(box(620, 340, 50, 50)), 639, 359, hitOptions)
      .right,
    640,
  );
  assert.equal(pointerTargetRect(target, -1, 180, hitOptions), null);
});
test("activity measures cumulative intentional movement and ignores jitter, stale samples and new seats", () => {
  const activity = new PointerActivity();
  assert.equal(activity.moved({ slot: 0, x: 50, y: 50 }), false);
  for (let i = 0; i < 600; i++)
    assert.equal(
      activity.moved({ slot: 0, x: 50 + Math.sin(i), y: 50 + Math.cos(i) }),
      false,
    );
  for (const x of [51, 52, 53])
    assert.equal(activity.moved({ slot: 0, x, y: 50 }), false);
  assert.equal(activity.moved({ slot: 0, x: 54, y: 50 }), true);
  assert.equal(activity.moved({ slot: 1, x: 500, y: 400 }), false);
  assert.equal(activity.moved({ slot: 0, x: 600, y: 400, stale: true }), false);
  assert.equal(activity.moved({ slot: 0, x: 700, y: 400 }), false);
  activity.clear(0);
  assert.equal(activity.moved({ slot: 0, x: 100, y: 100 }), false);
});
test("cursor tips stay aligned across TV scales and the optional glove uses its original fractional hotspot", () => {
  const manifest = {
    cursors: {
      arrow: ["cursors/arrow.png", 3, 6],
      glove: ["cursors/glove.png", 40.96, 11.52],
    },
  };
  const arrow = cursorAppearance(manifest, "arrow", 1280),
    big = cursorAppearance(manifest, "arrow", 1920),
    glove = cursorAppearance(manifest, "glove", 1280);
  assert.deepEqual([arrow.width, arrow.tipX, arrow.tipY], [64, 6, 12]);
  assert.deepEqual([big.width, big.tipX, big.tipY], [96, 9, 18]);
  assert.equal(glove.tipX / glove.width, 0.32);
  assert.equal(glove.tipY / glove.width, 0.09);
  assert.equal(cursorAppearance(manifest, "invalid").role, "arrow");
  assert.equal(
    cursorAppearance({ cursors: { arrow: manifest.cursors.arrow } }, "glove")
      .role,
    "arrow",
  );
});
test("mounted pointers do not keep the party awake for stationary sensor delivery; movement and button presses do", (t) => {
  class Node {
    constructor() {
      this.children = [];
      this.dataset = {};
      this.style = { setProperty() {} };
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    append(...nodes) {
      this.children.push(...nodes);
    }
    get firstElementChild() {
      return this.children[0];
    }
    setAttribute(name, value) {
      this[name] = value;
    }
    remove() {}
  }
  const globals = new Map(),
    handlers = new Map(),
    routes = [];
  let nextFrame,
    time = 0,
    activity = 0,
    activityPoints = [],
    mode = "focus";
  const replace = (key, value) => {
    globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  };
  replace("document", {
    createElement: () => new Node(),
    elementFromPoint: () => null,
  });
  replace("innerWidth", 1280);
  replace("innerHeight", 720);
  replace("performance", { now: () => time });
  replace("addEventListener", () => {});
  replace("removeEventListener", () => {});
  replace("requestAnimationFrame", (fn) => {
    nextFrame = fn;
    return 1;
  });
  replace("cancelAnimationFrame", () => {});
  let state = {
      connection: "connected",
      room: {
        phase: "lobby",
        pointerMode: true,
        hostSeat: 0,
        players: [{ slot: 0, connected: true, ready: true }],
      },
    },
    update;
  const pointers = mountPointers({
    root: new Node(),
    session: {
      on: (name, fn) => {
        handlers.set(name, fn);
        return () => handlers.delete(name);
      },
      store: {
        subscribe: (_select, fn) => {
          update = fn;
          return () => {};
        },
      },
      get: () => state,
    },
    nav: {
      scope: () => ({ querySelectorAll: () => [] }),
      getMode: () => mode,
      setMode: (value) => {
        mode = value;
      },
      route: (value) => routes.push(value),
    },
    theme: {
      manifest: {
        cursors: {
          arrow: ["arrow.png", 3, 6],
          glove: ["glove.png", 40.96, 11.52],
        },
      },
      url: (path) => path,
    },
    storage: { read: (_key, fallback) => fallback, write() {} },
    tray: { pointing() {} },
    balloons: { show() {} },
    getRoom: () => state.room,
    onActivity: (point) => {
      activity++;
      activityPoints.push(point);
    },
  });
  t.after(() => {
    pointers.destroy();
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const sample = (x) => {
    time += 16;
    handlers.get("pointer")({ slot: 0, x, y: 0 });
    nextFrame(time);
  };
  for (let i = 0; i < 600; i++) sample(0);
  assert.equal(activity, 0);
  assert.equal(mode, "focus");
  sample(0.4);
  assert.ok(activity > 0);
  assert.equal(mode, "pointer");
  assert.equal(activityPoints.at(-1).slot, 0);
  assert.ok(activityPoints.at(-1).x > 640 && activityPoints.at(-1).x <= 1280);
  assert.equal(activityPoints.at(-1).y, 360);
  const before = activity;
  handlers.get("shell-button")({ slot: 0, button: "B", pressed: true });
  assert.equal(activity, before + 1);
  assert.equal(
    activityPoints.at(-1),
    undefined,
    "buttons wake without inventing an eye target",
  );
  assert.deepEqual(routes, ["B"]);
  state = { ...state, connection: "reconnecting" };
  update(state);
  state = { ...state, connection: "connected" };
  update(state);
  sample(-0.8);
  assert.equal(
    activity,
    before + 1,
    "reconnection starts a fresh movement baseline",
  );
  pointers.updateSettings({ cursorSkin: "glove" });
  assert.equal(pointers.model.seats.size, 1);
});
