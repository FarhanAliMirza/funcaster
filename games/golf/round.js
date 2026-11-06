import { Hole, terrainHeight, HOLE } from "./logic.js";
export const COURSE = [
  { tee: { x: 0, z: 0 }, par: 4, name: "Meadow Run" },
  { tee: { x: -18, z: -104 }, par: 3, name: "Left Bank" },
  { tee: { x: 9, z: -193 }, par: 3, name: "Little Landing" },
  { tee: { x: 30, z: -38 }, par: 4, name: "High Road" },
  { tee: { x: 22, z: -150 }, par: 3, name: "Sunset Bend" },
  { tee: { x: -5, z: -212 }, par: 2, name: "Last Little Putt" },
];
export class GolfRound {
  constructor({ players, holes = 3, seed = 1, onEvent = () => {} }) {
    if (
      !players?.length ||
      players.length > 8 ||
      new Set(players.map((p) => p.slot)).size !== players.length
    )
      throw Error("One to eight unique golfers required");
    this.players = players.map((p) => ({
      ...p,
      card: [],
      hole: null,
      connected: true,
      lostAt: null,
    }));
    this.seed = seed;
    this.turnAt = 0;
    this.holes = [1, 3, 6].includes(holes) ? holes : 3;
    this.onEvent = onEvent;
    this.index = 0;
    this.time = 0;
    this.accumulator = 0;
    this.phase = "playing";
    this.turn = players[0].slot;
    this.beginHole();
  }
  get current() {
    return this.players.find((p) => p.slot === this.turn);
  }
  get course() {
    return COURSE[this.index];
  }
  beginHole() {
    const tee = this.course.tee;
    this.turnAt = this.time;
    for (const p of this.players) {
      p.hole = new Hole();
      p.hole.ball = {
        x: tee.x,
        y: terrainHeight(tee.x, tee.z),
        z: tee.z,
        vx: 0,
        vy: 0,
        vz: 0,
      };
      p.complete = false;
    }
    this.turn = this.players
      .slice()
      .sort((a, b) => this.total(a) - this.total(b))[0].slot;
    this.onEvent({ type: "hole", index: this.index, turn: this.turn });
  }
  total(p) {
    return p.card.reduce((a, b) => a + b, 0);
  }
  strike(slot, aim, power) {
    if (
      this.phase !== "playing" ||
      slot !== this.turn ||
      this.current.hole.state !== "aim" ||
      !Number.isFinite(aim) ||
      !Number.isFinite(power)
    )
      return false;
    const h = this.current.hole;
    h.aimOffset = Math.max(-0.5, Math.min(0.5, aim));
    this.lastLie = { ...h.ball };
    h.strike(Math.max(0.12, Math.min(1, power)));
    this.flightAt = this.time;
    this.onEvent({ type: "strike", slot });
    return true;
  }
  presence(slots) {
    for (const p of this.players) {
      const connected =
        p.ai || slots.some((s) => s.slot === p.slot && s.occupied);
      if (!connected && p.connected) p.lostAt = this.time;
      p.connected = connected;
      if (connected) p.lostAt = null;
    }
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || this.phase !== "playing") return;
    this.accumulator += Math.min(dt, 0.25);
    while (this.accumulator >= 1 / 120) {
      this.accumulator -= 1 / 120;
      this.step(1 / 120);
      if (this.phase !== "playing") break;
    }
  }
  step(dt) {
    this.time += dt;
    const p = this.current,
      h = p.hole;
    if (
      h.state === "aim" &&
      ((p.ai && this.time - this.turnAt > 2) ||
        (!p.connected && this.time - (p.lostAt ?? this.time) > 30))
    ) {
      const d = h.distanceToHole();
      this.strike(
        p.slot,
        p.ai
          ? Math.sin(
              this.seed + p.slot * 67 + this.index * 97 + h.strokes * 43,
            ) * 0.045
          : 0,
        Math.min(
          1,
          d < 13
            ? Math.sqrt(d / 12)
            : d < 120
              ? Math.sqrt(d / 90)
              : Math.sqrt(d / 230),
        ),
      );
      this.onEvent({ type: "autoplay", slot: p.slot });
    }
    if (h.state !== "flight") return;
    h.update(this.time * 1000, dt);
    const b = h.ball;
    if (
      Math.abs(b.x) > 78 ||
      b.z > 32 ||
      b.z < -275 ||
      this.time - this.flightAt > 25
    ) {
      h.ball = { ...this.lastLie, vx: 0, vy: 0, vz: 0 };
      h.strokes++;
      h.state = "aim";
      this.onEvent({ type: "penalty", slot: p.slot });
    }
    if (h.state === "flight") return;
    if (h.state === "holed" || h.strokes >= 8) {
      p.complete = true;
      p.card.push(Math.min(9, h.strokes));
    }
    const remaining = this.players.filter((p) => !p.complete);
    if (!remaining.length) {
      if (this.index + 1 >= this.holes) {
        this.phase = "results";
        this.onEvent({
          type: "results",
          scores: this.players.map((p) => ({
            slot: p.slot,
            score: this.total(p),
          })),
        });
        return;
      }
      this.index++;
      this.beginHole();
      return;
    }
    this.turn = remaining
      .slice()
      .sort(
        (a, b) =>
          b.hole.distanceToHole() - a.hole.distanceToHole() || a.slot - b.slot,
      )[0].slot;
    this.turnAt = this.time;
    this.onEvent({ type: "turn", turn: this.turn });
  }
}
