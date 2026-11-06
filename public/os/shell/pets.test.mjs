import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { choosePets, PetMotion } from "./pets.js";
import { avatarAssignment } from "./avatars.js";
const pets = JSON.parse(
  readFileSync(
    new URL("../../../assets/os/pets/pets.json", import.meta.url),
    "utf8",
  ),
);
const avatars = JSON.parse(
  readFileSync(
    new URL("../../../assets/os/avatars/avatars.json", import.meta.url),
    "utf8",
  ),
);

test("ambient pets choose at most two distinct approved animals and use only idle/walk", () => {
  assert.deepEqual(
    choosePets(pets, () => 0),
    ["dog", "dog-2"],
  );
  const selected = choosePets({ ...pets, maxVisible: 9 }, () => 0.999);
  assert.equal(selected.length, 2);
  assert.equal(new Set(selected).size, 2);
  for (const id of selected)
    assert.deepEqual(Object.keys(pets.pets[id].anims), ["idle", "walk"]);
  assert.deepEqual(
    choosePets({ ...pets, maxVisible: 1 }, () => 0),
    ["dog"],
  );
});

test("pets walk 40 design pixels per second, animate at 120ms, sit 2–6 seconds and turn at the edge", () => {
  const pet = new PetMotion({ x: 100, random: () => 0 });
  for (let i = 0; i < 8; i++) pet.step(0.25, { width: 400 });
  assert.equal(pet.mode, "walk");
  for (let i = 0; i < 10; i++) pet.step(0.1, { width: 400 });
  assert.equal(pet.x, 140);
  assert.equal(pet.frame(6), 2);
  pet.elapsed = 0.119;
  assert.equal(pet.frame(6), 0);
  pet.elapsed = 0.12;
  assert.equal(pet.frame(6), 1);
  pet.x = 350;
  pet.step(0.1, { width: 400 });
  assert.equal(pet.x, 352);
  assert.equal(pet.direction, -1);
  assert.equal(pet.mode, "idle");
  assert.equal(pet.remaining, 2);
  pet.sit(1);
  assert.equal(pet.direction, 1);
  assert.equal(pet.elapsed, 0);
  const longSit = new PetMotion({ random: () => 1 });
  longSit.sit(-1);
  assert.equal(longSit.remaining, 6);
});

test("paused or gentle pets stay static, clamp on resize, and do not jump after tab suspension", () => {
  const pet = new PetMotion({ x: 250, random: () => 0.5 });
  pet.mode = "walk";
  const remaining = pet.remaining;
  for (const options of [{ paused: true }, { gentle: true }]) {
    pet.step(10, { width: 400, ...options });
    assert.equal(pet.x, 250);
    assert.equal(pet.remaining, remaining);
    assert.equal(pet.elapsed, 0);
  }
  assert.equal(pet.frame(6, true), 0);
  pet.step(0, { width: 200, paused: true });
  assert.equal(pet.x, 152);
  pet.x = 50;
  pet.step(60, { width: 400 });
  assert.equal(
    pet.x,
    60,
    "a resumed frame is capped instead of catching up a minute",
  );
});

test("avatar seats stay fixed; only a winner runs, empty seats stay dim/static, and Gentle effects freezes frames", () => {
  assert.deepEqual(avatars.seats, ["biker", "punk", "cyborg", "townsperson"]);
  for (let slot = 0; slot < 4; slot++) {
    const idle = avatarAssignment(avatars, slot, { elapsed: 240 });
    assert.equal(idle.id, avatars.seats[slot]);
    assert.equal(idle.name, "idle");
    assert.equal(idle.frame, 2);
    const winner = avatarAssignment(avatars, slot, {
      winner: true,
      elapsed: 720,
    });
    assert.equal(winner.name, "run");
    assert.equal(winner.frame, 0);
    const empty = avatarAssignment(avatars, slot, {
      winner: true,
      empty: true,
      elapsed: 240,
    });
    assert.equal(empty.name, "idle");
    assert.equal(empty.empty, true);
    assert.equal(empty.frame, 0);
    assert.equal(
      avatarAssignment(avatars, slot, {
        winner: true,
        gentle: true,
        elapsed: 240,
      }).frame,
      0,
    );
  }
  assert.equal(avatarAssignment(avatars, 4), null);
  assert.equal(avatarAssignment(avatars, -1), null);
});
