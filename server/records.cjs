"use strict";
const { createHash } = require("node:crypto");
const { bundleHash } = require("./bundle-hash.cjs");
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
    out.push({
      slot: s.slot,
      score: Math.round(s.score),
      ...(s.outcome === "dnf" ? { outcome: "dnf" } : {}),
      ...(s.stats && typeof s.stats === "object"
        ? {
            stats: Object.fromEntries(
              Object.entries(s.stats)
                .filter(
                  ([k, v]) =>
                    /^[a-zA-Z][a-zA-Z0-9]{0,23}$/.test(k) &&
                    Number.isFinite(v) &&
                    Math.abs(v) <= 1e9,
                )
                .slice(0, 16)
                .map(([k, v]) => [k, Math.round(v)]),
            ),
          }
        : {}),
    });
  }
  return out.length === slots.length ? out : null;
}
function makeResult(room, game, scores, time, { abandoned = false } = {}) {
  const priority = { finished: 0, dnf: 1, forfeit: 2, removed: 3 };
  const ordered = scores
    .map((s) => ({
      ...s,
      ...(room.arcade
        ? { outcome: room.outcomes?.[s.slot] || "finished" }
        : {}),
    }))
    .sort(
      (a, b) =>
        (priority[a.outcome] || 0) - (priority[b.outcome] || 0) ||
        (game.scoring.direction === "lower"
          ? a.score - b.score
          : b.score - a.score),
    );
  let rank = 1;
  ordered.forEach((s, i) => {
    if (
      i &&
      (s.score !== ordered[i - 1].score || s.outcome !== ordered[i - 1].outcome)
    )
      rank = i + 1;
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
    ...(room.shared ? { sharedFrames: room.shared.frames } : {}),
    ...(room.logicReplay ? { logicCalls: room.logicReplay.calls } : {}),
    ...(room.logicReplays?.size && !room.logicReplay
      ? {
          logicBoards: [...room.logicReplays].map(([view, r]) => ({
            view,
            calls: r.calls,
          })),
        }
      : {}),
    boards:
      room.game === "fruit-ninja"
        ? [...(room.sliceReplays || [])]
            .filter(([, r]) => r.valid)
            .map(([view, r]) => ({ view, calls: r.calls }))
        : undefined,
  };
  let verification = game.verification === "casual" ? "unverified" : "attested";
  if (game.verification === "verifiable" && !abandoned) {
    if (room.shared) {
      verification = require("./shared-round.cjs").verifyShared(replay, scores)
        ? "verified"
        : "failed";
    } else if (require("./logic-replay.cjs").SUPPORTED.has(room.game)) {
      const checked = room.logicReplay;
      const actual =
        checked?.scores() ||
        [...(room.logicReplays || [])].flatMap(([view, r]) =>
          r.scores().map((s) => ({ ...s, slot: view })),
        );
      const valid =
        checked?.valid ||
        (room.logicReplays?.size === room.active.length &&
          [...room.logicReplays.values()].every((r) => r.valid));
      verification =
        valid &&
        actual.length === room.active.length &&
        scores.every(
          (s) =>
            actual.find((p) => room.active[p.slot] === s.slot)?.score ===
            s.score,
        )
          ? "verified"
          : "failed";
      if (verification === "verified")
        for (const s of ordered) {
          const detail = actual.find((p) => room.active[p.slot] === s.slot);
          if (detail?.stats) s.stats = detail.stats;
        }
    } else if (room.game === "fruit-ninja")
      verification = verifySlice(replay, scores) ? "verified" : "failed";
    else {
      const copy = createRound(
        room.game,
        room.active,
        room.match.seed,
        room.match,
      );
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
    matchId: room.arcade
      ? `${room.startedAt.toString(36)}.${room.code}.${room.roundId}`
      : `${room.code}.${room.roundId}`,
    gameId: game.gameId,
    version: game.version,
    bundleHash: bundleHash(game.id),
    bundleHashVersion: 1,
    setup: room.match,
    ...(room.remote?.views.size
      ? {
          views: [...room.remote.views.values()].map((v) => ({
            slot: v.slot,
            source: v.used ? "remote" : "host",
          })),
        }
      : {}),
    seed: room.match.seed,
    seedSource: "server-crypto",
    ...(room.shared ? { simulation: "server" } : {}),
    startedAt: room.startedAt,
    endedAt: time,
    status: abandoned
      ? room.arcade
        ? "no-contest"
        : "abandoned"
      : "completed",
    verification,
    scores: ordered,
    replayHash: hash(replay),
  };
  return { result: { ...result, hash: hash(result) }, replay };
}
module.exports = { canonical, hash, normalizeScores, makeResult };
