const test = require("node:test"),
  assert = require("node:assert/strict");
const { SliceReplay, verifySlice } = require("../../server/slice-replay.cjs");
test("seeded slicing replay validates scores and rejects reorder, invalid ticks and forged scores", () => {
  const r = new SliceReplay(81),
    calls = [
      ["setAspect", 16 / 9],
      ["start", 0],
    ];
  for (let i = 1; i <= 600; i++) {
    calls.push(
      [
        "setCursor",
        Math.sin(i / 10) * 5,
        Math.cos(i / 10) * 2,
        (i * 1000) / 120,
        0,
      ],
      ["update", (i * 1000) / 120, 1 / 120],
    );
  }
  assert.equal(r.accept(0, calls), true);
  const replay = {
    seed: 81,
    slots: [0],
    setup: { variant: "race" },
    boards: [{ view: 0, calls }],
  };
  assert.equal(verifySlice(replay, [{ slot: 0, score: r.score(0) }]), true);
  assert.equal(
    verifySlice(replay, [{ slot: 0, score: r.score(0) + 100 }]),
    false,
  );
  assert.equal(r.accept(0, []), false);
  assert.equal(new SliceReplay(1).accept(0, [["update", 1, 1]]), false);
});

test("malformed replay commands fail safely", () => {
  for (const calls of [[null], [1], [{}], [[]], [["start", NaN]]])
    assert.equal(new SliceReplay(1).accept(0, calls), false);
});
