import test from "node:test";
import assert from "node:assert/strict";
import { computeScale } from "./scale.js";
test("shell is 1x at HD, 1.5x at Full HD, and preserves design viewport", () => {
  for (const [w, h, ui] of [
    [1280, 720, 1],
    [1920, 1080, 1.5],
    [2560, 1440, 2],
    [3840, 2160, 3],
    [2560, 1080, 1.5],
    [1024, 768, 0.9],
    [1280, 600, 0.9],
    [960, 1006, 0.9],
    [1366, 768, 768 / 720],
  ]) {
    const s = computeScale(w, h);
    assert.equal(s.ui, ui);
    assert.equal(s.designWidth, w / ui);
    assert.equal(s.designHeight, h / ui);
    assert.equal(s.work.h, h - 42 * ui);
  }
});
test("scale clamps, overscan and integer art scale are bounded", () => {
  assert.equal(computeScale(320, 568).ui, 0.9);
  assert.equal(computeScale(10000, 10000, { tvScale: 2 }).ui, 4);
  assert.equal(computeScale(1920, 1080, { tvScale: 1.25 }).ui, 1.875);
  assert.equal(computeScale(1280, 720, { tvScale: "bogus" }).ui, 1);
  const s = computeScale(1280, 720, { safeArea: 5, dpr: 2 });
  assert.deepEqual(s.work, { x: 64, y: 36, w: 1152, h: 606 });
  assert.equal(s.pixelScale, 1);
  for (const value of Object.values(computeScale(0, 0)).filter(
    (x) => typeof x === "number",
  ))
    assert.ok(Number.isFinite(value));
});
