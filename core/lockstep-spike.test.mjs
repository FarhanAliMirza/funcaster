import test from "node:test";
import assert from "node:assert/strict";
import { InputSequencer, FrameBuffer, raceHash } from "./lockstep-spike.js";
import { Race } from "../games/mario-kart/logic.js";
test("two races catch up hash-equal after reordered and duplicated sequenced frames, without skipping missing ticks", () => {
  const q = new InputSequencer(),
    a = new FrameBuffer(),
    b = new FrameBuffer(),
    one = new Race({
      seed: 22,
      laps: 1,
      cpuCount: 0,
      humans: [
        { seat: 0, character: "mario" },
        { seat: 1, character: "luigi" },
      ],
    }),
    two = new Race({
      seed: 22,
      laps: 1,
      cpuCount: 0,
      humans: [
        { seat: 0, character: "mario" },
        { seat: 1, character: "luigi" },
      ],
    });
  one.start();
  two.start();
  const step = (r) => (f) => {
    r.stepPlayers(1 / 120, f.players);
    r.stepPlayers(1 / 120, f.players);
  };
  let batch = [];
  for (let i = 0; i < 10000; i++) {
    const f = q.next((i * 1000) / 60);
    a.receive(f);
    a.advance(step(one));
    batch.push(f);
    if (batch.length === 7) {
      for (const x of batch.reverse()) {
        b.receive(x);
        b.receive(x);
      }
      b.advance(step(two));
      batch = [];
    }
  }
  for (const f of batch) b.receive(f);
  while (b.tick < a.tick) b.advance(step(two));
  assert.equal(a.tick, 10000);
  assert.equal(raceHash(one), raceHash(two));
  assert.equal(b.receive({ tick: 999999, players: {} }), false);
});
test("stale phone input becomes autopilot and buffered frames cannot alias later input", () => {
  const q = new InputSequencer();
  q.input(0, { gas: true, steer: 0.3 }, 0);
  const f = q.next(1);
  q.input(0, { gas: false }, 20);
  assert.equal(f.players[0].gas, true);
  assert.equal(q.next(700).players[0].autopilot, true);
  assert.equal(f.applyAt, 6);
});
