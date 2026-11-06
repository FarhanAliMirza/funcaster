import test from "node:test";
import assert from "node:assert/strict";
import { games } from "../../core/catalog.js";
import { ICON_CROP } from "./icon-crop.js";
test("all13 shipped games have square crops and retain original game identifiers", () => {
  assert.equal(games.length, 13);
  assert.deepEqual(
    Object.keys(ICON_CROP).sort(),
    games.map((g) => g.id).sort(),
  );
  for (const [id, [x, y, w, h]] of Object.entries(ICON_CROP)) {
    assert.ok([x, y, w, h].every(Number.isFinite), id);
    assert.equal(w, h);
    assert.ok(w >= 100 && x >= 0 && y >= 0 && x + w <= 320);
  }
});
