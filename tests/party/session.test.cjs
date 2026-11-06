const test = require("node:test"),
  assert = require("node:assert/strict");
const { fixture, emit, wait } = require("./harness.cjs");
test("four slots, overflow, reconnect identity, and room isolation", async (t) => {
  const f = await fixture(t),
    host = await f.connect(),
    a = await emit(host, "host");
  const peers = [];
  for (let i = 0; i < 4; i++) {
    const s = await f.connect(),
      answer = await emit(s, "join", { code: a.code });
    assert.equal(answer.slot, i);
    peers.push({ s, answer });
  }
  const fifth = await f.connect();
  assert.equal((await emit(fifth, "join", { code: a.code })).full, true);
  const host2 = await f.connect(),
    b = await emit(host2, "host"),
    other = await f.connect();
  assert.equal((await emit(other, "join", { code: b.code })).slot, 0);
  assert.equal(f.party.rooms.get(a.code).players.filter(Boolean).length, 4);
  peers[2].s.disconnect();
  await f.advance(10);
  const reconnect = await f.connect();
  assert.equal(
    (
      await emit(reconnect, "join", {
        code: a.code,
        token: peers[2].answer.token,
      })
    ).slot,
    2,
  );
  assert.equal(f.party.rooms.get(a.code).players.filter(Boolean).length, 4);
});
test("controller cannot start, switch, or impersonate the host; malformed tokens are safe", async (t) => {
  const f = await fixture(t),
    host = await f.connect(),
    room = await emit(host, "host"),
    p = await f.connect();
  await emit(p, "join", { code: room.code });
  p.emit("select", { game: "bubble-burst" });
  p.emit("start");
  p.emit("input", { x: Infinity, y: NaN });
  await f.advance(30);
  assert.equal(f.party.rooms.get(room.code).game, "star-catch");
  assert.equal(f.party.rooms.get(room.code).phase, "lobby");
  const stranger = await f.connect();
  assert.ok(
    (await emit(stranger, "host", { code: room.code, token: "é".repeat(32) }))
      .error,
  );
});
test("practice admits ready late arrivals; round participants lock at countdown; rematch resets score", async (t) => {
  const f = await fixture(t),
    host = await f.connect(),
    r = await emit(host, "host"),
    p = await f.connect();
  await emit(p, "join", { code: r.code });
  p.emit("ready", { ready: true, mode: "touch" });
  await f.advance(30);
  const room = f.party.rooms.get(r.code);
  assert.equal(room.phase, "practice");
  const p2 = await f.connect();
  await emit(p2, "join", { code: r.code });
  p2.emit("ready", { ready: true });
  await f.advance(30);
  assert.deepEqual(room.active, [0, 1]);
  await f.advance(6001);
  assert.equal(room.phase, "countdown");
  const late = await f.connect();
  await emit(late, "join", { code: r.code });
  late.emit("ready", { ready: true });
  await f.advance(3001);
  assert.equal(room.phase, "playing");
  assert.deepEqual(room.active, [0, 1]);
  room.round.players[0].score = 123;
  await f.advance(60001);
  assert.equal(room.phase, "results");
  assert.equal(f.party.view(room).players[0].score, 123);
  await f.advance(12001);
  await f.advance(30);
  assert.equal(room.phase, "practice");
  assert.deepEqual(room.active, [0, 1, 2]);
  assert.equal(room.round.players[0].score, 0);
});
test("returning to lobby waits for a choice; selecting a game restarts the ready crew", async (t) => {
  const f = await fixture(t),
    h = await f.connect(),
    r = await emit(h, "host"),
    p = await f.connect();
  await emit(p, "join", { code: r.code });
  p.emit("ready", { ready: true });
  await f.advance(30);
  h.emit("lobby");
  await f.advance(30);
  assert.equal(f.party.rooms.get(r.code).phase, "lobby");
  await f.advance(10000);
  assert.equal(f.party.rooms.get(r.code).phase, "lobby");
  h.emit("select", { game: "neon-drift" });
  await f.advance(30);
  assert.equal(f.party.rooms.get(r.code).phase, "practice");
  assert.equal(f.party.rooms.get(r.code).game, "neon-drift");
});
test("stale inputs stop scoring and disconnected active slots cannot be stolen", async (t) => {
  const f = await fixture(t),
    h = await f.connect(),
    r = await emit(h, "host"),
    p = await f.connect(),
    q = await f.connect();
  await emit(p, "join", { code: r.code });
  await emit(q, "join", { code: r.code });
  p.emit("ready", { ready: true });
  q.emit("ready", { ready: true });
  await f.advance(30);
  const room = f.party.rooms.get(r.code);
  p.emit("leave");
  await f.advance(30);
  const newcomer = await f.connect();
  assert.equal((await emit(newcomer, "join", { code: r.code })).slot, 2);
  assert.equal(room.players[0].ready, false);
});

test("host disconnect pauses the clock and the same tab can reclaim the party", async (t) => {
  const f = await fixture(t),
    h = await f.connect(),
    r = await emit(h, "host"),
    p = await f.connect();
  await emit(p, "join", { code: r.code });
  p.emit("ready", { ready: true });
  await f.advance(30);
  const room = f.party.rooms.get(r.code),
    ends = room.endsAt;
  const disconnected = new Promise((resolve) =>
    f.io.of("/party").sockets.get(h.id).once("disconnect", resolve),
  );
  h.disconnect();
  await disconnected;
  await f.advance(1000);
  assert.equal(room.endsAt, ends + 1000);
  const resumed = await f.connect(),
    answer = await emit(resumed, "host", { code: r.code, token: r.token });
  assert.equal(answer.code, r.code);
  assert.equal(room.players[0].socket, p.id);
  assert.equal(f.party.view(room).hostConnected, true);
});

test("classics use authenticated, isolated screens and map a nonzero party slot to the solo driver", async (t) => {
  const f = await fixture(t),
    h = await f.connect(),
    r = await emit(h, "host");
  h.emit("lobby");
  await f.advance(20);
  const first = await f.connect(),
    p = await f.connect();
  await emit(first, "join", { code: r.code });
  await emit(p, "join", { code: r.code });
  first.emit("leave");
  h.emit("select", { game: "mario-kart" });
  p.emit("ready", { ready: true, mode: "touch" });
  await f.advance(30);
  h.emit("start");
  await f.advance(20);
  const room = f.party.rooms.get(r.code);
  assert.equal(room.phase, "classic");
  assert.deepEqual(room.active, [1]);
  const stranger = await f.connect();
  assert.ok(
    (
      await emit(stranger, "screen", {
        code: r.code,
        token: "wrong",
        game: "mario-kart",
        roundId: room.roundId,
      })
    ).error,
  );
  assert.ok(
    (
      await emit(stranger, "screen", {
        ...r,
        game: "drawing",
        roundId: room.roundId,
      })
    ).error,
  );
  const screen = await f.connect();
  assert.equal(
    (
      await emit(screen, "screen", {
        ...r,
        game: "mario-kart",
        roundId: room.roundId,
      })
    ).ok,
    true,
  );
  let sample, action, feedback;
  screen.on("orientation", (s) => (sample = s));
  screen.on("command", (c) => (action = c));
  p.on("feedback", (d) => (feedback = d));
  p.emit("input", { x: 0.5, y: 0, gas: true, boost: true });
  p.emit("action", { action: "confirm" });
  await f.advance(30);
  assert.equal(sample.slot, 0);
  assert.equal(sample.party.gas, true);
  assert.equal(sample.party.x, 0.5);
  assert.equal(action.button, "2");
  screen.emit("feedback", {
    type: "race-status",
    slot: 0,
    stage: "racing",
    boostIn: 7,
    boostsLeft: 2,
  });
  await f.advance(20);
  assert.equal(feedback.boostIn, 7);
  assert.equal(feedback.boostsLeft, 2);
  const otherHost = await f.connect(),
    otherRoom = await emit(otherHost, "host"),
    other = await f.connect();
  await emit(other, "join", { code: otherRoom.code });
  other.emit("input", { x: -1, y: 0, gas: true });
  other.emit("feedback", { type: "race-status", slot: 0, boostIn: 0 });
  await f.advance(20);
  assert.equal(sample.party.x, 0.5);
  assert.equal(feedback.boostIn, 7);
  assert.equal(feedback.boostsLeft, 2);
  await f.advance(510);
  assert.equal(sample.party.active, false);
  assert.equal(sample.party.gas, false);
  h.emit("lobby");
  await f.advance(20);
  assert.equal(room.screen, null);
  assert.equal(room.phase, "lobby");
});
test("classic multiplayer admits ready phones and solo next-player rotates the active driver", async (t) => {
  const f = await fixture(t),
    h = await f.connect(),
    r = await emit(h, "host"),
    peers = [];
  h.emit("select", { game: "fruit-ninja" });
  for (let i = 0; i < 4; i++) {
    const p = await f.connect();
    await emit(p, "join", { code: r.code });
    p.emit("ready", { ready: true });
    peers.push(p);
    await f.advance(20);
  }
  h.emit("start");
  await f.advance(20);
  const room = f.party.rooms.get(r.code);
  assert.deepEqual(room.active, [0, 1, 2, 3]);
  assert.equal(room.phase, "classic");
  h.emit("lobby");
  await f.advance(20);
  h.emit("select", { game: "mario-kart" });
  await f.advance(20);
  await emit(h, "setup", { mode: "solo" });
  h.emit("start");
  await f.advance(20);
  assert.deepEqual(room.active, [0]);
  const previous = room.roundId;
  peers[1].emit("next-player");
  await f.advance(20);
  assert.deepEqual(room.active, [0]);
  h.emit("next-player");
  await f.advance(20);
  assert.deepEqual(room.active, [1]);
  assert.equal(room.roundId, previous + 1);
  const old = await f.connect();
  assert.ok(
    (await emit(old, "screen", { ...r, game: "mario-kart", roundId: previous }))
      .error,
  );
  peers[1].emit("ready", { ready: false });
  await f.advance(20);
  assert.equal(room.players[1].input.gas, undefined);
});

test("a solo classic holds the current turn through a brief phone disconnect and refresh", async (t) => {
  const f = await fixture(t),
    host = await f.connect(),
    r = await emit(host, "host");
  host.emit("select", { game: "mario-kart" });
  const p = await f.connect(),
    identity = await emit(p, "join", { code: r.code });
  p.emit("ready", { ready: true });
  await f.advance(20);
  const waiting = await f.connect();
  await emit(waiting, "join", { code: r.code });
  waiting.emit("ready", { ready: true });
  await f.advance(20);
  await emit(host, "setup", { mode: "solo" });
  host.emit("start");
  await f.advance(20);
  const room = f.party.rooms.get(r.code),
    round = room.roundId;
  const dropped = new Promise((resolve) =>
    f.io.of("/party").sockets.get(p.id).once("disconnect", resolve),
  );
  p.disconnect();
  await dropped;
  await f.advance(1000);
  assert.equal(room.phase, "classic");
  assert.deepEqual(room.active, [0]);
  assert.equal(room.roundId, round);
  const rejoined = await f.connect();
  assert.equal(
    (await emit(rejoined, "join", { code: r.code, token: identity.token }))
      .slot,
    0,
  );
  rejoined.emit("ready", { ready: true });
  await f.advance(20);
  assert.deepEqual(room.active, [0]);
  assert.equal(room.roundId, round);
  const droppedAgain = new Promise((resolve) =>
    f.io.of("/party").sockets.get(rejoined.id).once("disconnect", resolve),
  );
  rejoined.disconnect();
  await droppedAgain;
  await f.advance(20001);
  assert.deepEqual(room.active, [1]);
  assert.ok(room.roundId > round);
});

test("a phone reconnect preserves its remaining Neon Drift boosts and exposes them in room state", async (t) => {
  const f = await fixture(t),
    h = await f.connect(),
    r = await emit(h, "host");
  h.emit("select", { game: "neon-drift" });
  const p = await f.connect(),
    identity = await emit(p, "join", { code: r.code });
  const other = await f.connect();
  await emit(other, "join", { code: r.code });
  p.emit("ready", { ready: true });
  other.emit("ready", { ready: true });
  await f.advance(30);
  p.emit("input", { x: 0, y: 0, gas: true, boost: true });
  await emit(p, "ping-check"); // Flush the real socket before advancing the fake simulation clock.
  await f.advance(40);
  const room = f.party.rooms.get(r.code);
  assert.equal(
    f.party.view(room).players.find((p) => p.slot === 0).boostsLeft,
    2,
  );
  const lost = new Promise((resolve) =>
    f.io.of("/party").sockets.get(p.id).once("disconnect", resolve),
  );
  p.disconnect();
  await lost;
  const resumed = await f.connect();
  await emit(resumed, "join", { code: r.code, token: identity.token });
  resumed.emit("ready", { ready: true });
  await f.advance(40);
  assert.equal(
    f.party.view(room).players.find((p) => p.slot === 0).boostsLeft,
    2,
  );
  assert.equal(
    f.party.view(room).players.find((p) => p.slot === 1).boostsLeft,
    3,
  );
});

test("multiplayer gates at two humans and freezes an independent four-seat race", async (t) => {
  const f = await fixture(t),
    h = await f.connect(),
    r = await emit(h, "host");
  h.emit("select", { game: "mario-kart" });
  await f.advance(20);
  await emit(h, "setup", { mode: "multiplayer" });
  const a = await f.connect();
  await emit(a, "join", { code: r.code });
  a.emit("ready", { ready: true });
  await f.advance(20);
  h.emit("start");
  await f.advance(20);
  const room = f.party.rooms.get(r.code);
  assert.equal(room.phase, "lobby");
  for (let i = 1; i < 4; i++) {
    const p = await f.connect();
    await emit(p, "join", { code: r.code });
    p.emit("ready", { ready: true });
  }
  await f.advance(20);
  h.emit("start");
  await f.advance(20);
  assert.deepEqual(room.active, [0, 1, 2, 3]);
  assert.equal(room.match.cpuCount, 0);
  h.emit("setup", { mode: "solo", cpuCount: 7 });
  await f.advance(20);
  assert.equal(room.match.mode, "multiplayer");
  assert.equal(room.match.cpuCount, 0);
});
test("isolated view inputs and one final scoreboard after every challenge finishes", async (t) => {
  const f = await fixture(t),
    h = await f.connect(),
    r = await emit(h, "host");
  h.emit("select", { game: "shooting-range" });
  await f.advance(20);
  const peers = [];
  for (let i = 0; i < 2; i++) {
    const p = await f.connect();
    peers.push(p);
    await emit(p, "join", { code: r.code });
    p.emit("ready", { ready: true });
  }
  await f.advance(20);
  h.emit("start");
  await f.advance(20);
  const room = f.party.rooms.get(r.code),
    screens = [];
  for (let view = 0; view < 2; view++) {
    const screen = await f.connect();
    screens.push(screen);
    assert.equal(
      (
        await emit(screen, "screen", {
          ...r,
          game: room.game,
          roundId: room.roundId,
          view,
        })
      ).ok,
      true,
    );
  }
  let samples = [];
  screens.forEach((s, i) => s.on("orientation", (p) => (samples[i] = p)));
  peers[0].emit("input", { x: 0.8, y: 0 });
  peers[1].emit("input", { x: -0.3, y: 0 });
  await f.advance(30);
  assert.equal(samples[0].party.x, 0.8);
  assert.equal(samples[1].party.x, -0.3);
  assert.equal(samples[1].slot, 0);
  await emit(screens[0], "match.finish", { scores: [{ slot: 0, score: 75 }] });
  assert.equal(room.phase, "classic");
  await emit(screens[1], "match.finish", { scores: [{ slot: 0, score: 100 }] });
  assert.equal(room.phase, "results");
  assert.equal(room.result.scores[0].slot, 1);
  assert.equal(
    room.result.verification,
    "failed",
    "claimed scores without input logs are unverified",
  );
  const oldHash = room.result.hash;
  await emit(screens[1], "match.finish", {
    scores: [{ slot: 0, score: 99999 }],
  });
  assert.equal(room.result.hash, oldHash);
});
test("read-only displays cannot act as screens, publish snapshots or finish rounds", async (t) => {
  const f = await fixture(t),
    h = await f.connect(),
    r = await emit(h, "host");
  h.emit("select", { game: "mario-kart" });
  const p = await f.connect();
  await emit(p, "join", { code: r.code });
  p.emit("ready", { ready: true });
  await f.advance(20);
  h.emit("start");
  await f.advance(20);
  const room = f.party.rooms.get(r.code),
    screen = await f.connect();
  await emit(screen, "screen", {
    ...r,
    game: room.game,
    roundId: room.roundId,
  });
  const watch = await f.connect();
  assert.ok(
    (
      await emit(watch, "watch-game", {
        code: r.code,
        token: r.token,
        roundId: room.roundId,
        view: 0,
        game: room.game,
      })
    ).error,
  );
  assert.equal(
    (
      await emit(watch, "watch-game", {
        code: r.code,
        token: r.displayToken,
        roundId: room.roundId,
        view: 0,
        game: room.game,
      })
    ).ok,
    true,
  );
  let seen;
  watch.on("snapshot", (s) => (seen = s));
  screen.emit("snapshot", { clock: 10, state: { position: 42 } });
  await f.advance(100);
  assert.equal(seen.state.position, 42);
  watch.emit("snapshot", { clock: 99, state: { position: 999 } });
  watch.emit("select", { game: "drawing" });
  assert.ok(
    (await emit(watch, "match.finish", { scores: [{ slot: 0, score: 999 }] }))
      .error,
  );
  await f.advance(100);
  assert.equal(room.game, "mario-kart");
  assert.equal(room.snapshots.get(-1).state.position, 42);
  screen.disconnect();
  await f.advance(20);
  assert.equal(room.screen, null);
  assert.equal(room.phase, "classic");
});
test("old builds are rejected and host pause freezes round time", async (t) => {
  const f = await fixture(t, { buildId: "new-build" }),
    h = await f.connect();
  assert.equal((await emit(h, "host", { buildId: "old-build" })).update, true);
  const r = await emit(h, "host", { buildId: "new-build" }),
    p = await f.connect();
  assert.equal((await emit(p, "join", { code: r.code })).update, true);
  await emit(p, "join", { code: r.code, buildId: "new-build" });
  p.emit("ready", { ready: true });
  await f.advance(20);
  const room = f.party.rooms.get(r.code);
  h.emit("pause");
  await f.advance(20);
  const remaining = room.endsAt;
  await f.advance(1000);
  assert.equal(room.endsAt, remaining + 1000);
  p.emit("pause");
  await f.advance(20);
  assert.equal(room.paused, true);
  h.emit("pause");
  await f.advance(20);
  assert.equal(room.paused, false);
});

test("four-player bracket goes through two semifinals and a final", async (t) => {
  const f = await fixture(t),
    h = await f.connect(),
    r = await emit(h, "host");
  h.emit("select", { game: "table-tennis" });
  await f.advance(20);
  await emit(h, "setup", { mode: "multiplayer", rotation: "bracket" });
  for (let i = 0; i < 4; i++) {
    const p = await f.connect();
    await emit(p, "join", { code: r.code });
    p.emit("ready", { ready: true });
  }
  await f.advance(20);
  h.emit("start");
  await f.advance(20);
  const room = f.party.rooms.get(r.code);
  async function win() {
    const s = await f.connect();
    await emit(s, "screen", { ...r, game: room.game, roundId: room.roundId });
    await emit(s, "match.finish", {
      scores: [
        { slot: 0, score: 7 },
        { slot: 1, score: 2 },
      ],
    });
  }
  assert.deepEqual(room.active, [0, 1]);
  await win();
  h.emit("start");
  await f.advance(20);
  assert.deepEqual(room.active, [2, 3]);
  await win();
  h.emit("start");
  await f.advance(20);
  assert.deepEqual(room.active, [0, 2]);
  await win();
  assert.equal(room.bracket.champion, 0);
  assert.equal(room.auto, false);
});
test("playlist advances and leaving play emits an abandoned record", async (t) => {
  const f = await fixture(t),
    h = await f.connect(),
    r = await emit(h, "host");
  h.emit("select", { game: "table-tennis" });
  await f.advance(20);
  await emit(h, "setup", { playlist: ["table-tennis", "swordplay"] });
  const p = await f.connect();
  await emit(p, "join", { code: r.code });
  p.emit("ready", { ready: true });
  await f.advance(20);
  h.emit("start");
  await f.advance(20);
  const room = f.party.rooms.get(r.code),
    s = await f.connect();
  await emit(s, "screen", { ...r, game: room.game, roundId: room.roundId });
  await emit(s, "match.finish", { scores: [{ slot: 0, score: 7 }] });
  await f.advance(12001);
  await f.advance(20);
  assert.equal(room.game, "swordplay");
  assert.equal(room.phase, "classic");
  h.emit("lobby");
  await f.advance(20);
  assert.equal(room.history.at(-1).result.status, "abandoned");
  assert.equal(room.history.length, 2);
});

test("host can pick the two duel players explicitly", async (t) => {
  const f = await fixture(t),
    h = await f.connect(),
    r = await emit(h, "host");
  h.emit("select", { game: "table-tennis" });
  await f.advance(10);
  for (let i = 0; i < 4; i++) {
    const p = await f.connect();
    await emit(p, "join", { code: r.code });
    p.emit("ready", { ready: true });
  }
  await f.advance(10);
  await emit(h, "setup", {
    mode: "multiplayer",
    rotation: "pick",
    pair: [3, 1],
  });
  h.emit("start");
  await f.advance(10);
  assert.deepEqual(f.party.rooms.get(r.code).active, [3, 1]);
});
test("drawing sends the secret only to its drawer and accepts bounded guesses from other seats", async (t) => {
  const f = await fixture(t),
    h = await f.connect(),
    r = await emit(h, "host");
  h.emit("select", { game: "drawing" });
  await f.advance(10);
  const ps = [];
  for (let i = 0; i < 2; i++) {
    const p = await f.connect();
    await emit(p, "join", { code: r.code });
    p.emit("ready", { ready: true });
    ps.push(p);
  }
  let private0, private1;
  ps[0].on("sketch-turn", (s) => (private0 = s));
  ps[1].on("sketch-turn", (s) => (private1 = s));
  await f.advance(10);
  h.emit("start");
  await f.advance(10);
  const room = f.party.rooms.get(r.code);
  assert.equal(private0.word, room.sketch.word);
  assert.equal(private1.word, null);
  assert.ok(!JSON.stringify(f.party.view(room)).includes(room.sketch.word));
  assert.equal(
    (await emit(ps[0], "guess", { text: room.sketch.word })).correct,
    false,
  );
  assert.equal(
    (await emit(ps[1], "guess", { text: room.sketch.word })).correct,
    true,
  );
  assert.ok(room.progress[1] >= 159 && room.progress[1] <= 160);
  assert.equal(room.progress[0], 60);
});
test("Slice Dojo scores come from its checked cursor log and malformed replay calls cannot crash the room", async (t) => {
  const f = await fixture(t),
    h = await f.connect(),
    r = await emit(h, "host"),
    p = await f.connect();
  h.emit("select", { game: "fruit-ninja" });
  await f.advance(10);
  await emit(p, "join", { code: r.code });
  p.emit("ready", { ready: true });
  await f.advance(10);
  h.emit("start");
  await f.advance(10);
  const room = f.party.rooms.get(r.code),
    screen = await f.connect();
  await emit(screen, "screen", {
    code: r.code,
    token: r.token,
    game: room.game,
    roundId: room.roundId,
  });
  screen.emit("replay-chunk", {
    sequence: 0,
    calls: [
      ["setAspect", 16 / 9],
      ["start", 0],
      ["update", 1000 / 120, 1 / 120],
    ],
  });
  screen.emit("score", { scores: [{ slot: 0, score: 999 }] });
  await f.advance(10);
  assert.equal(room.progress[0], 0);
  await f.advance(120001);
  assert.equal(room.result.verification, "verified");
  assert.equal(
    (await emit(h, "record", { matchId: room.result.matchId })).replay.boards
      .length,
    1,
  );
});
