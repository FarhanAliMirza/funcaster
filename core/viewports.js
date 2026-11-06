/** Integer-pixel camera rectangles. A three-player game uses the whole screen. */
export function viewports(
  count,
  width,
  height,
  { threeLayout = "balanced" } = {},
) {
  if (!Number.isInteger(count) || count < 1 || count > 4)
    throw Error("One to four views are supported");
  if (!["balanced", "grid"].includes(threeLayout))
    throw Error("Unknown three-view layout");
  const w = Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0,
    h = Number.isFinite(height) ? Math.max(0, Math.floor(height)) : 0,
    halfW = Math.floor(w / 2),
    halfH = Math.floor(h / 2);
  if (count === 1) return [{ x: 0, y: 0, width: w, height: h }];
  if (count === 2 && w / Math.max(1, h) < 1.2)
    return [
      { x: 0, y: 0, width: w, height: halfH },
      { x: 0, y: halfH, width: w, height: h - halfH },
    ];
  if (count === 3 && threeLayout === "balanced")
    return [
      { x: 0, y: 0, width: w, height: halfH },
      { x: 0, y: halfH, width: halfW, height: h - halfH },
      { x: halfW, y: halfH, width: w - halfW, height: h - halfH },
    ];
  const rows = count > 2 ? 2 : 1;
  return Array.from({ length: count }, (_, i) => {
    const x = Math.floor(((i % 2) * w) / 2),
      y = Math.floor((Math.floor(i / 2) * h) / rows);
    return {
      x,
      y,
      width: Math.floor((((i % 2) + 1) * w) / 2) - x,
      height: Math.floor(((Math.floor(i / 2) + 1) * h) / rows) - y,
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
