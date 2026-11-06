import test from "node:test";
import assert from "node:assert/strict";
import { GolfRound } from "./round.js";
test("honours use the previous hole, not the total", () => {
  const r = new GolfRound({ players: [{ slot: 0 }, { slot: 1 }] });
  r.players[0].card = [1, 5];
  r.players[1].card = [8, 3];
  r.beginHole();
  assert.equal(r.turn, 1);
});
test("an idle connected golfer gets a timed automatic shot", () => {
  const r = new GolfRound({
    players: [{ slot: 0 }, { slot: 1 }],
    turnSeconds: 10,
  });
  r.time = 11;
  r.step(1 / 120);
  assert.equal(r.current.hole.strokes, 1);
});
test("a repeated stroke sequence cannot hit the ball again", () => {
  const r = new GolfRound({ players: [{ slot: 0 }] });
  assert.equal(r.strike(0, 0, 0.4, 3), true);
  r.current.hole.state = "aim";
  assert.equal(r.strike(0, 0, 0.4, 3), false);
  assert.equal(r.current.hole.strokes, 1);
});
