export class FixedStep {
  constructor(hz = 120) {
    if (!Number.isFinite(hz) || hz < 1 || hz > 240)
      throw Error("Invalid tick rate");
    this.dt = 1 / hz;
    this.accumulator = 0;
    this.time = 0;
    this.tick = 0;
  }
  advance(elapsed, step) {
    if (!Number.isFinite(elapsed) || elapsed <= 0) return;
    this.accumulator += Math.min(0.25, elapsed);
    while (this.accumulator + 1e-10 >= this.dt) {
      this.accumulator -= this.dt;
      this.time += this.dt;
      this.tick++;
      step(this.dt, this.time, this.tick);
    }
  }
}
