"use strict";
const { createHash } = require("node:crypto");
const { verifySlice } = require("./slice-replay.cjs");
const { createRound, stepRound } = require("./party-engine.cjs");
function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .filter((k) => value[k] !== undefined)
    .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
    .join(",")}}`;
}
const hash = (value) =>
  createHash("sha256").update(canonical(value)).digest("hex");
function normalizeScores(scores, slots) {
  if (!Array.isArray(scores) || scores.length > 8) return null;
  const seen = new Set(),
    out = [];
  for (const s of scores) {
    if (!slots.includes(s?.slot)) continue;
    if (
      seen.has(s.slot) ||
      !Number.isFinite(s.score) ||
      Math.abs(s.score) > 10000000
    )
      return null;
    seen.add(s.slot);
    out.push({ slot: s.slot, score: Math.round(s.score * 1000) / 1000 });
  }
  return out.length === slots.length ? out : null;
}
function makeResult(room, game, scores, time, { abandoned = false } = {}) {
  const ordered = [...scores].sort((a, b) =>
    game.scoring.direction === "lower" ? a.score - b.score : b.score - a.score,
  );
  let rank = 1;
  ordered.forEach((s, i) => {
    if (i && s.score !== ordered[i - 1].score) rank = i + 1;
    s.rank = rank;
  });
  const replay = {
    schemaVersion: 1,
    gameId: game.gameId,
    version: game.version,
    seed: room.match.seed,
    setup: room.match,
    slots: room.active,
    frames: room.replay || [],
    boards:
      room.game === "fruit-ninja"
        ? [...(room.sliceReplays || [])]
            .filter(([, r]) => r.valid)
            .map(([view, r]) => ({ view, calls: r.calls }))
        : undefined,
  };
  let verification = game.verification === "casual" ? "unverified" : "attested";
  if (game.verification === "verifiable" && !abandoned) {
    if (room.game === "fruit-ninja")
      verification = verifySlice(replay, scores) ? "verified" : "failed";
    else {
      const copy = createRound(room.game, room.active, room.match.seed);
      for (const [dt, input] of replay.frames) stepRound(copy, input, dt);
      verification = copy.players.every(
        (p) =>
          Math.floor(p.score) === scores.find((s) => s.slot === p.slot)?.score,
      )
        ? "verified"
        : "failed";
    }
  }
  const result = {
    schemaVersion: 1,
    matchId: `${room.code}.${room.roundId}`,
    gameId: game.gameId,
    version: game.version,
    bundleHash: room.buildId || hash(game),
    setup: room.match,
    seed: room.match.seed,
    startedAt: room.startedAt,
    endedAt: time,
    status: abandoned ? "abandoned" : "completed",
    verification,
    scores: ordered,
    replayHash: hash(replay),
  };
  return { result: { ...result, hash: hash(result) }, replay };
}
module.exports = { canonical, hash, normalizeScores, makeResult };
