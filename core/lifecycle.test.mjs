import test from "node:test";
import assert from "node:assert/strict";
import { GameRuntime } from "../sdk/lifecycle.js";
function fixture() {
  let sum = 0,
    render = 0,
    delivered = 0,
    disposed = 0;
  const game = {
    init(ctx) {
      assert.ok(Object.isFrozen(ctx.setup));
    },
    step(dt, inputs) {
      sum += (inputs[0]?.x || 0) * dt;
    },
    render() {
      render++;
    },
    result() {
      return { scores: [{ slot: 0, score: sum }] };
    },
    dispose() {
      disposed++;
    },
  };
  const runtime = new GameRuntime(
    game,
    { seats: [0, 1], setup: { seed: 7 } },
    {
      onResult() {
        delivered++;
      },
    },
  );
  return {
    runtime,
    get stats() {
      return { sum, render, delivered, disposed };
    },
  };
}
test("SDK clocks are invariant across render rates; paused input does not advance the game", () => {
  const a = fixture(),
    b = fixture();
  for (const f of [a, b]) {
    f.runtime.start();
    f.runtime.input(0, { x: 1 });
    assert.equal(f.runtime.input(3, { x: 100 }), false);
  }
  for (let i = 0; i < 60; i++) a.runtime.advance(1 / 60);
  for (let i = 0; i < 30; i++) b.runtime.advance(1 / 30);
  assert.equal(a.stats.sum, b.stats.sum);
  a.runtime.pause();
  a.runtime.advance(1);
  assert.equal(a.stats.sum, b.stats.sum);
  a.runtime.pause(false);
  a.runtime.seat(0, "away");
  a.runtime.advance(1 / 60);
  assert.equal(a.stats.sum, b.stats.sum);
});
test("SDK sends exactly one immutable result and releases a game exactly once", () => {
  const f = fixture();
  f.runtime.start();
  f.runtime.input(0, { x: 2 });
  f.runtime.advance(0.1);
  const result = f.runtime.finish();
  assert.equal(f.runtime.finish(), result);
  assert.equal(f.stats.delivered, 1);
  assert.throws(() => {
    result.scores[0].score = 999;
  });
  f.runtime.advance(1);
  assert.equal(f.stats.sum, result.scores[0].score);
  f.runtime.dispose();
  f.runtime.dispose();
  f.runtime.advance(1);
  assert.equal(f.stats.disposed, 1);
});
