const test = require("node:test"),
  assert = require("node:assert/strict");
const { monitorEventLoopDelay, performance } = require("node:perf_hooks");
const { fixture, emit, FakePhone, wait } = require("../party/harness.cjs");
test(
  "four online Kart rooms sustain sixteen phones and eight rendered views",
  { timeout: 45000 },
  async (t) => {
    const f = await fixture(t, {
      now: Date.now,
      tickMs: 16,
      arcade: true,
      remoteViews: true,
      transports: process.env.STRESS_POLLING ? ["polling"] : ["websocket"],
    });
    const phones = [],
      rooms = [],
      views = [];
    for (let i = 0; i < 4; i++) {
      const host = await f.connect(),
        h = await emit(host, "host");
      await emit(host, "remote.configure", { enabled: true });
      const display = await f.connect(),
        d = await emit(display, "display", {
          code: h.code,
          token: h.displayToken,
        });
      await emit(display, "display.ready", { ready: true });
      for (let slot = 0; slot < 4; slot++) {
        const p = new FakePhone(f, h.code);
        await p.join();
        p.ready();
        phones.push(p);
      }
      await wait(30);
      await emit(host, "assign-seat", { slot: 3, ref: d.ref });
      host.emit("select", { game: "mario-kart" });
      await wait(30);
      host.emit("start");
      await wait(30);
      const room = f.party.rooms.get(h.code),
        details = { code: h.code, game: "mario-kart", roundId: room.roundId };
      assert.ok(room.shared);
      rooms.push(room);
      const local = await f.connect();
      assert.equal(
        (await emit(local, "screen", { ...details, token: h.token })).authority,
        false,
      );
      views.push(local);
      const peer = await f.connect();
      assert.equal(
        (
          await emit(peer, "watch-game", {
            ...details,
            token: h.displayToken,
            resumeKey: d.resumeKey,
          })
        ).authority,
        false,
      );
      views.push(peer);
    }
    await wait(100);
    for (const p of phones) p.socket.emit("action", { action: "confirm" });
    let snapshots = 0,
      bytes = 0,
      packets = 0;
    const rtt = [];
    views.forEach((v) =>
      v.on("snapshot", (s) => {
        snapshots++;
        bytes += Buffer.byteLength(JSON.stringify(s));
      }),
    );
    const lag = monitorEventLoopDelay({ resolution: 10 });
    lag.enable();
    const stream = setInterval(() => {
      for (const [i, p] of phones.entries()) {
        p.sample({ x: Math.sin(packets * 0.001 + i) * 0.1, gas: true });
        packets++;
      }
    }, 33);
    try {
      for (let n = 0; n < 10; n++) {
        rtt.push(
          ...(await Promise.all(
            phones.map(async (p) => {
              const start = performance.now();
              await emit(p.socket, "ping-check");
              return performance.now() - start;
            }),
          )),
        );
        await wait(500);
      }
    } finally {
      clearInterval(stream);
      lag.disable();
    }
    assert.ok(snapshots > 160);
    assert.ok(packets > 1600);
    assert.ok(
      rooms.every(
        (r) => r.shared.tick > 180 && !r.sharedWaiting && r.phase === "classic",
      ),
    );
    assert.ok(phones.every((p) => p.socket.connected));
    rtt.sort((a, b) => a - b);
    t.diagnostic(
      JSON.stringify({
        environment: "local Node server/client; no GPU or physical phones",
        rooms: 4,
        phones: 16,
        views: 8,
        packets,
        snapshots,
        snapshotBytes: bytes,
        pingP95Ms: +rtt[Math.floor(rtt.length * 0.95)].toFixed(2),
        eventLoopP99Ms: +(lag.percentile(99) / 1e6).toFixed(2),
      }),
    );
  },
);
