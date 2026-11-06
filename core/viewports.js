export function viewports(count, width, height) {
  if (!Number.isInteger(count) || count < 1 || count > 4)
    throw Error("One to four views are supported");
  const columns = count === 1 ? 1 : 2,
    rows = count > 2 ? 2 : 1;
  return Array.from({ length: count }, (_, i) => {
    const x = Math.floor(((i % columns) * width) / columns),
      y = Math.floor((Math.floor(i / columns) * height) / rows);
    return {
      x,
      y,
      width: Math.floor((((i % columns) + 1) * width) / columns) - x,
      height: Math.floor(((Math.floor(i / columns) + 1) * height) / rows) - y,
    };
  });
}
export class QualityGovernor {
  constructor() {
    this.scale = 1;
    this.samples = [];
  }
  sample(milliseconds) {
    if (
      !Number.isFinite(milliseconds) ||
      milliseconds <= 0 ||
      milliseconds > 250
    )
      return this.scale;
    this.samples.push(milliseconds);
    if (this.samples.length < 180) return this.scale;
    const average =
      this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.samples = [];
    if (average > 28) this.scale = Math.max(0.6, this.scale - 0.1);
    else if (average < 17) this.scale = Math.min(1, this.scale + 0.05);
    return this.scale;
  }
}
