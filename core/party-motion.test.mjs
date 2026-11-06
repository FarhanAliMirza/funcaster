import test from "node:test";
import assert from "node:assert/strict";
import { PartyMotion } from "./party-motion.js";
const flat = { alpha: 0, beta: 25, gamma: 0 };
function calibrate(m, pose = flat) {
  let result;
  for (let t = 0; t <= 1000; t += 20) result = m.update(pose, t);
  assert.equal(result.ready, true);
  return 1000;
}
test("neutral grip is measured and held still noise stays at zero", () => {
  const m = new PartyMotion();
  calibrate(m);
  for (let t = 1020; t < 1500; t += 20) {
    const r = m.update({ ...flat, gamma: Math.sin(t) * 0.3 }, t);
    assert.equal(r.x, 0);
    assert.equal(r.y, 0);
  }
});
test("small tilt is responsive, sensitivity can be adjusted, and values stay bounded", () => {
  const a = new PartyMotion({ sensitivity: 0.6 }),
    b = new PartyMotion({ sensitivity: 2.4 });
  calibrate(a);
  calibrate(b);
  let x, y;
  for (let t = 1020; t < 1600; t += 20) {
    x = a.update({ ...flat, gamma: 10 }, t);
    y = b.update({ ...flat, gamma: 10 }, t);
  }
  assert.ok(x.x > 0.1);
  assert.ok(y.x > x.x * 1.6);
  for (let t = 1600; t < 2000; t += 20) {
    const r = b.update({ ...flat, gamma: 85, beta: 70 }, t);
    assert.ok(Math.abs(r.x) <= 1 && Math.abs(r.y) <= 1);
  }
});
test("calibration remains neutral across yaw wrap and upright grips", () => {
  for (const beta of [0, 45, 89, 110]) {
    const m = new PartyMotion();
    calibrate(m, { alpha: 359.9, beta, gamma: 0 });
    const r = m.update({ alpha: 0.1, beta, gamma: 0 }, 1020);
    assert.ok(Math.abs(r.x) < 0.02 && Math.abs(r.y) < 0.02);
  }
});
test("portrait and landscape transform into screen-relative control axes", () => {
  const m = new PartyMotion();
  calibrate(m, { alpha: 0, beta: 0, gamma: 0 });
  let r;
  for (let t = 1020; t < 1800; t += 20)
    r = m.update({ alpha: 0, beta: 0, gamma: 12, screenAngle: 90 }, t);
  assert.ok(Math.abs(r.x) < 0.01);
  assert.ok(r.y < -0.4);
});
test("invalid samples never finish calibration or poison the next valid sample", () => {
  const m = new PartyMotion();
  assert.equal(m.update({ alpha: NaN, beta: 0, gamma: 0 }, 0), null);
  assert.equal(m.update({ quat: [0, 1, NaN, 1] }, 200), null);
  assert.equal(m.neutral, null);
  calibrate(m);
  assert.ok(Number.isFinite(m.update(flat, 1200).x));
});
test("a low but consistent sensor rate can calibrate", () => {
  const m = new PartyMotion();
  let r;
  for (let t = 0; t <= 1250; t += 125) r = m.update(flat, t);
  assert.equal(r.ready, true);
});
test("recenter measures a new grip and flicks have a cooldown", () => {
  const m = new PartyMotion();
  calibrate(m);
  assert.equal(m.flick({ x: 8, y: 0, z: 0 }, 2000), true);
  assert.equal(m.flick({ x: 12, y: 0, z: 0 }, 2200), false);
  assert.equal(m.flick({ x: 0, y: 0, z: 1 }, 3300), false);
  assert.equal(m.flick({ x: 0, y: 9, z: 0 }, 3400), true);
  m.reset();
  calibrate(m, { alpha: 40, beta: 60, gamma: 12 });
  const r = m.update({ alpha: 40, beta: 60, gamma: 12 }, 1500);
  assert.equal(r.x, 0);
  assert.equal(r.y, 0);
});
