/** Logical 720p artwork units; normalised input coordinates stay unchanged. */
export const renderScale = (height) =>
  (Number.isFinite(height) ? Math.max(1, height) : 1) / 720;

/** Draw a local symbol in equal horizontal/vertical units inside a normalised canvas. */
export function drawIsotropic(ctx, width, height, x, y, draw) {
  const w = Number.isFinite(width) ? Math.max(1, width) : 1,
    h = Number.isFinite(height) ? Math.max(1, height) : 1;
  ctx.save();
  try {
    ctx.translate(x, y);
    ctx.scale(1, w / h);
    draw();
  } finally {
    ctx.restore();
  }
}
