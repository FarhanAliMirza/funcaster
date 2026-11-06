import test from "node:test";
import assert from "node:assert/strict";
import { WheelInput } from "./input.js";
import { Race } from "./logic.js";
test("party wheel honors normalized steering and full pedal snapshots with stale-input failsafe", () => {
  const w = new WheelInput({ invert: true });
  w.sample(
    { party: { active: true, x: 0.6, gas: true, brake: false, boost: true } },
    100,
  );
  assert.equal(w.read(110).steer, 0.6);
  assert.equal(w.read(110).gas, true);
  assert.equal(w.read(110).nitro, true);
  w.sample(
    { party: { active: true, x: -0.4, gas: false, brake: true, boost: false } },
    140,
  );
  assert.equal(w.read(150).gas, false);
  assert.equal(w.read(150).brake, true);
  assert.equal(w.read(900).gas, false);
  assert.equal(w.read(900).brake, false);
  assert.equal(w.read(900).steer, 0);
  w.sample({ party: { active: true, x: 0, gas: true } }, 1000);
  w.sample({ party: { active: false, x: 0 } }, 1030);
  assert.equal(w.read(1040).gas, false);
  assert.equal(w.read(1040).live, false);
});
test("nitro is an edge-triggered burst with an eight-second cooldown and brake priority", () => {
  const r = new Race({ laps: 1 });
  r.state = "racing";
  const p = r.player;
  r.move(p, { gas: true, nitro: true }, 1 / 60);
  assert.ok(p.boost > 1.4);
  assert.equal(p.nitroCooldown, 8);
  const original = p.nitroCooldown;
  r.move(p, { gas: true, nitro: true }, 1 / 60);
  assert.ok(p.nitroCooldown < original);
  p.boost = 0;
  r.move(p, { gas: true, nitro: false }, 1 / 60);
  r.move(p, { gas: true, nitro: true }, 1 / 60);
  assert.equal(p.boost, 0);
  p.nitroCooldown = 0;
  p.lastInput = {};
  r.move(p, { gas: true, brake: true, nitro: true }, 1 / 60);
  assert.equal(p.boost, 0);
  p.lastInput = {};
  r.move(p, { gas: true, nitro: true }, 1 / 60);
  assert.ok(p.boost > 1.4);
});

test("a race has three nitro uses; holding, invalid taps and reconnects cannot refill them", () => {
  const race = new Race({ laps: 1 });
  race.state = "racing";
  const p = race.player;
  assert.equal(p.nitroRemaining, 3);
  // Braking and no gas must not waste a limited use.
  race.move(p, { gas: true, brake: true, nitro: true }, 1 / 60);
  race.move(p, { nitro: false }, 1 / 60);
  race.move(p, { nitro: true }, 1 / 60);
  assert.equal(p.nitroRemaining, 3);
  for (let remaining = 2; remaining >= 0; remaining--) {
    race.move(p, { gas: true, nitro: false }, 1 / 60);
    race.move(p, { gas: true, nitro: true }, 1 / 60);
    assert.equal(p.nitroRemaining, remaining);
    assert.ok(p.boost > 1.4);
    for (let i = 0; i < 490; i++)
      race.move(p, { gas: true, nitro: true }, 1 / 60);
    assert.equal(
      p.nitroRemaining,
      remaining,
      "a held button must not fire again after cooldown",
    );
    assert.equal(p.nitroCooldown, 0);
  }
  const wheel = new WheelInput();
  wheel.release();
  wheel.sample({ party: { active: true, x: 0, gas: true, boost: true } }, 1000);
  race.move(p, { gas: true, nitro: false }, 1 / 60);
  race.move(p, { gas: true, nitro: wheel.read(1010).nitro }, 1 / 60);
  assert.equal(p.nitroRemaining, 0);
  assert.equal(p.boost, 0);
  assert.equal(new Race({ laps: 1 }).player.nitroRemaining, 3);
});
