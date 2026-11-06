const test = require("node:test"),
  assert = require("node:assert/strict");
const { fixture, emit, FakePhone } = require("./harness.cjs");
async function setup(t, n = 2) {
  const f = await fixture(t, { arcade: true }),
    host = await f.connect(),
    r = await emit(host, "host"),
    phones = [];
  for (let i = 0; i < n; i++) {
    const phone = new FakePhone(f, r.code);
    await phone.join();
    phone.ready();
    phones.push(phone);
  }
  await f.advance(20);
  return { ...f, host, r, phones, room: f.party.rooms.get(r.code) };
}
test("a ready phone receives limited controls after TV consent window; owner credentials stay private", async (t) => {
  const f = await setup(t);
  assert.equal(f.room.arcade.hostToken, null);
  assert.equal(f.party.view(f.room).pendingHost.slot, 0);
  await f.advance(5001);
  assert.equal(f.party.view(f.room).hostSeat, 0);
  const [a, b] = f.phones;
  assert.ok(
    (
      await emit(b.socket, "host.cmd", {
        seq: 1,
        cmd: "select",
        args: { game: "bubble-burst" },
      })
    ).error,
  );
  a.socket.emit("select", { game: "bubble-burst" });
  await f.advance(20);
  assert.equal(
    f.room.game,
    "star-catch",
    "raw events cannot bypass the phone command gate",
  );
  const response = await emit(a.socket, "host.cmd", {
    seq: 1,
    cmd: "select",
    args: { game: "bubble-burst" },
  });
  assert.equal(response.ok, true);
  assert.equal(f.room.game, "bubble-burst");
  assert.deepEqual(
    await emit(a.socket, "host.cmd", {
      seq: 1,
      cmd: "select",
      args: { game: "neon-drift" },
    }),
    response,
  );
  assert.equal(f.room.game, "bubble-burst", "retry is idempotent");
  const visible = JSON.stringify(f.party.view(f.room));
  assert.ok(!visible.includes(f.r.token));
  assert.ok(!visible.includes(a.identity.token));
  assert.ok(
    (
      await emit(await f.connect(), "screen", {
        code: f.r.code,
        token: a.identity.token,
        game: "bubble-burst",
        roundId: 1,
      })
    ).error,
  );
  assert.equal((await emit(f.host, "host.assign", { slot: 1 })).ok, true);
  assert.ok((await emit(a.socket, "host.cmd", { seq: 2, cmd: "start" })).error);
  assert.equal(
    (await emit(b.socket, "host.cmd", { seq: 1, cmd: "start" })).ok,
    true,
  );
  assert.equal(f.room.phase, "practice");
});
test("TV veto cancels auto-grant; explicit leave revokes all grants", async (t) => {
  const f = await setup(t, 1);
  await emit(f.host, "host.assign", { slot: null });
  await f.advance(6000);
  assert.equal(f.room.arcade.hostToken, null);
  await emit(f.host, "host.assign", { slot: 0 });
  f.phones[0].socket.emit("leave");
  await f.advance(20);
  assert.equal(f.room.arcade.hostToken, null);
});
test("the fifth phone queues, reconnects in place, and is promoted without a rescan", async (t) => {
  const f = await setup(t, 4),
    waiting = new FakePhone(f, f.r.code);
  assert.equal((await waiting.join()).queued, true);
  const token = waiting.identity.token;
  waiting.disconnect();
  await f.advance(100);
  assert.equal((await waiting.join()).token, token);
  assert.equal(f.room.arcade.queue.length, 1);
  f.phones[1].socket.emit("leave");
  await f.advance(30);
  assert.equal(f.room.players[1].token, token);
  assert.equal(f.room.arcade.queue.length, 0);
  const visible = f.party.view(f.room);
  assert.equal(visible.players.length, 4);
  assert.ok(!JSON.stringify(visible).includes(token));
});
test("room locks reject new spectators but allow existing player recovery", async (t) => {
  const f = await setup(t, 1);
  await emit(f.host, "host.cmd", {
    seq: 1,
    cmd: "lock",
    args: { locked: true },
  });
  const p = new FakePhone(f, f.r.code);
  assert.ok((await p.join()).error);
  const own = f.phones[0];
  own.disconnect();
  await f.advance(20);
  assert.equal((await own.join()).slot, 0);
});
test("staff unlock is room-scoped, rate limited, and separately revocable", async (t) => {
  const f = await setup(t);
  assert.equal(
    (await emit(f.host, "arcade.configure", { pin: "735182", mode: "kiosk" }))
      .ok,
    true,
  );
  assert.equal(f.room.arcade.mode, "kiosk");
  const p = f.phones[1];
  assert.ok((await emit(p.socket, "host.cmd", { seq: 1, cmd: "pause" })).error);
  assert.ok(
    (await emit(p.socket, "staff.unlock", { pin: "735182suffix" })).error,
  );
  assert.equal(
    (await emit(p.socket, "staff.unlock", { pin: "735182" })).ok,
    true,
  );
  assert.equal(
    (
      await emit(p.socket, "host.cmd", {
        seq: 1,
        cmd: "lock",
        args: { locked: true },
      })
    ).ok,
    true,
  );
  p.socket.emit("staff.lock");
  await f.advance(20);
  assert.ok(
    (
      await emit(p.socket, "host.cmd", {
        seq: 2,
        cmd: "lock",
        args: { locked: false },
      })
    ).error,
  );
  for (let i = 0; i < 4; i++)
    await emit(p.socket, "staff.unlock", { pin: "111111" });
  assert.match(
    (await emit(p.socket, "staff.unlock", { pin: "735182" })).error,
    /minute/,
  );
  assert.equal(f.party.view(f.room).staffConfigured, true);
  assert.ok(!JSON.stringify(f.party.view(f.room)).includes("735182"));
});
test("kiosk waits ten seconds, then rotates the waiting visitor into the next game", async (t) => {
  const f = await setup(t, 4),
    next = new FakePhone(f, f.r.code);
  await next.join();
  await emit(f.host, "arcade.configure", { pin: "735182", mode: "kiosk" });
  await f.advance(20);
  assert.equal(f.room.phase, "lobby");
  assert.ok(f.room.arcade.countdown > 0);
  await f.advance(10001);
  assert.equal(f.room.phase, "practice");
  await f.advance(6001);
  await f.advance(3001);
  assert.equal(f.room.phase, "playing");
  await f.advance(60001);
  assert.equal(f.room.phase, "results");
  await f.advance(10001);
  assert.equal(f.room.phase, "lobby");
  assert.equal(f.room.game, "fruit-ninja");
  assert.equal(f.room.players[0].token, next.identity.token);
  assert.equal(f.room.arcade.queue.length, 1);
});
test("short drops recover; sustained drops forfeit without restarting the survivor", async (t) => {
  const f = await setup(t);
  f.host.emit("select", { game: "golf" });
  f.host.emit("start");
  await f.advance(20);
  const id = f.room.roundId;
  const p = f.phones[1];
  p.disconnect();
  await f.advance(15000);
  await p.join();
  p.ready();
  await f.advance(20);
  assert.equal(f.room.roundId, id);
  assert.equal(f.room.result, null);
  p.disconnect();
  await f.advance(20);
  await f.advance(30001);
  assert.equal(f.room.result.status, "completed");
  assert.equal(f.room.result.scores[1].outcome, "forfeit");
  assert.equal(f.room.result.scores[0].slot, 0);
});
test("host removal records no forfeiture and does not abandon a three-person round", async (t) => {
  const f = await setup(t, 3);
  f.host.emit("select", { game: "golf" });
  f.host.emit("start");
  await f.advance(20);
  f.host.emit("remove", { slot: 1 });
  await f.advance(20);
  assert.equal(f.room.phase, "classic");
  assert.equal(f.room.outcomes[1], "removed");
  assert.equal(f.room.result, null);
  const removed = new FakePhone(f, f.r.code);
  removed.identity = f.phones[1].identity;
  assert.ok((await removed.join()).error);
});

test("an away duel pauses during grace and forfeits after it, without switching to Solo", async (t) => {
  const f = await setup(t);
  f.host.emit("select", { game: "table-tennis" });
  await f.advance(10);
  f.host.emit("start");
  await f.advance(10);
  f.phones[1].socket.emit("away", { away: true });
  await f.advance(100);
  assert.equal(f.room.dropPaused, true);
  assert.equal(f.room.match.mode, "multiplayer");
  await f.advance(30001);
  assert.equal(f.room.phase, "results");
  assert.equal(f.room.result.scores.at(-1).outcome, "forfeit");
});
test("declining an active phone grant revokes it immediately", async (t) => {
  const f = await setup(t);
  await emit(f.host, "host.assign", { slot: 0 });
  f.phones[0].socket.emit("host.decline");
  await f.advance(10);
  assert.equal(f.room.arcade.hostToken, null);
  assert.ok(
    (await emit(f.phones[0].socket, "host.cmd", { seq: 1, cmd: "start" }))
      .error,
  );
});
