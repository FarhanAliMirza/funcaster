"use strict";
const express = require("express"),
  path = require("node:path"),
  fs = require("node:fs");
const { hash } = require("../records.cjs");
function createRouter({
  config,
  health,
  getResult,
  getPot,
  root = path.resolve(__dirname, "../.."),
}) {
  const router = express.Router();
  router.use((_req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    });
    next();
  });
  router.use(express.json({ limit: "16kb" }));
  router.get("/health", (_req, res) =>
    res.json({
      mode: config.PARTNERS,
      playMoney: true,
      version: require("../../package.json").version,
      ...health(),
    }),
  );
  router.get("/result/:hash", (req, res) => {
    if (!/^[\da-f]{64}$/.test(req.params.hash))
      return res.status(400).json({ error: "Invalid result hash." });
    const result = getResult(req.params.hash);
    if (!result)
      return res
        .status(404)
        .json({ error: "Result not found in this console." });
    const { hash: expected, ...core } = result;
    if (hash(core) !== expected)
      return res
        .status(503)
        .json({ error: "Stored result failed its hash check." });
    res.json({
      result,
      verified: result.verification === "verified",
      verificationScope: "game-replay",
      chainVerified: false,
      places: result.scores.map((s) => ({ slot: s.slot, rank: s.rank })),
    });
  });
  router.get("/pot/:potId", (req, res) => {
    if (!/^0x[\da-fA-F]{64}$/.test(req.params.potId))
      return res.status(400).json({ error: "Invalid pot ID." });
    if (config.PARTNERS !== "mock")
      return res
        .status(503)
        .json({ error: "Live pot reads are not implemented yet." });
    const pot = getPot(req.params.potId);
    if (!pot) return res.status(404).json({ error: "MOCK pot not found." });
    res.json({ mode: "mock", playMoney: true, pot });
  });
  router.use((error, _req, res, next) => {
    if (error?.type === "entity.too.large")
      return res.status(413).json({ error: "Request body exceeds 16 KB." });
    if (error?.type === "entity.parse.failed")
      return res.status(400).json({ error: "Invalid JSON." });
    next(error);
  });
  const potRouter = express.Router(),
    dist = path.join(root, "integrations/arc/pot-console/dist");
  // Startup only. Never manufacture a Studio-built console or a deployment.
  if (fs.existsSync(path.join(dist, "index.html")))
    potRouter.use(express.static(dist, { dotfiles: "deny" }));
  else
    potRouter.use((_req, res) =>
      res.status(503).type("text").send("Pot console is not built yet."),
    );
  return { router, potRouter };
}
module.exports = { createRouter };
