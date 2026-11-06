"use strict";
const { scoreboardKey } = require("../core/scoreboard-key.js");
const fs = require("node:fs"),
  path = require("node:path");
const { gameById, games } = require("../core/catalog.js");
const { SEATS } = require("../core/seats.js");
function createEventStore(filename) {
  let state = {
      version: 1,
      joins: 0,
      rounds: 0,
      completed: 0,
      forfeits: 0,
      records: [],
    },
    dirty = false,
    writeError = null;
  if (filename && fs.existsSync(filename)) {
    try {
      const saved = JSON.parse(fs.readFileSync(filename, "utf8"));
      if (saved.version !== 1) throw Error("Unknown event store version");
      for (const key of ["joins", "rounds", "completed", "forfeits"])
        state[key] =
          Number.isSafeInteger(saved[key]) && saved[key] >= 0 ? saved[key] : 0;
      if (Array.isArray(saved.records))
        state.records = saved.records
          .filter(
            (r) =>
              typeof r.matchId === "string" &&
              games.some((g) => g.id === r.game) &&
              Array.isArray(r.scores),
          )
          .slice(-500);
    } catch (e) {
      writeError = `Could not read event store: ${e.message}`;
    }
  }
  function save() {
    if (!filename || !dirty) return;
    try {
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      const temp = filename + ".tmp";
      fs.writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
      fs.renameSync(temp, filename);
      dirty = false;
      writeError = null;
    } catch (e) {
      writeError = `Could not save event store: ${e.message}`;
    }
  }
  const timer = setInterval(save, 1000);
  timer.unref();
  return {
    record(event) {
      if (event.type === "join") state.joins++;
      else if (event.type === "round") {
        const r = event.result;
        if (!r || state.records.some((x) => x.matchId === r.matchId)) return;
        state.rounds++;
        if (r.status === "completed") state.completed++;
        state.forfeits += (r.status === "completed" ? r.scores : []).filter(
          (s) => s.outcome === "forfeit",
        ).length;
        state.records.push({
          matchId: r.matchId,
          game: gameById(r.gameId).id,
          modeKey: scoreboardKey(gameById(r.gameId).id, r.setup),
          status: r.status,
          at: r.endedAt,
          verified: r.verification,
          scores: r.scores.map((s) => ({
            slot: s.slot,
            score: s.score,
            outcome: s.outcome || "finished",
          })),
        });
        state.records = state.records.slice(-500);
      } else return;
      dirty = true;
    },
    snapshot() {
      const boards = {},
        modeBoards = {};
      for (const game of games) {
        boards[game.id] = state.records
          .filter(
            (r) =>
              r.game === game.id &&
              r.status === "completed" &&
              r.verified !== "failed",
          )
          .flatMap((r) =>
            r.scores
              .filter((s) => s.outcome === "finished")
              .map((s) => ({
                name: SEATS[s.slot]?.name || "Player",
                score: s.score,
                at: r.at,
                matchId: r.matchId,
                verification: r.verified,
              })),
          )
          .sort(
            (a, b) =>
              (game.scoring.direction === "lower"
                ? a.score - b.score
                : b.score - a.score) || a.at - b.at,
          )
          .slice(0, 10);
      }
      for (const record of state.records) {
        if (record.status !== "completed" || record.verified === "failed")
          continue;
        const key = record.modeKey || scoreboardKey(record.game),
          game = gameById(record.game);
        modeBoards[key] ||= [];
        modeBoards[key].push(
          ...record.scores
            .filter((s) => s.outcome === "finished")
            .map((s) => ({
              name: SEATS[s.slot]?.name || "Player",
              score: s.score,
              at: record.at,
              matchId: record.matchId,
              verification: record.verified,
            })),
        );
        modeBoards[key].sort(
          (a, b) =>
            (game.scoring.direction === "lower"
              ? a.score - b.score
              : b.score - a.score) || a.at - b.at,
        );
        modeBoards[key] = modeBoards[key].slice(0, 10);
      }
      return {
        joins: state.joins,
        rounds: state.rounds,
        completed: state.completed,
        forfeits: state.forfeits,
        leaderboards: boards,
        modeLeaderboards: modeBoards,
        storageError: writeError,
      };
    },
    flush: save,
    close() {
      clearInterval(timer);
      save();
    },
  };
}
module.exports = { createEventStore };
