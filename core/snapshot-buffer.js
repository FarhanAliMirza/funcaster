const spatial = new Set([
  "x",
  "y",
  "z",
  "heading",
  "pitch",
  "bankVis",
  "rot",
  "rotation",
  "angle",
  "s",
  "lateral",
]);
function blend(a, b, t, key = "") {
  if (
    typeof a === "number" &&
    typeof b === "number" &&
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    spatial.has(key)
  ) {
    let d = b - a;
    if (["heading", "angle", "rot"].includes(key)) {
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
    }
    return a + d * t;
  }
  if (Array.isArray(b)) return b.map((v, i) => blend(a?.[i], v, t, key));
  if (b && typeof b === "object") {
    if (b.id !== undefined && a?.id !== b.id) return b;
    return Object.fromEntries(
      Object.entries(b).map(([k, v]) => [k, blend(a?.[k], v, t, k)]),
    );
  }
  return t < 1 && a !== undefined && !spatial.has(key) ? a : b;
}
export class SnapshotBuffer {
  constructor(delay = 100) {
    this.delay = delay;
    this.frames = [];
  }
  push(packet, received) {
    if (!Number.isFinite(packet?.clock) || !packet.state) return;
    const last = this.frames.at(-1);
    if (last && packet.clock <= last.clock) return;
    this.frames.push({ ...packet, received });
    if (this.frames.length > 12) this.frames.shift();
  }
  sample(now) {
    const last = this.frames.at(-1);
    if (!last) return null;
    const clock =
      last.clock + Math.min(250, Math.max(0, now - last.received)) - this.delay;
    let a = this.frames[0],
      b = last;
    for (const f of this.frames) {
      if (f.clock <= clock) a = f;
      else {
        b = f;
        break;
      }
    }
    const t = Math.max(
      0,
      Math.min(1, (clock - a.clock) / Math.max(1, b.clock - a.clock)),
    );
    return {
      clock: Math.min(clock, last.clock),
      state: blend(a.state, b.state, t),
      stale: now - last.received > 1000,
    };
  }
}
