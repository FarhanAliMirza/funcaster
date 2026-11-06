import { useDeterministicMath } from "./dmath.js";
export async function timeline(
  mode = "deterministic",
  rounds = 20,
  onProgress = () => {},
) {
  useDeterministicMath(mode === "deterministic");
  const { Race } = await import("../games/mario-kart/logic.js");
  const result = { schemaVersion: 1, mode, rounds: [] };
  const hash = (r) => {
    const bytes = new Uint8Array(
      new Float64Array(
        r.racers.flatMap((p) => [
          p.x,
          p.z,
          p.heading,
          p.speed,
          p.progress,
          p.lap,
          p.coins,
          p.finishTime || 0,
        ]),
      ).buffer,
    );
    let h = 2166136261;
    for (const b of bytes) h = Math.imul(h ^ b, 16777619);
    return (h >>> 0).toString(16).padStart(8, "0");
  };
  for (let n = 0; n < rounds; n++) {
    const race = new Race({
      seed: 381 + n,
      laps: 3,
      humans: [
        { seat: 0, character: "mario" },
        { seat: 1, character: "luigi" },
      ],
      cpuCount: 2,
    });
    race.start();
    const hashes = [],
      began = performance.now();
    let ticks = 0;
    while (race.state !== "results" && ticks < 75000) {
      const input = { 0: { autopilot: true }, 1: { autopilot: true } };
      if (ticks % 720 < 90)
        input[1] = { gas: true, steer: ((ticks % 180) - 90) / 500 };
      race.stepPlayers(1 / 120, input);
      ticks++;
      if (ticks % 60 === 0) hashes.push(hash(race));
    }
    const round = {
      seed: 381 + n,
      ticks,
      complete: race.state === "results",
      hashes,
      fastForwardMs: Math.round(performance.now() - began),
    };
    result.rounds.push(round);
    onProgress({
      round: n + 1,
      complete: round.complete,
      fastForwardMs: round.fastForwardMs,
    });
  }
  return result;
}
export function compareTimelines(a, b) {
  if (a.mode !== b.mode || a.rounds.length !== b.rounds.length)
    return { equal: false, reason: "Different test modes or round counts" };
  for (let i = 0; i < a.rounds.length; i++) {
    const x = a.rounds[i],
      y = b.rounds[i];
    if (x.seed !== y.seed || x.ticks !== y.ticks || !x.complete || !y.complete)
      return {
        equal: false,
        round: i + 1,
        reason: "Different or incomplete round",
      };
    for (let j = 0; j < Math.max(x.hashes.length, y.hashes.length); j++)
      if (x.hashes[j] !== y.hashes[j])
        return {
          equal: false,
          round: i + 1,
          tick: (j + 1) * 60,
          reason: "State hash differs",
        };
  }
  return { equal: true, rounds: a.rounds.length };
}
