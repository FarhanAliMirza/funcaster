import {
  mkdir,
  open,
  rename,
  unlink,
  readFile,
  readdir,
  stat,
  appendFile,
  access,
} from "node:fs/promises";
import { watch } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
export const jobTypes = new Set([
  "ens.party.open",
  "ens.seat.mint",
  "ens.record.set",
  "ens.role.grant",
  "ens.role.revoke",
  "ens.party.end",
  "arc.pot.create",
  "arc.pot.fund",
  "arc.pot.settle",
  "arc.pot.propose",
  "arc.pot.claim",
  "arc.pot.refund",
  "swarm.upload",
  "swarm.keep",
  "arkiv.result.put",
  "arkiv.live.put",
  "arkiv.live.extend",
  "arkiv.live.delete",
  "arkiv.profile.create",
  "arkiv.profile.extend",
  "arkiv.receipt.put",
]);
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export async function atomicJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(tmp, "wx", 0o600);
    await handle.writeFile(JSON.stringify(data));
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(tmp, file);
  } finally {
    await handle?.close();
    await unlink(tmp).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
}
export async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
export function validateJob(job) {
  if (
    !job ||
    !jobTypes.has(job.type) ||
    typeof job.idempotencyKey !== "string" ||
    !job.idempotencyKey.length ||
    job.idempotencyKey.length > 256 ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(job.room) ||
    !job.payload ||
    typeof job.payload !== "object" ||
    Array.isArray(job.payload)
  )
    throw new Error("Invalid outbox job");
  const inspect = (value) => {
    if (!value || typeof value !== "object") return;
    for (const [k, v] of Object.entries(value)) {
      if (
        /private.?key|secret|(?:^|_)token$|bits|super.?chat|jewels|kicks|gift.?amount/i.test(
          k,
        )
      )
        throw new Error(
          "Secret or platform currency field forbidden in outbox",
        );
      inspect(v);
    }
  };
  inspect(job.payload);
  if (Buffer.byteLength(JSON.stringify(job.payload)) > 8 * 1024 * 1024)
    throw new Error("Outbox payload too large");
}
// Hot paths only push an object into memory. All validation, serialization and I/O
// happens in the scheduled drain, never in finish(), tick() or view().
export function createOutbox(dir, { now = Date.now } = {}) {
  let queue = [],
    running = null,
    scheduled = false,
    closed = false,
    lastCreatedAt = 0;
  const drain = async () => {
    scheduled = false;
    while (queue.length) {
      const item = queue.shift();
      try {
        validateJob(item.job);
        const file = path.join(
          dir,
          "outbox",
          `${String(item.job.createdAt).padStart(16, "0")}-${item.job.id}.json`,
        );
        await atomicJson(file, item.job);
        item.resolve(item.job);
      } catch (e) {
        item.reject(new Error("Outbox write failed"));
      }
    }
  };
  const schedule = () => {
    if (running || scheduled) return;
    scheduled = true;
    setImmediate(() => {
      running = drain().finally(() => {
        running = null;
        if (queue.length) schedule();
      });
    });
  };
  return {
    enqueue(input) {
      if (closed) return Promise.reject(new Error("Outbox closed"));
      const job = {
        ...input,
        id: randomUUID(),
        createdAt: (lastCreatedAt = Math.max(now(), lastCreatedAt + 1)),
        attempts: 0,
      };
      const promise = new Promise((resolve, reject) =>
        queue.push({ job, resolve, reject }),
      );
      schedule();
      return promise;
    },
    get pending() {
      return queue.length + (running ? 1 : 0);
    },
    async flush() {
      while (scheduled || running || queue.length) {
        if (running) await running;
        else await new Promise((r) => setImmediate(r));
      }
    },
    async close() {
      closed = true;
      await this.flush();
    },
  };
}
export async function listJobs(dir) {
  const folder = path.join(dir, "outbox");
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const files = (await readdir(folder))
    .filter((f) => /^\d+-[\da-f-]+\.json$/.test(f))
    .sort();
  return Promise.all(
    files.map(async (name) => ({
      file: path.join(folder, name),
      job: await readJson(path.join(folder, name)),
    })),
  );
}
export function createReceiptReader(
  dir,
  {
    onReceipt = () => {},
    onHealth = () => {},
    onError = () => {},
    now = Date.now,
    pollMs = 2000,
  } = {},
) {
  let offset = 0,
    remainder = "",
    busy = false,
    closed = false,
    watcher,
    timer;
  const seen = new Set();
  async function poll() {
    if (busy || closed) return;
    busy = true;
    try {
      const heartbeat = await readJson(path.join(dir, "heartbeat.json"));
      const jobs = await listJobs(dir);
      onHealth({
        up:
          !!heartbeat &&
          heartbeat.status === "running" &&
          now() - heartbeat.at <= 15000,
        depth: jobs.length,
      });
      const file = path.join(dir, "receipts.jsonl");
      let size;
      try {
        size = (await stat(file)).size;
      } catch (e) {
        if (e.code === "ENOENT") return;
        throw e;
      }
      if (size < offset) {
        offset = 0;
        remainder = "";
      }
      // Bounded tail reads; replay all complete lines without an unbounded readFile.
      if (size > offset) {
        const h = await open(file, "r");
        try {
          const buffer = Buffer.alloc(Math.min(size - offset, 1024 * 1024));
          const { bytesRead } = await h.read(buffer, 0, buffer.length, offset);
          offset += bytesRead;
          const lines = (
            remainder + buffer.subarray(0, bytesRead).toString()
          ).split("\n");
          remainder = lines.pop();
          for (const line of lines) {
            if (!line) continue;
            let r;
            try {
              r = JSON.parse(line);
            } catch {
              onError();
              continue;
            }
            if (
              !r?.id ||
              !["done", "failed"].includes(r.status) ||
              !jobTypes.has(r.type)
            )
              continue;
            if (!seen.has(r.id)) {
              seen.add(r.id);
              onReceipt(r);
            }
          }
        } finally {
          await h.close();
        }
      }
    } catch {
      onError();
    } finally {
      busy = false;
    }
  }
  mkdir(dir, { recursive: true, mode: 0o700 })
    .then(() => {
      if (closed) return;
      watcher = watch(dir, () => void poll());
      watcher.on("error", () => onError());
      watcher.unref();
      void poll();
    })
    .catch(() => onError());
  timer = setInterval(() => void poll(), pollMs);
  timer.unref();
  return {
    poll,
    close() {
      closed = true;
      clearInterval(timer);
      watcher?.close();
    },
  };
}
export async function killed(dir, envKill) {
  if (envKill === "1") return true;
  try {
    await access(path.join(dir, "KILL"));
    return true;
  } catch (e) {
    if (e.code === "ENOENT") return false;
    throw e;
  }
}
export async function appendReceipt(dir, receipt) {
  const h = await open(path.join(dir, "receipts.jsonl"), "a", 0o600);
  try {
    await h.writeFile(JSON.stringify(receipt) + "\n");
    await h.sync();
  } finally {
    await h.close();
  }
}
