import { Hole } from "./logic.js";
/** Predict a remote ball from its stroke; authoritative snapshots settle it. */
export class FlightView {
  constructor(event) {
    this.event = event;
    this.time = 0;
    this.hole = new Hole({ pin: event.pin, wind: event.wind });
    this.hole.ball = { ...event.ball };
    this.hole.aimOffset = event.aim;
    this.hole.strike(event.power);
  }
  sample(clock) {
    const target = Math.min(25, Math.max(0, (clock - this.event.clock) / 1000));
    while (this.time + 1 / 120 <= target) {
      this.time += 1 / 120;
      this.hole.update(this.time * 1000, 1 / 120);
    }
    return this.hole.ball;
  }
}
