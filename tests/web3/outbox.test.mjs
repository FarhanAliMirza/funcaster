import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  rm,
  readFile,
  stat,
  writeFile,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  createOutbox,
  listJobs,
  createReceiptReader,
  atomicJson,
} from "../../integrations/shared/outbox.mjs";
import {
  createWorker,
  mockProvider,
  acquireWorkerLock,
} from "../../integrations/shared/worker.mjs";
const payload = {
  result: { hash: "fixture-result", matchId: "fixture-match" },
};
const input = (key, type = "ens.record.set") => ({
  type,
  room: "ROOMAA",
  idempotencyKey: key,
  payload,
});
async function temporary(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "funcaster-outbox-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
test("atomic 0600 jobs, deferred hot-path I/O, mock round trip and receipt tailing", async (t) => {
  const dir = await temporary(t),
    outbox = createOutbox(dir);
  let resolved = false;
  const promise = outbox.enqueue(input("one")).then((job) => {
    resolved = true;
    return job;
  });
  assert.equal(resolved, false);
  await promise;
  const [item] = await listJobs(dir);
  if (process.platform !== "win32")
    assert.equal((await stat(item.file)).mode & 0o777, 0o600);
  assert.ok(
    (await readdir(path.join(dir, "outbox"))).every((f) => f.endsWith(".json")),
  );
  const worker = createWorker({ dir, providers: { ens: mockProvider(dir) } });
  await worker.poll();
  assert.equal((await listJobs(dir)).length, 0);
  const receipts = [],
    health = [];
  const reader = createReceiptReader(dir, {
    onReceipt: (r) => receipts.push(r),
    onHealth: (h) => health.push(h),
  });
  await reader.poll();
  await new Promise((r) => setTimeout(r, 30));
  await reader.poll();
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].mock, true);
  assert.equal(receipts[0].tx, null);
  assert.equal(health.at(-1).up, true);
  await reader.poll();
  assert.equal(receipts.length, 1);
  reader.close();
  await worker.close();
  await outbox.close();
});
test("crash after external effect is recovered by provider lookup, then duplicate is a no-op", async (t) => {
  const dir = await temporary(t),
    q = createOutbox(dir);
  await q.enqueue(input("once"));
  let effects = 0;
  const durable = mockProvider(dir),
    provider = {
      ...durable,
      execute: async (j) => {
        effects++;
        return durable.execute(j);
      },
    };
  const crash = createWorker({
    dir,
    providers: { ens: provider },
    afterExecute: async () => {
      const e = new Error("simulated crash");
      e.simulateCrash = true;
      throw e;
    },
  });
  await assert.rejects(crash.poll(), /simulated crash/);
  assert.equal(effects, 1);
  const restarted = createWorker({ dir, providers: { ens: provider } });
  await restarted.poll();
  assert.equal(effects, 1);
  await q.enqueue(input("once"));
  await restarted.poll();
  assert.equal(effects, 1);
  assert.equal((await listJobs(dir)).length, 0);
  await q.enqueue({ ...input("once"), payload: { different: true } });
  await restarted.poll();
  const lines = (await readFile(path.join(dir, "receipts.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.equal(lines.at(-1).error, "Idempotency payload conflict");
  await q.close();
  await restarted.close();
});
test("retry backoff is bounded, a signer queue preserves order and another partner continues", async (t) => {
  const dir = await temporary(t);
  let time = 100000,
    calls = [];
  const q = createOutbox(dir, { now: () => time });
  await q.enqueue(input("first"));
  time++;
  await q.enqueue(input("second"));
  time++;
  await q.enqueue(input("other", "arc.pot.create"));
  const provider = {
    lookup: async () => null,
    execute: async (j) => {
      calls.push(j.idempotencyKey);
      throw Error("secret provider details must never reach receipts");
    },
  };
  const worker = createWorker({
    dir,
    now: () => time,
    providers: { ens: provider, arc: mockProvider(dir) },
  });
  await worker.poll();
  assert.deepEqual(calls, ["first"]);
  assert.equal((await listJobs(dir)).length, 2);
  await worker.poll();
  assert.equal(calls.length, 1);
  for (let n = 1; n < 8; n++) {
    time += 60000;
    await worker.poll();
  }
  const receipts = (await readFile(path.join(dir, "receipts.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.equal(
    receipts.find((r) => r.type === "ens.record.set").status,
    "failed",
  );
  assert.ok(!JSON.stringify(receipts).includes("secret provider"));
  assert.equal(calls.filter((x) => x === "first").length, 8);
  assert.ok(calls.includes("second"));
  await q.close();
  await worker.close();
});
test("kill file and env stop sending; lock excludes a second worker", async (t) => {
  const dir = await temporary(t),
    q = createOutbox(dir);
  await q.enqueue(input("kill"));
  const release = await acquireWorkerLock(dir);
  await assert.rejects(() => acquireWorkerLock(dir), /Another worker/);
  await release();
  await writeFile(path.join(dir, "KILL"), "");
  let count = 0;
  const worker = createWorker({
    dir,
    providers: {
      ens: {
        lookup: async () => null,
        execute: async () => {
          count++;
          return { mock: true };
        },
      },
    },
  });
  await worker.poll();
  assert.equal(count, 0);
  assert.equal(
    JSON.parse(await readFile(path.join(dir, "heartbeat.json"))).status,
    "killed",
  );
  await rm(path.join(dir, "KILL"));
  await worker.poll();
  assert.equal(count, 1);
  await q.enqueue(input("env-kill"));
  await createWorker({ dir, envKill: "1", providers: {} }).poll();
  assert.equal((await listJobs(dir)).length, 1);
  await q.close();
  await worker.close();
});
test("payloads cannot put secrets or platform currency into the outbox", async (t) => {
  const dir = await temporary(t),
    q = createOutbox(dir);
  for (const key of [
    "privateKey",
    "client_secret",
    "bits",
    "superChat",
    "kicks",
    "gift_amount",
  ])
    await assert.rejects(
      q.enqueue({ ...input(key), payload: { [key]: "forbidden" } }),
      /Outbox write failed/,
    );
  assert.equal((await listJobs(dir)).length, 0);
  await q.close();
});

test("same-clock jobs keep enqueue order", async (t) => {
  const dir = await temporary(t),
    q = createOutbox(dir, { now: () => 100 });
  await Promise.all([
    q.enqueue(input("one")),
    q.enqueue(input("two")),
    q.enqueue(input("three")),
  ]);
  assert.deepEqual(
    (await listJobs(dir)).map((x) => x.job.idempotencyKey),
    ["one", "two", "three"],
  );
  await q.close();
});
