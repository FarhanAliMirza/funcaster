import test from "node:test";
import assert from "node:assert/strict";
import {
  WindowModel,
  ModalQueue,
  placeWindow,
  clampRect,
  replacementIds,
  visibleFocusable,
} from "./wm.js";

test("window placement scales design sizes, reserves edges and clamps short/safe-area viewports", () => {
  assert.deepEqual(
    placeWindow({ w: 640, h: 440 }, { x: 0, y: 0, w: 1280, h: 678, ui: 1 }),
    { x: 320, y: 119, w: 640, h: 440 },
  );
  for (const work of [
    { x: 0, y: 0, w: 320, h: 280, ui: 0.9 },
    { x: 96, y: 54, w: 1728, h: 909, ui: 1.5 },
    { x: 0, y: 0, w: 2200, h: 678, ui: 1 },
  ]) {
    const rect = placeWindow({ w: 1200, h: 800 }, work, 8);
    assert.ok(rect.w <= work.w * 0.92 && rect.h <= work.h * 0.92);
    assert.ok(rect.x >= work.x && rect.y >= work.y);
    assert.ok(
      rect.x + rect.w <= work.x + work.w && rect.y + rect.h <= work.y + work.h,
    );
  }
  assert.deepEqual(
    clampRect(
      { x: -999, y: 999, w: 300, h: 200 },
      { x: 10, y: 10, w: 600, h: 400 },
    ),
    { x: 10, y: 210, w: 300, h: 200 },
  );
});

test("singleton windows retain maximised state and stable identity when reopened", () => {
  const model = new WindowModel();
  const first = model.add({ id: "players", title: "Players" });
  model.maximise("players");
  const second = model.add({ id: "players" });
  assert.equal(first, second);
  assert.equal(model.list().length, 1);
  assert.equal(second.state, "maximised");
  model.minimise("players");
  assert.equal(model.top(), null);
  model.add({ id: "players" });
  assert.equal(second.state, "maximised");
  assert.equal(model.focusId, "players");
});

test("one-tool replacement preserves pinned tools and the properties/player/invite exception", () => {
  const windows = [
    { id: "settings", kind: "tool" },
    { id: "records", kind: "tool", pinned: true },
    { id: "game-properties", kind: "tool" },
    { id: "game", kind: "game" },
  ];
  assert.deepEqual(replacementIds(windows, { id: "players", kind: "tool" }), [
    "settings",
  ]);
  assert.deepEqual(replacementIds(windows, { id: "invite", kind: "tool" }), [
    "settings",
  ]);
  assert.deepEqual(replacementIds(windows, { id: "help", kind: "tool" }), [
    "settings",
    "game-properties",
  ]);
  assert.deepEqual(
    replacementIds(windows, { id: "help", kind: "tool" }, true),
    [],
  );
  assert.deepEqual(replacementIds(windows, { id: "game", kind: "game" }), []);
  assert.deepEqual(
    replacementIds(
      [
        { id: "players", kind: "tool" },
        { id: "invite", kind: "tool" },
      ],
      { id: "game-properties" },
    ),
    [],
  );
});

test("focus raises windows within its layer and returns to the remaining window on close", () => {
  const model = new WindowModel();
  model.add({ id: "a" });
  model.add({ id: "b" });
  for (let i = 0; i < 1000; i++) model.focus(i % 2 ? "a" : "b");
  assert.equal(model.focusId, "a");
  assert.ok(model.list().every((entry) => entry.z >= 100 && entry.z <= 899));
  model.close("a");
  assert.equal(model.focusId, "b");
  model.close("b");
  assert.equal(model.focusId, null);
  assert.equal(model.top(), null);
});

test("modal scope blocks focusing a background tool and queued modal promises resolve in order", async () => {
  const model = new WindowModel();
  model.add({ id: "players" });
  model.add({ id: "dialog", kind: "modal" });
  assert.equal(model.focus("players"), false);
  assert.equal(model.focusId, "dialog");
  assert.equal(model.top().z, 910);
  model.close("dialog");
  assert.equal(model.focusId, "players");
  const queue = new ModalQueue(),
    resolved = [];
  const first = queue
    .push({ title: "One", cancelButton: "cancel" })
    .then((id) => resolved.push(["one", id]));
  const second = queue
    .push({ title: "Two", cancelButton: "no" })
    .then((id) => resolved.push(["two", id]));
  assert.equal(queue.active.options.title, "One");
  queue.choose("confirm");
  await first;
  assert.deepEqual(resolved, [["one", "confirm"]]);
  assert.equal(queue.active.options.title, "Two");
  queue.clear();
  await second;
  assert.deepEqual(resolved, [
    ["one", "confirm"],
    ["two", "no"],
  ]);
  assert.equal(queue.active, null);
});

test("maximise, minimise, restore and resize preserve normal placement and full-screen games", () => {
  let area = { x: 5, y: 5, w: 1280, h: 678, ui: 1 };
  const model = new WindowModel({
    getWorkArea: () => area,
    getViewport: () => ({ x: 0, y: 0, w: 1280, h: 720, ui: 1 }),
  });
  const tool = model.add({ id: "settings" }),
    normal = { ...tool.rect };
  model.maximise("settings");
  assert.deepEqual(tool.rect, { x: 5, y: 5, w: 1280, h: 678 });
  model.minimise("settings");
  model.restore("settings");
  assert.equal(tool.state, "maximised");
  model.restore("settings");
  assert.deepEqual(tool.rect, normal);
  area = { x: 10, y: 10, w: 320, h: 260, ui: 0.9 };
  model.relayout();
  assert.ok(tool.rect.x >= 10 && tool.rect.x + tool.rect.w <= 330);
  assert.ok(tool.rect.y >= 10 && tool.rect.y + tool.rect.h <= 270);
  const game = model.add({ id: "game", kind: "game" });
  assert.deepEqual(game.rect, { x: 0, y: 0, w: 1280, h: 720 });
  assert.equal(game.state, "maximised");
  assert.equal(model.minimise("game"), false);
});

test("normal windows recover manifest dimensions after hidden, small and scaled viewport changes", () => {
  let area = { x: 0, y: 0, w: 0, h: 0, ui: 0.9 };
  const model = new WindowModel({ getWorkArea: () => area });
  const entry = model.add({ id: "welcome", size: { w: 640, h: 440 } });
  assert.equal(entry.rect.w, 1);
  for (const next of [
    { x: 0, y: 0, w: 1280, h: 678, ui: 1 },
    { x: 0, y: 0, w: 320, h: 270, ui: 0.9 },
    { x: 0, y: 0, w: 1280, h: 678, ui: 1 },
    { x: 0, y: 0, w: 3840, h: 2034, ui: 3 },
  ]) {
    area = next;
    model.relayout();
    assert.deepEqual(entry.rect, placeWindow(entry.size, area));
  }
  assert.equal(entry.rect.w, 1920);
  assert.equal(entry.rect.h, 1320);
});

test("minimised and maximised windows retain fresh normal dimensions across viewport recovery", () => {
  for (const initialState of [
    "minimised",
    "maximised",
    "minimised-maximised",
  ]) {
    let area = { x: 0, y: 0, w: 0, h: 0, ui: 0.9 };
    const model = new WindowModel({ getWorkArea: () => area });
    const entry = model.add({ id: "settings", size: { w: 640, h: 440 } });
    if (initialState.includes("maximised")) model.maximise(entry.id);
    if (initialState.includes("minimised")) model.minimise(entry.id);
    for (const next of [
      { x: 0, y: 0, w: 1280, h: 678, ui: 1 },
      { x: 0, y: 0, w: 320, h: 270, ui: 0.9 },
      { x: 0, y: 0, w: 3840, h: 2034, ui: 3 },
    ]) {
      area = next;
      model.relayout();
      assert.deepEqual(entry.normalRect, placeWindow(entry.size, area));
      const maximised = initialState.includes("maximised");
      assert.deepEqual(
        entry.rect,
        maximised
          ? { x: area.x, y: area.y, w: area.w, h: area.h }
          : entry.normalRect,
      );
    }
    if (entry.state === "minimised") model.restore(entry.id);
    if (entry.state === "maximised") model.restore(entry.id);
    assert.equal(entry.state, "normal");
    assert.deepEqual(entry.rect, placeWindow(entry.size, area));
  }
});

test("drag placement survives a temporary small viewport without retaining its clipped size", () => {
  let area = { x: 0, y: 0, w: 1280, h: 678, ui: 1 };
  const model = new WindowModel({ getWorkArea: () => area });
  const entry = model.add({ id: "players", size: { w: 500, h: 300 } });
  model.move(entry.id, { x: 50, y: 70 });
  const moved = { ...entry.rect };
  area = { x: 0, y: 0, w: 320, h: 270, ui: 0.9 };
  model.relayout();
  area = { x: 0, y: 0, w: 1280, h: 678, ui: 1 };
  model.relayout();
  for (const key of ["x", "y", "w", "h"])
    assert.ok(Math.abs(entry.rect[key] - moved[key]) < 0.001);
  area = { x: 0, y: 0, w: 3840, h: 2034, ui: 3 };
  model.relayout();
  for (const key of ["x", "y", "w", "h"])
    assert.ok(Math.abs(entry.rect[key] - moved[key] * 3) < 0.001);
});

test("focus candidates exclude hidden Retry controls and invisible modal buttons", () => {
  const candidate = (
    name,
    { hidden = false, rects = 1, visibility = "visible" } = {},
  ) => ({
    name,
    closest: () => (hidden ? {} : null),
    getClientRects: () => Array(rects).fill({}),
    ownerDocument: {
      defaultView: { getComputedStyle: () => ({ visibility }) },
    },
  });
  const hiddenRetry = candidate("retry", { hidden: true });
  const collapsed = candidate("collapsed", { rects: 0 });
  const invisible = candidate("invisible", { visibility: "hidden" });
  const enabled = candidate("ready");
  const scope = {
    querySelectorAll: () => [hiddenRetry, collapsed, invisible, enabled],
  };
  assert.deepEqual(visibleFocusable(scope), [enabled]);
});

test("window titles and optional icons update without replacing the window or its placement", () => {
  const model = new WindowModel();
  const entry = model.add({
    id: "game-properties",
    title: "Properties",
    icon: "game.svg",
  });
  const rect = { ...entry.rect };
  assert.equal(model.setTitle("game-properties", "Kart Rush Properties"), true);
  assert.equal(entry.title, "Kart Rush Properties");
  assert.equal(entry.icon, "game.svg");
  assert.deepEqual(entry.rect, rect);
  assert.equal(
    model.setTitle("game-properties", "Star Catch Properties", "star.svg"),
    true,
  );
  assert.equal(entry.icon, "star.svg");
  assert.equal(model.setTitle("missing", "No window"), false);
});
