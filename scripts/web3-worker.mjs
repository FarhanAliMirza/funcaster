import { mkdir } from "node:fs/promises";
import { loadConfig } from "../integrations/shared/config.mjs";
import {
  createWorker,
  mockProvider,
  acquireWorkerLock,
} from "../integrations/shared/worker.mjs";
try {
  const config = loadConfig(process.env, { role: "worker" });
  if (
    config.PARTNERS !== "mock" ||
    ["WEB3_ENS", "WEB3_ARC", "WEB3_ARKIV"].some((k) => config[k] === "on")
  )
    throw new Error(
      "Only MOCK worker adapters are implemented; live sending is disabled.",
    );
  await mkdir(config.WEB3_DATA_DIR, { recursive: true, mode: 0o700 });
  const release = await acquireWorkerLock(config.WEB3_DATA_DIR),
    providers = {};
  for (const partner of ["ens", "arc", "arkiv"])
    if (config[`WEB3_${partner.toUpperCase()}`] === "mock")
      providers[partner] = mockProvider(config.WEB3_DATA_DIR);
  const worker = createWorker({
    dir: config.WEB3_DATA_DIR,
    providers,
    envKill: config.WEB3_KILL,
  });
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    await worker.close();
    await release();
  };
  const poll = () =>
    worker.poll().catch(() => {
      console.error("Worker I/O failed; jobs retained.");
    });
  const timer = setInterval(poll, 1000);
  process.once("SIGTERM", () => void stop());
  process.once("SIGINT", () => void stop());
  console.log("MOCK worker started; no network transactions.");
  await poll();
} catch (error) {
  console.error(
    error.message.startsWith("Only MOCK") || error.message.includes("worker")
      ? error.message
      : "Worker startup failed; check configuration and volume access.",
  );
  process.exitCode = 1;
}
