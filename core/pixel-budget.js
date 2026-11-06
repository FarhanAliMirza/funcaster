/** Backing-store budgets; CSS geometry and calibrated aim stay unchanged. */
export const SINGLE_VIEW_PIXELS = 4_200_000;
export const SPLIT_VIEW_PIXELS = 2_100_000;

const extent = (value) => (Number.isFinite(value) ? Math.max(1, value) : 1);

/** The host supplies the number of independent frames on this screen. */
export function viewPixelBudget(search = globalThis.location?.search || "") {
  const views = Number(new URLSearchParams(search).get("views"));
  return Number.isInteger(views) && views >= 2 && views <= 4
    ? SPLIT_VIEW_PIXELS
    : SINGLE_VIEW_PIXELS;
}

export function dprFor(
  width,
  height,
  { cap = 2, maxPixels = SINGLE_VIEW_PIXELS } = {},
) {
  if (
    !Number.isFinite(cap) ||
    cap <= 0 ||
    !Number.isFinite(maxPixels) ||
    maxPixels < 1
  )
    throw new RangeError(
      "A positive DPR cap and a pixel budget of at least one are required",
    );
  const device = globalThis.devicePixelRatio;
  return Math.min(
    Number.isFinite(device) && device > 0 ? device : 1,
    cap,
    Math.sqrt(maxPixels / (extent(width) * extent(height))),
  );
}

/** Avoid resetting a 2D context and reallocating its bitmap every frame. */
export function resizeCanvas(canvas, width, height, options) {
  const dpr = dprFor(width, height, options);
  const backingWidth = Math.max(1, Math.floor(extent(width) * dpr));
  const backingHeight = Math.max(1, Math.floor(extent(height) * dpr));
  if (canvas.width !== backingWidth) canvas.width = backingWidth;
  if (canvas.height !== backingHeight) canvas.height = backingHeight;
  return dpr;
}
