const fs = require("node:fs"),
  { hash } = require("../server/records.cjs"),
  { createRound, stepRound } = require("../server/party-engine.cjs");
const file = process.argv[2];
if (!file) throw Error("Pass an exported round JSON file");
const { result, replay } = JSON.parse(fs.readFileSync(file, "utf8"));
if (hash(replay) !== result.replayHash) throw Error("Replay hash mismatch");
const { hash: expected, ...unsigned } = result;
if (hash(unsigned) !== expected) throw Error("Result hash mismatch");
if (replay.gameId === "funcaster.fruit-ninja") {
  if (!require("../server/slice-replay.cjs").verifySlice(replay, result.scores))
    throw Error("Slice replay scores do not agree");
  console.log("Verified: seeded Slice Dojo replay and final scores agree.");
  process.exit(0);
}
if (
  !["funcaster.star-catch", "funcaster.neon-drift", "funcaster.bubble-burst"].includes(
    replay.gameId,
  )
)
  throw Error("This result is attested; it has no independent score verifier.");
const round = createRound(replay.gameId.slice(7), replay.slots, replay.seed);
for (const [dt, inputs] of replay.frames) stepRound(round, inputs, dt);
if (
  !round.players.every(
    (p) =>
      Math.floor(p.score) ===
      result.scores.find((s) => s.slot === p.slot)?.score,
  )
)
  throw Error("Replayed scores do not agree");
console.log("Verified: hash, seed, input replay and final scores agree.");
