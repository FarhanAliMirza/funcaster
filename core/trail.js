/**
 * Motion trail — recent pointer history, shared by every game that cares how
 * fast you swung: sword arcs, racket hits, golf swings, blade slices.
 */
export class Trail {
  constructor({ lifetimeMs = 140, minStep = 0.0005, speedWindowMs = 55 } = {}) {
    this.lifetimeMs = lifetimeMs;
    this.minStep = minStep;
    this.speedWindowMs = speedWindowMs;
    this.points = [];
    this.segments = []; // segments added on the last push, for hit tests
  }

  push(x, y, now) {
    const last = this.points[this.points.length - 1];
    this.segments = [];
    if (!last || Math.hypot(x - last.x, y - last.y) > this.minStep) {
      if (last)
        this.segments.push({
          x1: last.x,
          y1: last.y,
          x2: x,
          y2: y,
          t0: last.t,
          t1: now,
        });
      this.points.push({ x, y, t: now });
    }
    while (this.points.length && now - this.points[0].t > this.lifetimeMs)
      this.points.shift();
  }

  clear() {
    this.points.length = 0;
    this.segments.length = 0;
  }

  /**
   * Speed in screen-widths per second, measured over a window of history.
   *
   * Single-sample velocity divides by the packet inter-arrival time, so one
   * network hitch fabricates a huge bogus speed — enough to make a motionless
   * still pointer register as a fast gesture. A window is stable across stalls.
   */
  speed() {
    if (this.points.length < 2) return 0;
    const last = this.points[this.points.length - 1];
    let i = this.points.length - 1;
    while (i > 0 && last.t - this.points[i - 1].t < this.speedWindowMs) i -= 1;
    const first = this.points[i];
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0) return 0;
    return Math.hypot(last.x - first.x, last.y - first.y) / dt;
  }
}

/** Shortest distance from a point to a line segment. */
export function segmentDistance(cx, cy, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(cx - x1, cy - y1);
  const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
  return Math.hypot(cx - (x1 + t * dx), cy - (y1 + t * dy));
}

/** First entry of a moving segment into a circle, fraction 0..1 or null. */
export function segmentCircleEntry(x0, y0, x1, y1, r) {
  const dx = x1 - x0,
    dy = y1 - y0,
    a = dx * dx + dy * dy,
    c = x0 * x0 + y0 * y0 - r * r;
  if (c <= 0) return 0;
  if (a < 1e-15) return null;
  const b = 2 * (x0 * dx + y0 * dy),
    d = b * b - 4 * a * c;
  if (d < 0) return null;
  const u = (-b - Math.sqrt(d)) / (2 * a);
  return u >= 0 && u <= 1 ? u : null;
}
