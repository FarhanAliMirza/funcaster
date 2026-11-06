const test = require("node:test"),
  assert = require("node:assert/strict");
const { monitorEventLoopDelay, performance } = require("node:perf_hooks");
const { fixture, emit, FakePhone, wait } = require("../party/harness.cjs");
test(
  "four rooms and sixteen controllers sustain input and ping traffic",
  {
    timeout: Math.max(
      30000,
      (Number(process.env.STRESS_SECONDS) || 5) * 1000 + 30000,
    ),
  },
  async (t) => {
    const f = await fixture(t, {
        now: Date.now,
        tickMs: 16,
        arcade: true,
        transports: process.env.STRESS_POLLING ? ["polling"] : ["websocket"],
      }),
      phones = [],
      hosts = [];
    for (let roomIndex = 0; roomIndex < 4; roomIndex++) {
      const host = await f.connect(),
        room = await emit(host, "host");
      hosts.push(host);
      for (let slot = 0; slot < 4; slot++) {
        const phone = new FakePhone(f, room.code);
        assert.equal((await phone.join()).slot, slot);
        phone.ready();
        phones.push(phone);
      }
    }
    await wait(80);
    for (const host of hosts) {
      host.on("state", (state) => {
        if (
          state.phase === "lobby" &&
          state.players.filter((p) => p.ready).length === 4
        )
          host.emit("start");
      });
      host.emit("start");
    }
    const lag = monitorEventLoopDelay({ resolution: 10 });
    lag.enable();
    let samples = 0,
      frames = 0;
    const rtt = [];
    hosts.forEach((h) => h.on("frame", () => frames++));
    const stream = setInterval(() => {
      for (const [i, p] of phones.entries()) {
        p.sample({
          x: Math.sin(samples * 0.01 + i),
          y: Math.cos(samples * 0.013 + i),
          pulse: samples % 20 === 0,
        });
        samples++;
      }
    }, 33);
    try {
      for (
        let round = 0;
        round < Math.max(10, (Number(process.env.STRESS_SECONDS) || 5) * 2);
        round++
      ) {
        const results = await Promise.all(
          phones.map(async (p) => {
            const began = performance.now();
            await emit(p.socket, "ping-check");
            return performance.now() - began;
          }),
        );
        rtt.push(...results);
        await wait(500);
      }
    } finally {
      clearInterval(stream);
      lag.disable();
    }
    assert.ok(frames > 100);
    assert.ok(samples > 1600);
    assert.ok(phones.every((p) => p.socket.connected));
    assert.equal(f.party.rooms.size, 4);
    rtt.sort((a, b) => a - b);
    t.diagnostic(
      JSON.stringify({
        environment: "local Node client/server; no physical phones",
        rooms: 4,
        phones: 16,
        inputPackets: samples,
        frames,
        pingP95Ms: +rtt[Math.floor(rtt.length * 0.95)].toFixed(2),
        eventLoopP99Ms: +(lag.percentile(99) / 1e6).toFixed(2),
      }),
    );
  },
);
