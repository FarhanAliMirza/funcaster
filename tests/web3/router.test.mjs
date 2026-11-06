import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { createRequire } from "node:module";
import { loadConfig } from "../../integrations/shared/config.mjs";
const require = createRequire(import.meta.url),
  { createWeb3 } = require("../../server/web3/index.cjs"),
  { createRouter } = require("../../server/web3/router.cjs"),
  { scriptedRoom } = require("./party-script.cjs"),
  { canonical } = require("../../server/records.cjs");
async function server(t, router, potRouter) {
  const app = express();
  app.use("/api/web3", router);
  if (potRouter) app.use("/pot", potRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => new Promise((r) => server.close(r)));
  return `http://127.0.0.1:${server.address().port}`;
}
test("canonical result endpoint preserves hash, exposes no identities, and health has no private config", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "funcaster-http-"));
  const web3 = createWeb3({
    config: loadConfig({
      PARTNERS: "mock",
      WEB3_DATA_DIR: dir,
      ENS_RPC_URLS: "https://private-rpc.example/key-value",
    }),
  });
  t.after(async () => {
    await web3.close();
    await rm(dir, { recursive: true, force: true });
  });
  const room = scriptedRoom({ web3 }),
    base = await server(t, web3.router, web3.potRouter);
  const response = await fetch(`${base}/api/web3/result/${room.result.hash}`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(canonical(data.result), canonical(room.result));
  assert.equal(data.verified, true);
  assert.equal(data.chainVerified, false);
  assert.equal(data.verificationScope, "game-replay");
  assert.equal(data.places.length, 4);
  const text = JSON.stringify(data);
  for (const p of room.room.players) {
    assert.ok(!text.includes(p.token));
    assert.ok(!text.includes(p.address || "no-identity-fixture"));
  }
  assert.ok(!/displayName|privateKey/.test(text));
  const health = await (await fetch(`${base}/api/web3/health`)).json();
  assert.ok(!JSON.stringify(health).includes(dir));
  assert.ok(!JSON.stringify(health).includes("private-rpc"));
  assert.ok(!JSON.stringify(health).includes("balance"));
  assert.equal(health.mode, "mock");
  assert.equal(
    (await fetch(`${base}/api/web3/result/${"0".repeat(64)}`)).status,
    404,
  );
  assert.equal((await fetch(`${base}/api/web3/result/nope`)).status, 400);
  assert.equal(
    (await fetch(`${base}/api/web3/pot/0x${"0".repeat(64)}`)).status,
    404,
  );
  assert.equal((await fetch(`${base}/api/web3/pot/nope`)).status, 400);
  assert.equal((await fetch(`${base}/pot/`)).status, 503);
  room.party.close();
});
test("own JSON parser enforces 16 KB and never reflects submitted content", async (t) => {
  const router = createRouter({
    config: loadConfig({ PARTNERS: "mock" }),
    health: () => ({}),
    getResult: () => null,
    getPot: () => null,
  });
  const base = await server(t, router.router);
  const options = (body) => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  let r = await fetch(
    `${base}/api/web3/health`,
    options(JSON.stringify({ value: "x".repeat(17000) })),
  );
  assert.equal(r.status, 413);
  assert.equal((await r.json()).error, "Request body exceeds 16 KB.");
  r = await fetch(`${base}/api/web3/health`, options("{not-json"));
  assert.equal(r.status, 400);
  assert.equal(r.headers.get("cache-control"), "no-store");
});
test("live pot reads fail explicitly; real Studio dist is served only when it exists", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "funcaster-pot-dist-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const dist = path.join(dir, "integrations/arc/pot-console/dist");
  await mkdir(dist, { recursive: true });
  await writeFile(path.join(dist, "index.html"), "<title>TEST FIXTURE</title>");
  const routers = createRouter({
    config: loadConfig({
      PARTNERS: "on",
      WEB3_ENS: "off",
      WEB3_ARC: "off",
      WEB3_ARKIV: "off",
    }),
    health: () => ({}),
    getResult: () => null,
    getPot: () => null,
    root: dir,
  });
  const base = await server(t, routers.router, routers.potRouter);
  assert.equal(
    (await fetch(`${base}/api/web3/pot/0x${"0".repeat(64)}`)).status,
    503,
  );
  assert.match(await (await fetch(`${base}/pot/`)).text(), /TEST FIXTURE/);
});
