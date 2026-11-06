import fs from "node:fs";
import path from "node:path";
import { inspectBundle } from "./bundle.mjs";
const root = path.resolve(process.argv[2] || "games"),
  single = fs.existsSync(path.join(root, "game.json"));
const dirs = single
  ? [root]
  : fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(root, e.name));
let failed = false;
const ids = new Set();
for (const dir of dirs) {
  if (!fs.existsSync(path.join(dir, "index.html"))) continue;
  try {
    const bundle = inspectBundle(dir);
    if (ids.has(bundle.gameId)) throw Error("Duplicate gameId");
    ids.add(bundle.gameId);
    console.log(
      `✓ ${bundle.gameId}@${bundle.version} · ${bundle.files.length} files · ${bundle.bundleHash.slice(0, 12)}`,
    );
  } catch (e) {
    failed = true;
    console.error(`✗ ${dir}: ${e.message}`);
  }
}
if (!ids.size) {
  console.error("No valid game manifests found");
  failed = true;
}
process.exitCode = failed ? 1 : 0;
