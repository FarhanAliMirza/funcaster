import test from "node:test";
import assert from "node:assert/strict";
import { mountAvatars } from "./avatars.js";
import { createStore } from "../util/store.js";

const descriptor = {
  frameMs: 120,
  seats: ["biker"],
  avatars: {
    biker: {
      frame: [48, 48],
      anims: {
        idle: { file: "idle.png", frames: 4 },
        run: { file: "run.png", frames: 6 },
      },
    },
  },
};
function fixture(t, { phase = "lobby", fetch } = {}) {
  const intervals = new Map(),
    originals = new Map();
  let time = 0,
    serial = 0,
    writes = 0;
  const replace = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value,
    });
  };
  replace("performance", { now: () => time });
  replace("setInterval", (fn) => {
    intervals.set(++serial, fn);
    return serial;
  });
  replace("clearInterval", (id) => intervals.delete(id));
  t.after(() => {
    avatars.destroy();
    for (const [key, old] of originals) {
      if (old) Object.defineProperty(globalThis, key, old);
      else delete globalThis[key];
    }
  });
  const target = {
      isConnected: true,
      dataset: { avatarSlot: "0" },
      classList: { add() {}, toggle() {} },
      setAttribute() {},
      closest: () => null,
      style: {
        setProperty(key, value) {
          this[key] = value;
          writes++;
        },
      },
    },
    document = Object.assign(new EventTarget(), {
      hidden: false,
      documentElement: new EventTarget(),
    }),
    reduced = Object.assign(new EventTarget(), { matches: false }),
    store = createStore({ room: { phase, players: [{ slot: 0 }] } });
  const avatars = mountAvatars(
    { querySelectorAll: () => [target] },
    {
      store,
      document,
      window: { matchMedia: () => reduced },
      theme: { asset: () => "avatars.json", url: (file) => file },
      fetch:
        fetch || (async () => ({ ok: true, json: async () => descriptor })),
    },
  );
  return {
    avatars,
    document,
    target,
    intervals,
    get writes() {
      return writes;
    },
    async phase(value) {
      store.set({ room: { ...store.get().room, phase: value } });
      await Promise.resolve();
    },
    tick(ms) {
      time += ms;
      for (const fn of [...intervals.values()]) fn();
    },
  };
}

test("avatars stop scheduling and painting during every game phase, then resume without a catch-up jump", async (t) => {
  const env = fixture(t);
  await env.avatars.ready;
  assert.equal(env.intervals.size, 1);
  env.tick(120);
  assert.equal(env.target.style["--avatar-frame"], 1);
  for (const phase of ["practice", "countdown", "playing", "classic"]) {
    await env.phase(phase);
    assert.equal(env.intervals.size, 0);
    const before = env.writes;
    env.tick(60000);
    env.avatars.update();
    assert.equal(env.writes, before, `${phase} must not repaint decoration`);
  }
  await env.phase("results");
  assert.equal(env.intervals.size, 1);
  env.tick(120);
  assert.equal(env.target.style["--avatar-frame"], 2);
  await env.phase("results");
  await env.phase("lobby");
  assert.equal(env.intervals.size, 1, "state feeds do not duplicate the clock");
  env.avatars.updateSettings({ gentle: true });
  assert.equal(env.intervals.size, 0);
  assert.equal(env.target.style["--avatar-frame"], 0);
  env.avatars.updateSettings({ gentle: false });
  assert.equal(env.intervals.size, 1);
  env.document.hidden = true;
  env.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(env.intervals.size, 0);
  env.document.hidden = false;
  env.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(env.intervals.size, 1);
  env.avatars.destroy();
  assert.equal(env.intervals.size, 0);
});

test("an avatar descriptor arriving after the game starts cannot wake its animation loop", async (t) => {
  let finish;
  const env = fixture(t, {
    fetch: () => new Promise((resolve) => (finish = resolve)),
  });
  await env.phase("playing");
  finish({ ok: true, json: async () => descriptor });
  await env.avatars.ready;
  assert.equal(env.intervals.size, 0);
  assert.equal(env.writes, 0);
  await env.phase("results");
  assert.equal(env.intervals.size, 1);
  env.avatars.updateSettings({ avatars: false });
  assert.equal(env.intervals.size, 0);
  env.avatars.destroy();
  await env.phase("lobby");
  assert.equal(env.intervals.size, 0);
});
