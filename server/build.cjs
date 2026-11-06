const { createHash } = require("node:crypto");
const fs = require("node:fs"),
  path = require("node:path");
function buildId(root) {
  const digest = createHash("sha256");
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      if (
        e.name.startsWith(".") ||
        ["evidence", "pipeline", "node_modules"].includes(e.name)
      )
        continue;
      const file = path.join(dir, e.name);
      if (e.isDirectory()) walk(file);
      else if (
        /\.(js|cjs|html|css|json)$/.test(e.name) &&
        !e.name.includes(".test.")
      ) {
        digest.update(path.relative(root, file));
        digest.update(fs.readFileSync(file));
      }
    }
  }
  for (const dir of ["core", "sdk", "public", "server", "games"])
    walk(path.join(root, dir));
  return digest.digest("hex").slice(0, 16);
}
module.exports = { buildId };
