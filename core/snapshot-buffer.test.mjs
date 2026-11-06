import test from "node:test";
import assert from "node:assert/strict";
import { SnapshotBuffer } from "./snapshot-buffer.js";
import { segmentCircleEntry } from "./trail.js";
test("snapshot interpolation preserves scores and wraps angles; stale peers freeze", () => {
  const b = new SnapshotBuffer(100);
  b.push({ clock: 0, state: { x: 0, score: 1, heading: 3.1 } }, 0);
  b.push({ clock: 100, state: { x: 10, score: 2, heading: -3.1 } }, 100);
  const s = b.sample(150);
  assert.equal(s.state.x, 5);
  assert.equal(s.state.score, 1);
  assert.ok(Math.abs(s.state.heading - Math.PI) < 0.05);
  assert.equal(b.sample(2000).state.x, 10);
  assert.equal(b.sample(2000).stale, true);
});
test("cut arbitration uses first circle entry, including tangents and stationary segments", () => {
  assert.equal(segmentCircleEntry(-2, 0, 2, 0, 1), 0.25);
  assert.equal(segmentCircleEntry(0, 0, 0, 0, 1), 0);
  assert.equal(segmentCircleEntry(-2, 2, 2, 2, 1), null);
  assert.equal(segmentCircleEntry(-2, 1, 2, 1, 1), 0.5);
});
