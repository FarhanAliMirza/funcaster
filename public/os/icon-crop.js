import { artwork } from "../party/art.js";
/** Square crops of repository-owned card art, in the SVG's 320 × 166 coordinates. */
export const ICON_CROP = Object.freeze({
  "mario-kart": [92, 3, 146, 146],
  "star-catch": [95, 26, 135, 135],
  "neon-drift": [95, 18, 132, 132],
  "bubble-burst": [60, 6, 176, 176],
  golf: [92, 24, 146, 146],
  "fruit-ninja": [90, 22, 146, 146],
  "table-tennis": [94, 10, 150, 150],
  swordplay: [92, 15, 150, 150],
  kart: [82, 1, 150, 150],
  "island-flyover": [94, 5, 142, 142],
  "shooting-range": [86, 13, 150, 150],
  "alien-attack": [93, 26, 136, 136],
  drawing: [65, 4, 184, 184],
});
export function gameIcon(game) {
  if (!ICON_CROP[game.id])
    throw new RangeError(`Unknown game icon: ${game.id}`);
  const el = document.createElement("span");
  el.className = "game-icon";
  el.setAttribute("aria-hidden", "true");
  el.style.setProperty("--bg", game.bg);
  el.style.setProperty("--c", game.color);
  // Only the checked-in artwork generator supplies markup. No room or player text enters SVG.
  const template = document.createElement("template");
  template.innerHTML = artwork(game.id);
  const svg = template.content.firstElementChild;
  svg.setAttribute("viewBox", ICON_CROP[game.id].join(" "));
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  el.append(svg);
  return el;
}
