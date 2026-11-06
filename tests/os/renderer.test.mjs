import test from "node:test";
import assert from "node:assert/strict";
import { PartyRenderer } from "../../public/party/render.js";
import { SINGLE_VIEW_PIXELS } from "../../core/pixel-budget.js";

test("arena art, stroke and combo units scale together while canvas backing stays bounded", (t) => {
  for (const [key, value] of Object.entries({
    devicePixelRatio: 2,
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: () => 0,
    ResizeObserver: class {
      observe() {}
    },
  })) {
    const previous = globalThis[key];
    globalThis[key] = value;
    t.after(() => {
      if (previous === undefined) delete globalThis[key];
      else globalThis[key] = previous;
    });
  }
  const calls = [],
    context = new Proxy(
      {},
      {
        get(target, key) {
          return key in target
            ? target[key]
            : (...args) => calls.push([key, ...args]);
        },
      },
    );
  let box = { width: 1280, height: 720 };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    getBoundingClientRect: () => box,
  };
  const renderer = new PartyRenderer(canvas);
  const players = Array.from({ length: 4 }, (_, slot) => ({
    slot,
    x: 0.5,
    y: 0.5,
    combo: 4,
    pulse: 0,
    hit: 0,
    feedback: 0,
    objects: [{ id: 1, kind: "hazard", x: 0.3, y: 0.3, radius: 0.05, age: 1 }],
  }));
  for (const [width, height] of [
    [1280, 720],
    [3840, 2160],
    [960, 1006],
  ]) {
    box = { width, height };
    renderer.resize();
    assert.ok(canvas.width * canvas.height <= SINGLE_VIEW_PIXELS);
    for (const game of ["star-catch", "bubble-burst", "neon-drift"]) {
      renderer.setFrame({ game, players });
      calls.length = 0;
      renderer.animate(1000);
      assert.deepEqual(
        calls.find(([name]) => name === "scale"),
        ["scale", height / 720, height / 720],
      );
      assert.ok(calls.filter(([name]) => name === "fillText").length === 4);
      assert.equal(
        calls.filter(([name]) => name === "save").length,
        calls.filter(([name]) => name === "restore").length,
      );
      assert.ok(
        calls
          .flat(2)
          .filter((arg) => typeof arg === "number")
          .every(Number.isFinite),
      );
    }
  }
  box = { width: 1280, height: 720 };
  renderer.resize();
  renderer.setInsets({ top: 120, bottom: 100 });
  calls.length = 0;
  renderer.animate(1600);
  assert.ok(
    calls.some(([name, x, y]) => name === "translate" && x === 0 && y === 120),
  );
  assert.ok(
    calls.some(([name, x, y, w, h]) => name === "rect" && y === 0 && h === 500),
    "Gameplay is clipped between the measured HUD and footer",
  );
  box = { width: 0, height: 0 };
  renderer.resize();
  calls.length = 0;
  renderer.animate(2000);
  assert.ok(!calls.some(([name]) => name === "scale"));
  renderer.running = false;
});
