import test from "node:test";
import assert from "node:assert/strict";
import { GolfRound, seededCourse, golfScores } from "./round.js";
test("address latches aim, release is idempotent, and another seat cannot strike", () => {
  const r = new GolfRound({ players: [{ slot: 0 }, { slot: 1 }], holes: 1 });
  assert.equal(r.release(0, 0.4, 1), false);
  assert.equal(r.address(1, 0.3, 1), false);
  assert.equal(r.address(0, 0.2, 1), true);
  assert.equal(r.release(1, 0.8, 1), false);
  assert.equal(r.release(0, 0.4, 1), true);
  assert.equal(r.current.hole.aimOffset, 0.2);
  assert.equal(r.release(0, 0.4, 1), false);
  assert.equal(r.current.hole.strokes, 1);
});
test("seeded courses reproduce tees, pin, bounds and wind", () => {
  assert.deepEqual(seededCourse(42, true), seededCourse(42, true));
  assert.notDeepEqual(seededCourse(42, true), seededCourse(43, true));
  for (const c of seededCourse(42, true)) {
    assert.ok(c.tee.x > c.bounds.left && c.tee.x < c.bounds.right);
    assert.ok(c.pin.z > c.bounds.far);
  }
});
test("match and skins score wins; tied skins carry", () => {
  const p = [
    { slot: 0, card: [3, 4, 2] },
    { slot: 1, card: [3, 5, 3] },
  ];
  assert.deepEqual(
    golfScores(p, "match").map((s) => s.score),
    [-2, 0],
  );
  assert.deepEqual(
    golfScores(p, "skins").map((s) => s.score),
    [-3, 0],
  );
});
test("all golf modes complete with four idle players and seeded wind", () => {
  for (const mode of ["stroke", "match", "skins", "closest", "scramble"]) {
    const r = new GolfRound({
      players: [0, 1, 2, 3].map((slot) => ({ slot, ai: true })),
      holes: 1,
      seed: 8,
      course: "seeded",
      wind: true,
      mode,
    });
    for (let i = 0; i < 120 * 1200 && r.phase !== "results"; i++)
      r.update(1 / 120);
    assert.equal(r.phase, "results", mode);
    assert.equal(
      r.players.every((p) => p.card.length === 1),
      true,
      mode,
    );
    assert.ok(
      golfScores(r.players, mode).every((s) => Number.isSafeInteger(s.score)),
    );
  }
});

test("four-player match play uses opposing best-ball pairs and shares team points", () => {
  const p = [
    { slot: 0, card: [3, 6] },
    { slot: 1, card: [4, 4] },
    { slot: 2, card: [5, 5] },
    { slot: 3, card: [6, 3] },
  ];
  assert.deepEqual(
    golfScores(p, "match").map((s) => s.score),
    [-1, -1, -1, -1],
  );
});
