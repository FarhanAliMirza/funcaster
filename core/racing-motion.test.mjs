import test from "node:test";
import assert from "node:assert/strict";
import { RacingMotion } from "./racing-motion.js";
import { DriveControls } from "./drive-controls.js";
import { Pointer } from "./pointer.js";

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
const base = multiply(rotation([0, 1, 0], -57), rotation([1, 0, 0], 41));
const pose = ({ swing = 0, twist = 0 } = {}) => ({
  quat: multiply(
    multiply(base, rotation([0.6, 0.8, 0], swing)),
    rotation([0, 0, 1], twist),
  ),
});
const settle = (motion, sample, start = 20, end = 600, interval = 20) => {
  let result;
  for (let time = start; time <= end; time += interval)
    result = motion.update(sample, time);
  return result;
};

test("wheel is ready on its first packet and only screen-normal twist steers", () => {
  const motion = new RacingMotion();
  assert.deepEqual(motion.update(pose(), 0), {
    x: 0,
    y: 0,
    ready: true,
    progress: 1,
  });
  for (let time = 20; time <= 400; time += 20) {
    const result = motion.update(pose({ swing: 80 }), time);
    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
  }
  const result = settle(motion, pose({ swing: 65, twist: 10 }), 420, 900);
  assert.ok(result.x < -0.16 && result.x > -0.18, String(result.x));
  assert.equal(result.y, 0);
});

test("default steering preserves fine corrections and reaches full lock", () => {
  for (const [degrees, min, max] of [
    [2, 0, 0.001],
    [5, 0.04, 0.05],
    [10, 0.16, 0.18],
    [20, 0.49, 0.51],
    [32, 0.999, 1],
    [60, 0.999, 1],
  ]) {
    for (const direction of [-1, 1]) {
      const motion = new RacingMotion();
      motion.update(pose(), 0);
      const result = settle(motion, pose({ twist: degrees * direction }));
      const x = -result.x * direction;
      assert.ok(x >= min && x <= max, `${degrees}°/${direction}: ${x}`);
      assert.equal(result.y, 0);
    }
  }
});

test("wheel smooths sudden motion, reverses promptly and is sensor-rate stable", () => {
  const final = [];
  for (const interval of [10, 20, 50]) {
    const motion = new RacingMotion();
    motion.update(pose(), 0);
    let result;
    for (let time = interval; time <= 200; time += interval) {
      result = motion.update(pose({ twist: 32 }), time);
      if (time === interval)
        assert.ok(result.x > -0.6, "a single sample must not snap to full lock");
    }
    assert.ok(result.x < -0.95 && result.x > -0.97);
    final.push(result.x);
    for (let time = 200 + interval; time <= 300; time += interval)
      result = motion.update(pose({ twist: -32 }), time);
    assert.ok(result.x > 0.6);
    for (let time = 300 + interval; time <= 600; time += interval)
      result = motion.update(pose(), time);
    assert.ok(Math.abs(result.x) < 0.006);
  }
  assert.ok(Math.max(...final) - Math.min(...final) < 0.0001);
});

test("racing sensitivity stays bounded and center can reset instantly", () => {
  for (const value of [NaN, Infinity, undefined])
    assert.equal(new RacingMotion({ sensitivity: value }).sensitivity, 1);
  const motion = new RacingMotion();
  motion.setSensitivity(2.4);
  assert.equal(motion.sensitivity, 1.3);
  motion.setSensitivity(NaN);
  assert.equal(motion.sensitivity, 1.3);
  motion.setSensitivity(0.1);
  assert.equal(motion.sensitivity, 0.7);
  assert.equal(motion.update(pose({ twist: 17 }), 0).ready, true);
  motion.reset();
  assert.deepEqual(motion.update(pose({ twist: -26 }), 20), {
    x: 0,
    y: 0,
    ready: true,
    progress: 1,
  });
});

test("pedals support two thumbs, brake priority, cancellation and focus loss", () => {
  const controls = new DriveControls();
  controls.down("gas", 1, 0);
  controls.down("boost", 2, 1);
  assert.deepEqual(controls.read(10), {
    gas: true,
    brake: false,
    boost: true,
  });
  controls.up(2);
  assert.equal(controls.read(200).gas, true);
  assert.equal(controls.read(200).boost, false);
  controls.down("brake", 3, 201);
  assert.deepEqual(controls.read(202), {
    gas: false,
    brake: true,
    boost: false,
  });
  controls.up(3);
  assert.equal(controls.read(210).gas, true);
  controls.release();
  assert.deepEqual(controls.read(220), {
    gas: false,
    brake: false,
    boost: false,
  });
});

test("classic pointer uses calibrated coordinates without stale gyro extrapolation", () => {
  const pointer = new Pointer();
  pointer.rateDps = { yaw: 100, pitch: -50 };
  pointer.emaRate = { x: 1, y: -1 };
  pointer.update({ party: { active: true, x: 0.6, y: 0 } }, 0.03, 100);
  const position = pointer.sampleAt(120);
  assert.ok(
    Math.abs(position.x - 0.8) < 0.001 && Math.abs(position.y - 0.5) < 0.001,
  );
  pointer.update({ party: { active: false, x: 0, y: 0 } }, 0.03, 140);
  assert.equal(pointer.live, false);
});
