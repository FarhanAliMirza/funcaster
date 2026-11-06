const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  GAMES,
  createRound,
  stepRound,
} = require("../../server/party-engine.cjs");
test("all three games support solo through four players with bounded independent state", () => {
  for (const game of GAMES)
    for (let count = 1; count <= 4; count++) {
      const round = createRound(
        game,
        Array.from({ length: count }, (_, i) => i),
        10,
      );
      for (let t = 0; t < 3600; t++)
        stepRound(
          round,
          Object.fromEntries(
            round.players.map((p) => [
              p.slot,
              {
                x: Math.sin(t / 30 + p.slot),
                y: Math.cos(t / 45),
                pulse: t % 70 === 0,
              },
            ]),
          ),
          1 / 60,
        );
      assert.ok(Math.abs(round.elapsed - 60) < 0.01);
      assert.equal(round.players.length, count);
      for (const p of round.players) {
        assert.ok(p.x >= 0.09 && p.x <= 0.91);
        assert.ok(Number.isFinite(p.score));
        assert.ok(p.score >= 0);
        assert.ok(p.objects.length < 20);
      }
    }
});
test("equivalent input gives every player identical opportunities and scores", () => {
  for (const game of GAMES) {
    const r = createRound(game, [0, 1, 2, 3], 42);
    for (let t = 0; t < 1200; t++)
      stepRound(
        r,
        Object.fromEntries(
          [0, 1, 2, 3].map((slot) => [
            slot,
            { x: Math.sin(t / 30), y: Math.sin(t / 25), pulse: t % 60 === 0 },
          ]),
        ),
        1 / 30,
      );
    for (const p of r.players.slice(1))
      assert.equal(p.score, r.players[0].score);
  }
});
test("star catches reward and hazards penalize without negative scores", () => {
  const r = createRound("star-catch", [0], 1),
    p = r.players[0];
  r.nextSpawn = 99;
  p.y = 0.84;
  p.objects = [{ id: 1, x: 0.5, y: 0.81, age: 0, kind: "star" }];
  stepRound(r, { 0: { x: 0, y: 0 } }, 0.1);
  assert.equal(p.score, 10);
  p.objects = [{ id: 2, x: 0.5, y: 0.81, age: 0, kind: "hazard" }];
  stepRound(r, { 0: { x: 0, y: 0 } }, 0.1);
  assert.equal(p.score, 0);
  assert.equal(p.combo, 0);
});
test("stale/disconnected input cannot score while its lane coasts", () => {
  for (const game of GAMES) {
    const r = createRound(game, [0]);
    r.nextSpawn = 99;
    const p = r.players[0];
    p.x = 0.5;
    p.y = 0.48;
    p.objects = [
      {
        x: 0.5,
        y: 0.48,
        id: 0,
        kind: "bubble",
        age: 0,
        radius: 0.09,
        dwell: 0.12,
      },
    ];
    for (let i = 0; i < 10; i++)
      stepRound(r, { 0: { active: false, x: 0, y: 0, pulse: true } }, 0.1);
    assert.equal(p.score, 0);
  }
});
test("invalid game and player lists fail closed; ended rounds do not keep scoring", () => {
  assert.throws(() => createRound("unknown", [0]));
  assert.throws(() => createRound("star-catch", [0, 0]));
  assert.throws(() => createRound("star-catch", []));
  const r = createRound("neon-drift", [0]);
  r.elapsed = 60;
  stepRound(r, { 0: { x: 0, y: 0 } }, 0.1);
  assert.equal(r.players[0].score, 0);
});

test("Neon Drift pedals accelerate, brake, boost, and stop scoring with stale inputs", () => {
  const r = createRound("neon-drift", [0, 1], 17);
  for (let i = 0; i < 40; i++)
    stepRound(
      r,
      {
        0: { gas: true, active: true, x: 0 },
        1: { gas: false, active: true, x: 0 },
      },
      0.05,
    );
  const p = r.players[0],
    stopped = r.players[1];
  assert.ok(p.speed > 0.9);
  assert.equal(stopped.speed, 0);
  assert.ok(p.score > stopped.score);
  stepRound(r, { 0: { gas: true, boost: true, active: true, x: 0 } }, 0.05);
  assert.equal(p.cooldown, 8);
  assert.equal(p.boosting, 1.5);
  for (let i = 0; i < 20; i++)
    stepRound(r, { 0: { gas: true, brake: true, active: true, x: 0 } }, 0.05);
  assert.ok(p.speed < 0.01);
  const score = p.score;
  for (let i = 0; i < 20; i++)
    stepRound(r, { 0: { active: false, gas: true, boost: true, x: 0 } }, 0.05);
  assert.equal(p.score, score);
});

test("Neon Drift gives independent limited boosts and replenishes only for a new round", () => {
  const r = createRound("neon-drift", [0, 1], 42),
    p = r.players[0];
  stepRound(r, { 0: { gas: true, brake: true, boost: true } }, 0.05);
  stepRound(r, { 0: { boost: false } }, 0.05);
  stepRound(r, { 0: { boost: true } }, 0.05);
  assert.equal(p.boostsLeft, 3);
  for (let remaining = 2; remaining >= 0; remaining--) {
    stepRound(r, { 0: { gas: true, boost: false } }, 0.05);
    stepRound(r, { 0: { gas: true, boost: true } }, 0.05);
    assert.equal(p.boostsLeft, remaining);
    assert.equal(p.cooldown, 8);
    // Repeated samples and held inputs cannot spend another charge.
    for (let i = 0; i < 165; i++)
      stepRound(r, { 0: { gas: true, boost: true } }, 0.05);
    assert.equal(p.boostsLeft, remaining);
    assert.equal(p.cooldown, 0);
    assert.equal(r.players[1].boostsLeft, 3);
  }
  stepRound(r, { 0: { active: false, gas: true, boost: false } }, 0.05);
  stepRound(r, { 0: { active: true, gas: true, boost: true } }, 0.05);
  assert.equal(p.boostsLeft, 0);
  assert.equal(p.boosting, 0);
  assert.equal(createRound("neon-drift", [0]).players[0].boostsLeft, 3);
});
