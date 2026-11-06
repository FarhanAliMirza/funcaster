import test from "node:test";
import assert from "node:assert/strict";
import { mountPointers } from "./pointers.js";
import { createStore } from "./util/store.js";

function fixture(t, phase = "lobby") {
  class Element {
    constructor() {
      this.children = [];
      this.dataset = {};
      this.style = { setProperty() {} };
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    append(...nodes) {
      for (const node of nodes) {
        node.parent = this;
        this.children.push(node);
      }
    }
    get firstElementChild() {
      return this.children[0];
    }
    setAttribute() {}
    remove() {
      if (this.parent)
        this.parent.children = this.parent.children.filter(
          (node) => node !== this,
        );
    }
  }
  const frames = new Map(),
    events = new Map(),
    originals = new Map(),
    tray = new Map();
  let serial = 0,
    time = 0,
    activity = 0,
    mode = "focus";
  const replace = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  };
  replace("document", {
    createElement: () => new Element(),
    elementFromPoint: () => null,
  });
  replace("innerWidth", 1280);
  replace("innerHeight", 720);
  replace("performance", { now: () => time });
  replace("requestAnimationFrame", (fn) => {
    frames.set(++serial, fn);
    return serial;
  });
  replace("cancelAnimationFrame", (id) => frames.delete(id));
  replace("addEventListener", () => {});
  replace("removeEventListener", () => {});
  t.after(() => {
    pointers.destroy();
    for (const [key, old] of originals) {
      if (old) Object.defineProperty(globalThis, key, old);
      else delete globalThis[key];
    }
  });
  const root = new Element(),
    store = createStore({
      connection: "connected",
      room: {
        phase,
        pointerMode: true,
        hostSeat: 0,
        players: [{ slot: 0, connected: true, ready: true }],
      },
    });
  const pointers = mountPointers({
    root,
    session: {
      store,
      get: store.get,
      on: (name, fn) => {
        events.set(name, fn);
        return () => events.delete(name);
      },
      pointerMode: async () => ({ ok: true }),
    },
    nav: {
      scope: () => ({ querySelectorAll: () => [] }),
      getMode: () => mode,
      setMode: (next) => (mode = next),
      route() {},
    },
    theme: {
      manifest: { cursors: { arrow: ["arrow.png", 3, 6] } },
      url: (path) => path,
    },
    storage: { read: (_key, fallback) => fallback, write() {} },
    tray: { pointing: (slot, value) => tray.set(slot, value) },
    balloons: { show() {} },
    getRoom: () => store.get().room,
    onActivity: () => activity++,
  });
  return {
    pointers,
    frames,
    tray,
    layer: root.firstElementChild,
    get activity() {
      return activity;
    },
    phase(next, connection = "connected") {
      store.set({ connection, room: { ...store.get().room, phase: next } });
    },
    sample(x = 0) {
      events.get("pointer")?.({ slot: 0, x, y: 0 });
    },
    tick(ms = 16) {
      time += ms;
      const pending = [...frames];
      frames.clear();
      for (const [, fn] of pending) fn(time);
    },
  };
}

test("shell pointers cancel their frame loop and reset stale cursor state for active games", (t) => {
  const env = fixture(t);
  assert.equal(env.frames.size, 1);
  env.sample();
  env.tick();
  env.sample(0.1);
  env.tick();
  assert.equal(env.activity, 1);
  assert.equal(env.layer.children.length, 1);
  for (const phase of ["practice", "countdown", "playing", "classic"]) {
    env.phase(phase);
    assert.equal(env.frames.size, 0);
    assert.equal(env.pointers.model.seats.size, 0);
    assert.equal(env.layer.children.length, 0);
    assert.equal(env.layer.hidden, true);
    assert.equal(env.tray.get(0), false);
    env.sample(-1);
    env.tick(60000);
    assert.equal(env.frames.size, 0);
    assert.equal(env.activity, 1);
  }
  env.phase("results");
  assert.equal(env.frames.size, 1);
  env.sample(-0.5);
  env.tick();
  assert.equal(env.activity, 1, "new round's first sample is a fresh anchor");
  env.sample(-0.4);
  env.tick();
  assert.equal(env.activity, 2);
  env.phase("results");
  env.phase("lobby");
  assert.equal(env.frames.size, 1, "state updates keep only one frame loop");
  env.pointers.destroy();
  assert.equal(env.frames.size, 0);
});

test("mounting in a game or losing the relay never schedules shell cursor rendering", (t) => {
  const env = fixture(t, "playing");
  assert.equal(env.frames.size, 0);
  env.phase("results", "reconnecting");
  assert.equal(env.frames.size, 0);
  env.phase("results");
  assert.equal(env.frames.size, 1);
  env.phase("results", "reconnecting");
  assert.equal(env.frames.size, 0);
  env.pointers.destroy();
  env.phase("lobby");
  assert.equal(env.frames.size, 0);
});
