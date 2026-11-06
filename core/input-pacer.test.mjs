import test from "node:test";
import assert from "node:assert/strict";
import { InputPacer } from "./input-pacer.js";
test("idle heartbeat stays under stale-input cutoff without streaming at full rate", () => {
  const p = new InputPacer();
  assert.ok(p.sample({ x: 0, y: 0 }, 0));
  assert.equal(p.sample({ x: 0, y: 0 }, 100), null);
  assert.equal(p.sample({ x: 0, y: 0 }, 200).seq, 2);
  assert.ok(p.sample({ x: 0.4, y: 0 }, 230));
});
test("a busy transport never queues obsolete inputs", () => {
  const p = new InputPacer();
  assert.equal(p.sample({ x: 0.9, y: 0 }, 0, { writable: false }), null);
  assert.equal(p.sample({ x: -0.2, y: 0 }, 100).x, -0.2);
});

test("pedal release bypasses pacing so a brake or accelerator cannot linger", () => {
  const p = new InputPacer();
  p.sample({ x: 0, y: 0, gas: true }, 0, { latency: 300 });
  assert.equal(
    p.sample({ x: 0, y: 0, gas: false }, 1, { latency: 300 }).gas,
    false,
  );
});

test("a brief boost survives transport backpressure exactly once", () => {
  const p = new InputPacer();
  p.sample({ x: 0, y: 0, boost: false }, 0);
  p.sample({ x: 0, y: 0, boost: true }, 50, { writable: false });
  p.sample({ x: 0, y: 0, boost: false }, 250, { writable: false });
  assert.equal(p.sample({ x: 0.3, y: 0, boost: false }, 300).boost, true);
  assert.equal(p.sample({ x: 0.3, y: 0, boost: false }, 301).boost, false);
});
