import { resizeCanvas } from "../../core/pixel-budget.js";
import { renderScale } from "../../core/render-scale.js";
import { SEATS } from "../../core/seats.js";
const colors = SEATS.map((seat) => seat.color);
const palettes = ["#f0ebff", "#fff0e7", "#e6f5ed", "#fff7db"];
export class PartyRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext("2d");
    this.frame = null;
    this.insets = { top: 0, bottom: 0 };
    this.positions = new Map();
    this.particles = [];
    this.feedback = new Map();
    this.motion = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.running = true;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(),
      d = resizeCanvas(this.canvas, r.width, r.height);
    this.w = r.width;
    this.h = r.height;
    this.g.setTransform(d, 0, 0, d, 0, 0);
  }
  setInsets({ top = 0, bottom = 0 } = {}) {
    this.insets = {
      top: Number.isFinite(top) ? Math.max(0, top) : 0,
      bottom: Number.isFinite(bottom) ? Math.max(0, bottom) : 0,
    };
  }
  setFrame(frame) {
    this.frame = frame;
    for (const p of frame.players) {
      if (
        this.feedback.get(p.slot) !== p.feedback &&
        p.feedback > 0 &&
        this.motion
      ) {
        for (let i = 0; i < 10; i++)
          this.particles.push({
            slot: p.slot,
            x: p.x,
            y: p.y,
            vx: (Math.random() - 0.5) * 0.6,
            vy: -Math.random() * 0.6,
            t: 0.7,
            color: p.hit ? "#f57678" : colors[p.slot],
          });
      }
      this.feedback.set(p.slot, p.feedback);
    }
  }
  clear() {
    this.frame = null;
    this.feedback.clear();
    this.positions.clear();
    this.particles = [];
  }
  round(x, y, w, h, r, fill) {
    const g = this.g;
    g.fillStyle = fill;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill();
  }
  star(x, y, r, color) {
    const g = this.g;
    g.fillStyle = color;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2,
        s = i % 2 ? r * 0.47 : r;
      g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
    }
    g.closePath();
    g.fill();
  }
  animate(time) {
    if (!this.running) return;
    requestAnimationFrame(this.animate);
    const dt = Math.min(0.04, (time - (this.time || time)) / 1000);
    this.time = time;
    const g = this.g;
    g.clearRect(0, 0, this.w, this.h);
    if (!this.frame?.players.length || !this.w || !this.h) return;
    const top = Math.min(this.h - 1, this.insets.top),
      bottom = Math.min(this.h - top - 1, this.insets.bottom),
      scale = renderScale(this.h),
      w = this.w / scale,
      h = (this.h - top - bottom) / scale,
      n = this.frame.players.length,
      lw = w / n;
    // Keep lane backgrounds behind the UI, but paint gameplay only between its rails.
    this.frame.players.forEach((player, index) => {
      g.fillStyle = palettes[player.slot];
      g.fillRect((index * this.w) / n, 0, this.w / n, this.h);
    });
    // Work in 720p art units: sprites, outlines and captions all scale together.
    g.save();
    g.translate(0, top);
    g.scale(scale, scale);
    this.frame.players.forEach((p, index) => {
      const left = index * lw;
      g.save();
      g.beginPath();
      g.rect(left, 0, lw, h);
      g.clip();
      g.translate(left, 0);
      g.fillStyle = palettes[p.slot];
      g.fillRect(0, 0, lw, h);
      const color = colors[p.slot],
        game = this.frame.game;
      let pos = this.positions.get(p.slot);
      if (!pos) {
        pos = { x: p.x, y: p.y };
        this.positions.set(p.slot, pos);
      }
      const mix = 1 - Math.exp(-30 * dt);
      pos.x += (p.x - pos.x) * mix;
      pos.y += (p.y - pos.y) * mix;
      if (game === "neon-drift") {
        g.fillStyle = "#21564f";
        g.fillRect(lw * 0.055, 0, lw * 0.89, h);
        g.strokeStyle = "#8ccaba";
        g.lineWidth = 2;
        g.setLineDash([20, 30]);
        g.lineDashOffset = -(p.distance || 0) * 180;
        for (const x of [0.35, 0.65]) {
          g.beginPath();
          g.moveTo(lw * x, 0);
          g.lineTo(lw * x, h);
          g.stroke();
        }
        g.setLineDash([]);
        g.fillStyle = "#d3f180";
        for (let i = 0; i < 15; i++) {
          const y = ((i * 60 + (p.distance || 0) * 160) % (h + 60)) - 60;
          g.fillRect(lw * 0.04, y, 5, 23);
          g.fillRect(lw * 0.94, y, 5, 23);
        }
      } else {
        g.globalAlpha = 0.32;
        for (let i = 0; i < 17; i++) {
          const x = (((i * 73 + 31) % 101) / 101) * lw,
            y = (((i * 57 + 15) % 103) / 103) * h;
          this.star(x, y, 3 + (i % 3), color);
        }
        g.globalAlpha = 1;
        if (game === "star-catch") {
          g.fillStyle = "#ffffff77";
          g.beginPath();
          g.ellipse(lw * 0.25, h * 0.97, lw * 0.75, h * 0.1, 0, 0, Math.PI * 2);
          g.fill();
          g.beginPath();
          g.ellipse(lw, h * 0.99, lw * 0.65, h * 0.12, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      for (const o of p.objects) {
        const x = o.x * lw,
          y = o.y * h,
          r = Math.max(8, o.radius * lw);
        if (o.kind === "bubble") {
          const alpha = Math.min(1, (5 - o.age) * 2);
          g.globalAlpha = alpha;
          g.fillStyle = ["#b5a0ec", "#ffa58b", "#75cfbb", "#f4cb6b"][o.id % 4];
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = "#fff";
          g.lineWidth = 2;
          g.stroke();
          g.beginPath();
          g.strokeStyle = "#ffffff99";
          g.lineWidth = 4;
          g.arc(x, y, r * 0.65, 3.5, 4.7);
          g.stroke();
          g.globalAlpha = 1;
          if (o.dwell > 0) {
            g.strokeStyle = color;
            g.lineWidth = 3;
            g.beginPath();
            g.arc(
              x,
              y,
              r + 6,
              -Math.PI / 2,
              -Math.PI / 2 + (Math.PI * 2 * o.dwell) / 0.13,
            );
            g.stroke();
          }
        } else if (o.kind === "hazard") {
          g.save();
          g.translate(x, y);
          g.rotate(o.age);
          this.round(
            -r,
            -r,
            r * 2,
            r * 2,
            game === "neon-drift" ? 4 : r,
            "#f67683",
          );
          g.strokeStyle = "#fff";
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(-r * 0.35, -r * 0.35);
          g.lineTo(r * 0.35, r * 0.35);
          g.moveTo(r * 0.35, -r * 0.35);
          g.lineTo(-r * 0.35, r * 0.35);
          g.stroke();
          g.restore();
        } else if (game === "neon-drift") {
          g.strokeStyle = "#ffe17c";
          g.lineWidth = 5;
          g.beginPath();
          g.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2);
          g.stroke();
        } else {
          this.star(x, y, r * 1.4, "#f7bd43");
          g.fillStyle = "#fff4ba";
          g.beginPath();
          g.arc(x - r * 0.2, y - r * 0.3, r * 0.22, 0, Math.PI * 2);
          g.fill();
        }
      }
      const x = pos.x * lw,
        size = game === "star-catch" ? lw * 0.105 : Math.min(48, lw * 0.14),
        y =
          game === "star-catch"
            ? Math.min(pos.y * h, h - size * 0.85)
            : pos.y * h;
      g.save();
      g.translate(x, y);
      if (p.hit > 0 && this.motion) g.translate(Math.sin(time * 0.1) * 3, 0);
      if (game === "star-catch") {
        g.fillStyle = "#0000000d";
        g.beginPath();
        g.ellipse(0, size * 0.6, size * 1.1, size * 0.2, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = p.hit > 0 ? "#f67683" : color;
        g.beginPath();
        g.moveTo(-size, -size * 0.23);
        g.lineTo(size, -size * 0.23);
        g.lineTo(size * 0.7, size * 0.52);
        g.quadraticCurveTo(0, size * 0.8, -size * 0.7, size * 0.52);
        g.closePath();
        g.fill();
        g.fillStyle = "#ffffff60";
        g.beginPath();
        g.ellipse(0, -size * 0.23, size, size * 0.2, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(-size * 0.26, size * 0.26, 3, 0, Math.PI * 2);
        g.arc(size * 0.26, size * 0.26, 3, 0, Math.PI * 2);
        g.fill();
      } else if (game === "neon-drift") {
        g.rotate((p.x - pos.x) * 1.4);
        this.round(
          -size * 0.65,
          -size * 0.8,
          size * 1.3,
          size * 1.8,
          12,
          p.hit > 0 ? "#f67683" : color,
        );
        this.round(
          -size * 0.4,
          -size * 0.4,
          size * 0.8,
          size * 0.5,
          5,
          "#d3f4ff",
        );
        this.round(-size * 0.9, -size * 0.45, 7, size * 0.5, 2, "#17372f");
        this.round(size * 0.7, -size * 0.45, 7, size * 0.5, 2, "#17372f");
        g.fillStyle = "#fcf2bc";
        g.fillRect(-size * 0.42, -size * 0.7, size * 0.2, 5);
        g.fillRect(size * 0.23, -size * 0.7, size * 0.2, 5);
        if (this.motion) {
          g.fillStyle = "#9de7da";
          g.beginPath();
          g.moveTo(-size * 0.25, size);
          g.lineTo(size * 0.25, size);
          g.lineTo(0, size * (1.3 + Math.sin(time * 0.02) * 0.2));
          g.fill();
        }
      } else {
        g.strokeStyle = color;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(0, 0, 17, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(0, 0, 8, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = color;
        g.beginPath();
        g.arc(0, 0, 4, 0, Math.PI * 2);
        g.fill();
        if (p.pulse > 0) {
          g.globalAlpha = p.pulse / 0.4;
          g.lineWidth = 4;
          g.beginPath();
          g.arc(0, 0, (1 - p.pulse / 0.4) * lw * 0.3 + 20, 0, Math.PI * 2);
          g.stroke();
          g.globalAlpha = 1;
        }
      }
      g.restore();
      if (p.combo >= 3) {
        g.font = "700 11px system-ui";
        g.textAlign = "center";
        g.fillStyle = game === "neon-drift" ? "#d7f889" : color;
        g.fillText(`${p.combo} IN A ROW`, lw / 2, 25);
      }
      for (const part of this.particles.filter((q) => q.slot === p.slot)) {
        g.globalAlpha = part.t / 0.7;
        this.star(part.x * lw, part.y * h, 4, part.color);
      }
      g.globalAlpha = 1;
      g.restore();
      if (index) {
        g.fillStyle = "#f7f5ef";
        g.fillRect(left - 3, 0, 6, h);
      }
    });
    g.restore();
    this.particles = this.particles.filter((p) => {
      p.t -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += dt * 0.8;
      return p.t > 0;
    });
  }
}
