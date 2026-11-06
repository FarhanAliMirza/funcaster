import { Worker } from "node:worker_threads";
import fs from "node:fs";
import { compareTimelines } from "../core/determinism-run.js";
const run = (mode) =>
  new Promise((resolve, reject) => {
    const w = new Worker(new URL("./determinism-worker.mjs", import.meta.url), {
      workerData: { mode, rounds: 20 },
    });
    w.once("message", resolve);
    w.once("error", reject);
  });
for (const mode of ["native", "deterministic"]) {
  const a = await run(mode),
    b = await run(mode),
    comparison = compareTimelines(a, b);
  console.log(
    mode,
    JSON.stringify(comparison),
    "slowest fast-forward",
    Math.max(...a.rounds.map((r) => r.fastForwardMs)) + "ms",
  );
  if (!comparison.equal) process.exitCode = 1;
  if (process.argv[2])
    fs.writeFileSync(process.argv[2] + "-" + mode + ".json", JSON.stringify(a));
}
console.log(
  "Node evidence only. Real Chrome, Firefox, Safari, iOS and Android plus five live races are still required. Remote lockstep remains disabled.",
);
