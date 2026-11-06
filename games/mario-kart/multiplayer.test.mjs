import test from "node:test";
import assert from "node:assert/strict";
import { Race, CHARACTERS } from "./logic.js";
const humans = (n) =>
  Array.from({ length: n }, (_, seat) => ({
    seat,
    character: CHARACTERS[seat].id,
  }));
test("racing defaults to humans only for two through four players, preserving solo CPUs", () => {
  assert.equal(new Race().racers.length, 8);
  for (const n of [2, 3, 4]) {
    const r = new Race({ humans: humans(n) });
    assert.equal(r.racers.length, n);
    assert.equal(r.humans.length, n);
    assert.equal(
      new Race({ humans: humans(n), cpuCount: 20 }).racers.length,
      8,
    );
  }
  assert.throws(() => new Race({ humans: [{ seat: 1 }, { seat: 1 }] }));
});
test("independent human inputs, boost supplies and reconnect autopilot", () => {
  const r = new Race({ humans: [{ seat: 0 }, { seat: 3 }], laps: 1 });
  r.state = "racing";
  const a = r.racerOf(0),
    b = r.racerOf(3),
    initialB = b.progress;
  for (let i = 0; i < 60; i++)
    r.updatePlayers(1 / 60, { 0: { gas: true, nitro: i === 0 }, 3: {} });
  assert.ok(a.speed > 10);
  assert.ok(Math.abs(b.progress - initialB) < 0.2);
  assert.equal(a.nitroRemaining, 2);
  assert.equal(b.nitroRemaining, 3);
  for (let i = 0; i < 60; i++)
    r.updatePlayers(1 / 60, { 0: { brake: true }, 3: { autopilot: true } });
  assert.ok(b.speed > 10);
  const before = b.speed;
  for (let i = 0; i < 30; i++) r.updatePlayers(1 / 60, { 3: { brake: true } });
  assert.ok(b.speed < before);
  assert.equal(r.racers.length, 2);
});
test("one finisher cannot end another human's race", () => {
  const r = new Race({ humans: humans(2) });
  r.state = "racing";
  r.humans[0].finishTime = 10;
  r.updatePlayers(1 / 60, {});
  assert.equal(r.state, "racing");
  r.humans[1].finishTime = 11;
  r.updatePlayers(1 / 60, {});
  assert.equal(r.state, "results");
});
