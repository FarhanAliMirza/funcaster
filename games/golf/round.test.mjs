import test from "node:test";
import assert from "node:assert/strict";
import { GolfRound } from "./round.js";
const players = [{ slot: 0 }, { slot: 2 }, { slot: 3 }];
test("golf accepts only the current player's shot and never double-hits a moving ball", () => {
  const r = new GolfRound({ players });
  assert.equal(r.strike(2, 0, 1), false);
  assert.equal(r.strike(0, 0, 0.8), true);
  assert.equal(r.strike(0, 0, 1), false);
  for (let i = 0; i < 3600 && r.turn === 0; i++) r.update(1 / 120);
  assert.equal(r.turn, 2);
  assert.equal(r.players[0].hole.strokes, 1);
  assert.equal(r.players[1].hole.strokes, 0);
});
test("golf resets each golfer per hole, caps strokes and produces a cumulative scorecard", () => {
  const r = new GolfRound({ players, holes: 3 });
  for (let hole = 0; hole < 3; hole++)
    for (const p of r.players) {
      r.turn = p.slot;
      p.hole.strokes = 7;
      r.strike(p.slot, 0, 0.12);
      p.hole.state = "flight";
      r.flightAt = r.time - 26;
      r.update(1 / 60);
    }
  assert.equal(r.phase, "results");
  assert.ok(r.players.every((p) => p.card.length === 3));
  assert.ok(r.players.every((p) => r.total(p) === 27));
});
test("a disconnected golfer gets a grace period and then a safe automatic shot", () => {
  const r = new GolfRound({ players });
  r.presence([
    { slot: 2, occupied: true },
    { slot: 3, occupied: true },
  ]);
  for (let i = 0; i < 29 * 60; i++) r.update(1 / 60);
  assert.equal(r.current.hole.strokes, 0);
  for (let i = 0; i < 2 * 60; i++) r.update(1 / 60);
  assert.ok(r.players[0].hole.strokes >= 1);
});

test("seeded CPU golfers take bounded turns without phone input", () => {
  const a = new GolfRound({
    players: [
      { slot: 4, ai: true },
      { slot: 5, ai: true },
    ],
    holes: 1,
    seed: 79,
  });
  const b = new GolfRound({
    players: [
      { slot: 4, ai: true },
      { slot: 5, ai: true },
    ],
    holes: 1,
    seed: 79,
  });
  a.presence([]);
  b.presence([]);
  for (let i = 0; i < 120 * 600 && a.phase !== "results"; i++) {
    a.update(1 / 120);
    b.update(1 / 120);
  }
  assert.equal(a.phase, "results");
  assert.deepEqual(
    a.players.map((p) => p.card),
    b.players.map((p) => p.card),
  );
  assert.ok(a.players.every((p) => p.card.length === 1 && p.card[0] <= 9));
});
