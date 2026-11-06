import test from "node:test";
import assert from "node:assert/strict";
import { demoState, demoFrame } from "./demo-state.js";
import { createDemoSession } from "./demo-session.js";
import { createStore } from "./util/store.js";
import { gameById, matchSetup } from "../../core/catalog.js";
import { resultPresentation } from "./result-data.js";
import { PartyRenderer } from "../party/render.js";
const at = 1_800_000_000_000;
function session(scenario = "three") {
  let time = at;
  const store = createStore({
      room: demoState(scenario, time),
      connection: "demo",
    }),
    api = createDemoSession(store, { now: () => time });
  return {
    store,
    api,
    advance: (ms) => {
      time += ms;
    },
  };
}
test("demo scenarios are deterministic and separate empty, ready and disconnected rooms", () => {
  for (const scenario of [
    "empty",
    "three",
    "ready",
    "playing",
    "results",
    "kiosk",
    "reconnecting",
  ])
    assert.deepEqual(demoState(scenario, at), demoState(scenario, at));
  assert.deepEqual(demoState("three", at), demoState("ready", at));
  for (const scenario of ["empty", "kiosk", "unknown"]) {
    const room = demoState(scenario, at);
    assert.equal(room.players.length, 0);
    assert.deepEqual(room.active, []);
    assert.equal(room.hostSeat, null);
    assert.equal(room.phase, "lobby");
    assert.match(room.startReason, /Waiting for/);
  }
  const kiosk = demoState("kiosk", at);
  assert.equal(kiosk.operatingMode, "kiosk");
  assert.equal(kiosk.attract, true);
  assert.ok(kiosk.playlist.every((id) => gameById(id).id === id));
  assert.equal(demoState("three", at).startReason, "Ready to play");
  assert.equal(demoState("reconnecting", at).hostConnected, false);
  assert.equal(
    demoState("reconnecting", at).startReason,
    "Waiting for the main screen",
  );
});
test("playing demo has a real match setup and its snapshot draws finite geometry with the real renderer", (t) => {
  const room = demoState("playing", at),
    frame = demoFrame(room);
  assert.deepEqual(room.match, {
    ...matchSetup(gameById(room.game), room.setup, 3),
    seed: 42,
  });
  assert.equal(room.endsAt - room.serverTime, 45000);
  assert.deepEqual(
    frame.players.map((p) => p.slot),
    room.active,
  );
  let draws = 0;
  const g = new Proxy(
    {},
    {
      get:
        (_target, key) =>
        (...args) => {
          for (const value of args)
            if (typeof value === "number")
              assert.ok(Number.isFinite(value), String(key));
          if (["fill", "fillRect", "fillText"].includes(key)) draws++;
        },
    },
  );
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "requestAnimationFrame",
  );
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: () => 1,
  });
  t.after(() => {
    if (descriptor)
      Object.defineProperty(globalThis, "requestAnimationFrame", descriptor);
    else delete globalThis.requestAnimationFrame;
  });
  const renderer = Object.assign(Object.create(PartyRenderer.prototype), {
    g,
    w: 1280,
    h: 720,
    positions: new Map(),
    feedback: new Map(),
    particles: [],
    motion: false,
    running: true,
  });
  renderer.setInsets({ top: 120, bottom: 100 });
  renderer.setFrame(frame);
  renderer.animate(1000);
  renderer.animate(1016);
  assert.ok(draws > 20, "all three lanes and their objects are painted");
  assert.equal(demoFrame(demoState("empty", at)), null);
});
test("results preview records a completed round and labels the forfeiting seat without claiming replay verification", () => {
  const room = demoState("results", at),
    data = resultPresentation(room);
  assert.equal(room.result.status, "completed");
  assert.ok(room.result.matchId);
  assert.equal(room.roundId, 1);
  assert.equal(room.result.verification, "unverified");
  assert.equal(room.result.setup.mode, "multiplayer");
  assert.equal(data.ranked.length, 3);
  assert.equal(data.ranked[2].outcome, "forfeit");
  assert.ok(data.ranked[2].outcomeLabel);
  assert.equal(room.players[2].connected, false);
  assert.equal(room.startReason, "Ready to play");
});
test("demo edits normalize options and replace restores the opening snapshot without residual fields", async () => {
  const { store, api } = session(),
    initial = structuredClone(store.get().room.setup);
  assert.equal(
    (
      await api.setup({
        laps: 3,
        pair: [0, 1],
        customWords: "apple, pear",
        cpuCount: 99,
      })
    ).ok,
    true,
  );
  assert.equal(store.get().room.setup.laps, 3);
  assert.equal(store.get().room.setup.cpuCount, 7);
  assert.equal((await api.setup(initial, { replace: true })).ok, true);
  assert.deepEqual(store.get().room.setup, initial);
  await api.setup({
    laps: 99,
    holes: 4,
    variant: "invalid",
    playlist: ["star-catch", "no-game", "star-catch"],
  });
  assert.equal(store.get().room.setup.laps, 1);
  assert.equal(store.get().room.setup.holes, 3);
  assert.equal(store.get().room.setup.variant, "co-op");
  assert.deepEqual(store.get().room.playlist, ["star-catch"]);
  const before = structuredClone(store.get().room);
  assert.ok((await api.setup(null)).error);
  assert.ok(api.select("not-a-game").error);
  assert.deepEqual(store.get().room, before);
  assert.equal(api.select("drawing").ok, true);
  assert.equal(store.get().room.game, "drawing");
  api.destroy();
});
test("frame subscribers receive the current demo snapshot, unsubscribe and destroy prevent late delivery", async () => {
  const { api } = session("playing"),
    frames = [];
  api.on("frame", (frame) => frames.push(frame));
  const cancelled = [];
  api.on("frame", (frame) => cancelled.push(frame))();
  await Promise.resolve();
  assert.equal(frames.length, 1);
  assert.equal(frames[0].players.length, 3);
  assert.equal(cancelled.length, 0);
  api.on("frame", (frame) => cancelled.push(frame));
  api.destroy();
  await Promise.resolve();
  assert.equal(cancelled.length, 0);
});
test("preview pause, results hold, desktop and reconnect actions remain entirely local", async () => {
  const f = session("playing");
  assert.ok((await f.api.setup({ mode: "solo" })).error);
  assert.ok(f.api.select("drawing").error);
  assert.equal((await f.api.pause()).ok, true);
  assert.equal(f.store.get().room.paused, true);
  await f.api.pause();
  assert.equal(f.store.get().room.paused, false);
  await f.api.lobby();
  assert.equal(f.store.get().room.phase, "lobby");
  assert.equal(f.store.get().room.match, null);
  assert.ok(f.store.get().room.players.every((p) => p.status === "ready"));
  const r = session("results");
  await r.api.resultHold(true);
  r.advance(4000);
  await r.api.resultHold(true);
  assert.equal(r.store.get().room.resultsRemainingMs, 20000);
  await r.api.resultHold(false);
  assert.equal(r.api.remainingMs(r.store.get().room.endsAt), 20000);
  const reconnect = session("reconnecting");
  reconnect.store.set({ connection: "reconnecting", error: "Offline" });
  assert.equal(reconnect.api.reconnect().ok, true);
  assert.equal(reconnect.store.get().connection, "demo");
  assert.equal(reconnect.store.get().room.hostConnected, true);
  assert.equal(reconnect.store.get().room.startReason, "Ready to play");
  assert.equal(reconnect.api.socket, undefined);
  f.api.destroy();
  r.api.destroy();
  reconnect.api.destroy();
});
test("live-only utility operations explain demo limitations rather than throwing or mutating state", async () => {
  const { api, store } = session(),
    initial = structuredClone(store.get());
  for (const name of [
    "start",
    "extend",
    "remove",
    "nextPlayer",
    "record",
    "arcadeConfigure",
    "hostAssign",
    "remoteConfigure",
    "assignSeat",
    "revokeView",
    "pointerMode",
    "restorePlayer",
    "phoneText",
    "endRoom",
    "retryPairing",
    "newParty",
  ])
    assert.match((await api[name]()).error, /demo/i, name);
  assert.ok((await api.cmd("lock", null)).error);
  assert.deepEqual(store.get(), initial);
  api.destroy();
  await api.lobby();
  await api.setup({ laps: 3 });
  await api.reconnect();
  assert.deepEqual(store.get(), initial);
});
