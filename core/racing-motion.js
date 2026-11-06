import { MOTION_PROFILES } from "./motion-settings.js";
import { PartyMotion } from "./party-motion.js";
import { axesFromSample, dot, clamp, DEG } from "./orientation.js";
const screenAxes = (axes, degrees) => {
  const a = degrees * DEG,
    c = Math.cos(a),
    s = Math.sin(a);
  const mix = (u, v) => ({
    x: axes.x.x * u + axes.y.x * v,
    y: axes.x.y * u + axes.y.y * v,
    z: axes.x.z * u + axes.y.z * v,
  });
  return { right: mix(c, s), up: mix(-s, c), normal: axes.z };
};
const angleBetween = (a, b) => Math.acos(clamp(dot(a, b), -1, 1)) / DEG;
// Steering measures roll about the screen normal, relative to a comfortable
// two-handed grip. Forward/back pitch isn't a pedal: it must not cause braking.
export class RacingMotion extends PartyMotion {
  constructor({ sensitivity = MOTION_PROFILES.racing.default } = {}) {
    super({ sensitivity: MOTION_PROFILES.racing.default });
    this.setSensitivity(sensitivity);
  }
  setSensitivity(value) {
    if (Number.isFinite(value))
      this.sensitivity = clamp(
        value,
        MOTION_PROFILES.racing.min,
        MOTION_PROFILES.racing.max,
      );
  }
  update(sample, time) {
    if (!Number.isFinite(time) || !sample) return null;
    if (
      sample.quat
        ? !Array.isArray(sample.quat) ||
          sample.quat.length !== 4 ||
          !sample.quat.every(Number.isFinite) ||
          Math.abs(Math.hypot(...sample.quat) - 1) > 0.05
        : ![sample.alpha, sample.beta, sample.gamma].every(Number.isFinite)
    )
      return null;
    const axes = screenAxes(
      axesFromSample(sample),
      Number(sample.screenAngle) || 0,
    );
    if (!this.neutral) {
      const previous = this.buffer.at(-1);
      if (
        previous &&
        Math.max(
          angleBetween(previous.axes.right, axes.right),
          angleBetween(previous.axes.normal, axes.normal),
        ) > 2.5
      )
        this.buffer = [];
      this.buffer.push({ axes, time });
      while (this.buffer.length > 100) this.buffer.shift();
      const span = time - this.buffer[0].time;
      const noise = Math.max(
        ...this.buffer.map((p) => angleBetween(p.axes.right, axes.right)),
      );
      this.progress = clamp(span / 700, 0, 1);
      if (span >= 700 && this.buffer.length >= 6 && noise < 3) {
        this.neutral = axes;
        this.noise = clamp(noise, 2, 3);
        this.progress = 1;
        this.last = time;
      }
      return { x: 0, y: 0, ready: !!this.neutral, progress: this.progress };
    }
    const roll =
      -Math.atan2(
        dot(axes.right, this.neutral.up),
        dot(axes.right, this.neutral.right),
      ) / DEG;
    // Keep little corrections gentle while retaining full lock for corners.
    // At the default: a 2° quiet center, ~17% steering at 10°, full lock at 32°.
    const fullLock = 32 / this.sensitivity;
    const target =
      Math.sign(roll) *
      Math.pow(
        clamp((Math.abs(roll) - this.noise) / (fullLock - this.noise), 0, 1),
        1.35,
      );
    const dt = clamp((time - this.last) / 1000, 0.001, 0.1);
    this.last = time;
    // 63 ms smoothing removes hand tremor without a long steering delay.
    this.x += (target - this.x) * (1 - Math.exp(-dt * 16));
    return { x: clamp(this.x, -1, 1), y: 0, ready: true, progress: 1 };
  }
}
