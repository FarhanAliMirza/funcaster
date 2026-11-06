/** Fit is a shell presentation choice; keep it out of the replay bundle. */
export const GAME_FITS = Object.freeze({
  "mario-kart": "16:9",
  kart: "fluid",
  "island-flyover": "fluid",
  golf: "fluid",
  "fruit-ninja": "16:9",
  "table-tennis": "fluid",
  swordplay: "fluid",
  "shooting-range": "16:10",
  "alien-attack": "16:9",
  drawing: "fluid",
  "star-catch": "fluid",
  "bubble-burst": "fluid",
  "neon-drift": "fluid",
});
const canvasGames = new Set(["star-catch", "bubble-burst", "neon-drift"]);
const ratios = Object.freeze({
  "16:9": 16 / 9,
  "16:10": 16 / 10,
  "4:3": 4 / 3,
});
const dimension = (value) => (Number.isFinite(value) ? Math.max(0, value) : 0);

export function gameFit(id, { sharedScreens = false } = {}) {
  if (!Object.hasOwn(GAME_FITS, id))
    throw new RangeError(`Unknown game: ${id}`);
  return {
    fit: id === "drawing" && sharedScreens ? "16:9" : GAME_FITS[id],
    surface: canvasGames.has(id) ? "canvas" : "iframe",
  };
}

/** Largest exact-ratio rectangle centred inside a CSS-pixel content box. */
export function letterbox({ x = 0, y = 0, width, height }, fit = "fluid") {
  const w = dimension(width),
    h = dimension(height);
  if (fit !== "fluid" && !Object.hasOwn(ratios, fit))
    throw new RangeError(`Unsupported game fit: ${fit}`);
  let fittedWidth = w,
    fittedHeight = h;
  if (fit !== "fluid") {
    fittedWidth = Math.min(w, h * ratios[fit]);
    fittedHeight = Math.min(h, fittedWidth / ratios[fit]);
  }
  return {
    x: (Number.isFinite(x) ? x : 0) + (w - fittedWidth) / 2,
    y: (Number.isFinite(y) ? y : 0) + (h - fittedHeight) / 2,
    width: fittedWidth,
    height: fittedHeight,
  };
}

/**
 * count is the number of independent surfaces, not the number of players:
 * Kart Rush's internal split and shared worlds use count: 1. The game host
 * supplies count > 1 only for independent per-seat views. Letterbox each cell,
 * never the whole grid, so every seat sees the complete playfield.
 */
export function gameViewLayout(
  id,
  width,
  height,
  { count = 1, sharedScreens = false } = {},
) {
  if (!Number.isInteger(count) || count < 1 || count > 4)
    throw new RangeError("One to four game surfaces are supported");
  width = dimension(width);
  height = dimension(height);
  const { fit, surface } = gameFit(id, { sharedScreens });
  const columns = count === 1 || (count === 2 && width < height * 1.2) ? 1 : 2;
  const rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, index) => {
    const column = index % columns,
      row = Math.floor(index / columns);
    const cell = {
      x: (column * width) / columns,
      y: (row * height) / rows,
      width: width / columns,
      height: height / rows,
    };
    return { cell, frame: letterbox(cell, fit), surface, fit };
  });
}
