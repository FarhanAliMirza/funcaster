import { FixedStep } from "../core/fixed-step.js";
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
/** A deterministic lifecycle, independent of sockets and animation scheduling. */
export function defineGame(hooks) {
  for (const required of ["init", "step", "render", "result"])
    if (typeof hooks?.[required] !== "function")
      throw Error(`Missing game hook: ${required}`);
  return Object.freeze({ ...hooks });
}
export class GameRuntime {
  constructor(game, context, { hz = 120, onResult = () => {} } = {}) {
    this.game = defineGame(game);
    this.context = freeze(structuredClone(context));
    this.clock = new FixedStep(hz);
    this.inputs = new Map();
    this.seats = new Set(
      this.context.seats.map((s) => (typeof s === "number" ? s : s.slot)),
    );
    this.onResult = onResult;
    this.phase = "ready";
    this.game.init(this.context);
  }
  start() {
    if (this.phase === "ready") this.phase = "playing";
  }
  pause(value = true) {
    if (["playing", "paused"].includes(this.phase))
      this.phase = value ? "paused" : "playing";
  }
  input(slot, value) {
    if (
      !this.seats.has(slot) ||
      this.phase === "finished" ||
      this.phase === "disposed"
    )
      return false;
    this.inputs.set(slot, freeze(structuredClone(value)));
    return true;
  }
  seat(slot, event) {
    if (!this.seats.has(slot) || this.phase === "disposed") return;
    if (["leave", "away", "autopilot"].includes(event))
      this.inputs.delete(slot);
    this.game.onSeat?.(slot, event);
  }
  advance(seconds, views = []) {
    if (this.phase === "disposed") return;
    if (this.phase === "playing")
      this.clock.advance(seconds, (dt) => {
        if (this.phase === "playing")
          this.game.step(dt, Object.fromEntries(this.inputs));
      });
    this.game.render(views);
  }
  finish() {
    if (this.phase === "disposed") return null;
    if (this.phase === "finished") return this.final;
    this.final = freeze(structuredClone(this.game.result()));
    this.phase = "finished";
    this.onResult(this.final);
    return this.final;
  }
  dispose() {
    if (this.phase === "disposed") return;
    this.phase = "disposed";
    this.inputs.clear();
    this.game.dispose?.();
  }
}
