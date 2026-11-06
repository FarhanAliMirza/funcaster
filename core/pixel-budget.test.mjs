import test from "node:test";
import assert from "node:assert/strict";
import {
  dprFor,
  resizeCanvas,
  viewPixelBudget,
  SINGLE_VIEW_PIXELS,
  SPLIT_VIEW_PIXELS,
} from "./pixel-budget.js";

const screens = [
  [1280, 720],
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
  [2560, 1080],
  [1024, 768],
  [1280, 600],
  [960, 1006],
];
function device(t, value) {
  const previous = Object.getOwnPropertyDescriptor(
    globalThis,
    "devicePixelRatio",
  );
  t.after(() =>
    previous
      ? Object.defineProperty(globalThis, "devicePixelRatio", previous)
      : delete globalThis.devicePixelRatio,
  );
  globalThis.devicePixelRatio = value;
}

test("all nine screens stay within single and split budgets at low and high device densities", (t) => {
  device(t, 1);
  for (const density of [1, 1.25, 2, 3]) {
    globalThis.devicePixelRatio = density;
    for (const [w, h] of screens)
      for (const cap of [1.6, 2])
        for (const maxPixels of [SINGLE_VIEW_PIXELS, SPLIT_VIEW_PIXELS]) {
          const dpr = dprFor(w, h, { cap, maxPixels });
          assert.ok(dpr > 0 && dpr <= density && dpr <= cap);
          assert.ok(Math.floor(w * dpr) * Math.floor(h * dpr) <= maxPixels);
          // A limiting budget may downsample below 1; small screens retain native sharpness.
          if (w * h * Math.min(density, cap) ** 2 <= maxPixels)
            assert.equal(dpr, Math.min(density, cap));
          else assert.ok(Math.abs(w * h * dpr * dpr - maxPixels) < 1e-6);
        }
  }
  globalThis.devicePixelRatio = 2;
  assert.equal(dprFor(1280, 720), 2);
  assert.ok(dprFor(3840, 2160) < 1);
});

test("only a valid count of independent views selects the split budget", () => {
  for (const search of [
    "",
    "?view=3",
    "?views=1",
    "?views=0",
    "?views=5",
    "?views=2.5",
    "?views=NaN",
  ])
    assert.equal(viewPixelBudget(search), SINGLE_VIEW_PIXELS);
  for (const views of [2, 3, 4])
    assert.equal(
      viewPixelBudget(`?party=ABCDEF&view=0&views=${views}`),
      SPLIT_VIEW_PIXELS,
    );
});

test("hidden and malformed viewport sizes stay finite and recover; invalid budgets fail explicitly", (t) => {
  device(t, 2);
  for (const [w, h] of [
    [0, 0],
    [1280, 0],
    [0, 720],
    [-1, 5],
    [NaN, Infinity],
  ])
    assert.ok(Number.isFinite(dprFor(w, h)) && dprFor(w, h) > 0);
  for (const invalid of [undefined, NaN, 0, -1, Infinity]) {
    globalThis.devicePixelRatio = invalid;
    assert.equal(dprFor(1280, 720), 1);
  }
  for (const options of [
    { cap: 0 },
    { cap: NaN },
    { maxPixels: 0 },
    { maxPixels: Infinity },
  ])
    assert.throws(() => dprFor(1280, 720, options), RangeError);
});

test("a stable canvas allocates once, changes only needed dimensions and survives hide/restore", (t) => {
  device(t, 2);
  const size = { width: 300, height: 150 },
    writes = { width: 0, height: 0 };
  const canvas = {};
  for (const axis of ["width", "height"])
    Object.defineProperty(canvas, axis, {
      get: () => size[axis],
      set: (value) => {
        size[axis] = value;
        writes[axis]++;
      },
    });
  resizeCanvas(canvas, 1280, 720);
  assert.deepEqual(size, { width: 2560, height: 1440 });
  for (let frame = 0; frame < 120; frame++) resizeCanvas(canvas, 1280, 720);
  assert.deepEqual(
    writes,
    { width: 1, height: 1 },
    "unchanged frames must not clear or reallocate the context",
  );
  resizeCanvas(canvas, 1200, 720);
  assert.deepEqual(writes, { width: 2, height: 1 });
  resizeCanvas(canvas, 3840, 2160);
  assert.ok(canvas.width * canvas.height <= SINGLE_VIEW_PIXELS);
  resizeCanvas(canvas, 3840, 2160, { maxPixels: SPLIT_VIEW_PIXELS });
  assert.ok(canvas.width * canvas.height <= SPLIT_VIEW_PIXELS);
  resizeCanvas(canvas, 0, 0);
  assert.ok(canvas.width >= 1 && canvas.height >= 1);
  globalThis.devicePixelRatio = 1.25;
  resizeCanvas(canvas, 1280, 720);
  assert.deepEqual(size, { width: 1600, height: 900 });
  const stable = { ...writes };
  resizeCanvas(canvas, 1280, 720);
  assert.deepEqual(writes, stable);
});
