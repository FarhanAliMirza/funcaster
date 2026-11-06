/** Experimental sequencing gate. Not wired into the party namespace. */
export class InputSequencer {
  constructor({ delay = 6, maxFrames = 36000 } = {}) {
    this.delay = delay;
    this.maxFrames = maxFrames;
    this.tick = 0;
    this.inputs = new Map();
    this.frames = [];
  }
  input(seat, input, now) {
    if (
      !Number.isInteger(seat) ||
      seat < 0 ||
      seat > 3 ||
      !Number.isFinite(now)
    )
      return false;
    this.inputs.set(seat, {
      at: now,
      input: {
        steer: Math.max(-1, Math.min(1, Number(input.steer) || 0)),
        gas: input.gas === true,
        brake: input.brake === true,
        boost: input.boost === true,
      },
    });
    return true;
  }
  next(now) {
    if (this.tick >= this.maxFrames) return null;
    const players = {};
    for (let seat = 0; seat < 2; seat++) {
      const value = this.inputs.get(seat);
      players[seat] =
        value && now - value.at < 500
          ? { ...value.input }
          : { autopilot: true };
    }
    const frame = {
      tick: this.tick++,
      applyAt: this.tick - 1 + this.delay,
      players,
    };
    this.frames.push(frame);
    return frame;
  }
}
export class FrameBuffer {
  constructor() {
    this.tick = 0;
    this.frames = new Map();
    this.stalls = 0;
    this.stalled = false;
  }
  receive(frame) {
    if (
      !Number.isInteger(frame?.tick) ||
      frame.tick < 0 ||
      frame.tick > this.tick + 1200 ||
      !frame.players
    )
      return false;
    if (frame.tick < this.tick) return true;
    if (!this.frames.has(frame.tick))
      this.frames.set(frame.tick, structuredClone(frame));
    return true;
  }
  advance(step, budget = 12) {
    if (budget <= 0) return 0;
    let n = 0;
    while (n < budget && this.frames.has(this.tick)) {
      const f = this.frames.get(this.tick);
      this.frames.delete(this.tick++);
      step(f);
      n++;
    }
    if (!n && !this.stalled) this.stalls++;
    this.stalled = !n;
    return n;
  }
}
export function raceHash(race) {
  const bytes = new Uint8Array(
    new Float64Array(
      race.racers.flatMap((p) => [
        p.x,
        p.z,
        p.heading,
        p.speed,
        p.progress,
        p.lap,
        p.coins,
        p.finishTime || 0,
      ]),
    ).buffer,
  );
  let h = 2166136261;
  for (const b of bytes) h = Math.imul(h ^ b, 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}
