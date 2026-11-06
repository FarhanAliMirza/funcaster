"use strict";
const GAMES = ["star-catch", "neon-drift", "bubble-burst"];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
function random(seed) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function createRound(game, slots, seed = Date.now(), setup = {}) {
  if (!GAMES.includes(game)) throw new Error("Unknown game");
  if (
    !slots.length ||
    slots.length > 4 ||
    new Set(slots).size !== slots.length ||
    slots.some((s) => !Number.isInteger(s) || s < 0 || s > 3)
  )
    throw new Error("Invalid players");
  return {
    game,
    interaction: setup.interaction === true,
    elapsed: 0,
    duration: 60,
    nextSpawn: 0,
    nextId: 0,
    random: random(seed),
    players: slots.map((slot) => ({
      slot,
      x: 0.5,
      y: 0.8,
      score: 0,
      combo: 0,
      bestCombo: 0,
      hit: 0,
      pulse: 0,
      cooldown: 0,
      speed: 0,
      distance: 0,
      boosting: 0,
      drafting: false,
      boostHeld: false,
      boostsLeft: 3,
      feedback: 0,
      objects: [],
    })),
  };
}
function reward(p, amount) {
  p.combo++;
  p.bestCombo = Math.max(p.bestCombo, p.combo);
  p.score += amount + Math.min(5, Math.floor(p.combo / 3));
  p.feedback++;
}
function stepRound(round, inputs, dt) {
  if (!Number.isFinite(dt) || dt <= 0 || round.elapsed >= round.duration)
    return round;
  dt = Math.min(dt, 0.1, round.duration - round.elapsed);
  round.elapsed += dt;
  if (round.elapsed >= round.nextSpawn) {
    const kind =
      round.game === "bubble-burst"
        ? "bubble"
        : round.random() < 0.23
          ? "hazard"
          : "star";
    const object = {
      id: round.nextId++,
      x: 0.12 + round.random() * 0.76,
      y: round.game === "bubble-burst" ? 0.18 + round.random() * 0.57 : -0.08,
      kind,
      age: 0,
      dwell: 0,
      radius:
        round.game === "bubble-burst" ? 0.065 + round.random() * 0.022 : 0.04,
    };
    round.players.forEach((p) => p.objects.push({ ...object }));
    round.nextSpawn =
      round.elapsed +
      (round.game === "bubble-burst"
        ? 0.63
        : Math.max(0.28, 0.67 - round.elapsed / 180));
  }
  const claims = [];
  const previous = round.players.map((p) => ({
    slot: p.slot,
    x: p.x,
    distance: p.distance,
    speed: p.speed,
  }));
  const claim = (p, o, fraction) => {
    if (!round.interaction || round.game === "neon-drift") reward(p, 10);
    else claims.push({ p, id: o.id, fraction });
  };
  for (const p of round.players) {
    const input = inputs[p.slot] || { x: 0, y: 0, active: false };
    const x = Number.isFinite(input.x) ? clamp(input.x, -1, 1) : 0,
      y = Number.isFinite(input.y) ? clamp(input.y, -1, 1) : 0;
    p.x += (0.5 + x * 0.41 - p.x) * (1 - Math.exp(-18 * dt));
    p.y +=
      ((round.game === "bubble-burst" ? 0.48 + y * 0.36 : 0.84) - p.y) *
      (1 - Math.exp(-18 * dt));
    p.hit = Math.max(0, p.hit - dt);
    p.pulse = Math.max(0, p.pulse - dt);
    p.cooldown = Math.max(0, p.cooldown - dt);
    const pulse =
      round.game === "bubble-burst" &&
      input.active !== false &&
      input.pulse &&
      p.cooldown === 0;
    if (pulse) {
      p.pulse = 0.4;
      p.cooldown = 1.1;
    }
    if (round.game === "neon-drift") {
      p.boosting = Math.max(0, p.boosting - dt);
      if (
        input.active !== false &&
        input.boost &&
        !p.boostHeld &&
        p.cooldown === 0 &&
        p.boostsLeft > 0 &&
        input.gas &&
        !input.brake
      ) {
        p.boosting = 1.5;
        p.cooldown = 8;
        p.boostsLeft--;
      }
      p.boostHeld = !!input.boost;
      const target =
        input.active !== false && input.gas && !input.brake ? 1 : 0;
      p.speed +=
        (target - p.speed) *
        (1 - Math.exp(-dt * (input.brake ? 14 : target ? 3 : 2)));
      p.drafting =
        round.interaction &&
        input.active !== false &&
        input.gas &&
        !input.brake &&
        previous.some(
          (q) =>
            q.slot !== p.slot &&
            q.distance > p.distance + 0.08 &&
            q.distance < p.distance + 1.5 &&
            Math.abs(q.x - p.x) < 0.12 &&
            q.speed > 0.5,
        );
      const slip = p.drafting ? 1.12 : 1;
      p.distance += dt * p.speed * (p.boosting ? 1.7 : 1) * slip;
      if (input.active !== false)
        p.score += dt * 3 * p.speed * (p.boosting ? 1.7 : 1) * slip;
    }
    const speed =
      round.game === "neon-drift"
        ? (0.48 + round.elapsed * 0.003) * p.speed * (p.boosting ? 1.7 : 1)
        : 0.26 + round.elapsed * 0.003;
    p.objects = p.objects.filter((o) => {
      o.age += dt;
      if (round.game === "bubble-burst") {
        const d = Math.hypot(o.x - p.x, (o.y - p.y) * 1.3);
        o.dwell =
          input.active !== false && d < o.radius + 0.025 ? o.dwell + dt : 0;
        if (
          input.active !== false &&
          (o.dwell >= 0.13 || (pulse && d < 0.26))
        ) {
          claim(
            p,
            o,
            pulse && d < 0.26 ? 0 : clamp((0.13 - (o.dwell - dt)) / dt, 0, 1),
          );
          return false;
        }
        return o.age < 5;
      }
      const before = o.y;
      o.y += dt * speed;
      if (
        input.active !== false &&
        before < p.y + 0.045 &&
        o.y >= p.y - 0.045 &&
        Math.abs(o.x - p.x) < (round.game === "star-catch" ? 0.13 : 0.095)
      ) {
        if (o.kind === "hazard") {
          p.score = Math.max(0, p.score - 10);
          p.combo = 0;
          p.hit = 0.45;
          p.feedback++;
        } else
          claim(
            p,
            o,
            clamp(
              (p.y - 0.045 - before) / Math.max(0.000001, o.y - before),
              0,
              1,
            ),
          );
        return false;
      }
      return o.y < 1.12 && o.age < 6;
    });
  }
  const won = new Set();
  claims.sort(
    (a, b) =>
      a.fraction - b.fraction ||
      ((a.p.slot - (a.id % 4) + 4) % 4) - ((b.p.slot - (b.id % 4) + 4) % 4),
  );
  for (const c of claims)
    if (!won.has(c.id)) {
      won.add(c.id);
      reward(c.p, 10);
    }
  if (won.size)
    for (const p of round.players)
      p.objects = p.objects.filter((o) => !won.has(o.id));
  return round;
}
function snapshot(round) {
  return {
    game: round.game,
    interaction: round.interaction,
    elapsed: round.elapsed,
    duration: round.duration,
    players: round.players,
  };
}
module.exports = { GAMES, createRound, stepRound, snapshot };
