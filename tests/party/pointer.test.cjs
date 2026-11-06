const test = require("node:test"),
  assert = require("node:assert/strict");
const { fixture, emit, FakePhone } = require("./harness.cjs");
const {
  pointerSample,
  shellButton,
  deviceInfo,
} = require("../../server/shell-input.cjs");

async function lobby(t, count = 2) {
  const f = await fixture(t, { arcade: true });
  const host = await f.connect(),
    identity = await emit(host, "host");
  const phones = [];
  for (let i = 0; i < count; i++) {
    const phone = new FakePhone(f, identity.code);
    await phone.join();
    phones.push(phone);
  }
  return {
    ...f,
    host,
    identity,
    phones,
    room: f.party.rooms.get(identity.code),
  };
}
function collect(socket, event) {
  const values = [];
  socket.on(event, (value) => values.push(value));
  return values;
}
async function flushed(...sockets) {
  for (const socket of sockets) await emit(socket, "ping-check");
}
async function mode(f, on = true) {
  assert.equal((await emit(f.host, "pointer-mode", { on })).on, on);
}

test("pointer validation builds bounded fresh samples and rejects malformed/nonfinite shapes", () => {
  const q = [0, 0, 0, 1];
  const out = pointerSample({
    q,
    r: [-9000, 50, 9000],
    slot: 9,
    t: 99,
    secret: "omit",
  });
  assert.deepEqual(out, { q, r: [-2000, 50, 2000] });
  assert.notEqual(out.q, q);
  assert.deepEqual(pointerSample({ a: -1, b: 181, g: -91 }), {
    a: 0,
    b: 180,
    g: -90,
  });
  assert.deepEqual(pointerSample({ a: 999, b: -999, g: 999 }), {
    a: 360,
    b: -180,
    g: 90,
  });
  assert.deepEqual(pointerSample({ x: -2, y: 2 }), { x: -1, y: 1 });
  for (const bad of [
    null,
    [],
    {},
    { q: [0, 0, 0] },
    { q: [0, 0, 0, 0] },
    { q: [0, 0, 0, 1.1] },
    { q: [NaN, 0, 0, 1] },
    { a: 0, b: Infinity, g: 0 },
    { a: "0", b: 0, g: 0 },
    { a: 0, b: 0 },
    { x: 0 },
    { x: NaN, y: 0 },
    { q, x: 0, y: 0 },
    { q, r: [0, 0] },
    { q, r: [0, Infinity, 0] },
  ])
    assert.equal(pointerSample(bad), null, JSON.stringify(bad));
  assert.deepEqual(shellButton({ button: "A", pressed: false, slot: 3 }), {
    button: "A",
    pressed: false,
  });
  for (const bad of [
    { button: "unknown", pressed: true },
    { button: "A" },
    { button: "A", pressed: 1 },
  ])
    assert.equal(shellButton(bad), null);
});

test("shell samples reach only the host using stable seats without requiring ready", async (t) => {
  const f = await lobby(t),
    [first, phone] = f.phones;
  first.socket.emit("leave");
  await flushed(first.socket);
  assert.equal(phone.identity.slot, 1);
  assert.equal(f.room.players[1].ready, false);
  const display = await f.connect();
  assert.equal(
    (
      await emit(display, "display", {
        code: f.identity.code,
        token: f.identity.displayToken,
      })
    ).ok,
    true,
  );
  const other = new FakePhone(f, f.identity.code);
  await other.join();
  const foreignHost = await f.connect();
  await emit(foreignHost, "host");
  const hostPointers = collect(f.host, "pointer"),
    hostButtons = collect(f.host, "shell-button");
  const watchers = [display, other.socket, foreignHost, first.socket];
  const leaked = watchers.map((socket) => [
    collect(socket, "pointer"),
    collect(socket, "shell-button"),
  ]);
  await mode(f);
  phone.pointer({ a: 10, b: 20, g: 30, r: [1, 2, 3], slot: 0, t: -1 });
  phone.button();
  await flushed(phone.socket, f.host, ...watchers);
  assert.deepEqual(hostPointers, [
    { slot: 1, a: 10, b: 20, g: 30, r: [1, 2, 3], t: 100000 },
  ]);
  assert.deepEqual(hostButtons, [{ slot: 1, button: "A", pressed: true }]);
  for (const events of leaked) assert.deepEqual(events, [[], []]);
});

test("pointer sequence is independent of game input, malformed/replayed samples do not relay, reconnect resets it", async (t) => {
  const f = await lobby(t, 1),
    phone = f.phones[0],
    got = collect(f.host, "pointer");
  await mode(f);
  phone.sample({ seq: 500 });
  phone.pointer({ q: [0, 0, 0, 1], seq: 0 });
  await flushed(phone.socket, f.host);
  assert.equal(got.length, 1);
  await f.advance(10);
  for (const packet of [
    { q: [0, 0, 0, 1], seq: 0 },
    { q: [0, 0, 0, 1], seq: -1 },
    { q: [0, 0, 0, 1], seq: 1.5 },
    { q: [0, 0, 0, 1], seq: "1" },
    { q: [NaN, 0, 0, 1], seq: 1 },
    { a: Infinity, b: 0, g: 0, seq: 1 },
    { x: 0, seq: 1 },
  ])
    phone.socket.emit("pointer", packet);
  await flushed(phone.socket, f.host);
  assert.equal(got.length, 1);
  phone.pointer({ x: 2, y: -2, seq: 1 });
  await flushed(phone.socket, f.host);
  assert.deepEqual(got.at(-1), { slot: 0, x: 1, y: -1, t: 100010 });
  phone.disconnect();
  await f.advance(10);
  await phone.join();
  phone.pointer({ q: [0, 0, 0, 1], seq: 0 });
  await flushed(phone.socket, f.host);
  assert.equal(got.length, 3);
});

test("pointer and button streams have independent per-phone time floors", async (t) => {
  const f = await lobby(t),
    [phone, other] = f.phones;
  const got = collect(f.host, "pointer"),
    buttons = collect(f.host, "shell-button");
  await mode(f);
  for (let i = 0; i < 50; i++) {
    phone.pointer();
    await flushed(phone.socket);
    await f.advance(2);
  }
  await flushed(f.host);
  assert.equal(got.length, 13, "at most 13 packets in the first 100 ms");
  other.pointer();
  phone.socket.emit("shell-button", { button: "unknown", pressed: true });
  phone.button("A");
  phone.button("A", false);
  other.button("B");
  await flushed(phone.socket, other.socket, f.host);
  assert.equal(got.length, 14);
  assert.deepEqual(
    [...buttons].sort((a, b) => a.slot - b.slot),
    [
      { slot: 0, button: "A", pressed: true },
      { slot: 1, button: "B", pressed: true },
    ],
  );
  await f.advance(30);
  phone.button("A", false);
  await flushed(phone.socket, f.host);
  assert.deepEqual(buttons.at(-1), { slot: 0, button: "A", pressed: false });
});

test("only the host toggles pointer mode; away, waiting and playing phones cannot drive it", async (t) => {
  const f = await lobby(t, 5),
    phone = f.phones[0],
    queued = f.phones[4];
  const got = collect(f.host, "pointer"),
    buttons = collect(f.host, "shell-button");
  phone.socket.emit("pointer-mode", { on: true });
  phone.pointer();
  phone.button();
  await flushed(phone.socket, f.host);
  assert.equal(f.room.pointerMode, false);
  assert.deepEqual(got, []);
  assert.deepEqual(buttons, []);
  assert.equal(queued.identity.queued, true);
  assert.ok((await emit(f.host, "pointer-mode", { on: "true" })).error);
  await mode(f);
  queued.pointer();
  queued.button();
  phone.socket.emit("away", { away: true });
  phone.pointer();
  phone.button();
  await flushed(phone.socket, queued.socket, f.host);
  assert.deepEqual(got, []);
  assert.deepEqual(buttons, []);
  phone.socket.emit("away", { away: false });
  phone.ready();
  await flushed(phone.socket);
  assert.equal((await emit(f.host, "host.assign", { slot: 0 })).ok, true);
  assert.ok(
    (
      await emit(phone.socket, "host.cmd", {
        seq: 1,
        cmd: "pointer-mode",
        args: { on: false },
      })
    ).error,
  );
  assert.equal(f.room.pointerMode, true);
  await emit(f.host, "setup", { mode: "solo" });
  f.host.emit("start");
  await flushed(f.host);
  assert.equal(f.room.pointerMode, false);
  assert.equal(f.party.view(f.room).pointerMode, false);
  assert.equal((await emit(f.host, "pointer-mode", { on: true })).on, false);
  phone.pointer();
  phone.button();
  await flushed(phone.socket, f.host);
  assert.deepEqual(got, []);
  assert.deepEqual(buttons, []);
});

test("screen and viewer receive no shell events in results; classic game input is retained", async (t) => {
  const f = await lobby(t, 1),
    phone = f.phones[0];
  f.host.emit("select", { game: "table-tennis" });
  await flushed(f.host);
  await emit(f.host, "setup", { mode: "solo" });
  phone.ready();
  await flushed(phone.socket);
  await mode(f);
  f.host.emit("start");
  await flushed(f.host);
  assert.equal(f.room.phase, "classic");
  assert.equal(f.room.pointerMode, false);
  const screen = await f.connect(),
    viewer = await f.connect();
  const details = {
    code: f.identity.code,
    game: f.room.game,
    roundId: f.room.roundId,
  };
  assert.equal(
    (await emit(screen, "screen", { ...details, token: f.identity.token })).ok,
    true,
  );
  assert.equal(
    (
      await emit(viewer, "watch-game", {
        ...details,
        token: f.identity.displayToken,
      })
    ).ok,
    true,
  );
  const screenStates = collect(screen, "state"),
    viewerStates = collect(viewer, "state");
  const orientation = collect(screen, "orientation");
  const got = collect(f.host, "pointer");
  const screenPointers = collect(screen, "pointer"),
    screenButtons = collect(screen, "shell-button");
  const viewerPointers = collect(viewer, "pointer"),
    viewerButtons = collect(viewer, "shell-button");
  phone.pointer();
  phone.sample({ x: 0.5, y: -0.4, gas: true });
  await flushed(phone.socket);
  await f.advance(20);
  await flushed(screen, f.host);
  assert.equal(got.length, 0);
  assert.equal(orientation.at(-1).party.x, 0.5);
  assert.equal(orientation.at(-1).party.gas, true);
  assert.equal(
    (await emit(screen, "match.finish", { scores: [{ slot: 0, score: 7 }] }))
      .ok,
    true,
  );
  assert.equal(f.room.phase, "results");
  await mode(f);
  phone.pointer();
  phone.button();
  await flushed(phone.socket, f.host, screen, viewer);
  assert.equal(got.length, 1);
  phone.socket.emit("device", { platform: "ios", tier: "A" });
  await flushed(phone.socket, screen, viewer);
  for (const states of [screenStates, viewerStates]) {
    assert.ok(states.length);
    assert.ok(
      states.every((state) => state.players.every((p) => !("device" in p))),
    );
  }
  for (const events of [
    screenPointers,
    screenButtons,
    viewerPointers,
    viewerButtons,
  ])
    assert.deepEqual(events, []);
});

test("pointer mode clears on host loss and stays off when a host reclaims", async (t) => {
  const f = await lobby(t, 1),
    phone = f.phones[0];
  const states = collect(phone.socket, "state");
  await mode(f);
  await flushed(phone.socket);
  assert.equal(states.at(-1).pointerMode, true);
  const lost = new Promise((resolve) =>
    f.io.of("/party").sockets.get(f.host.id).once("disconnect", resolve),
  );
  f.host.disconnect();
  await lost;
  await flushed(phone.socket);
  assert.equal(f.room.pointerMode, false);
  assert.equal(states.at(-1).pointerMode, false);
  const host = await f.connect();
  assert.equal(
    (
      await emit(host, "host", {
        code: f.identity.code,
        token: f.identity.token,
      })
    ).code,
    f.identity.code,
  );
  const got = collect(host, "pointer");
  phone.pointer();
  await flushed(phone.socket, host);
  assert.deepEqual(got, []);
  assert.equal(f.party.view(f.room).pointerMode, false);
});

test("device diagnostics are sanitized and sent to the host only, never other or queued phones", async (t) => {
  const f = await lobby(t, 5),
    phone = f.phones[0];
  const hostStates = collect(f.host, "state");
  const display = await f.connect();
  await emit(display, "display", {
    code: f.identity.code,
    token: f.identity.displayToken,
  });
  const recipients = [...f.phones.map((p) => p.socket), display];
  const states = recipients.map((socket) => collect(socket, "state"));
  const raw = {
    platform: "android",
    tier: "A",
    gyro: true,
    hz: 9000,
    haptics: "vibrate",
    fullscreen: true,
    standalone: true,
    touchMax: 999,
    inApp: "instagram",
    secure: true,
    userAgent: "secret user agent",
    token: "secret",
  };
  phone.socket.emit("device", raw);
  await flushed(phone.socket, f.host, ...recipients);
  const expected = {
    platform: "android",
    tier: "A",
    gyro: true,
    hz: 240,
    haptics: "vibrate",
    fullscreen: true,
    standalone: true,
    touchMax: 20,
    inApp: "Instagram",
    secure: true,
  };
  assert.deepEqual(f.room.players[0].device, expected);
  assert.deepEqual(hostStates.at(-1).players[0].device, expected);
  for (const received of states) {
    assert.ok(received.length);
    assert.ok(
      received.every((state) => state.players.every((p) => !("device" in p))),
    );
  }
  assert.ok(f.party.view(f.room).players.every((p) => !("device" in p)));
  f.host.emit("device", { platform: "ios" });
  display.emit("device", { platform: "ios" });
  phone.socket.emit("device", { platform: "ios" });
  await flushed(f.host, display, phone.socket);
  assert.deepEqual(
    f.room.players[0].device,
    expected,
    "one diagnostic update per second",
  );
  await f.advance(1000);
  phone.socket.emit("device", {
    platform: "invalid",
    tier: "unknown",
    gyro: 1,
    hz: Infinity,
    touchMax: -100,
    inApp: "unbounded arbitrary user agent",
    haptics: "buzz",
  });
  await flushed(phone.socket);
  assert.deepEqual(f.room.players[0].device, {
    platform: "other",
    tier: "B",
    gyro: false,
    hz: 0,
    haptics: "none",
    fullscreen: false,
    standalone: false,
    touchMax: 0,
    inApp: null,
    secure: false,
  });
  assert.equal(deviceInfo(null), null);
  assert.equal(deviceInfo([]), null);
});
