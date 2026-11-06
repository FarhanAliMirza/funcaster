import test from "node:test";
import assert from "node:assert/strict";
import { Race, rollItem } from "./logic.js";
test("last place item distribution adapts to a two-driver grid", () => {
  for (let n = 0; n < 100; n++)
    assert.equal(
      rollItem(2, () => n / 100, 2),
      rollItem(8, () => n / 100, 8),
    );
  for (let n = 0; n < 100; n++)
    assert.equal(
      rollItem(1, () => n / 100, 1),
      rollItem(1, () => n / 100, 8),
    );
});
test("a connected idle rival cannot hold the finishing race forever", () => {
  const race = new Race({ humans: [{ seat: 0 }, { seat: 1 }], cpuCount: 0 });
  race.start();
  race.state = "racing";
  race.humans[0].finishTime = 1;
  race.firstHumanFinish = 0;
  race.raceTime = 29.99;
  race.stepPlayers(1 / 120, {});
  race.stepPlayers(1 / 120, {});
  assert.equal(race.humans[1].dnf, true);
  assert.equal(race.state, "finishing");
  assert.equal(race.position(race.humans[0]), 1);
  for (let i = 0; i < 500; i++) race.stepPlayers(1 / 120, {});
  assert.equal(race.state, "results");
});
