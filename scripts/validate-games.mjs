import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { validateManifest } from "../core/catalog.js";
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
    const manifest = JSON.parse(
        fs.readFileSync(path.join(dir, "game.json"), "utf8"),
      ),
      errors = validateManifest(manifest);
    if (ids.has(manifest.gameId)) errors.push("duplicate gameId");
    ids.add(manifest.gameId);
    for (const e of fs.readdirSync(dir, { withFileTypes: true }))
      if (e.isSymbolicLink())
        errors.push("symlinks are not allowed in bundles");
    const size = fs.statSync(path.join(dir, "index.html")).size;
    if (size > 1000000) errors.push("entry must be under 1 MB");
    if (errors.length) throw Error(errors.join("; "));
    console.log(`✓ ${manifest.gameId}@${manifest.version}`);
  } catch (e) {
    failed = true;
    console.error(`✗ ${dir}: ${e.message}`);
  }
}
if (!ids.size) {
  console.error("No game manifests found");
  failed = true;
}
process.exitCode = failed ? 1 : 0;
