/** Keep current input responsive without streaming unchanged samples at full rate. */
export class InputPacer {
  constructor() {
    this.last = null;
    this.at = -Infinity;
    this.seq = 0;
    this.pendingBoost = false;
  }
  sample(input, time, { latency = 0, writable = true } = {}) {
    if (!Number.isFinite(time)) return null;
    if (input.boost && !this.last?.boost) this.pendingBoost = true;
    if (!writable) return null;
    input = { ...input, boost: !!input.boost || this.pendingBoost };
    const changed =
      !this.last ||
      ["x", "y"].some(
        (k) => Math.abs((input[k] || 0) - (this.last[k] || 0)) > 0.003,
      ) ||
      ["gas", "brake", "boost", "pulse"].some(
        (k) => !!input[k] !== !!this.last[k],
      );
    const release =
      this.last &&
      ["gas", "brake", "boost"].some((k) => this.last[k] && !input[k]);
    const interval = release ? 0 : changed ? (latency > 180 ? 50 : 30) : 200;
    if (time - this.at < interval) return null;
    this.at = time;
    this.last = { ...input };
    this.pendingBoost = false;
    return { ...input, seq: ++this.seq };
  }
}
