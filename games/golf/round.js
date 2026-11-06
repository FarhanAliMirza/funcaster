import { seededRandom } from "../../core/random.js";
import { Hole, terrainHeight, HOLE } from "./logic.js";
export const COURSE = [
  { tee: { x: 0, z: 0 }, par: 4, name: "Meadow Run" },
  { tee: { x: -18, z: -104 }, par: 3, name: "Left Bank" },
  { tee: { x: 9, z: -193 }, par: 3, name: "Little Landing" },
  { tee: { x: 30, z: -38 }, par: 4, name: "High Road" },
  { tee: { x: 22, z: -150 }, par: 3, name: "Sunset Bend" },
  { tee: { x: -5, z: -212 }, par: 2, name: "Last Little Putt" },
];
export function seededCourse(seed, wind = false) {
  const rng = seededRandom(seed);
  return COURSE.map((c, i) => ({
    ...c,
    tee: { x: c.tee.x + (rng() - 0.5) * 8, z: c.tee.z + (rng() - 0.5) * 10 },
    pin: { x: HOLE.x + (rng() - 0.5) * 6, z: HOLE.z + (rng() - 0.5) * 6 },
    wind: { x: wind ? (rng() - 0.5) * 2 : 0, z: wind ? (rng() - 0.5) * 2 : 0 },
    bounds: { left: -78, right: 78, near: 32, far: -275 },
  }));
}
export function golfScores(players, mode = "stroke") {
  const points = new Map(players.map((p) => [p.slot, 0]));
  let carry = 1;
  for (let i = 0; i < Math.max(...players.map((p) => p.card.length)); i++) {
    if (mode === "match" && players.length === 4) {
      const a = Math.min(players[0].card[i] ?? 9, players[2].card[i] ?? 9),
        b = Math.min(players[1].card[i] ?? 9, players[3].card[i] ?? 9);
      if (a !== b)
        for (const index of a < b ? [0, 2] : [1, 3])
          points.set(players[index].slot, points.get(players[index].slot) + 1);
      continue;
    }
    const best = Math.min(...players.map((p) => p.card[i] ?? 9)),
      winners = players.filter((p) => p.card[i] === best);
    if (mode === "skins") {
      if (winners.length === 1) {
        points.set(winners[0].slot, points.get(winners[0].slot) + carry);
        carry = 1;
      } else carry++;
    } else if (mode === "match" && winners.length < players.length)
      for (const p of winners) points.set(p.slot, points.get(p.slot) + 1);
  }
  return players.map((p) => ({
    slot: p.slot,
    score: ["skins", "match"].includes(mode)
      ? 0 - points.get(p.slot)
      : mode === "closest"
        ? Math.round((p.closest || 0) * 1000)
        : p.card.reduce((a, b) => a + b, 0),
    stats: {
      strokes: p.card.reduce((a, b) => a + b, 0),
      holes: p.card.length,
      points: points.get(p.slot),
    },
  }));
}
export class GolfRound {
  constructor({
    players,
    holes = 3,
    seed = 1,
    turnSeconds = 45,
    skill = "club",
    course = "classic",
    wind = false,
    mode = "stroke",
    readyGolf = false,
    onEvent = () => {},
  }) {
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
    this.layouts =
      course === "seeded"
        ? seededCourse(seed, wind)
        : wind
          ? COURSE.map((c, i) => ({
              ...c,
              wind: seededCourse(seed, true)[i].wind,
            }))
          : COURSE;
    this.mode = ["stroke", "match", "skins", "closest", "scramble"].includes(
      mode,
    )
      ? mode
      : "stroke";
    this.readyGolf = readyGolf;
    this.addressed = null;
    this.scrambleWave = new Set();
    this.turnSeconds = Math.max(0, Math.min(120, turnSeconds));
    this.skill = ["rookie", "club", "pro"].includes(skill) ? skill : "club";
    this.strokeSequences = new Map();
    this.turnAt = 0;
    this.extensions = 0;
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
    return this.layouts[this.index];
  }
  beginHole() {
    const tee = this.course.tee;
    this.addressed = null;
    this.scrambleWave.clear();
    this.turnAt = this.time;
    for (const p of this.players) {
      p.hole = new Hole({
        pin: this.course.pin,
        wind: this.course.wind,
        par: this.course.par,
      });
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
      .sort(
        (a, b) =>
          (a.card.at(-1) || 0) - (b.card.at(-1) || 0) ||
          this.players.indexOf(a) - this.players.indexOf(b),
      )[0].slot;
    this.onEvent({ type: "hole", index: this.index, turn: this.turn });
  }
  total(p) {
    return p.card.reduce((a, b) => a + b, 0);
  }
  address(slot, aim, seq) {
    if (
      !Number.isFinite(aim) ||
      !Number.isSafeInteger(seq) ||
      seq < 0 ||
      this.phase !== "playing"
    )
      return false;
    if (
      slot !== this.turn &&
      this.readyGolf &&
      !this.current.connected &&
      this.time - this.turnAt >= 20 &&
      !this.addressed &&
      this.current.hole.state === "aim"
    ) {
      const next = this.players.find(
        (p) => p.slot === slot && !p.complete && p.connected,
      );
      if (next) {
        this.turn = slot;
        this.turnAt = this.time;
      }
    }
    if (
      slot !== this.turn ||
      this.current.hole.state !== "aim" ||
      seq <= (this.strokeSequences.get(slot) ?? -1)
    )
      return false;
    this.addressed = { slot, aim: Math.max(-0.5, Math.min(0.5, aim)), seq };
    return true;
  }
  release(slot, power, seq) {
    const a = this.addressed;
    if (!a || a.slot !== slot || a.seq !== seq) return false;
    const ok = this.strike(slot, a.aim, power, seq);
    if (ok) this.addressed = null;
    return ok;
  }
  cancelAddress(slot) {
    if (this.addressed?.slot === slot) this.addressed = null;
  }
  strike(slot, aim, power, seq = null) {
    if (
      seq !== null &&
      (!Number.isSafeInteger(seq) ||
        seq <= (this.strokeSequences.get(slot) ?? -1))
    )
      return false;
    if (
      this.phase !== "playing" ||
      slot !== this.turn ||
      this.current.hole.state !== "aim" ||
      !Number.isFinite(aim) ||
      !Number.isFinite(power)
    )
      return false;
    if (seq !== null) this.strokeSequences.set(slot, seq);
    const h = this.current.hole;
    h.aimOffset = Math.max(-0.5, Math.min(0.5, aim));
    this.lastLie = { ...h.ball };
    h.strike(Math.max(0.12, Math.min(1, power)));
    this.flightAt = this.time;
    this.onEvent({
      type: "strike",
      slot,
      aim: h.aimOffset,
      power,
      seq,
      hole: this.index,
      wind: this.course.wind || { x: 0, z: 0 },
    });
    return true;
  }
  extendTurn(seconds = 30) {
    if (this.phase !== "playing" || this.extensions >= 2 || seconds !== 30)
      return false;
    this.extensions++;
    this.turnAt += seconds;
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
        (!p.connected && this.time - (p.lostAt ?? this.time) > 30) ||
        (this.turnSeconds > 0 && this.time - this.turnAt > this.turnSeconds))
    ) {
      const d = h.distanceToHole();
      this.strike(
        p.slot,
        p.ai
          ? Math.sin(
              this.seed + p.slot * 67 + this.index * 97 + h.strokes * 43,
            ) * { rookie: 0.11, club: 0.045, pro: 0.012 }[this.skill]
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
      b.x < (this.course.bounds?.left ?? -78) ||
      b.x > (this.course.bounds?.right ?? 78) ||
      b.z > (this.course.bounds?.near ?? 32) ||
      b.z < (this.course.bounds?.far ?? -275) ||
      this.time - this.flightAt > 25
    ) {
      h.ball = { ...this.lastLie, vx: 0, vy: 0, vz: 0 };
      h.strokes++;
      h.state = "aim";
      this.onEvent({ type: "penalty", slot: p.slot });
    }
    if (h.state === "flight") return;
    if (this.mode === "closest") {
      p.closest = (p.closest || 0) + h.distanceToHole();
      h.state = "holed";
    }
    if (this.mode === "scramble") {
      this.scrambleWave.add(p.slot);
      const remainingWave = this.players.filter(
        (g) => !this.scrambleWave.has(g.slot),
      );
      if (h.state !== "holed" && remainingWave.length) {
        this.turn = remainingWave[0].slot;
        this.turnAt = this.time;
        return;
      }
      const best = this.players
        .slice()
        .sort((a, b) => a.hole.distanceToHole() - b.hole.distanceToHole())[0];
      const strokes = Math.max(...this.players.map((g) => g.hole.strokes));
      for (const g of this.players) {
        g.hole.ball = { ...best.hole.ball };
        g.hole.strokes = strokes;
        g.hole.state = h.state === "holed" ? "holed" : "aim";
      }
      this.scrambleWave.clear();
      if (h.state !== "holed" && strokes < 8) {
        this.turn = this.players[0].slot;
        this.turnAt = this.time;
        return;
      }
      for (const g of this.players) {
        g.complete = true;
        g.card.push(Math.min(9, strokes));
      }
    }
    if (!p.complete && (h.state === "holed" || h.strokes >= 8)) {
      p.complete = true;
      p.card.push(Math.min(9, h.strokes));
    }
    const remaining = this.players.filter((p) => !p.complete);
    if (!remaining.length) {
      if (this.index + 1 >= this.holes) {
        this.phase = "results";
        this.onEvent({
          type: "results",
          scores: golfScores(this.players, this.mode),
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
    this.addressed = null;
    this.onEvent({ type: "turn", turn: this.turn });
  }
}
