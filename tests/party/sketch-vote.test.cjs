const test = require("node:test"),
  assert = require("node:assert/strict"),
  { SketchVote } = require("../../server/sketch-vote.cjs");
test("voting rejects spectators, self-votes and duplicates and always ends", () => {
  const v = new SketchVote([0, 2, 3]);
  assert.equal(v.vote(0, 2), false);
  v.step(90);
  assert.equal(v.vote(0, 0), false);
  assert.equal(v.vote(1, 2), false);
  assert.equal(v.vote(0, 2), true);
  assert.equal(v.vote(0, 3), false);
  assert.equal(v.scores[2], 100);
  v.step(15);
  assert.equal(v.finished, true);
  assert.equal(v.vote(3, 2), false);
});
