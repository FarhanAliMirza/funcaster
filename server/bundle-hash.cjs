"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  { createHash } = require("node:crypto");
const { inspectBundle } = require("../scripts/bundle.mjs");
const { gameById } = require("../core/catalog.js");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
// Pin game files and the common runtime/rules used by this game. No credentials or logs.
function bundleHash(id) {
  const game = gameById(id);
  if (cache.has(game.id)) return cache.get(game.id);
  const h = createHash("sha256");
  h.update(inspectBundle(path.join(root, "games", game.id)).bundleHash);
  const visit = (dir) => {
    for (const e of fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) visit(f);
      else if (e.isFile() && /\.(js|cjs|css|woff2|svg|png|mp3)$/.test(e.name))
        h.update(path.relative(root, f))
          .update("\0")
          .update(fs.readFileSync(f))
          .update("\0");
    }
  };
  visit(path.join(root, "core"));
  visit(path.join(root, "games/shared"));
  visit(path.join(root, "sdk"));
  visit(path.join(root, "public/fonts"));
  visit(path.join(root, "public/assets/audio"));
  h.update(fs.readFileSync(path.join(root, "public/party/fonts.css")));
  if (!game.classic)
    h.update(fs.readFileSync(path.join(root, "server/party-engine.cjs")));
  if (["mario-kart", "table-tennis", "swordplay"].includes(game.id))
    h.update(fs.readFileSync(path.join(root, "server/shared-round.cjs")));
  const value = h.digest("hex");
  cache.set(game.id, value);
  return value;
}
module.exports = { bundleHash };
