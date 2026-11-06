// Independent pointer ownership allows both thumbs on different pedals.
export class DriveControls {
  constructor() {
    this.release();
  }
  down(control, pointer, now) {
    if (!["gas", "brake", "boost"].includes(control)) return;
    this.pointers.set(pointer, control);
    if (control === "boost") this.boostUntil = now + 180;
  }
  up(pointer) {
    this.pointers.delete(pointer);
  }
  release() {
    this.pointers = new Map();
    this.boostUntil = -Infinity;
  }
  read(now) {
    const held = new Set(this.pointers.values());
    return {
      gas: held.has("gas") && !held.has("brake"),
      brake: held.has("brake"),
      boost: now < this.boostUntil,
    };
  }
}
