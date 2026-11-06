import test from "node:test";
import assert from "node:assert/strict";
import { PartyWorld } from "./party-world.js";
import { MiniReplay } from "../../server/mini-replay.cjs";
test("same target pays once, earlier shot wins regardless of seat order", () => {
  const w = new PartyWorld({ game: "shooting-range", seats: 2 });
  w.range.nextSpawnMs = 5000;
  w.range.targets = [
    {
      id: 1,
      x: 0.8,
      y: 0.5,
      r: 0.06,
      kind: "normal",
      cell: 0,
      expiresMs: 5000,
      x0: 0.8,
    },
  ];
  w.input(0, 0, 0);
  w.input(1, 0, 0);
  w.time = 1;
  w.act(0, 0);
  w.act(1, 0.1);
  w.step(1 / 120);
  assert.equal(w.players[0].score, 0);
  assert.ok(w.players[1].score > 0);
  assert.equal(w.range.targets.length, 0);
});
test("ring claims are exclusive and dead ships can be revived by a teammate", () => {
  const w = new PartyWorld({ game: "island-flyover", seats: 2 });
  w.objects = [{ id: 0, x: 0.5, y: 0.5, owner: null }];
  w.players.forEach((p) => {
    p.x = 0.5;
    p.y = 0.5;
  });
  w.step(1 / 120);
  assert.equal(
    w.players.reduce((n, p) => n + p.rings, 0),
    1,
  );
  assert.equal(w.done, true);
  const c = new PartyWorld({ game: "alien-attack", mode: "coop", seats: 2 });
  c.players[1].lives = 0;
  c.objects = [{ kind: "revive", x: c.players[0].x, y: c.players[0].y }];
  c.step(1 / 120);
  assert.equal(c.players[1].lives, 1);
  assert.equal(c.players[0].revives, 1);
});
test("every shared mode ends within its cap and replays identical scores for four players", () => {
  for (const [game, mode] of [
    ["shooting-range", "shared"],
    ["shooting-range", "steal"],
    ["island-flyover", "shared"],
    ["alien-attack", "coop"],
    ["alien-attack", "versus"],
  ]) {
    const w = new PartyWorld({ game, mode, seats: 4, seed: 3 }),
      r = new MiniReplay(game, 3, { worldMode: mode }, 4);
    let calls = [["init"]];
    for (let i = 0; i < 11000 && !w.done; i++) {
      if (i % 40 === 0)
        for (let s = 0; s < 4; s++) {
          const x = Math.sin(i * 0.01 + s),
            y = Math.cos(i * 0.01 + s);
          w.input(s, x, y);
          w.act(s, 0);
          calls.push(["input", s, x, y], ["act", s, 0]);
        }
      w.step(1 / 120);
      calls.push(["step", 1 / 120]);
      if (calls.length > 800) {
        assert.ok(r.accept(r.sequence, calls), game);
        calls = [];
      }
    }
    if (calls.length) assert.ok(r.accept(r.sequence, calls), game);
    assert.ok(w.done, game);
    assert.deepEqual(r.scores(), w.scores(), game);
  }
});

test("opt-in helpers participate without adding human result seats", () => {
  for (const game of ["shooting-range", "alien-attack"]) {
    const w = new PartyWorld({ game, seats: 4, bot: true, mode: "coop" }),
      r = new MiniReplay(
        game,
        1,
        { worldMode: game === "shooting-range" ? "shared" : "coop", bot: true },
        4,
      );
    let calls = [["init"]];
    for (let i = 0; i < 7200 && !w.done; i++) {
      w.step(1 / 120);
      calls.push(["step", 1 / 120]);
      if (calls.length === 800) {
        assert.ok(r.accept(r.sequence, calls));
        calls = [];
      }
    }
    if (calls.length) assert.ok(r.accept(r.sequence, calls));
    assert.equal(w.players.length, 5);
    assert.equal(w.scores().length, 4);
    assert.ok(w.players.at(-1).shots > 0);
    assert.deepEqual(r.scores(), w.scores());
  }
});
