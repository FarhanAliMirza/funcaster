import { drawIsotropic } from "../../core/render-scale.js";
import { resizeCanvas } from "../../core/pixel-budget.js";
import { GameLink } from "../../core/net.js";
import { PartyWorld } from "./party-world.js";
import { SEATS } from "../../core/seats.js";
const canvas = document.querySelector("canvas"),
  ctx = canvas.getContext("2d"),
  hud = document.querySelector("#hud");
const identity = (p) =>
  p.ai ? { color: "#c9ef77", name: "Helper", shape: "✦" } : SEATS[p.slot];
const game = location.pathname.split("/")[2];
let world,
  last = performance.now(),
  reported = false;
const link = new GameLink({
  onPresence(p) {
    if (!world) {
      world = new PartyWorld({
        game,
        seed: p.setup.seed,
        seats: p.slots.length,
        mode: p.setup.worldMode,
        bot: p.setup.bot,
      });
      link.bindReplay(world, ["input", "act", "step"], [["init"]]);
      document.querySelector("#hint").textContent =
        game === "shooting-range"
          ? p.setup.worldMode === "steal"
            ? "Aim · tap to tag · tap again after the ring clears to claim"
            : "Aim · tap to shoot · first hit claims the target"
          : game === "island-flyover"
            ? "Tilt to fly · grab the glowing rings first"
            : p.setup.worldMode === "coop"
              ? "Tilt to dodge · tap to fire · collect + to revive a friend"
              : "Tilt to dodge · tap to fire · most hits wins";
    }
  },
  onOrientation(data, slot) {
    if (world && data.party?.active)
      world.input(slot, data.party.x, data.party.y);
    else world?.input(slot, 0, 0);
  },
  onCommand(cmd, slot) {
    if (cmd.type === "button" && cmd.button === "A")
      world?.act(slot, (cmd.ageMs || 0) / 1000);
  },
});
link.bindState(() => world);
function circle(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r, (r * canvas.width) / canvas.height, 0, 0, Math.PI * 2);
  ctx.fill();
}
function draw(now) {
  requestAnimationFrame(draw);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  link.clock(now);
  if (!world) return;
  link.advance(dt, (_, step) => world.step(step));
  if (world.done && !reported && link.authority) {
    reported = true;
    link.finish(world.scores());
  }
  resizeCanvas(canvas, canvas.clientWidth, canvas.clientHeight);
  ctx.setTransform(canvas.width, 0, 0, canvas.height, 0, 0);
  ctx.fillStyle = game === "island-flyover" ? "#164c59" : "#182821";
  ctx.fillRect(0, 0, 1, 1);
  ctx.strokeStyle = "#ffffff0b";
  ctx.lineWidth = 0.001;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.moveTo(i / 20, 0);
    ctx.lineTo(i / 20, 1);
    ctx.moveTo(0, i / 20);
    ctx.lineTo(1, i / 20);
    ctx.stroke();
  }
  if (game === "shooting-range") {
    for (const t of world.range.targets) {
      const x = t.x / 1.6,
        r = t.r / 1.6;
      circle(
        x,
        t.y,
        r,
        t.kind === "bomb"
          ? "#ef5d7e"
          : t.kind === "gold"
            ? "#f7c600"
            : "#faf5da",
      );
      circle(x, t.y, r * 0.6, t.kind === "bomb" ? "#462236" : "#ce673c");
      circle(x, t.y, r * 0.25, "#faf5da");
      const tag = world.tags[t.id];
      if (tag) {
        ctx.strokeStyle = identity(world.players[tag.slot]).color;
        ctx.lineWidth = 0.008;
        ctx.beginPath();
        ctx.ellipse(
          x,
          t.y,
          r + 0.01,
          ((r + 0.01) * canvas.width) / canvas.height,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    }
    for (const p of world.players) {
      const x = (p.input.x + 1) / 2,
        y = (p.input.y + 1) / 2;
      ctx.strokeStyle = identity(p).color;
      ctx.lineWidth = 0.003;
      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        0.02,
        (0.02 * canvas.width) / canvas.height,
        0,
        0,
        Math.PI * 2,
      );
      ctx.moveTo(x - 0.035, y);
      ctx.lineTo(x + 0.035, y);
      ctx.moveTo(x, y - 0.035);
      ctx.lineTo(x, y + 0.035);
      ctx.stroke();
    }
  } else if (game === "island-flyover") {
    circle(0.5, 0.5, 0.37, "#296f60");
    circle(0.46, 0.48, 0.26, "#478e69");
    for (const r of world.objects) {
      ctx.strokeStyle = r.owner === null ? "#f7c600" : SEATS[r.owner].color;
      ctx.globalAlpha = r.owner === null ? 1 : 0.25;
      ctx.lineWidth = 0.006;
      ctx.beginPath();
      ctx.ellipse(
        r.x,
        r.y,
        0.025,
        (0.025 * canvas.width) / canvas.height,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    for (const o of world.objects) {
      circle(o.x, o.y, 0.025, o.kind === "revive" ? "#c9ef77" : "#d387ed");
      ctx.fillStyle = "#17231f";
      drawIsotropic(ctx, canvas.width, canvas.height, o.x, o.y, () => {
        ctx.font = ".04px sans-serif";
        ctx.fillText(o.kind === "revive" ? "+" : "•", -0.012, 0.012);
      });
    }
    for (const b of world.bolts) {
      ctx.fillStyle = identity(world.players[b.slot]).color;
      ctx.fillRect(b.x - 0.003, b.y, 0.006, 0.025);
    }
  }
  if (game !== "shooting-range")
    for (const p of world.players) {
      ctx.globalAlpha = p.lives <= 0 ? 0.2 : p.invulnerable > 0 ? 0.65 : 1;
      ctx.fillStyle = identity(p).color;
      drawIsotropic(ctx, canvas.width, canvas.height, p.x, p.y, () => {
        ctx.beginPath();
        ctx.moveTo(0, -0.033);
        ctx.lineTo(-0.028, 0.024);
        ctx.lineTo(0, 0.013);
        ctx.lineTo(0.028, 0.024);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#17231f";
        ctx.font = "bold .018px sans-serif";
        ctx.fillText(p.ai ? "✦" : String(p.slot + 1), -0.006, 0.008);
      });
    }
  ctx.globalAlpha = 1;
  const scores = world.scores();
  hud.replaceChildren(
    ...scores.map((p) => {
      const s = document.createElement("span");
      s.style.color = identity(p).color;
      s.textContent = `${SEATS[p.slot].shape} ${SEATS[p.slot].name} · ${p.score}${game === "alien-attack" ? " · " + p.stats.lives + " ♥" : ""}`;
      return s;
    }),
  );
  document.querySelector("#timer").textContent = world.done
    ? "Round complete"
    : Math.max(
        0,
        Math.ceil((game === "shooting-range" ? 60 : 90) - world.time),
      ) + "s";
}
requestAnimationFrame(draw);
