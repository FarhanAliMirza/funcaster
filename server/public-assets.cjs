"use strict";
const path = require("node:path");

// express.static decodes URL paths before resolving files. Apply the same
// decoding before the guard, including separators used on Windows.
function blockPrivateAssets(req, res, next) {
  let pathname;
  try {
    pathname = path.posix
      .normalize(decodeURIComponent(req.path).replaceAll("\\", "/"))
      .toLowerCase();
  } catch {
    return res.status(400).end();
  }
  const hidden = [
    "/assets/source",
    "/assets/mario-kart",
    "/games/mario-kart/item-art",
    "/games/mario-kart/pipeline",
  ];
  if (
    hidden.some((root) => pathname === root || pathname.startsWith(root + "/"))
  )
    return res.status(404).end();
  next();
}

module.exports = { blockPrivateAssets };
