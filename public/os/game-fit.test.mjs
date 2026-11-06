import test from "node:test";
import assert from "node:assert/strict";
import { games } from "../../core/catalog.js";
import { GAME_FITS, gameFit, gameViewLayout, letterbox } from "./game-fit.js";
const matrix = [
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
const near = (a, b) =>
  assert.ok(Math.abs(a - b) < 1e-7, `${a} should equal ${b}`);

test("the fit map covers the shipped catalog and keeps server arenas out of iframes", () => {
  assert.deepEqual(
    Object.keys(GAME_FITS).sort(),
    games.map((game) => game.id).sort(),
  );
  for (const game of games)
    assert.equal(gameFit(game.id).surface, game.classic ? "iframe" : "canvas");
  assert.equal(gameFit("drawing").fit, "fluid");
  assert.equal(gameFit("drawing", { sharedScreens: true }).fit, "16:9");
  assert.throws(() => gameFit("unknown"), RangeError);
});

test("all games stay centred and complete in all nine screens, at one and maximum views", () => {
  for (const game of games)
    for (const [width, height] of matrix)
      for (const count of [1, game.maxPlayers]) {
        const layout = gameViewLayout(game.id, width, height, { count });
        assert.equal(layout.length, count);
        for (const { cell, frame, fit } of layout) {
          assert.ok(frame.x >= cell.x && frame.y >= cell.y);
          assert.ok(frame.x + frame.width <= cell.x + cell.width + 1e-7);
          assert.ok(frame.y + frame.height <= cell.y + cell.height + 1e-7);
          near(frame.x + frame.width / 2, cell.x + cell.width / 2);
          near(frame.y + frame.height / 2, cell.y + cell.height / 2);
          assert.ok(
            Math.abs(frame.width - cell.width) < 1e-7 ||
              Math.abs(frame.height - cell.height) < 1e-7,
            "one dimension fills the cell",
          );
          if (fit === "fluid") assert.deepEqual(frame, cell);
          else {
            const [a, b] = fit.split(":").map(Number);
            near(frame.width / frame.height, a / b);
          }
        }
        for (let i = 0; i < count; i++)
          for (let j = i + 1; j < count; j++) {
            const a = layout[i].cell,
              b = layout[j].cell;
            assert.ok(
              a.x + a.width <= b.x ||
                b.x + b.width <= a.x ||
                a.y + a.height <= b.y ||
                b.y + b.height <= a.y,
              "cells never overlap",
            );
          }
      }
});

test("two views stack in a narrow box and split side by side at the 1.2 boundary", () => {
  const stacked = gameViewLayout("shooting-range", 960, 1006, { count: 2 });
  assert.equal(stacked[0].cell.width, 960);
  assert.equal(stacked[1].cell.y, 503);
  near(stacked[0].frame.width / stacked[0].frame.height, 1.6);
  const wide = gameViewLayout("shooting-range", 1200, 1000, { count: 2 });
  assert.equal(wide[1].cell.x, 600);
  assert.equal(wide[1].cell.y, 0);
});

test("hidden, malformed and offset containers cannot produce invalid frame dimensions", () => {
  for (const [width, height] of [
    [0, 0],
    [0, 720],
    [1280, 0],
    [-1, 200],
    [NaN, Infinity],
  ])
    for (const id of Object.keys(GAME_FITS))
      for (const count of [1, 2, 3, 4])
        for (const { frame } of gameViewLayout(id, width, height, { count })) {
          assert.ok(Object.values(frame).every(Number.isFinite));
          assert.ok(frame.width >= 0 && frame.height >= 0);
        }
  assert.deepEqual(
    letterbox({ x: 10, y: 20, width: 800, height: 600 }, "16:9"),
    { x: 10, y: 95, width: 800, height: 450 },
  );
  assert.deepEqual(letterbox({ width: 800, height: 800 }, "4:3"), {
    x: 0,
    y: 100,
    width: 800,
    height: 600,
  });
  assert.throws(() => letterbox({ width: 1, height: 1 }, "square"), RangeError);
  for (const count of [0, 5, 1.5])
    assert.throws(
      () => gameViewLayout("kart", 1280, 720, { count }),
      RangeError,
    );
});
