const test = require("node:test"),
  assert = require("node:assert/strict");
const { fixture, emit, FakePhone } = require("./harness.cjs");
async function results(t) {
  const f = await fixture(t, { arcade: true }),
    host = await f.connect(),
    identity = await emit(host, "host");
  const phone = new FakePhone(f, identity.code);
  await phone.join();
  phone.ready();
  await f.advance(20);
  await emit(host, "host.cmd", { seq: 1, cmd: "start" });
  await f.advance(6001);
  await f.advance(3001);
  await f.advance(60001);
  const room = f.party.rooms.get(identity.code);
  assert.equal(room.phase, "results");
  return { ...f, host, phone, identity, room };
}
test("focused OS results freeze only the current party countdown and release the remaining duration", async (t) => {
  const f = await results(t),
    roundId = f.room.roundId;
  await f.advance(2000);
  const held = await emit(f.host, "results-hold", { on: true, roundId });
  assert.equal(held.ok, true);
  assert.equal(held.on, true);
  assert.ok(held.remainingMs <= 10000 && held.remainingMs > 9000);
  assert.equal(f.room.endsAt, 0);
  await f.advance(20000);
  assert.equal(f.room.phase, "results");
  const view = f.party.view(f.room);
  assert.equal(view.resultsHeld, true);
  assert.equal(view.resultsRemainingMs, held.remainingMs);
  const repeated = await emit(f.host, "results-hold", { on: true, roundId });
  assert.equal(repeated.remainingMs, held.remainingMs);
  await emit(f.host, "results-hold", { on: false, roundId });
  await f.advance(held.remainingMs - 1);
  assert.equal(f.room.phase, "results");
  await f.advance(2);
  assert.equal(f.room.phase, "lobby");
  assert.equal(f.room.resultsHeld, false);
  assert.ok((await emit(f.host, "results-hold", { on: true, roundId })).error);
});
test("results holds reject phones, bad rounds and malformed payloads and release on host loss", async (t) => {
  const f = await results(t),
    roundId = f.room.roundId;
  await emit(f.host, "host.assign", { slot: 0 });
  const phoneAnswer = await emit(f.phone.socket, "host.cmd", {
    seq: 1,
    cmd: "results-hold",
    args: { on: true, roundId },
  });
  assert.ok(phoneAnswer.error);
  for (const payload of [
    { on: "yes", roundId },
    { on: true, roundId: roundId - 1 },
    { on: true },
  ])
    assert.ok((await emit(f.host, "results-hold", payload)).error);
  await emit(f.host, "results-hold", { on: true, roundId });
  f.host.disconnect();
  await f.advance(20);
  assert.equal(f.room.resultsHeld, false);
  assert.ok(f.room.endsAt > 0);
  const replacement = await f.connect();
  assert.equal(
    (await emit(replacement, "host", f.identity)).code,
    f.identity.code,
  );
  await f.advance(13000);
  assert.equal(f.room.phase, "lobby");
});
test("unmodified classic countdowns and kiosk results still auto-return", async (t) => {
  const f = await results(t);
  await f.advance(12001);
  assert.equal(f.room.phase, "lobby");
  // Kiosk never accepts an OS focus hold: its configured countdown stays untouched.
  f.room.phase = "results";
  f.room.endsAt = 190000;
  f.room.arcade.mode = "kiosk";
  const before = f.room.endsAt;
  const answer = await emit(f.host, "results-hold", {
    on: true,
    roundId: f.room.roundId,
  });
  assert.equal(answer.on, false);
  assert.equal(f.room.endsAt, before);
  assert.equal(f.room.resultsHeld, false);
});
