import test from "node:test";
import assert from "node:assert/strict";
import { viewports } from "./viewports.js";
import { renderScale, drawIsotropic } from "./render-scale.js";

test("camera partitions cover odd-sized, portrait and hidden surfaces without overlap or NaN", () => {
  for (const [width, height] of [
    [1001, 701],
    [960, 1006],
    [3840, 2160],
    [0, 0],
  ])
    for (const count of [1, 2, 3, 4]) {
      const views = viewports(count, width, height);
      assert.equal(
        views.reduce((sum, v) => sum + v.width * v.height, 0),
        width * height,
      );
      for (const [index, v] of views.entries()) {
        assert.ok(Object.values(v).every(Number.isFinite));
        assert.ok(
          v.x >= 0 &&
            v.y >= 0 &&
            v.x + v.width <= width &&
            v.y + v.height <= height,
        );
        for (const other of views.slice(index + 1))
          assert.ok(
            v.x + v.width <= other.x ||
              other.x + other.width <= v.x ||
              v.y + v.height <= other.y ||
              other.y + other.height <= v.y,
          );
      }
    }
  assert.equal(viewports(2, 960, 1006)[1].x, 0);
  assert.equal(viewports(2, 1200, 1000)[1].y, 0);
  assert.equal(viewports(3, 1000, 600)[0].width, 1000);
  assert.equal(viewports(3, 1000, 600, { threeLayout: "grid" })[0].width, 500);
});

test("canvas artwork grows with height and local normalised symbols stay isotropic", () => {
  assert.equal(renderScale(720), 1);
  assert.equal(renderScale(2160), 3);
  for (const height of [0, NaN, Infinity])
    assert.ok(Number.isFinite(renderScale(height)));
  for (const [w, h] of [
    [1920, 1080],
    [960, 1006],
    [1024, 768],
  ]) {
    const calls = [],
      ctx = {
        save: () => calls.push("save"),
        restore: () => calls.push("restore"),
        translate: (x, y) => calls.push([x, y]),
        scale: (x, y) => calls.push([x, y]),
      };
    drawIsotropic(ctx, w, h, 0.3, 0.4, () => calls.push("draw"));
    assert.deepEqual(calls[1], [0.3, 0.4]);
    assert.ok(Math.abs(calls[2][0] * w - calls[2][1] * h) < 1e-8);
    assert.deepEqual(calls.slice(-2), ["draw", "restore"]);
  }
});
