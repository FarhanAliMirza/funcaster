const test = require("node:test"),
  assert = require("node:assert/strict");
const { SketchRound } = require("../../server/sketch-round.cjs");
test("draw-and-guess keeps prompts private, scores one guess per player, and rotates every drawer", () => {
  const r = new SketchRound([0, 2, 3], 71);
  assert.equal(r.privateState(2).word, null);
  assert.equal(r.privateState(0).word, r.word);
  assert.ok(!r.publicState().label.includes(r.word));
  assert.equal(r.guess(0, r.word), false);
  assert.equal(r.guess(1, r.word), false);
  assert.equal(r.guess(2, "wrong"), false);
  assert.equal(r.guess(2, r.word.toUpperCase()), true);
  assert.equal(r.guess(2, r.word), false);
  assert.equal(r.guess(3, r.word), true);
  assert.equal(r.scores[0], 120);
  r.step(3);
  assert.equal(r.drawer, 2);
  r.step(30);
  assert.equal(r.publicState().label, r.word);
  r.step(3);
  assert.equal(r.drawer, 3);
  r.step(30);
  r.step(3);
  assert.equal(r.finished, true);
});
