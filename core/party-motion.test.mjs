import test from "node:test";
import assert from "node:assert/strict";
import { PartyMotion } from "./party-motion.js";

const DEG = Math.PI / 180;
const multiply = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const rotation = ([x, y, z], degrees) => {
  const half = (degrees * DEG) / 2,
    s = Math.sin(half);
  return [x * s, y * s, z * s, Math.cos(half)];
};
const bases = [
  [0, 0, 0, 1],
  rotation([1, 0, 0], 74),
  multiply(rotation([0, 1, 0], -61), rotation([1, 0, 0], 38)),
];
const pose = (base, { swingAxis = [1, 0, 0], swing = 0, twist = 0 } = {}) => ({
  quat: multiply(
    multiply(base, rotation(swingAxis, swing)),
    rotation([0, 0, 1], twist),
  ),
});
const settle = (motion, sample, start = 20, end = 600, interval = 20) => {
  let result;
  for (let time = start; time <= end; time += interval)
    result = motion.update(sample, time);
  return result;
};

test("the first valid sample is centered and ready immediately", () => {
  for (const base of bases) {
    const motion = new PartyMotion();
    assert.deepEqual(motion.update(pose(base), 0), {
      x: 0,
      y: 0,
      ready: true,
      progress: 1,
    });
  }
});

test("forward, backward, sideways and diagonal screen tilt never steer", () => {
  for (const base of bases) {
    for (const axis of [
      [1, 0, 0],
      [0, 1, 0],
      [Math.SQRT1_2, Math.SQRT1_2, 0],
    ]) {
      const motion = new PartyMotion();
      motion.update(pose(base), 0);
      for (const [index, angle] of [-85, -40, -12, 0, 12, 40, 85].entries()) {
        const result = motion.update(
          pose(base, { swingAxis: axis, swing: angle }),
          20 + index * 20,
        );
        assert.equal(result.x, 0, `${axis.join(",")}/${angle}`);
        assert.equal(result.y, 0);
      }
    }
  }
});

test("only twist perpendicular to the screen steers from arbitrary grips", () => {
  for (const base of bases) {
    const right = new PartyMotion();
    right.update(pose(base), 0);
    const rightResult = settle(
      right,
      pose(base, { swingAxis: [0.6, 0.8, 0], swing: 65, twist: 12 }),
    );
    assert.ok(rightResult.x < -0.6, String(rightResult.x));
    assert.equal(rightResult.y, 0);

    const left = new PartyMotion();
    left.update(pose(base), 0);
    const leftResult = settle(
      left,
      pose(base, { swingAxis: [0.6, 0.8, 0], swing: -65, twist: -12 }),
    );
    assert.ok(leftResult.x > 0.6, String(leftResult.x));
    assert.equal(leftResult.y, 0);
  }
});

test("legacy orientation events isolate alpha twist and ignore beta/gamma tilt", () => {
  for (const tilted of [
    { alpha: 0, beta: 55, gamma: 0, screenAngle: 270 },
    { alpha: 0, beta: 0, gamma: -45, screenAngle: 90 },
  ]) {
    const motion = new PartyMotion();
    assert.equal(
      motion.update({ alpha: 0, beta: 0, gamma: 0, screenAngle: 0 }, 0).ready,
      true,
    );
    for (let time = 20; time <= 400; time += 20) {
      const result = motion.update(tilted, time);
      assert.equal(result.x, 0);
      assert.equal(result.y, 0);
    }
  }
  const motion = new PartyMotion();
  motion.update({ alpha: 0, beta: 0, gamma: 0, screenAngle: 0 }, 0);
  const result = settle(
    motion,
    { alpha: 12, beta: 0, gamma: 0, screenAngle: 90 },
    420,
    900,
  );
  assert.ok(result.x < -0.6);
  assert.equal(result.y, 0);
});

test("linear acceleration data cannot affect steering", () => {
  const motion = new PartyMotion();
  motion.update({ ...pose(bases[1]), motion: { ax: 0, ay: 0, az: 0 } }, 0);
  const result = settle(motion, {
    ...pose(bases[1]),
    motion: { ax: 100, ay: -100, az: 100, rx: 80, ry: -40, rz: 20 },
  });
  assert.equal(result.x, 0);
  assert.equal(result.y, 0);
});

test("sensitivity changes response and steering remains bounded", () => {
  const low = new PartyMotion({ sensitivity: 0.6 });
  const high = new PartyMotion({ sensitivity: 2.4 });
  low.update(pose(bases[0]), 0);
  high.update(pose(bases[0]), 0);
  const lowResult = settle(low, pose(bases[0], { twist: 8 }));
  const highResult = settle(high, pose(bases[0], { twist: 8 }));
  assert.ok(lowResult.x < -0.1);
  assert.ok(highResult.x < lowResult.x * 1.6);
  const bounded = settle(high, pose(bases[0], { twist: 120 }), 620, 1000);
  assert.ok(Math.abs(bounded.x) <= 1);
  assert.equal(bounded.y, 0);
});

test("invalid samples are ignored and reset immediately captures a new center", () => {
  const motion = new PartyMotion();
  assert.equal(motion.update({ alpha: NaN, beta: 0, gamma: 0 }, 0), null);
  assert.equal(motion.update({ quat: [0, 1, NaN, 1] }, 10), null);
  assert.equal(motion.neutral, null);
  assert.equal(motion.update(pose(bases[0], { twist: 30 }), 20).ready, true);
  assert.ok(settle(motion, pose(bases[0], { twist: 45 }), 40, 500).x < -0.5);
  motion.reset();
  assert.deepEqual(motion.update(pose(bases[2]), 520), {
    x: 0,
    y: 0,
    ready: true,
    progress: 1,
  });
});
