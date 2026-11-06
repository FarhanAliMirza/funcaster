import { axesFromSample, dot, clamp, DEG } from "./orientation.js";

// Relative body axes keep the neutral grip away from Euler wrap/gimbal problems.
// The browser already fuses gyro and accelerometer for orientation; acceleration
// is separately used for an optional flick, never as an absolute position sensor.
export class PartyMotion {
  constructor({ sensitivity = 1.25 } = {}) {
    this.sensitivity = clamp(sensitivity, 0.6, 2.4);
    this.reset();
  }
  reset() {
    this.neutral = null;
    this.buffer = [];
    this.started = null;
    this.progress = 0;
    this.noise = 0.8;
    this.x = 0;
    this.y = 0;
    this.last = null;
    this.lastFlick = -Infinity;
  }
  setSensitivity(value) {
    if (Number.isFinite(value)) this.sensitivity = clamp(value, 0.6, 2.4);
  }
  update(sample, time) {
    if (
      !Number.isFinite(time) ||
      !sample ||
      !(
        (sample.quat?.length === 4 && sample.quat.every(Number.isFinite)) ||
        [sample.alpha, sample.beta, sample.gamma].every(Number.isFinite)
      )
    )
      return null;
    const axes = axesFromSample(sample);
    if (!this.neutral) {
      if (this.started === null) this.started = time;
      const previous = this.buffer.at(-1);
      const movement = previous
        ? Math.acos(clamp(dot(previous.axes.z, axes.z), -1, 1)) / DEG
        : 0;
      if (movement > 2.5) this.buffer = [];
      this.buffer.push({ axes, time });
      while (this.buffer.length > 100) this.buffer.shift();
      const span = time - this.buffer[0].time;
      this.progress = clamp(span / 850, 0, 1);
      const noise = Math.max(
        ...this.buffer.map(
          (s) => Math.acos(clamp(dot(s.axes.z, axes.z), -1, 1)) / DEG,
        ),
      );
      if (
        (span >= 850 && this.buffer.length >= 6 && noise < 4) ||
        time - this.started > 5000
      ) {
        this.neutral = axes;
        this.noise = clamp(noise * 0.7, 0.65, 3);
        this.progress = 1;
        this.last = time;
      }
      return { x: 0, y: 0, ready: !!this.neutral, progress: this.progress };
    }
    const z = dot(axes.z, this.neutral.z);
    let horizontal = Math.atan2(dot(axes.z, this.neutral.x), z) / DEG;
    let vertical = -Math.atan2(dot(axes.z, this.neutral.y), z) / DEG;
    const angle = (Number(sample.screenAngle) || 0) * DEG;
    const hx = horizontal * Math.cos(angle) + vertical * Math.sin(angle);
    const vy = vertical * Math.cos(angle) - horizontal * Math.sin(angle);
    const response = (v) => {
      const magnitude = Math.max(0, Math.abs(v) - this.noise);
      return (
        Math.sign(v) *
        Math.pow(clamp(magnitude / (24 / this.sensitivity), 0, 1), 0.9)
      );
    };
    const dt = clamp((time - this.last) / 1000, 0.001, 0.1);
    this.last = time;
    // Approximately 35 ms smoothing at rest; large deliberate moves respond faster.
    const mix = 1 - Math.exp(-dt * (28 + Math.abs(hx) * 1.2));
    this.x += (response(hx) - this.x) * mix;
    this.y += (response(vy) - this.y) * mix;
    return {
      x: clamp(this.x, -1, 1),
      y: clamp(this.y, -1, 1),
      ready: true,
      progress: 1,
    };
  }
  flick(acceleration, time) {
    if (!this.neutral || !acceleration || time - this.lastFlick < 1100)
      return false;
    const { x, y, z } = acceleration;
    if (![x, y, z].every(Number.isFinite)) return false;
    if (Math.hypot(x, y, z) > 7.5) {
      this.lastFlick = time;
      return true;
    }
    return false;
  }
}
