import { axesFromSample, clamp, DEG } from "./orientation.js";

const normalizeQuaternion = (q) => {
  const length = Math.hypot(...q);
  if (!Number.isFinite(length) || length < 1e-9) return null;
  return q.map((value) => value / length);
};

/** Convert the device-to-world body axes into an [x, y, z, w] quaternion. */
function quaternionFromAxes(axes) {
  const m00 = axes.x.x,
    m01 = axes.y.x,
    m02 = axes.z.x,
    m10 = axes.x.y,
    m11 = axes.y.y,
    m12 = axes.z.y,
    m20 = axes.x.z,
    m21 = axes.y.z,
    m22 = axes.z.z;
  const trace = m00 + m11 + m22;
  let x, y, z, w;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  return normalizeQuaternion([x, y, z, w]);
}

function quaternionFromSample(sample) {
  if (
    sample?.quat?.length === 4 &&
    sample.quat.every(Number.isFinite) &&
    Math.abs(Math.hypot(...sample.quat) - 1) <= 0.05
  )
    return normalizeQuaternion(sample.quat);
  if (
    !sample ||
    ![sample.alpha, sample.beta, sample.gamma].every(Number.isFinite)
  )
    return null;
  return quaternionFromAxes(axesFromSample(sample));
}

/** `inverse(reference) * current`, expressed in the reference phone frame. */
function relativeQuaternion(reference, current) {
  const [ax, ay, az, aw] = reference,
    [bx, by, bz, bw] = current;
  return [
    aw * bx - ax * bw - ay * bz + az * by,
    aw * by + ax * bz - ay * bw - az * bx,
    aw * bz - ax * by + ay * bx - az * bw,
    aw * bw + ax * bx + ay * by + az * bz,
  ];
}

const wrapDegrees = (value) => {
  let result = value;
  while (result > 180) result -= 360;
  while (result <= -180) result += 360;
  return result;
};

/**
 * One-dimensional phone steering.
 *
 * The first valid attitude is the center immediately: there is no stillness
 * gate and no prescribed grip. Later attitudes are decomposed into swing and
 * twist in that first phone frame. Swing changes where the screen faces
 * (forward/back or side-to-side tilt) and is discarded. Only twist around the
 * axis perpendicular to the screen becomes steering.
 */
export class PartyMotion {
  constructor({
    sensitivity = 1.25,
    minSensitivity = 0.6,
    maxSensitivity = 2.4,
    fullTurn = 24,
    exponent = 0.9,
    responseRate = 28,
    deadzone = 0.8,
  } = {}) {
    this.minSensitivity = minSensitivity;
    this.maxSensitivity = maxSensitivity;
    this.fullTurn = fullTurn;
    this.exponent = exponent;
    this.responseRate = responseRate;
    this.deadzone = deadzone;
    this.sensitivity = clamp(
      Number.isFinite(sensitivity) ? sensitivity : 1.25,
      minSensitivity,
      maxSensitivity,
    );
    this.reset();
  }

  reset() {
    this.neutral = null;
    this.x = 0;
    this.last = null;
  }

  setSensitivity(value) {
    if (Number.isFinite(value))
      this.sensitivity = clamp(value, this.minSensitivity, this.maxSensitivity);
  }

  update(sample, time) {
    if (!Number.isFinite(time)) return null;
    const attitude = quaternionFromSample(sample);
    if (!attitude) return null;

    if (!this.neutral) {
      this.neutral = attitude;
      this.last = time;
      return { x: 0, y: 0, ready: true, progress: 1 };
    }

    const relative = relativeQuaternion(this.neutral, attitude);
    // Swing-twist decomposition around local Z only needs the quaternion's
    // z/w pair. At the one singular pose (an exact 180-degree screen flip),
    // twist is undefined, so retain the last stable steering value.
    const twistLength = Math.hypot(relative[2], relative[3]);
    if (twistLength < 1e-6)
      return { x: clamp(this.x, -1, 1), y: 0, ready: true, progress: 1 };
    const twist = wrapDegrees(
      (2 * Math.atan2(relative[2] / twistLength, relative[3] / twistLength)) /
        DEG,
    );
    const magnitude = Math.max(0, Math.abs(twist) - this.deadzone);
    const fullTurn = this.fullTurn / this.sensitivity;
    const target =
      -Math.sign(twist) *
      Math.pow(
        clamp(magnitude / Math.max(1, fullTurn - this.deadzone), 0, 1),
        this.exponent,
      );
    const dt = clamp((time - this.last) / 1000, 0.001, 0.1);
    this.last = time;
    this.x += (target - this.x) * (1 - Math.exp(-dt * this.responseRate));
    return { x: clamp(this.x, -1, 1), y: 0, ready: true, progress: 1 };
  }
}
