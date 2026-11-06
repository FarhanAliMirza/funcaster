import { seededRandom } from "../../core/random.js";
import { Range } from "../shooting-range/logic.js";
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
/** Shared optional modes. Fixed-step rules; rendering and sockets stay outside. */
export class PartyWorld {
  constructor({
    game,
    seed = 1,
    seats = 1,
    mode = "shared",
    bot = false,
  } = {}) {
    this.game = game;
    this.mode = mode;
    this.rng = seededRandom(seed);
    this.time = 0;
    this.done = false;
    this.nextSpawn = 0;
    this.nextRevive = 8;
    this.serial = 0;
    this.pending = [];
    this.objects = [];
    this.bolts = [];
    this.players = Array.from({ length: seats }, (_, slot) => ({
      slot,
      x: (slot + 1) / (seats + 1),
      y: 0.8,
      score: 0,
      lives: 3,
      cooldown: 0,
      invulnerable: 0,
      shots: 0,
      hits: 0,
      rings: 0,
      revives: 0,
      input: { x: 0, y: 0 },
    }));
    this.range = new Range({ rng: this.rng });
    this.range.start(0);
    this.tags = {};
    if (game === "island-flyover")
      this.objects = Array.from({ length: 20 }, (_, id) => ({
        id,
        x: 0.08 + this.rng() * 0.84,
        y: 0.1 + this.rng() * 0.7,
        owner: null,
      }));
    this.bot = bot && ["shooting-range", "alien-attack"].includes(game);
    if (this.bot)
      this.players.push({
        slot: this.players.length,
        ai: true,
        x: 0.5,
        y: 0.78,
        score: 0,
        lives: 3,
        cooldown: 0,
        invulnerable: 0,
        shots: 0,
        hits: 0,
        rings: 0,
        revives: 0,
        input: { x: 0, y: 0 },
      });
    this.botAt = 0.8;
  }
  input(slot, x, y) {
    const p = this.players[slot];
    if (p) p.input = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }
  act(slot, age = 0) {
    const p = this.players[slot];
    if (!p || this.done || p.lives <= 0 || p.cooldown > 0) return;
    p.cooldown = this.game === "shooting-range" ? 0.22 : 0.18;
    p.shots++;
    if (this.game === "shooting-range")
      this.pending.push({
        slot,
        x: (p.input.x + 1) * 0.8,
        y: (p.input.y + 1) * 0.5,
        at: Math.max(0, this.time - clamp(age, 0, 0.15)),
      });
    else if (this.game === "alien-attack")
      this.bolts.push({ x: p.x, y: p.y, slot });
  }
  step(dt) {
    if (this.done) return;
    this.time += dt;
    const bot = this.players.find((p) => p.ai);
    if (bot && bot.lives > 0) {
      const target =
        this.game === "shooting-range"
          ? this.range.targets.find((t) => t.kind !== "bomb")
          : this.objects.find((o) => o.kind === "alien");
      if (target) {
        this.input(
          bot.slot,
          this.game === "shooting-range"
            ? target.x / 0.8 - 1
            : clamp((target.x - bot.x) * 8, -1, 1),
          this.game === "shooting-range" ? target.y * 2 - 1 : 0,
        );
        if (this.time >= this.botAt) {
          this.act(bot.slot);
          this.botAt =
            this.time + (this.game === "shooting-range" ? 0.9 : 0.35);
        }
      }
    }
    for (const p of this.players) {
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.invulnerable = Math.max(0, p.invulnerable - dt);
    }
    if (this.game === "shooting-range") {
      this.range.update(this.time * 1000);
      this.pending.sort(
        (a, b) =>
          a.at - b.at ||
          ((a.slot - this.serial + 4) % 4) - ((b.slot - this.serial + 4) % 4),
      );
      for (const shot of this.pending) {
        const target = this.range.targets.find(
            (t) => Math.hypot(t.x - shot.x, t.y - shot.y) <= t.r,
          ),
          p = this.players[shot.slot];
        if (target && this.mode === "steal" && target.kind !== "bomb") {
          const tag = this.tags[target.id];
          if (!tag) {
            this.tags[target.id] = { slot: shot.slot, until: this.time + 0.35 };
            continue;
          }
          if (this.time < tag.until) continue;
        }
        const hit = this.range.shoot(shot.x, shot.y, this.time * 1000);
        if (hit.hit) {
          p.score = Math.max(0, p.score + hit.points);
          p.hits++;
          this.serial++;
        }
      }
      this.pending = [];
      this.done = this.range.state === "done";
    } else if (this.game === "island-flyover") {
      for (const p of this.players) {
        p.x = clamp(p.x + p.input.x * dt * 0.24, 0.025, 0.975);
        p.y = clamp(p.y + p.input.y * dt * 0.24, 0.06, 0.94);
      }
      for (const ring of this.objects) {
        if (ring.owner !== null) continue;
        const nearby = this.players
          .map((p) => ({ p, d: Math.hypot(p.x - ring.x, p.y - ring.y) }))
          .filter((x) => x.d < 0.042)
          .sort(
            (a, b) =>
              a.d - b.d ||
              ((a.p.slot - ring.id + 4) % 4) - ((b.p.slot - ring.id + 4) % 4),
          );
        if (nearby[0]) {
          const p = nearby[0].p;
          ring.owner = p.slot;
          p.rings++;
          p.score += 100 + Math.max(0, 90 - Math.floor(this.time));
        }
      }
      this.done =
        this.objects.every((r) => r.owner !== null) || this.time >= 90;
    } else {
      for (const p of this.players)
        if (p.lives > 0) {
          p.x = clamp(p.x + p.input.x * dt * 0.6, 0.04, 0.96);
          p.y = clamp(p.y + p.input.y * dt * 0.25, 0.55, 0.9);
        }
      if (this.time >= this.nextSpawn) {
        this.objects.push({
          id: this.serial++,
          kind: "alien",
          x: 0.06 + this.rng() * 0.88,
          y: -0.06,
        });
        this.nextSpawn = this.time + Math.max(0.22, 0.75 - this.time * 0.005);
      }
      if (this.mode === "coop" && this.time >= this.nextRevive) {
        this.nextRevive = this.time + 8;
        if (this.players.some((p) => p.lives === 0))
          this.objects.push({
            id: this.serial++,
            kind: "revive",
            x: 0.1 + this.rng() * 0.8,
            y: 0.1,
          });
      }
      for (const b of this.bolts) b.y -= dt * 0.9;
      for (const o of this.objects) {
        o.y += dt * 0.16;
        if (o.kind === "alien") {
          const hits = this.bolts
            .filter((b) => !b.spent && Math.hypot(b.x - o.x, b.y - o.y) < 0.05)
            .sort(
              (a, b) =>
                a.y - b.y ||
                ((a.slot - o.id + 4) % 4) - ((b.slot - o.id + 4) % 4),
            );
          if (hits[0]) {
            hits[0].spent = true;
            o.dead = true;
            const p = this.players[hits[0].slot];
            p.score += 100;
            p.hits++;
            continue;
          }
        }
        for (const p of this.players) {
          if (p.lives <= 0 || Math.hypot(p.x - o.x, p.y - o.y) > 0.065)
            continue;
          if (o.kind === "revive") {
            const down = this.players.find((x) => x.lives === 0);
            if (down) {
              down.lives = 1;
              down.invulnerable = 2;
              p.revives++;
            }
            o.dead = true;
            break;
          }
          if (!p.invulnerable) {
            p.lives--;
            p.invulnerable = 1.5;
            o.dead = true;
            break;
          }
        }
      }
      this.bolts = this.bolts.filter((b) => !b.spent && b.y > -0.1);
      this.objects = this.objects.filter((o) => !o.dead && o.y < 1.1);
      this.done = this.players.every((p) => p.lives <= 0) || this.time >= 90;
    }
  }
  scores() {
    const team = this.players.reduce((n, p) => n + p.score, 0);
    return this.players
      .filter((p) => !p.ai)
      .map((p) => ({
        slot: p.slot,
        score:
          this.game === "alien-attack" && this.mode === "coop" ? team : p.score,
        stats: {
          hits: p.hits,
          shots: p.shots,
          rings: p.rings,
          lives: p.lives,
          revives: p.revives,
        },
      }));
  }
}
