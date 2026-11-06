import { driverPortrait } from "./original-art.js";
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`;
const orb = (color) =>
  svg(
    `<circle cx="50" cy="50" r="27" fill="${color}"/><ellipse cx="50" cy="50" rx="44" ry="14" fill="none" stroke="#eefaff" stroke-width="6" transform="rotate(-25 50 50)"/><circle cx="42" cy="39" r="8" fill="white" opacity=".7"/>`,
  );
export const ITEM_ICONS = {
  banana: svg(
    '<path d="M50 13L86 84H14Z" fill="#ffc874" stroke="#714460" stroke-width="5"/><path d="M28 58H73" stroke="white" stroke-width="8"/>',
  ),
  green: orb("#49dcb0"),
  red: orb("#fc8294"),
  blue: orb("#7aafff"),
  mushroom: svg(
    '<path d="M54 5L15 59H46L38 95 87 39H56Z" fill="#ffb86a" stroke="#fff2c1" stroke-width="5"/>',
  ),
  star: svg(
    '<path d="M50 7L83 28V71L50 93 17 71V28Z" fill="#b2a0ff" stroke="white" stroke-width="5"/><path d="M50 20V80M28 35L72 65M72 35L28 65" stroke="#fff5b0" stroke-width="4"/>',
  ),
  empty: svg(
    '<circle cx="50" cy="50" r="30" fill="none" stroke="#b1a6d6" stroke-width="5" stroke-dasharray="8 6"/>',
  ),
};
export async function loadSourcePortraits() {
  return false;
}
export const portrait = (c) => driverPortrait(c.id);
