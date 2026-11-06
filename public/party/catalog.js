export { games, gameById } from "/core/catalog.js";
export const colors = ["#7357f5", "#fb7858", "#20a88a", "#e4ad26"];
export const names = ["Lilac", "Peach", "Mint", "Sunny"];
export function remember(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
export function recalled(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key));
  } catch {
    return null;
  }
}
