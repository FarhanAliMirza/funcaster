import test from "node:test";
import assert from "node:assert/strict";
import { FruitNinja, FRUIT_TYPES } from "./logic.js";
function board(variant) {
  const g = new FruitNinja({ rng: () => 0.5 });
  g.configure({ variant, seats: 4 });
  g.start(0);
  return g;
}
test("co-op scales spawn rate, shares misses and stops on a bomb", () => {
  const g = board("co-op"),
    b = board("battle");
  assert.ok(g.spawnInterval(500) < b.spawnInterval(500));
  for (let i = 0; i < 3; i++)
    g.fruits.push({
      x: 100,
      y: -8,
      r: 0.5,
      vx: 0,
      vy: 0,
      rot: 0,
      spin: 0,
      bomb: false,
    });
  g.update(100, 1 / 120);
  assert.equal(g.state.phase, "over");
  assert.equal(g.state.lives, 0);
  const h = board("co-op");
  h.fruits.push({
    x: 0,
    y: 0,
    r: 0.5,
    vx: 0,
    vy: 0,
    rot: 0,
    spin: 0,
    bomb: true,
  });
  h.setCursor(-1, 0, 10, 0);
  h.setCursor(1, 0, 20, 0);
  h.update(20, 1 / 120);
  assert.equal(h.state.phase, "over");
  assert.equal(h.getPlayer(0).stats.bombs, 1);
});
test("battle penalties keep the board alive and countdown has no misses", () => {
  const g = board("battle");
  g.start(3000);
  g.fruits.push({
    x: 100,
    y: -8,
    r: 0.5,
    vx: 0,
    vy: 0,
    rot: 0,
    spin: 0,
    bomb: false,
  });
  g.update(2000, 1 / 120);
  assert.equal(g.fruits.length, 1);
  g.update(3001, 1 / 120);
  assert.equal(g.state.lives, 3);
  assert.equal(g.state.phase, "playing");
});
