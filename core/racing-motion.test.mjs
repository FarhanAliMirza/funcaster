import test from "node:test";
import assert from "node:assert/strict";
import { Quaternion, Matrix4, Vector3 } from "three";
import { RacingMotion } from "./racing-motion.js";
import { DriveControls } from "./drive-controls.js";
import { Pointer } from "./pointer.js";
function pose(roll = 0, flip = false, incline = 50, pitch = 0) {
  const a = (incline * Math.PI) / 180;
  const right = new Vector3(1, 0, 0),
    up = new Vector3(0, Math.cos(a), Math.sin(a)),
    normal = right.clone().cross(up);
  const turn = new Quaternion().setFromAxisAngle(
    normal,
    (-roll * Math.PI) / 180,
  );
  const tilt = new Quaternion().setFromAxisAngle(
    right,
    (pitch * Math.PI) / 180,
  );
  const axes = flip
    ? [up.clone(), right.clone().negate(), normal.clone()]
    : [up.clone().negate(), right.clone(), normal.clone()];
  axes.forEach((v) => v.applyQuaternion(turn).applyQuaternion(tilt));
  return {
    quat: new Quaternion()
      .setFromRotationMatrix(new Matrix4().makeBasis(...axes))
      .toArray(),
    screenAngle: flip ? 270 : 90,
  };
}
function settle(m, p) {
  let result;
  for (let t = 0; t <= 800; t += 20) result = m.update(p, t);
  assert.equal(result.ready, true);
}
test("wheel accepts both landscape grips and gentle clockwise roll steers right", () => {
  for (const flip of [false, true])
    for (const incline of [10, 50, 85]) {
      const m = new RacingMotion();
      settle(m, pose(0, flip, incline));
      let r;
      for (let t = 820; t < 1200; t += 20)
        r = m.update(pose(10, flip, incline), t);
      assert.ok(r.x > 0.16 && r.x < 0.18, `${flip}/${incline}: ${r.x}`);
      for (let t = 1200; t < 1500; t += 20)
        r = m.update(pose(-10, flip, incline), t);
      assert.ok(r.x < -0.16 && r.x > -0.18);
      for (let t = 1500; t < 1700; t += 20)
        r = m.update(pose(0, flip, incline, 25), t);
      assert.ok(Math.abs(r.x) < 0.015, "forward tilt should not steer");
    }
});
test("wheel rejects movement during calibration, noise and invalid quaternions; sensitivity and recenter work", () => {
  const m = new RacingMotion();
  assert.equal(m.update({ quat: [0, 0, 0, 0] }, 0), null);
  for (let t = 0; t < 1000; t += 20) m.update(pose(t % 40 ? 8 : -8), t);
  assert.equal(m.neutral, null);
  m.reset();
  settle(m, pose());
  for (let t = 820; t < 1200; t += 20)
    assert.equal(m.update(pose(1.9 * Math.sin(t)), t).x, 0);
  let low, high;
  m.setSensitivity(0.7);
  for (let t = 1200; t < 1500; t += 20) low = m.update(pose(10), t).x;
  m.setSensitivity(1.3);
  for (let t = 1500; t < 1800; t += 20) high = m.update(pose(10), t).x;
  assert.ok(high > low * 2);
  m.reset();
  settle(m, pose(7));
  assert.equal(m.update(pose(7), 820).x, 0);
});
test("default steering preserves fine corrections and reaches full lock without a large rotation", () => {
  for (const [degrees, min, max] of [
    [2, 0, 0.001],
    [5, 0.04, 0.05],
    [10, 0.16, 0.18],
    [20, 0.49, 0.51],
    [32, 0.999, 1],
    [60, 0.999, 1],
  ]) {
    for (const direction of [-1, 1]) {
      const m = new RacingMotion();
      settle(m, pose());
      let result;
      for (let t = 820; t <= 1320; t += 20)
        result = m.update(pose(degrees * direction), t);
      const x = result.x * direction;
      assert.ok(x >= min && x <= max, `${degrees}°/${direction}: ${x}`);
    }
  }
});
test("wheel smooths sudden motion, reverses promptly and responds consistently across sensor rates", () => {
  const final = [];
  for (const interval of [10, 20, 50]) {
    const m = new RacingMotion();
    settle(m, pose());
    let result;
    for (let t = 800 + interval; t <= 1000; t += interval) {
      result = m.update(pose(32), t);
      if (t === 800 + interval)
        assert.ok(result.x < 0.6, "a single sample must not snap to full lock");
    }
    assert.ok(result.x > 0.95 && result.x < 0.97, "full response within 200 ms");
    final.push(result.x);
    for (let t = 1000 + interval; t <= 1100; t += interval)
      result = m.update(pose(-32), t);
    assert.ok(result.x < -0.6, "countersteering must not remain stuck turning right");
    for (let t = 1100 + interval; t <= 1400; t += interval)
      result = m.update(pose(), t);
    assert.ok(Math.abs(result.x) < 0.006, "releasing the tilt recenters cleanly");
  }
  assert.ok(Math.max(...final) - Math.min(...final) < 0.0001);
});
test("racing sensitivity has bounded defaults and keeps full steering available at gentler settings", () => {
  for (const value of [NaN, Infinity, undefined])
    assert.equal(new RacingMotion({ sensitivity: value }).sensitivity, 1);
  const m = new RacingMotion();
  m.setSensitivity(2.4);
  assert.equal(m.sensitivity, 1.3);
  m.setSensitivity(NaN);
  assert.equal(m.sensitivity, 1.3);
  m.setSensitivity(0.1);
  assert.equal(m.sensitivity, 0.7);
  settle(m, pose());
  let result;
  for (let t = 820; t <= 1320; t += 20) result = m.update(pose(46), t);
  assert.ok(result.x > 0.999);
});
test("pedals support two thumbs, brake takes priority, cancellation and focus loss release everything", () => {
  const d = new DriveControls();
  d.down("gas", 1, 0);
  d.down("boost", 2, 1);
  assert.deepEqual(d.read(10), { gas: true, brake: false, boost: true });
  d.up(2);
  assert.equal(d.read(200).gas, true);
  assert.equal(d.read(200).boost, false);
  d.down("brake", 3, 201);
  assert.deepEqual(d.read(202), { gas: false, brake: true, boost: false });
  d.up(3);
  assert.equal(d.read(210).gas, true);
  d.release();
  assert.deepEqual(d.read(220), { gas: false, brake: false, boost: false });
});
test("classic pointer uses calibrated coordinates without stale gyro extrapolation", () => {
  const p = new Pointer();
  p.rateDps = { yaw: 100, pitch: -50 };
  p.emaRate = { x: 1, y: -1 };
  p.update({ party: { active: true, x: 0.6, y: -0.4 } }, 0.03, 100);
  const position = p.sampleAt(120);
  assert.ok(
    Math.abs(position.x - 0.8) < 0.001 && Math.abs(position.y - 0.3) < 0.001,
  );
  p.update({ party: { active: false, x: 0, y: 0 } }, 0.03, 140);
  assert.equal(p.live, false);
});
