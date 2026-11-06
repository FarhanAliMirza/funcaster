const test = require("node:test"),
  assert = require("node:assert/strict");
const { createRound, stepRound } = require("../../server/party-engine.cjs");
test("a shared bubble can be claimed once, with identical results for reversed seat order", () => {
  const scores = [];
  for (const slots of [
    [0, 1],
    [1, 0],
  ]) {
    const r = createRound("bubble-burst", slots, 1, { interaction: true });
    r.nextSpawn = 100;
    r.players.forEach((p) => {
      p.x = 0.5;
      p.y = 0.48;
      p.objects = [
        {
          id: 1,
          x: 0.5,
          y: 0.48,
          kind: "bubble",
          radius: 0.08,
          age: 0,
          dwell: 0,
        },
      ];
    });
    stepRound(
      r,
      { 0: { x: 0, y: 0, pulse: true }, 1: { x: 0, y: 0, pulse: true } },
      1 / 30,
    );
    scores.push(
      r.players
        .map((p) => ({ slot: p.slot, score: p.score }))
        .sort((a, b) => a.slot - b.slot),
    );
    assert.equal(
      r.players.reduce((sum, p) => sum + p.score, 0),
      10,
    );
    assert.ok(r.players.every((p) => p.objects.length === 0));
  }
  assert.deepEqual(scores[0], scores[1]);
});
test("slipstream rewards a nearby following active driver, never a stopped or braking one", () => {
  const r = createRound("neon-drift", [0, 1], 2, { interaction: true });
  r.players[1].distance = 0.5;
  r.players.forEach((p) => (p.speed = 1));
  stepRound(r, { 0: { gas: true }, 1: { gas: true } }, 1 / 30);
  assert.equal(r.players[0].drafting, true);
  assert.equal(r.players[1].drafting, false);
  stepRound(r, { 0: { gas: true, brake: true }, 1: { gas: true } }, 1 / 30);
  assert.equal(r.players[0].drafting, false);
});
