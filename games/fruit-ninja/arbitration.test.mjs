import test from "node:test";
import assert from "node:assert/strict";
import { FruitNinja } from "./logic.js";
function round() {
  const game = new FruitNinja({ rng: () => 0.99, infiniteLives: true });
  game.start(0);
  game.state.nextSpawn = Infinity;
  return game;
}
function fruit(game, serial = 0) {
  game.spawn(false, 0);
  Object.assign(game.fruits.at(-1), {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 0.7,
    sliceOrder: serial,
  });
}
function cut(game, slot, t) {
  game.setCursor(-2, 0, t - 15, slot);
  game.setCursor(2, 0, t, slot);
}
test("earlier blade sample wins regardless of seat insertion order", () => {
  for (const order of [
    [0, 1],
    [1, 0],
  ]) {
    const game = round();
    fruit(game);
    for (const slot of order) cut(game, slot, slot === 1 ? 20 : 30);
    game.update(30, 1 / 120);
    assert.ok(game.getPlayer(1).score > 0);
    assert.equal(game.getPlayer(0).score, 0);
  }
});
test("equal-time hits rotate by round-local fruit order, independent of other games", () => {
  for (let serial = 0; serial < 4; serial++) {
    const unrelated = round();
    unrelated.spawn(false, 0);
    const game = round();
    fruit(game, serial);
    for (const slot of [3, 2, 1, 0]) cut(game, slot, 20);
    game.update(20, 1 / 120);
    for (let slot = 0; slot < 4; slot++)
      assert.equal(game.getPlayer(slot).score > 0, slot === serial);
  }
});
