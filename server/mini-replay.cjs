"use strict";
const { PartyWorld } = require("../games/shared/party-world.js");
const { sharedWorld } = require("../core/catalog.js");
const { Rally } = require("../games/table-tennis/logic.js"),
  { Duel } = require("../games/swordplay/logic.js"),
  { Race } = require("../games/kart/logic.js"),
  { Flight } = require("../games/island-flyover/logic.js"),
  { Range } = require("../games/shooting-range/logic.js"),
  { Patrol } = require("../games/alien-attack/logic.js"),
  { seededRandom } = require("../core/random.js");
const TYPES = {
  "table-tennis": Rally,
  swordplay: Duel,
  kart: Race,
  "island-flyover": Flight,
  "shooting-range": Range,
  "alien-attack": Patrol,
};
const METHODS = {
  "table-tennis": {
    start: 1,
    update: 2,
    setPaddle: 2,
    setOpponent: 2,
    setPartner: 2,
    swing: 1,
    swingOpponent: 1,
  },
  swordplay: {
    start: 1,
    update: 2,
    setBlade: 2,
    setOpponent: 1,
    humanStrike: 3,
    strikeOpponent: 2,
    swing: 2,
  },
  kart: { start: 1, update: 2, setSteer: 1, setPedals: 1 },
  "island-flyover": { start: 1, update: 2, setTilt: 2 },
  "shooting-range": { start: 1, update: 1, shoot: 3 },
  "alien-attack": { start: 1, update: 2, setSteer: 1, shoot: 1 },
};
class MiniReplay {
  constructor(id, seed, setup, seats) {
    Object.assign(this, {
      id,
      seed,
      setup,
      seats,
      calls: [],
      sequence: 0,
      valid: true,
      bytes: 0,
      steps: 0,
      started: false,
    });
  }
  accept(sequence, calls) {
    if (
      !this.valid ||
      sequence !== this.sequence ||
      !Array.isArray(calls) ||
      calls.length > 1000
    )
      return (this.valid = false);
    const bytes = JSON.stringify(calls).length;
    const shared = sharedWorld(this.id, this.setup);
    if (this.bytes + bytes > 12000000) return (this.valid = false);
    const safe = (v, depth = 0) =>
      depth < 5 &&
      (v === null ||
        typeof v === "boolean" ||
        (typeof v === "string" && v.length < 40) ||
        (typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e9) ||
        (typeof v === "object" &&
          Object.keys(v).length < 12 &&
          Object.entries(v).every(
            ([k, x]) =>
              !["__proto__", "constructor", "prototype"].includes(k) &&
              safe(x, depth + 1),
          )));
    try {
      for (const call of calls) {
        if (!Array.isArray(call) || !safe(call)) throw Error("Invalid call");
        const [method, ...args] = call;
        if (method === "init") {
          if (this.game) throw Error("Cannot reset");
          this.game = shared
            ? new PartyWorld({
                game: this.id,
                seed: this.seed,
                seats: this.seats,
                mode: this.setup.worldMode,
                bot: this.setup.bot,
              })
            : new TYPES[this.id]({
                seed: this.seed,
                rng: seededRandom(this.seed),
                winScore: this.setup.winScore || 7,
                coop: this.setup.tennisMode === "coop",
              });
          if (!shared) this.game.rng = seededRandom(this.seed);
          if (["table-tennis", "swordplay"].includes(this.id))
            this.game.humanOpponent = this.seats > 1 && !this.game.coop;
        } else if (shared) {
          if (
            !this.game ||
            !({ input: 3, act: 2, step: 1 }[method] === args.length)
          )
            throw Error("Invalid shared method");
          if (
            method === "step" &&
            (Math.abs(args[0] - 1 / 120) > 1e-10 || ++this.steps > 12000)
          )
            throw Error("Invalid step");
          if (
            method !== "step" &&
            (!Number.isInteger(args[0]) || args[0] < 0 || args[0] >= this.seats)
          )
            throw Error("Invalid player");
          this.game[method](...args);
        } else {
          if (!this.game || METHODS[this.id][method] !== args.length)
            throw Error("Invalid method");
          if (method === "start") {
            if (this.started) throw Error("Cannot restart");
            this.started = true;
            this.start = args[0];
            this.time = args[0];
          }
          if (method === "update") {
            if (!this.started) {
              this.game.update(...args);
              continue;
            }
            if (
              ++this.steps > 75000 ||
              args[0] < this.time - 20 ||
              args[0] - this.start > 605000 ||
              (args.length === 2 && Math.abs(args[1] - 1 / 120) > 1e-10)
            )
              throw Error("Invalid step");
            this.time = args[0];
          }
          if (
            ["setPaddle", "setOpponent"].includes(method) &&
            this.id === "table-tennis" &&
            args.some((x) => x < 0 || x > 1)
          )
            throw Error("Invalid aim");
          if (
            ["setSteer", "setTilt"].includes(method) &&
            args.some((x) => Math.abs(x) > 90)
          )
            throw Error("Invalid tilt");
          this.game[method](...args);
        }
      }
    } catch {
      return (this.valid = false);
    }
    this.bytes += bytes;
    this.calls.push(...calls);
    this.sequence++;
    return true;
  }
  scores() {
    const g = this.game;
    if (!g) return [];
    if (sharedWorld(this.id, this.setup)) return g.scores();
    if (this.id === "table-tennis")
      return [
        {
          slot: 0,
          score: g.score.player,
          stats: { longestRally: g.longestRally },
        },
        {
          slot: 1,
          score: g.coop ? g.score.player : g.score.ai,
          stats: { longestRally: g.longestRally },
        },
      ].slice(0, this.seats);
    if (this.id === "swordplay")
      return [
        { slot: 0, score: g.player.points },
        { slot: 1, score: g.ai.points },
      ].slice(0, this.seats);
    if (this.id === "kart")
      return [
        {
          slot: 0,
          score: Math.round(
            g.state === "done"
              ? Math.max(0, 100000 - g.lapTimes.reduce((a, b) => a + b, 0) / 10)
              : (g.lap - 1) * 1000 + g.nextCp * 100 + g.trackT * 100,
          ),
          stats: {
            totalMs: Math.round(g.elapsedMs),
            bestLapMs: Math.round(g.bestLapMs || 0),
            laps: g.lapTimes.length,
            boostsUsed: 3 - g.boostsLeft,
          },
        },
      ];
    if (this.id === "island-flyover")
      return [
        {
          slot: 0,
          score: g.collected * 100,
          stats: { rings: g.collected, timeMs: Math.round(g.elapsedMs || 0) },
        },
      ];
    if (this.id === "shooting-range")
      return [
        {
          slot: 0,
          score: g.score,
          stats: {
            shots: g.shots,
            hits: g.hits,
            bombs: g.bombs,
            accuracy: Math.round(g.accuracy * 100),
          },
        },
      ];
    return [
      {
        slot: 0,
        score: g.score,
        stats: { kills: g.kills, lives: g.lives, distance: Math.round(g.z) },
      },
    ];
  }
}
module.exports = { MiniReplay, TYPES };
