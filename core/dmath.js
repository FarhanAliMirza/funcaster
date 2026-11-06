/** Deterministic elementary functions for the opt-in lockstep spike.
 * Uses explicit IEEE-754 operations; no platform transcendental intrinsics.
 * Production keeps native Math until cross-engine/device acceptance passes.
 */
const PI = 3.141592653589793,
  HALF = PI / 2,
  TAU = PI * 2,
  LN2 = 0.6931471805599453;
export function sin(x) {
  if (!Number.isFinite(x)) return NaN;
  x -= Math.round(x / TAU) * TAU;
  let term = x,
    sum = x;
  for (let n = 1; n <= 18; n++) {
    term *= (-x * x) / (2 * n * (2 * n + 1));
    sum += term;
  }
  return sum;
}
export const cos = (x) => sin(x + HALF);
function atan(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  let invert = false,
    shift = false;
  if (x > 1) {
    x = 1 / x;
    invert = true;
  }
  if (x > 0.41421356237309503) {
    x = (x - 1) / (x + 1);
    shift = true;
  }
  let term = x,
    sum = x;
  for (let n = 1; n <= 35; n++) {
    term *= -x * x;
    sum += term / (2 * n + 1);
  }
  if (shift) sum += PI / 4;
  if (invert) sum = HALF - sum;
  return sign * sum;
}
export function atan2(y, x) {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  if (x === 0)
    return y === 0
      ? Object.is(x, -0)
        ? Object.is(y, -0)
          ? -PI
          : PI
        : y
      : y > 0
        ? HALF
        : -HALF;
  if (!Number.isFinite(x) && !Number.isFinite(y)) {
    x = Math.sign(x);
    y = Math.sign(y);
  }
  if (x > 0) return atan(y / x);
  return atan(y / x) + (y < 0 || Object.is(y, -0) ? -PI : PI);
}
export function exp(x) {
  if (Number.isNaN(x)) return NaN;
  if (x > 709.782712893384) return Infinity;
  if (x < -745) return 0;
  const k = Math.round(x / LN2),
    r = x - k * LN2;
  let sum = 1,
    term = 1;
  for (let n = 1; n <= 20; n++) {
    term *= r / n;
    sum += term;
  }
  let scale = 1,
    base = k < 0 ? 0.5 : 2,
    n = Math.abs(k);
  while (n) {
    if (n % 2) scale *= base;
    base *= base;
    n = Math.floor(n / 2);
  }
  return sum * scale;
}
export function hypot(...values) {
  let max = 0;
  for (const v of values) max = Math.max(max, Math.abs(v));
  if (!max || !Number.isFinite(max)) return max;
  let sum = 0;
  for (const v of values) {
    const q = v / max;
    sum += q * q;
  }
  return max * Math.sqrt(sum);
}
export const deterministic = Object.freeze({ sin, cos, atan2, exp, hypot });
export let raceMath = Math;
// Run each mode in a fresh worker, before importing Race (track tables are cached).
export function useDeterministicMath(enabled) {
  raceMath = enabled ? deterministic : Math;
}
