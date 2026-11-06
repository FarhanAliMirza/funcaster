import { games } from "../core/catalog.js";
import { readFileSync, writeFileSync } from "node:fs";
const check = process.argv.includes("--check");
for (const game of games) {
  const path = new URL(`../games/${game.id}/game.json`, import.meta.url);
  const expected = JSON.stringify(game, null, 2) + "\n";
  if (check) {
    if (readFileSync(path, "utf8") !== expected)
      throw Error(`Catalog drift: ${game.id}. Run npm run catalog:sync`);
  } else writeFileSync(path, expected);
}
console.log(`Catalog agrees across ${games.length} games.`);
