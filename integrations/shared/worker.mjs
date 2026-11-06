import path from "node:path";
import { unlink, open } from "node:fs/promises";
import {
  atomicJson,
  readJson,
  listJobs,
  validateJob,
  digest,
  killed,
  appendReceipt,
} from "./outbox.mjs";
// Real adapters must implement lookup(idempotencyKey) against their chain before
// retrying a write. A local done-set alone cannot close the post-send crash window.
export function createWorker({
  dir,
  providers,
  now = Date.now,
  envKill = "0",
  afterExecute = async () => {},
}) {
  let running = false,
    closed = false;
  async function complete(file, job, receipt, fingerprint) {
    await atomicJson(
      path.join(dir, "done", digest(job.idempotencyKey) + ".json"),
      { fingerprint, receipt },
    );
    await appendReceipt(dir, { ...receipt, id: job.id });
    await unlink(file);
  }
  async function processJob({ file, job }) {
    try {
      validateJob(job);
    } catch {
      await atomicJson(path.join(dir, "failed", path.basename(file)), {
        error: "Invalid job",
      });
      await unlink(file);
      return true;
    }
    if (job.nextAttemptAt > now()) return false;
    const fingerprint = digest(
      JSON.stringify({ type: job.type, payload: job.payload }),
    );
    const done = await readJson(
      path.join(dir, "done", digest(job.idempotencyKey) + ".json"),
    );
    if (done) {
      if (done.fingerprint !== fingerprint) {
        await appendReceipt(dir, {
          id: job.id,
          type: job.type,
          status: "failed",
          tx: null,
          explorer: null,
          at: now(),
          error: "Idempotency payload conflict",
        });
        await unlink(file);
      } else {
        await appendReceipt(dir, { ...done.receipt, id: job.id });
        await unlink(file);
      }
      return true;
    }
    const provider = providers[job.type.split(".")[0]];
    try {
      if (!provider?.lookup || !provider?.execute)
        throw new Error("Provider unavailable");
      const prior = await provider.lookup(job.idempotencyKey);
      if (await killed(dir, envKill)) return false;
      const output = prior || (await provider.execute(job));
      // Simulates process death after external effect but before local done-set.
      await afterExecute(job, output);
      const receipt = {
        id: job.id,
        type: job.type,
        status: "done",
        tx: output.tx ?? null,
        explorer: output.explorer ?? null,
        at: now(),
        ...(output.mock ? { mock: true } : {}),
      };
      await complete(file, job, receipt, fingerprint);
      return true;
    } catch (error) {
      if (error.simulateCrash) throw error;
      const attempts = job.attempts + 1;
      if (attempts >= 8) {
        await complete(
          file,
          job,
          {
            id: job.id,
            type: job.type,
            status: "failed",
            tx: null,
            explorer: null,
            at: now(),
            error: "Provider failed after eight attempts",
          },
          fingerprint,
        );
        return true;
      }
      await atomicJson(file, {
        ...job,
        attempts,
        nextAttemptAt: now() + Math.min(60000, 1000 * 2 ** (attempts - 1)),
      });
      return false;
    }
  }
  return {
    async poll() {
      if (running || closed) return;
      running = true;
      try {
        const stop = await killed(dir, envKill);
        await atomicJson(path.join(dir, "heartbeat.json"), {
          at: now(),
          status: stop ? "killed" : "running",
        });
        if (stop) return;
        const groups = new Map();
        for (const item of await listJobs(dir)) {
          const key = item.job?.type?.split(".")[0] || "invalid";
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(item);
        }
        await Promise.all(
          [...groups.values()].map(async (items) => {
            for (const item of items) {
              if (closed || (await killed(dir, envKill))) break;
              if (!(await processJob(item))) break;
            }
          }),
        );
      } finally {
        running = false;
      }
    },
    async close() {
      closed = true;
      while (running) await new Promise((r) => setTimeout(r, 5));
      await atomicJson(path.join(dir, "heartbeat.json"), {
        at: now(),
        status: "stopped",
      });
    },
  };
}
export function mockProvider(dir) {
  return {
    async lookup(key) {
      return readJson(path.join(dir, "mock-effects", digest(key) + ".json"));
    },
    async execute(job) {
      const output = { mock: true, tx: null, explorer: null };
      await atomicJson(
        path.join(dir, "mock-effects", digest(job.idempotencyKey) + ".json"),
        output,
      );
      return output;
    },
  };
}
export async function acquireWorkerLock(dir) {
  const file = path.join(dir, "worker.lock");
  for (let i = 0; i < 2; i++)
    try {
      const h = await open(file, "wx", 0o600);
      await h.writeFile(String(process.pid));
      await h.close();
      return async () => unlink(file);
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      const { readFile } = await import("node:fs/promises");
      let pid;
      try {
        pid = Number(await readFile(file, "utf8"));
      } catch {
        throw new Error("Worker lock needs inspection");
      }
      if (!Number.isInteger(pid) || pid < 1)
        throw new Error("Worker lock needs inspection");
      try {
        process.kill(pid, 0);
        throw new Error("Another worker already owns this volume");
      } catch (check) {
        if (check.code !== "ESRCH") throw check;
        await unlink(file);
      }
    }
  throw new Error("Unable to acquire worker lock");
}
