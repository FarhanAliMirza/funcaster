const test = require("node:test"),
  assert = require("node:assert/strict");
const { fixture, emit, FakePhone } = require("./harness.cjs");
const flush = (socket) => emit(socket, "ping-check");
async function setup(t, count = 2, options = {}) {
  const f = await fixture(t, { arcade: true, ...options }),
    host = await f.connect(),
    identity = await emit(host, "host"),
    phones = [];
  for (let i = 0; i < count; i++) {
    const phone = new FakePhone(f, identity.code);
    await phone.join();
    phone.ready();
    await flush(phone.socket);
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
async function views(f) {
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
  f.host.emit("select", { game: "drawing" });
  await flush(f.host);
  await emit(f.host, "setup", { drawing: "free", mode: "multiplayer" });
  f.host.emit("start");
  await flush(f.host);
  const screen = await f.connect(),
    viewer = await f.connect();
  assert.equal(
    (
      await emit(screen, "screen", {
        code: f.identity.code,
        token: f.identity.token,
        game: "drawing",
        roundId: f.room.roundId,
      })
    ).ok,
    true,
  );
  assert.equal(
    (
      await emit(viewer, "watch-game", {
        code: f.identity.code,
        token: f.identity.displayToken,
        game: "drawing",
        roundId: f.room.roundId,
        view: -1,
      })
    ).ok,
    true,
  );
  return [display, screen, viewer];
}

test("ending a room requires the actual TV host and an explicit confirmation", async (t) => {
  const f = await setup(t, 4);
  await emit(f.host, "arcade.configure", { pin: "735182", mode: "party" });
  await emit(f.host, "host.assign", { slot: 0 });
  await emit(f.phones[1].socket, "staff.unlock", { pin: "735182" });
  const queued = new FakePhone(f, f.identity.code);
  assert.equal((await queued.join()).queued, true);
  const watchers = await views(f),
    outsider = await f.connect();
  for (const socket of [
    f.phones[0].socket,
    f.phones[1].socket,
    f.phones[2].socket,
    queued.socket,
    ...watchers,
    outsider,
  ])
    assert.match(
      (await emit(socket, "end-room", { confirmed: true })).error,
      /Only the main screen/,
    );
  assert.ok(
    (
      await emit(f.phones[0].socket, "host.cmd", {
        seq: 1,
        cmd: "end-room",
        args: { confirmed: true },
      })
    ).error,
  );
  for (const data of [
    null,
    {},
    [],
    { confirmed: false },
    { confirmed: "true" },
    { confirmed: true, code: "other" },
  ])
    assert.match((await emit(f.host, "end-room", data)).error, /Confirm/);
  assert.equal(f.party.rooms.get(f.identity.code), f.room);
  assert.equal(f.room.phase, "classic");
});

test("confirmed shutdown acknowledges, records one no-contest, ends all members, and invalidates reclaim without touching another room", async (t) => {
  const records = [],
    f = await setup(t, 4, { persist: (record) => records.push(record) });
  const queued = new FakePhone(f, f.identity.code);
  await queued.join();
  const watchers = await views(f),
    otherHost = await f.connect(),
    otherIdentity = await emit(otherHost, "host");
  const otherPhone = new FakePhone(f, otherIdentity.code);
  await otherPhone.join();
  const otherEnded = [];
  otherHost.on("ended", () => otherEnded.push(true));
  const clients = [
    f.host,
    ...f.phones.map((p) => p.socket),
    queued.socket,
    ...watchers,
  ];
  const events = clients.map(() => []);
  const disconnected = clients.map(
    (socket, index) =>
      new Promise((resolve) => {
        socket.on("ended", () => events[index].push("ended"));
        socket.once("disconnect", () => {
          events[index].push("disconnect");
          resolve();
        });
      }),
  );
  assert.deepEqual(await emit(f.host, "end-room", { confirmed: true }), {
    ok: true,
  });
  await Promise.all(disconnected);
  for (const sequence of events)
    assert.deepEqual(sequence, ["ended", "disconnect"]);
  assert.equal(f.party.rooms.has(f.identity.code), false);
  assert.equal(f.room.result.status, "no-contest");
  assert.equal(records.filter((record) => record.type === "round").length, 1);
  assert.equal(f.room.history.length, 1);
  const replacement = await f.connect();
  assert.ok(
    (
      await emit(replacement, "host", {
        code: f.identity.code,
        token: f.identity.token,
      })
    ).error,
  );
  assert.ok(
    (
      await emit(await f.connect(), "join", {
        code: f.identity.code,
        token: f.phones[0].identity.token,
      })
    ).error,
  );
  assert.ok(
    (
      await emit(await f.connect(), "display", {
        code: f.identity.code,
        token: f.identity.displayToken,
      })
    ).error,
  );
  assert.equal(f.party.rooms.has(otherIdentity.code), true);
  assert.equal(otherHost.connected, true);
  assert.equal(otherPhone.socket.connected, true);
  assert.deepEqual(otherEnded, []);
  await flush(otherHost);
});

test("a superseded host socket cannot shut down the reclaimed room", async (t) => {
  const f = await setup(t),
    original = f.io.of("/party").sockets.get(f.host.id),
    handler = original.listeners("end-room")[0];
  const host = await f.connect();
  await emit(host, "host", { code: f.identity.code, token: f.identity.token });
  const answer = await new Promise((resolve) =>
    handler({ confirmed: true }, resolve),
  );
  assert.match(answer.error, /Only the main screen/);
  assert.equal(f.party.rooms.has(f.identity.code), true);
  assert.equal(host.connected, true);
});

test("ordinary host-loss expiry retains its grace period and uses the same final cleanup", async (t) => {
  const records = [],
    f = await setup(t, 2, { persist: (record) => records.push(record) });
  await views(f);
  const ended = new Promise((resolve) =>
    f.phones[0].socket.once("ended", resolve),
  );
  f.host.disconnect();
  await f.advance(10);
  await f.advance(119999);
  assert.equal(f.party.rooms.has(f.identity.code), true);
  await f.advance(2);
  await ended;
  assert.equal(f.party.rooms.has(f.identity.code), false);
  assert.equal(f.room.result.status, "no-contest");
  assert.equal(records.filter((record) => record.type === "round").length, 1);
});
