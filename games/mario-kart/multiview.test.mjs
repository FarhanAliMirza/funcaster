import test from "node:test";
import assert from "node:assert/strict";
import { ChaseCamera, RaceViews } from "./multiview.js";
import { Race } from "./logic.js";
import { viewports } from "../../core/viewports.js";
import {
  SINGLE_VIEW_PIXELS,
  SPLIT_VIEW_PIXELS,
} from "../../core/pixel-budget.js";

const finiteCamera = (camera) => {
  assert.ok(Number.isFinite(camera.aspect) && camera.aspect > 0);
  for (const matrix of [
    camera.projectionMatrix,
    camera.projectionMatrixInverse,
  ])
    assert.ok(
      matrix.elements.every(Number.isFinite),
      "camera matrix must stay finite",
    );
};

test("a chase camera survives a hidden frame and recovers its visible aspect", () => {
  const racer = new Race().player;
  const rig = new ChaseCamera();
  for (const [width, height] of [
    [0, 0],
    [1280, 0],
    [0, 720],
    [1280, 720],
  ]) {
    const camera = rig.update(racer, { width, height }, 1 / 60);
    finiteCamera(camera);
  }
  assert.equal(rig.camera.aspect, 16 / 9);
});

function mockScreen(t) {
  const node = () => ({
    children: [],
    style: {},
    append(child) {
      this.children.push(child);
    },
    querySelector(selector) {
      return this.children.find((child) =>
        child.className.split(" ").includes(selector.slice(1)),
      );
    },
    remove() {},
  });
  const previous = new Map(
    ["document", "innerWidth", "innerHeight", "devicePixelRatio"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  globalThis.document = { createElement: node, body: node() };
  const areas = [],
    cameras = [];
  let pixelRatio = 1;
  const renderer = {
    getPixelRatio: () => pixelRatio,
    setPixelRatio(value) {
      pixelRatio = value;
    },
    setScissorTest() {},
    clear() {},
    setViewport(...rectangle) {
      areas.push(rectangle);
    },
    setScissor(...rectangle) {
      areas.push(rectangle);
    },
    render(_scene, camera) {
      cameras.push(camera);
      finiteCamera(camera);
    },
  };
  return { renderer, areas, cameras };
}

test("one through four race views keep valid draw areas across hide and resize", (t) => {
  const { renderer, areas, cameras } = mockScreen(t);
  for (const count of [1, 2, 3, 4]) {
    const players = Array.from({ length: count }, (_, slot) => ({ slot }));
    const race = new Race({
      humans: players.map(({ slot }) => ({ seat: slot })),
    });
    const views = new RaceViews(renderer);
    for (const [width, height] of [
      [0, 0],
      [1, 1],
      [1280, 0],
      [0, 720],
      [640, 360],
      [1280, 720],
    ]) {
      globalThis.innerWidth = width;
      globalThis.innerHeight = height;
      areas.length = 0;
      cameras.length = 0;
      views.render({}, race, players, 1 / 60, 0, []);
      assert.equal(cameras.length, count);
      for (const rectangle of areas) {
        assert.ok(rectangle.every(Number.isFinite));
        assert.ok(
          rectangle[2] >= 1 && rectangle[3] >= 1,
          "no zero drawing areas",
        );
      }
    }
  }
});

test("race quality multiplies native sharpness and respects the budget after a 4K resize", (t) => {
  const { renderer } = mockScreen(t);
  globalThis.devicePixelRatio = 2;
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 720;
  const players = [{ slot: 0 }, { slot: 1 }];
  const race = new Race({
    humans: players.map(({ slot }) => ({ seat: slot })),
  });
  const views = new RaceViews(renderer);
  const draw = (dt = 1 / 60) => views.render({}, race, players, dt, 0, []);
  draw();
  assert.equal(
    renderer.getPixelRatio(),
    1.6,
    "initial high-density output must not be replaced by governor scale 1",
  );
  for (let i = 0; i < 180; i++) draw(0.032);
  assert.ok(Math.abs(renderer.getPixelRatio() - 1.44) < 1e-9);
  for (let i = 0; i < 180; i++) draw(0.008);
  assert.ok(
    Math.abs(renderer.getPixelRatio() - 1.52) < 1e-9,
    "recovery raises the fraction of the budgeted DPR",
  );
  globalThis.innerWidth = 3840;
  globalThis.innerHeight = 2160;
  draw();
  const dpr = renderer.getPixelRatio();
  for (const v of viewports(2, 3840, 2160))
    assert.ok(v.width * v.height * dpr * dpr <= SPLIT_VIEW_PIXELS);
  assert.ok(dpr < 1, "large split views must be able to downsample");
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 720;
  draw();
  assert.ok(
    Math.abs(renderer.getPixelRatio() - 1.52) < 1e-9,
    "shrinking restores sharpness without resetting governor history",
  );
});

test("one to four internal cameras each stay inside their pixel allowance", (t) => {
  const { renderer } = mockScreen(t);
  globalThis.devicePixelRatio = 3;
  for (const [width, height] of [
    [1280, 720],
    [3840, 2160],
    [2560, 1080],
    [960, 1006],
  ])
    for (const count of [1, 2, 3, 4]) {
      globalThis.innerWidth = width;
      globalThis.innerHeight = height;
      const players = Array.from({ length: count }, (_, slot) => ({ slot }));
      const race = new Race({
        humans: players.map(({ slot }) => ({ seat: slot })),
      });
      const views = new RaceViews(renderer);
      views.render({}, race, players, 1 / 60, 0, []);
      const dpr = renderer.getPixelRatio();
      for (const v of viewports(count, width, height))
        assert.ok(
          v.width * v.height * dpr * dpr <=
            (count > 1 ? SPLIT_VIEW_PIXELS : SINGLE_VIEW_PIXELS) + 1e-6,
        );
    }
});
