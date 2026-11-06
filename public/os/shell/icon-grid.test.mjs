import test from "node:test";
import assert from "node:assert/strict";
import { desktopLayout } from "./icon-grid.js";
test("the desktop grid fits the supported design viewport and paginates short windows", () => {
  for (const [w, h, ui] of [
    [1280, 678, 1],
    [640, 322.2, 0.9],
    [1024, 730.2, 0.9],
    [3840, 2034, 3],
  ]) {
    const grid = desktopLayout(w, h, ui);
    assert.ok(grid.rows * grid.cellHeight + 126 <= h / ui);
    assert.ok(grid.columns * grid.cellWidth + 32 <= w / ui);
    assert.ok(grid.pages * grid.capacity >= 13);
  }
  assert.equal(desktopLayout(1280, 678).pages, 1);
  assert.ok(desktopLayout(640, 322.2, 0.9).pages > 1);
});
