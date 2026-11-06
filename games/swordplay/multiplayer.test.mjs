import test from "node:test";
import assert from "node:assert/strict";
import { Duel } from "./logic.js";
test("human opponent has a bounded strike window and separate guard", () => {
  const d = new Duel();
  d.start(0);
  d.setOpponent(1.2);
  assert.equal(d.humanOpponent, true);
  assert.equal(d.strikeOpponent(2000, 0.5), true);
  assert.equal(d.strikeOpponent(2050, 0.7), false);
  assert.equal(d.aiGuard, 1.2);
});

test("simultaneous human attacks resolve equally without first-seat advantage", () => {
  const d = new Duel();
  d.start(0);
  d.setOpponent(0);
  d.setBlade(0, false);
  d.humanStrike(0, 1000, 0);
  d.humanStrike(1, 1000, 0);
  d.update(1450, 1 / 120);
  assert.equal(d.player.points, 1);
  assert.equal(d.ai.points, 1);
  assert.equal(d.humanAttacks.length, 0);
});
