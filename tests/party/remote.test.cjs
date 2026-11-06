const test = require("node:test"),
  assert = require("node:assert/strict");
const { fixture, emit, FakePhone, wait } = require("./harness.cjs");
async function setup(t) {
  const f = await fixture(t, { arcade: true, remoteViews: true });
  const host = await f.connect(),
    h = await emit(host, "host");
  await emit(host, "remote.configure", { enabled: true });
  const display = await f.connect(),
    d = await emit(display, "display", { code: h.code, token: h.displayToken });
  const phones = [];
  for (let i = 0; i < 2; i++) {
    const p = new FakePhone(f, h.code);
    await p.join();
    p.ready();
    phones.push(p);
  }
  await f.advance(10);
  await emit(host, "assign-seat", { slot: 1, ref: d.ref });
  await emit(display, "display.ready", { ready: true });
  return { ...f, host, h, display, d, phones, room: f.party.rooms.get(h.code) };
}
test("pairing is scoped, capacity bounded and grants contain no owner credential", async (t) => {
  const f = await setup(t);
  assert.ok(f.d.ref);
  assert.ok(f.d.resumeKey);
  assert.ok(!JSON.stringify(f.party.view(f.room)).includes(f.h.token));
  assert.ok(
    (await emit(f.phones[0].socket, "assign-seat", { slot: 0, ref: f.d.ref }))
      .error,
  );
  assert.ok(
    (await emit(f.host, "assign-seat", { slot: 0, ref: f.d.ref })).error,
  );
  assert.ok(
    (await emit(f.host, "assign-seat", { slot: 0, ref: "foreign-room" })).error,
  );
});
test("independent views gate start, scope scores and recover without restarting", async (t) => {
  const f = await setup(t);
  f.host.emit("select", { game: "shooting-range" });
  await f.advance(10);
  const pending = new Promise((r) => f.display.once("view-offer", r));
  f.host.emit("start");
  const offer = await pending;
  assert.equal(f.room.endsAt, 0);
  assert.equal(offer.slot, 1);
  assert.ok(!JSON.stringify(f.party.view(f.room)).includes(offer.token));
  assert.equal(
    (await emit(f.display, "view-accept", { roundId: f.room.roundId })).ok,
    true,
  );
  const denied = await f.connect();
  assert.ok(
    (
      await emit(denied, "screen", {
        code: f.h.code,
        token: f.h.token,
        game: f.room.game,
        roundId: f.room.roundId,
        view: 1,
      })
    ).error,
  );
  const local = await f.connect();
  let count = 0;
  local.on("presence", () => count++);
  await emit(local, "screen", {
    code: f.h.code,
    token: f.h.token,
    game: f.room.game,
    roundId: f.room.roundId,
    view: 0,
  });
  assert.equal(count, 0);
  const player = await f.connect();
  const registration = {
    code: f.h.code,
    viewToken: offer.token,
    game: f.room.game,
    roundId: f.room.roundId,
    view: 0,
    fresh: true,
  };
  assert.equal((await emit(player, "screen", registration)).ok, true);
  await f.advance(10);
  assert.ok(f.room.endsAt > 0);
  assert.ok(count > 0);
  assert.equal(
    f.room.screens.get(1),
    player.id,
    "view comes from grant, not forged payload",
  );
  assert.ok((await emit(player, "host.cmd", { seq: 1, cmd: "lobby" })).error);
  player.disconnect();
  await wait(10);
  await f.advance(2000);
  const fresh = await f.connect();
  assert.ok((await emit(fresh, "screen", registration)).error);
  const recovered = await f.connect();
  assert.equal(
    (await emit(recovered, "screen", { ...registration, fresh: false })).ok,
    true,
  );
  await emit(local, "match.finish", { scores: [{ slot: 0, score: 12 }] });
  await emit(recovered, "match.finish", { scores: [{ slot: 0, score: 34 }] });
  assert.deepEqual(
    f.room.result.scores.map((p) => [p.slot, p.score]),
    [
      [1, 34],
      [0, 12],
    ],
  );
  assert.equal(f.room.result.views[0].source, "remote");
  const expired = await f.connect();
  assert.ok(
    (await emit(expired, "screen", { ...registration, fresh: false })).error,
  );
});
test("screen build mismatch cannot pair; Kiosk disables remote grants", async (t) => {
  const f = await setup(t);
  await emit(f.host, "arcade.configure", { pin: "824916", mode: "kiosk" });
  assert.equal(f.room.remote.enabled, false);
  assert.equal(f.room.remote.seats.size, 0);
  assert.ok((await emit(f.host, "remote.configure", { enabled: true })).error);
});
test("remote loss forfeits after ten seconds and does not spawn a replacement run", async (t) => {
  const f = await setup(t);
  f.host.emit("select", { game: "shooting-range" });
  await f.advance(10);
  const pending = new Promise((r) => f.display.once("view-offer", r));
  f.host.emit("start");
  const offer = await pending;
  await emit(f.display, "view-accept", { roundId: f.room.roundId });
  const local = await f.connect(),
    remote = await f.connect();
  await emit(local, "screen", {
    code: f.h.code,
    token: f.h.token,
    game: f.room.game,
    roundId: f.room.roundId,
    view: 0,
  });
  await emit(remote, "screen", {
    code: f.h.code,
    viewToken: offer.token,
    game: f.room.game,
    roundId: f.room.roundId,
    view: 1,
  });
  remote.disconnect();
  await wait(10);
  await f.advance(10001);
  assert.equal(f.room.outcomes[1], "forfeit");
  assert.equal(f.room.remote.views.get(1).state, "lost");
  assert.equal(f.room.phase, "results");
});

test("invalid screen links cannot consume or replace a phone seat", async (t) => {
  const f = await setup(t),
    bad = await f.connect();
  const original = f.room.players[0].socket;
  assert.ok(
    (await emit(bad, "join", { code: f.h.code, screen: "missing" })).error,
  );
  assert.equal(f.room.players.filter(Boolean).length, 2);
  assert.ok(
    (
      await emit(bad, "join", {
        code: f.h.code,
        screen: "missing",
        token: f.room.players[0].token,
      })
    ).error,
  );
  assert.equal(f.room.players[0].socket, original);
  assert.equal(f.phones[0].socket.connected, true);
});
test("leaving clears screen binding so the next player can use that screen", async (t) => {
  const f = await setup(t);
  f.phones[1].socket.emit("leave");
  await f.advance(50);
  assert.equal(f.room.remote.seats.has(1), false);
  const p = await f.connect();
  assert.equal(
    (await emit(p, "join", { code: f.h.code, screen: f.d.ref })).slot,
    1,
  );
});
