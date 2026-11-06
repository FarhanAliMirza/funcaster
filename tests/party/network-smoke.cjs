// An actual network smoke check, isolated in its own temporary party.
const { io } = require("socket.io-client");
const assert = require("node:assert/strict");
const base = process.env.PARTY_URL || "http://localhost:8444";
const sockets = [],
  timers = [];
const emit = (s, name, payload = {}) =>
  new Promise((resolve, reject) =>
    s
      .timeout(10000)
      .emit(name, payload, (e, r) => (e ? reject(e) : resolve(r))),
  );
const event = (s, name, predicate) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      s.off(name, listener);
      reject(new Error("Timed out: " + name));
    }, 20000);
    const listener = (data) => {
      if (predicate(data)) {
        clearTimeout(timeout);
        s.off(name, listener);
        resolve(data);
      }
    };
    s.on(name, listener);
  });
async function connect() {
  const s = io(base + "/party", {
    forceNew: true,
    transports: ["websocket", "polling"],
    reconnection: false,
  });
  sockets.push(s);
  await event(s, "connect", () => true);
  return s;
}
(async () => {
  try {
    const classic = await (await fetch(base + "/api/pairing")).json();
    assert.ok(classic.url.endsWith("/classic-controller"));
    const games = await (await fetch(base + "/api/games")).json();
    assert.equal(games.length, 13);
    const { buildId } = await (await fetch(base + "/api/health")).json();
    const host = await connect(),
      room = await emit(host, "host", { buildId });
    const pair = await (
      await fetch(base + "/api/party/pairing/" + room.code)
    ).json();
    assert.ok(pair.qr.startsWith("data:image/png"));
    if (base.startsWith("https://"))
      assert.ok(pair.url.startsWith(base + "/controller?room="));
    for (let slot = 0; slot < 4; slot++) {
      const p = await connect(),
        answer = await emit(p, "join", { code: room.code, buildId });
      assert.equal(answer.slot, slot);
      timers.push(
        setInterval(
          () =>
            p.emit("input", {
              x: Math.sin(Date.now() / 1300 + slot),
              y: Math.cos(Date.now() / 1400),
              pulse: true,
              gas: true,
            }),
          40,
        ),
      );
      p.emit("ready", { ready: true, mode: "touch" });
    }
    for (const game of ["star-catch", "neon-drift", "bubble-burst"]) {
      const next = event(
        host,
        "frame",
        (f) => f.game === game && f.players.length === 4 && f.elapsed > 1,
      );
      if (game !== "star-catch") {
        host.emit("lobby");
        host.emit("select", { game });
      }
      const frame = await next;
      assert.equal(frame.players.length, 4);
      assert.ok(
        frame.players.every(
          (p) => Number.isFinite(p.x) && Number.isFinite(p.score),
        ),
      );
      console.log(
        "PASS: " +
          game +
          " with four independent controllers through " +
          new URL(base).protocol,
      );
    }
    const done = event(host, "state", (s) => s.phase === "playing");
    await done;
    console.log(
      "PASS: practice → countdown → scored round; public QR origin is correct",
    );
    for (const game of [
      "mario-kart",
      "fruit-ninja",
      "alien-attack",
      "shooting-range",
      "drawing",
      "golf",
      "table-tennis",
      "swordplay",
      "kart",
      "island-flyover",
    ]) {
      const started = event(
        host,
        "state",
        (s) => s.phase === "classic" && s.game === game,
      );
      host.emit("lobby");
      host.emit("select", { game });
      host.emit("start");
      const state = await started;
      assert.equal(
        state.active.length,
        ["table-tennis", "swordplay"].includes(game) ? 2 : 4,
      );
      const screen = await connect();
      const samples = event(
        screen,
        "orientation",
        (s) => s.slot === 0 && s.party.active && s.party.gas,
      );
      const accepted = await emit(screen, "screen", {
        ...room,
        buildId,
        game,
        roundId: state.roundId,
        view: 0,
      });
      assert.equal(accepted.ok, true);
      await samples;
      assert.equal((await fetch(base + `/games/${game}/`)).status, 200);
      screen.disconnect();
      console.log(
        `PASS: ${game} shares the party with ${state.active.length} active controller(s)`,
      );
    }
  } finally {
    timers.forEach(clearInterval);
    sockets.forEach((s) => s.disconnect());
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
