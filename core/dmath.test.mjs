import test from "node:test";
import assert from "node:assert/strict";
import * as d from "./dmath.js";
test("deterministic functions agree with native values within the racing domain", () => {
  for (let i = -1000; i <= 1000; i++) {
    const x = i / 10;
    assert.ok(Math.abs(d.sin(x) - Math.sin(x)) < 1e-12);
    assert.ok(Math.abs(d.cos(x) - Math.cos(x)) < 1e-12);
    assert.ok(Math.abs(d.atan2(x, 37) - Math.atan2(x, 37)) < 1e-12);
    assert.ok(Math.abs(d.atan2(x, -37) - Math.atan2(x, -37)) < 1e-12);
    const y = i / 100;
    assert.ok(Math.abs(d.exp(y) - Math.exp(y)) / Math.exp(y) < 1e-12);
  }
  assert.equal(d.hypot(3, 4), 5);
  assert.equal(d.atan2(0, -1), Math.PI);
  assert.equal(d.atan2(-0, -1), -Math.PI);
});
