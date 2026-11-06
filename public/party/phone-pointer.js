const finite = Number.isFinite;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
/** A second stream for the retained shell pointer; game calibration never enters it. */
export class PhonePointer {
  constructor() {
    this.raw = null;
    this.rates = null;
    this.touch = null;
    this.rawAt = -Infinity;
    this.ratesAt = -Infinity;
    this.touchAt = -Infinity;
    this.lastSent = -Infinity;
    this.seq = 0;
    this.rawRevision = 0;
    this.touchRevision = 0;
    this.sentKey = "";
  }
  orientation(event, time) {
    if (![event.beta, event.gamma, time].every(finite)) return false;
    this.raw = {
      a: finite(event.alpha) ? clamp(event.alpha, 0, 360) : 0,
      b: clamp(event.beta, -180, 180),
      g: clamp(event.gamma, -90, 90),
    };
    this.rawAt = time;
    this.rawRevision++;
    return true;
  }
  quaternion(q, time) {
    if (
      !finite(time) ||
      !Array.isArray(q) ||
      q.length !== 4 ||
      !q.every(finite) ||
      Math.abs(Math.hypot(...q) - 1) > 0.05
    )
      return false;
    this.raw = { q: [...q] };
    this.rawAt = time;
    this.rawRevision++;
    return true;
  }
  motion(rate, time) {
    if (!rate || ![rate.beta, rate.gamma, rate.alpha, time].every(finite))
      return false;
    this.rates = [rate.beta, rate.gamma, rate.alpha].map((value) =>
      clamp(value, -2000, 2000),
    );
    this.ratesAt = time;
    this.rawRevision++;
    return true;
  }
  point(x, y, time) {
    if (![x, y, time].every(finite)) return false;
    this.touch = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
    this.touchAt = time;
    this.touchRevision++;
    return true;
  }
  pending(time, mode = "motion") {
    const touch = mode === "touch",
      sample = touch ? this.touch : this.raw,
      at = touch ? this.touchAt : this.rawAt,
      key = `${mode}:${touch ? this.touchRevision : this.rawRevision}`;
    return (
      !!sample &&
      finite(time) &&
      key !== this.sentKey &&
      time >= at &&
      time - at <= 250
    );
  }
  flush(time, { enabled, writable = true, mode = "motion" } = {}) {
    const touch = mode === "touch",
      sample = touch ? this.touch : this.raw,
      at = touch ? this.touchAt : this.rawAt;
    const key = `${mode}:${touch ? this.touchRevision : this.rawRevision}`;
    if (
      !enabled ||
      !writable ||
      !finite(time) ||
      !sample ||
      key === this.sentKey ||
      time < at ||
      time - at > 250 ||
      time - this.lastSent < 8
    )
      return null;
    this.lastSent = time;
    this.sentKey = key;
    return {
      ...sample,
      ...(!touch && this.rates && time - this.ratesAt <= 250
        ? { r: [...this.rates] }
        : {}),
      seq: ++this.seq,
    };
  }
}
