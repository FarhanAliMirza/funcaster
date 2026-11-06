import test from "node:test";
import assert from "node:assert/strict";
import { navigationScore, spatialNext, restoreTarget } from "./nav.js";
const rect = (x, y, w = 40, h = 40) => ({
  left: x,
  top: y,
  width: w,
  height: h,
  right: x + w,
  bottom: y + h,
});
const item = (id, x, y, w = 40, h = 40, group = null) => ({
  id,
  rect: rect(x, y, w, h),
  group,
});
test("spatial scoring prefers overlapping next rows and rejects the wrong half-plane", () => {
  const row = rect(0, 0, 200, 40);
  assert.equal(navigationScore(row, rect(0, 60, 200, 40), "down"), -60);
  assert.equal(navigationScore(row, rect(0, -60), "down"), Infinity);
  assert.equal(
    spatialNext(
      [
        item("wide", 0, 0, 200),
        item("left", 0, 60),
        item("right", 160, 60),
        item("far", 300, 60),
      ],
      "wide",
      "down",
    ),
    "left",
  );
});
test("grid navigation stays in row or column and wraps only when requested", () => {
  const rows = [
    item("a", 0, 0),
    item("b", 60, 0),
    item("c", 0, 60),
    item("d", 60, 60),
  ];
  assert.equal(spatialNext(rows, "a", "right", { grid: true }), "b");
  assert.equal(spatialNext(rows, "b", "right", { grid: true }), null);
  assert.equal(
    spatialNext(rows, "b", "right", { grid: true, wrap: true }),
    "a",
  );
  assert.equal(spatialNext(rows, "c", "down", { grid: true, wrap: true }), "a");
});
test("tab strips wrap, segmented rows fall through to spatial neighbours", () => {
  const rows = [
    item("a", 0, 0, 40, 40, "tabs"),
    item("b", 60, 0, 40, 40, "tabs"),
    item("c", 120, 0),
  ];
  assert.equal(
    spatialNext(rows, "b", "right", { group: "tabs", wrap: true }),
    "a",
  );
  assert.equal(spatialNext(rows, "b", "right", { group: "tabs" }), "c");
  assert.equal(spatialNext(rows, null, "down"), "a");
  assert.equal(spatialNext([], null, "down"), null);
});
test("focus return uses the opener only if it remains eligible", () => {
  const a = { hasAttribute: () => false },
    b = { hasAttribute: () => true },
    gone = {};
  assert.equal(restoreTarget(a, b, [a, b]), a);
  assert.equal(restoreTarget(gone, a, [a, b]), a);
  assert.equal(restoreTarget(gone, null, [a, b]), b);
  assert.equal(restoreTarget(gone, null, []), null);
});
