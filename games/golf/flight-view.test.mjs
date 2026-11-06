import test from "node:test";
import assert from "node:assert/strict";
import { FlightView } from "./flight-view.js";
import { Hole, terrainHeight } from "./logic.js";
test("a 300ms-late stroke fast-forwards to the same ball as the authority without changing the event", () => {
  const e = {
    clock: 1000,
    ball: { x: 0, y: terrainHeight(0, 0), z: 0, vx: 0, vy: 0, vz: 0 },
    pin: { x: 5, z: -200 },
    wind: { x: 0.7, z: -0.2 },
    aim: -0.1,
    power: 0.8,
  };
  const original = structuredClone(e),
    h = new Hole({ pin: e.pin, wind: e.wind });
  h.ball = { ...e.ball };
  h.aimOffset = e.aim;
  h.strike(e.power);
  const view = new FlightView(e);
  for (let i = 1; i <= 120; i++) h.update((i * 1000) / 120, 1 / 120);
  view.sample(1300);
  const actual = view.sample(2000);
  assert.ok(
    Math.hypot(actual.x - h.ball.x, actual.y - h.ball.y, actual.z - h.ball.z) <
      1e-8,
  );
  assert.deepEqual(e, original);
});
