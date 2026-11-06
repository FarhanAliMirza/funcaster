import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  createSession,
  HOST_KEY,
  canStart,
  isClassic,
  isArena,
} from "../../public/os/session.js";
import { createPropertiesModel } from "../../public/os/option-ui.js";
const { fixture, emit, FakePhone } = createRequire(import.meta.url)(
  "../party/harness.cjs",
);
const memory = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};
const pairing = async () => ({
  ok: true,
  json: async () => ({
    url: "https://example.test/controller?room=ROOM",
    qr: "data:image/png;base64,test",
    trusted: true,
  }),
});
function until(session, predicate) {
  if (predicate(session.get())) return Promise.resolve(session.get());
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      off();
      reject(
        new Error(
          "Session condition timed out: " + JSON.stringify(session.get()),
        ),
      );
    }, 1500);
    const off = session.store.subscribe(
      (state) => state,
      (state) => {
        if (predicate(state)) {
          clearTimeout(timeout);
          off();
          resolve(state);
        }
      },
    );
  });
}
async function connected(t, options = {}) {
  const f = await fixture(t, options.fixture || {}),
    socket = await f.connect(),
    storage = options.storage || memory();
  const session = createSession({
    socket,
    buildId: options.buildId,
    storage,
    fetcher: pairing,
    now: () => 100000,
    ...options,
  });
  t.after(() => session.destroy());
  await until(session, (s) => s.connection === "connected" && s.room);
  return { ...f, socket, storage, session };
}

test("session creates an arcade room, replaces room state, pairs and preserves the legacy credential shape", async (t) => {
  const f = await connected(t);
  const { session, storage } = f;
  const state = await until(session, (s) => s.pairing);
  assert.equal(state.room.arcade, true);
  assert.deepEqual(Object.keys(JSON.parse(storage.getItem(HOST_KEY))).sort(), [
    "code",
    "displayToken",
    "token",
  ]);
  assert.equal(state.room.hostConnected, true);
  assert.equal(session.remainingMs(101000), 1000);
  const phone = new FakePhone(f, state.identity.code);
  await phone.join();
  phone.ready();
  await emit(phone.socket, "ping-check");
  await until(session, (s) => s.room.players[0]?.ready);
  assert.equal(canStart(session.get().room), true);
  assert.equal(
    state.room.players.length,
    0,
    "room slices are replaced, not mutated",
  );
  assert.equal(session.select("mario-kart").ok, true);
  await until(session, (s) => s.room.game === "mario-kart");
});

test("a refreshed shell reclaims its saved room and an expired saved room retries only once", async (t) => {
  const f = await connected(t),
    previous = f.session.get().identity;
  f.session.destroy();
  await f.advance(20);
  const resumed = createSession({
    socket: await f.connect(),
    storage: f.storage,
    fetcher: pairing,
  });
  t.after(() => resumed.destroy());
  await until(resumed, (s) => s.connection === "connected" && s.room);
  assert.deepEqual(resumed.get().identity, previous);
  const expiredStorage = memory();
  expiredStorage.setItem(
    HOST_KEY,
    JSON.stringify({ code: "EXPIRED", token: "bad", displayToken: "old" }),
  );
  const socket = await f.connect(),
    hostPackets = [];
  socket.onAnyOutgoing((event, data) => {
    if (event === "host") hostPackets.push(data);
  });
  const fresh = createSession({
    socket,
    storage: expiredStorage,
    fetcher: pairing,
  });
  t.after(() => fresh.destroy());
  await until(fresh, (s) => s.connection === "connected" && s.room);
  assert.equal(hostPackets.length, 2);
  assert.equal(hostPackets[0].code, "EXPIRED");
  assert.equal(hostPackets[1].code, undefined);
  assert.match(fresh.get().notice, /Session expired/);
  assert.notEqual(fresh.get().identity.code, "EXPIRED");
});

test("stale build responses request an update without creating rooms or destroying reclaim credentials", async (t) => {
  const f = await fixture(t, { buildId: "current" }),
    storage = memory();
  const saved = { code: "RETAIN", token: "owner", displayToken: "display" };
  storage.setItem(HOST_KEY, JSON.stringify(saved));
  const session = createSession({
    socket: await f.connect(),
    storage,
    buildId: "old",
    fetcher: pairing,
  });
  t.after(() => session.destroy());
  let updates = 0;
  session.on("update", () => updates++);
  await until(session, (s) => s.connection === "update");
  assert.equal(updates, 1);
  assert.equal(f.party.rooms.size, 0);
  assert.deepEqual(JSON.parse(storage.getItem(HOST_KEY)), saved);
});

test("setup sends all options and host commands serialize monotonic sequences with a bounded rate-limit retry", async (t) => {
  let rateDelays = 0;
  const f = await connected(t, {
    delay: async (ms) => {
      assert.equal(ms, 1050);
      rateDelays++;
      await f.advance(ms);
    },
  });
  f.session.select("mario-kart");
  await until(f.session, (s) => s.room.game === "mario-kart");
  assert.equal(
    (await f.session.setup({ laps: 3, mode: "solo", cpuCount: 2 })).ok,
    true,
  );
  const sent = [];
  f.socket.onAnyOutgoing((event, data) => {
    if (["host.cmd", "setup"].includes(event)) sent.push({ event, data });
  });
  assert.equal((await f.session.setup({ cpuCount: 0 })).ok, true);
  const setup = sent.find((item) => item.event === "setup").data;
  assert.equal(setup.laps, 3);
  assert.equal(setup.mode, "solo");
  assert.equal(setup.cpuCount, 0);
  const results = await Promise.all(
    Array.from({ length: 6 }, () => f.session.cmd("status")),
  );
  assert.ok(results.every((answer) => answer.ok));
  assert.equal(rateDelays, 1);
  const sequences = sent
    .filter((item) => item.event === "host.cmd")
    .map((item) => item.data.seq);
  assert.deepEqual(
    sequences,
    [1, 2, 3, 4, 5, 6, 6],
    "same logical command ID is retried after rate limiting",
  );
  const start = await f.session.start();
  assert.match(start.error, /Waiting for/);
});

test("active-round option changes are blocked and destructive actions require confirmation", async (t) => {
  const confirmations = [];
  let decision = "cancel";
  const f = await connected(t, {
    confirm: async (options) => {
      confirmations.push(options);
      return decision;
    },
  });
  const phone = new FakePhone(f, f.session.get().identity.code);
  await phone.join();
  phone.ready();
  await emit(phone.socket, "ping-check");
  await until(f.session, (s) => canStart(s.room));
  assert.equal((await f.session.start()).ok, true);
  await until(f.session, (s) => isArena(s.room) || isClassic(s.room));
  assert.match(
    (await f.session.setup({ mode: "multiplayer" })).error,
    /between rounds/,
  );
  assert.deepEqual(await f.session.lobby(), { cancelled: true });
  assert.ok(isArena(f.session.get().room));
  decision = "confirm";
  assert.equal((await f.session.lobby()).ok, true);
  await until(f.session, (s) => s.room.phase === "lobby");
  assert.equal(confirmations.length, 2);
  assert.equal(confirmations[0].defaultButton, "cancel");
});

test("pairing retries visibly and keeps the typed room code available", async (t) => {
  let attempts = 0;
  const f = await connected(t, {
    retryMs: 15,
    fetcher: async () => {
      if (++attempts < 2) throw new Error("offline");
      return pairing();
    },
  });
  await until(f.session, (s) => s.pairingError);
  assert.ok(f.session.get().identity.code);
  assert.match(f.session.get().pairingError, /Retry/);
  await until(f.session, (s) => s.pairing);
  assert.equal(attempts, 2);
  assert.equal(f.session.get().pairingError, null);
});

test("room expiry clears stored credentials and exposes an explicit new-party action", async (t) => {
  const f = await connected(t),
    code = f.session.get().identity.code;
  f.io.of("/party").to(code).emit("ended");
  await until(f.session, (s) => s.connection === "ended");
  assert.equal(f.storage.getItem(HOST_KEY), undefined);
  assert.equal(f.session.get().room, null);
  f.session.newParty();
  await until(f.session, (s) => s.connection === "connected" && s.room);
  assert.notEqual(f.session.get().identity.code, code);
});

test("late pairing responses cannot update a destroyed session", async (t) => {
  let waitForReply = false,
    resolveReply;
  const f = await connected(t, {
    fetcher: () =>
      waitForReply
        ? new Promise((resolve) => {
            resolveReply = resolve;
          })
        : pairing(),
  });
  await until(f.session, (state) => state.pairing);
  waitForReply = true;
  const request = f.session.retryPairing();
  assert.equal(f.session.get().pairingLoading, true);
  f.session.destroy();
  const snapshot = f.session.get();
  resolveReply(await pairing());
  await request;
  assert.equal(f.session.get(), snapshot);
});

test("a queued rate-limit retry cannot execute against a replacement room", async (t) => {
  let finishDelay, enteredDelay;
  const waiting = new Promise((resolve) => {
    enteredDelay = resolve;
  });
  const f = await connected(t, {
    delay: () => {
      enteredDelay();
      return new Promise((resolve) => {
        finishDelay = resolve;
      });
    },
  });
  for (let i = 0; i < 5; i++)
    assert.equal((await f.session.cmd("status")).ok, true);
  const oldCode = f.session.get().identity.code;
  const pending = f.session.cmd("lock", { locked: true });
  await waiting;
  f.session.newParty();
  await until(
    f.session,
    (state) =>
      state.connection === "connected" &&
      state.room &&
      state.room.code !== oldCode,
  );
  finishDelay();
  assert.match((await pending).error, /connection changed/i);
  assert.equal(f.session.get().room.locked, false);
});

test("Properties Cancel replaces the opening setup after a live server normalized an edit", async (t) => {
  const f = await connected(t);
  assert.deepEqual(f.session.get().room.setup, {});
  const model = createPropertiesModel({
    gameId: "mario-kart",
    getRoom: () => f.session.get().room,
    session: f.session,
  });
  const off = f.session.store.subscribe(
    (state) => state.room,
    (room) => model.update(room),
  );
  t.after(() => {
    off();
    model.destroy();
  });
  await until(f.session, (state) => state.room.game === "mario-kart");
  model.change({ laps: 3 });
  assert.equal((await model.flush()).ok, true);
  await until(f.session, (state) => state.room.setup.laps === 3);
  assert.equal((await model.cancel()).ok, true);
  await until(f.session, (state) => state.room.setup.laps === 1);
});

test("Next player confirms once, ends the solo turn, rotates three seats and skips disconnected players", async (t) => {
  let decision = "cancel",
    confirmations = 0,
    f;
  f = await connected(t, {
    confirm: async () => {
      confirmations++;
      return decision;
    },
    delay: async (ms) => f.advance(ms),
  });
  f.session.select("golf");
  await until(f.session, (state) => state.room.game === "golf");
  await f.session.setup({ mode: "solo" });
  const phones = [];
  for (let i = 0; i < 3; i++) {
    const phone = new FakePhone(f, f.session.get().identity.code);
    await phone.join();
    phone.ready();
    await emit(phone.socket, "ping-check");
    phones.push(phone);
  }
  await until(
    f.session,
    (state) =>
      state.room.players.filter((p) => p.ready && p.connected).length === 3,
  );
  assert.equal((await f.session.start()).ok, true);
  await until(f.session, (state) => state.room.phase === "classic");
  const initialRound = f.session.get().room.roundId;
  assert.deepEqual(f.session.get().room.active, [0]);
  assert.deepEqual(await f.session.nextPlayer(), { cancelled: true });
  assert.equal(f.session.get().room.roundId, initialRound);
  assert.equal(f.session.get().room.phase, "classic");
  const packets = [];
  f.socket.onAnyOutgoing((event, data) => {
    if (event === "host.cmd") packets.push(data.cmd);
  });
  decision = "confirm";
  for (const slot of [1, 2, 0]) {
    await f.advance(1100);
    assert.equal((await f.session.nextPlayer()).ok, true);
    await until(
      f.session,
      (state) =>
        state.room.phase === "classic" && state.room.active[0] === slot,
    );
  }
  assert.deepEqual(packets, [
    "lobby",
    "next-player",
    "lobby",
    "next-player",
    "lobby",
    "next-player",
  ]);
  phones[1].disconnect();
  await until(
    f.session,
    (state) => !state.room.players.find((p) => p.slot === 1)?.connected,
  );
  await f.advance(1100);
  assert.equal((await f.session.nextPlayer()).ok, true);
  await until(f.session, (state) => state.room.active[0] === 2);
  assert.equal(confirmations, 5);
  const raw = f.party.rooms.get(f.session.get().identity.code);
  assert.equal(raw.lastSoloSlot, 2);
  await f.advance(1100);
  await f.session.lobby();
  await f.session.setup({ mode: "multiplayer" });
  assert.equal(
    raw.lastSoloSlot,
    null,
    "non-solo setup discards the previous turn",
  );
  assert.equal((await f.session.start()).ok, true);
  await until(f.session, (state) => state.room.phase === "classic");
  assert.equal(
    raw.lastSoloSlot,
    null,
    "a multiplayer start never inherits a solo cursor",
  );
  assert.deepEqual(raw.active, [0, 2]);
});
