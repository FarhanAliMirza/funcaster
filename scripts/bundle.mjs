import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { validateManifest } from "../core/catalog.js";
/** Read-only bundle inspection. Never executes creator code or follows links. */
export function inspectBundle(
  directory,
  { maxBytes = 25 * 1024 * 1024, maxFiles = 4096 } = {},
) {
  const root = path.resolve(directory),
    files = [],
    errors = [];
  let bytes = 0;
  if (fs.lstatSync(root).isSymbolicLink())
    throw Error("Bundle root cannot be a symlink");
  const walk = (dir) => {
    for (const entry of fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const abs = path.join(dir, entry.name),
        name = path.relative(root, abs).split(path.sep).join("/");
      if (entry.isSymbolicLink()) {
        errors.push(`Symlink: ${name}`);
        continue;
      }
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!entry.isFile()) {
        errors.push(`Unsupported file: ${name}`);
        continue;
      }
      if (files.length >= maxFiles) throw Error("Bundle has too many files");
      const size = fs.statSync(abs).size;
      bytes += size;
      if (bytes > maxBytes) throw Error("Bundle exceeds 25 MB");
      if (/(^|\/)(\.env($|\.)|.*\.(pem|key|p12|pfx)$)/i.test(name))
        errors.push(`Private configuration is not allowed: ${name}`);
      files.push({
        path: name,
        bytes: size,
        sha256: createHash("sha256").update(fs.readFileSync(abs)).digest("hex"),
      });
    }
  };
  walk(root);
  const entry = files.find((f) => f.path === "index.html");
  if (!entry) errors.push("Missing index.html");
  else if (entry.bytes > 1000000) errors.push("Entry must be under 1 MB");
  let manifest;
  if (!files.some((f) => f.path === "game.json"))
    errors.push("Missing game.json");
  else {
    try {
      manifest = JSON.parse(
        fs.readFileSync(path.join(root, "game.json"), "utf8"),
      );
      errors.push(...validateManifest(manifest));
    } catch (e) {
      errors.push(e.message);
    }
  }
  if (errors.length) throw Error(errors.join("; "));
  return {
    gameId: manifest.gameId,
    version: manifest.version,
    manifest,
    bytes,
    files,
    bundleHash: createHash("sha256")
      .update(JSON.stringify(files))
      .digest("hex"),
  };
}
