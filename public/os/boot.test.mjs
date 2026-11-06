import test from "node:test";
import assert from "node:assert/strict";
import { bootPhase, mountBoot } from "./shell/boot.js";
test("boot cannot skip asset or room readiness; any input skips only the decorative delay", () => {
  assert.equal(
    bootPhase({ ready: false, connected: true, elapsed: 9000, skipped: true }),
    "booting",
  );
  assert.equal(
    bootPhase({ ready: true, connected: false, elapsed: 9000, skipped: true }),
    "booting",
  );
  assert.equal(
    bootPhase({ ready: true, connected: true, elapsed: 2199, skipped: false }),
    "booting",
  );
  assert.equal(
    bootPhase({ ready: true, connected: true, elapsed: 2200, skipped: false }),
    "who",
  );
  assert.equal(
    bootPhase({ ready: true, connected: true, elapsed: 100, skipped: true }),
    "who",
  );
});

import { createStore } from "./util/store.js";
function bootFixture(t, { demo = false, preview = false, room = {} } = {}) {
  class Element extends EventTarget {
    constructor() {
      super();
      this.children = [];
      this.dataset = {};
      this.hidden = false;
      this.classList = { add() {}, remove() {} };
    }
    append(...children) {
      this.children.push(...children);
    }
    setAttribute(name, value) {
      this[name] = value;
    }
    remove() {}
  }
  const document = new EventTarget();
  document.createElement = () => new Element();
  const prior = globalThis.document;
  globalThis.document = document;
  let time = 1000,
    interval;
  t.mock.method(Date, "now", () => time);
  t.mock.method(globalThis, "setInterval", (fn) => {
    interval = fn;
    return 1;
  });
  t.mock.method(globalThis, "clearInterval", () => {});
  const calls = [],
    store = createStore({
      connection: demo ? "demo" : "connected",
      room: {
        code: "ABC",
        phase: "lobby",
        players: [],
        operatingMode: "party",
        ...room,
      },
    });
  const context = {
    getSession: () => ({}),
    mascot: { event: (name) => calls.push(["mascot", name]) },
    audio: { cue: (name) => calls.push(["cue", name]), unlock() {} },
    nav: { restore() {} },
    enterFullscreen() {
      calls.push(["enter-fullscreen"]);
      document.fullscreenElement ||= {};
    },
  };
  const boot = mountBoot({
    root: new Element(),
    store,
    context,
    demo,
    preview,
    wm: {
      register() {},
      open: async (id) => calls.push(["open", id]),
      close: async (id) => calls.push(["close", id]),
      list: () => [],
    },
  });
  t.after(() => {
    boot.destroy();
    if (prior === undefined) delete globalThis.document;
    else globalThis.document = prior;
  });
  return {
    boot,
    calls,
    store,
    document,
    advance(ms) {
      time += ms;
      interval();
    },
  };
}
const settled = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
test("boot cues once; attract wake preserves a 15-second grace even when demo attract stays true", async (t) => {
  const f = bootFixture(t, {
    demo: true,
    preview: true,
    room: { operatingMode: "kiosk", attract: true },
  });
  f.boot.ready();
  f.document.dispatchEvent(new Event("pointerdown"));
  await settled();
  assert.equal(f.boot.stage(), "attract");
  assert.equal(
    f.calls.filter(([type, name]) => type === "cue" && name === "startup")
      .length,
    1,
  );
  await f.boot.complete();
  assert.equal(f.boot.stage(), "desktop");
  assert.ok(
    f.calls.some(([type, name]) => type === "mascot" && name === "activity"),
  );
  f.advance(500);
  await settled();
  assert.equal(f.boot.stage(), "desktop");
  f.advance(14499);
  await settled();
  assert.equal(f.boot.stage(), "desktop");
  f.advance(2);
  await settled();
  assert.equal(f.boot.stage(), "attract");
  await f.boot.complete();
  assert.equal(
    f.calls.filter(([type, name]) => type === "cue" && name === "startup")
      .length,
    1,
  );
});
test("Who fullscreen uses the idempotent entry API and does not toggle an existing fullscreen session", async (t) => {
  const f = bootFixture(t);
  f.boot.ready();
  f.document.dispatchEvent(new Event("pointerdown"));
  await settled();
  assert.equal(f.boot.stage(), "who");
  assert.equal(
    f.calls.filter(([type]) => type === "enter-fullscreen").length,
    1,
  );
  f.document.dispatchEvent(new Event("pointerdown"));
  await settled();
  assert.equal(
    f.calls.filter(([type]) => type === "enter-fullscreen").length,
    1,
  );
  assert.ok(f.document.fullscreenElement);
});
