const test = require("node:test"),
  assert = require("node:assert/strict");
const { fixture, emit, FakePhone } = require("./harness.cjs");
async function setup(t, count = 2) {
  const f = await fixture(t, { arcade: true, remoteViews: true }),
    host = await f.connect(),
    identity = await emit(host, "host"),
    phones = [];
  let state;
  host.on("state", (value) => (state = value));
  for (let i = 0; i < count; i++) {
    const p = new FakePhone(f, identity.code);
    await p.join();
    p.ready();
    await emit(p.socket, "ping-check");
    phones.push(p);
  }
  await emit(host, "ping-check");
  return {
    ...f,
    host,
    identity,
    phones,
    room: f.party.rooms.get(identity.code),
    state: () => state,
  };
}
async function remove(f, slot = 0) {
  const reply = await emit(f.host, "host.cmd", {
    seq: 1,
    cmd: "remove",
    args: { slot, confirmed: true },
  });
  assert.equal(reply.ok, true);
  return f.state().removedPlayers.find((p) => p.slot === slot);
}

test("only the TV receives safe removed-player handles and creation time", async (t) => {
  const f = await setup(t);
  let phoneState, displayState;
  f.phones[1].socket.on("state", (value) => (phoneState = value));
  const display = await f.connect();
  display.on("state", (value) => (displayState = value));
  await emit(display, "display", {
    code: f.identity.code,
    token: f.identity.displayToken,
  });
  const removed = await remove(f);
  await emit(display, "ping-check");
  await emit(f.phones[1].socket, "ping-check");
  assert.equal(f.state().createdAt, f.room.created);
  assert.deepEqual(Object.keys(removed).sort(), [
    "expiresAt",
    "name",
    "restoreId",
    "slot",
  ]);
  assert.match(removed.restoreId, /^[A-Za-z0-9_-]{32}$/);
  assert.notEqual(removed.restoreId, f.phones[0].identity.token);
  assert.equal(removed.expiresAt, f.room.created + 600000);
  assert.equal(removed.name, "Peeli");
  for (const state of [phoneState, displayState]) {
    assert.equal(state.removedPlayers, undefined);
    assert.equal(state.createdAt, undefined);
    assert.ok(!JSON.stringify(state).includes(removed.restoreId));
  }
  const denied = await f.connect();
  assert.match(
    (
      await emit(denied, "join", {
        code: f.identity.code,
        token: f.phones[0].identity.token,
      })
    ).error,
    /removed/,
  );
});

test("restore requires owner membership, exact confirmation, and cannot be delegated", async (t) => {
  const f = await setup(t, 4);
  await emit(f.host, "arcade.configure", { mode: "party", pin: "123456" });
  await emit(f.host, "host.assign", { slot: 1 });
  await emit(f.phones[2].socket, "staff.unlock", { pin: "123456" });
  const waiting = new FakePhone(f, f.identity.code);
  await waiting.join();
  const outsider = await f.connect(),
    display = await f.connect();
  await emit(display, "display", {
    code: f.identity.code,
    token: f.identity.displayToken,
  });
  const entry = await remove(f),
    payload = { restoreId: entry.restoreId, confirmed: true };
  for (const socket of [
    f.phones[1].socket,
    f.phones[2].socket,
    f.phones[3].socket,
    waiting.socket,
    outsider,
    display,
  ])
    assert.match(
      (await emit(socket, "restore-player", payload)).error,
      /Only the main screen/,
    );
  for (const data of [
    null,
    [],
    {},
    { restoreId: entry.restoreId },
    { ...payload, confirmed: false },
    { ...payload, token: "extra" },
    { ...payload, restoreId: "bad" },
  ])
    assert.match((await emit(f.host, "restore-player", data)).error, /Confirm/);
  assert.ok(
    (
      await emit(f.phones[1].socket, "host.cmd", {
        seq: 1,
        cmd: "restore-player",
        args: payload,
      })
    ).error,
  );
  assert.equal(f.room.arcade.bans.size, 1);
});

test("restore removes only the ban, preserves occupied seats/outcomes and allows a fresh join", async (t) => {
  const f = await setup(t);
  f.room.active = [0, 1];
  f.room.outcomes = {};
  const entry = await remove(f),
    outcome = f.room.outcomes[0];
  const replacement = new FakePhone(f, f.identity.code);
  await replacement.join();
  const occupant = f.room.players[0];
  assert.equal(
    (
      await emit(f.host, "restore-player", {
        restoreId: entry.restoreId,
        confirmed: true,
      })
    ).ok,
    true,
  );
  assert.equal(f.room.arcade.bans.has(f.phones[0].identity.token), false);
  assert.equal(f.room.players[0], occupant);
  assert.equal(f.room.outcomes[0], outcome);
  assert.equal(f.state().removedPlayers.length, 0);
  const back = await f.connect(),
    answer = await emit(back, "join", {
      code: f.identity.code,
      token: f.phones[0].identity.token,
    });
  assert.ok(!answer.error);
  assert.notEqual(answer.slot, 0);
  assert.notEqual(answer.token, f.phones[0].identity.token);
  assert.ok(
    (
      await emit(f.host, "restore-player", {
        restoreId: entry.restoreId,
        confirmed: true,
      })
    ).error,
  );
});

test("restore handles are room scoped and expire with the ten-minute timeout", async (t) => {
  const f = await setup(t),
    entry = await remove(f),
    other = await f.connect();
  await emit(other, "host");
  assert.ok(
    (
      await emit(other, "restore-player", {
        restoreId: entry.restoreId,
        confirmed: true,
      })
    ).error,
  );
  await f.advance(600001);
  assert.equal(f.room.arcade.removed.size, 0);
  assert.equal(f.room.arcade.bans.size, 0);
  assert.ok(
    (
      await emit(f.host, "restore-player", {
        restoreId: entry.restoreId,
        confirmed: true,
      })
    ).error,
  );
});

test("a replaced TV's captured handler cannot restore a removal", async (t) => {
  const f = await setup(t),
    entry = await remove(f),
    old = f.io
      .of("/party")
      .sockets.get(f.host.id)
      .listeners("restore-player")[0],
    replacement = await f.connect();
  await emit(replacement, "host", {
    code: f.identity.code,
    token: f.identity.token,
  });
  let answer;
  old(
    { restoreId: entry.restoreId, confirmed: true },
    (value) => (answer = value),
  );
  assert.match(answer.error, /Only the main screen/);
  assert.equal(f.room.arcade.bans.size, 1);
});
