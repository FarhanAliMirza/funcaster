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

test("Hindi prompts remain private; bilingual aliases and five-attempt penalty work", () => {
  const r = new SketchRound([0, 1], 12, { language: "hi", theme: "nature" });
  assert.match(r.word, /[^a-z]/i);
  assert.equal(r.privateState(1).word, null);
  assert.equal(r.guess(1, "fuck"), false);
  assert.equal(r.privateState(1).attemptsLeft, 5);
  assert.equal(r.guess(1, "wrong"), false);
  assert.equal(r.privateState(1).attemptsLeft, 4);
  assert.equal(r.guess(1, r.deck[0][0]), true);
  assert.equal(r.scores[1], 150);
  const blocked = new SketchRound([0, 1], 7);
  for (let i = 0; i < 5; i++) blocked.guess(1, "wrong");
  assert.equal(blocked.guess(1, blocked.word), false);
});
test("custom words are bounded, filtered and never leaked through a public prompt", () => {
  const r = new SketchRound([0, 1], 1, {
    customWords: ["samosa", "<script>", "fuck", "samosa"],
  });
  assert.equal(r.word, "samosa");
  assert.equal(r.deck.length, 1);
  assert.ok(!JSON.stringify(r.publicState()).includes("samosa"));
});
