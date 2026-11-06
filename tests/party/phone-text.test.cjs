const test = require("node:test"),
  assert = require("node:assert/strict");
const { fixture, emit, FakePhone } = require("./harness.cjs");
const request = (socket, payload = { field: "customWords" }) =>
  new Promise((resolve, reject) =>
    socket
      .timeout(3000)
      .emit("phone-text", payload, (error, response) =>
        error ? reject(error) : resolve(response),
      ),
  );
const flush = (socket) => emit(socket, "ping-check");
async function setup(t, count = 2, grant = true) {
  const f = await fixture(t, { arcade: true }),
    host = await f.connect(),
    identity = await emit(host, "host"),
    phones = [];
  for (let i = 0; i < count; i++) {
    const phone = new FakePhone(f, identity.code);
    await phone.join();
    phone.ready();
    await flush(phone.socket);
    phones.push(phone);
  }
  host.emit("select", { game: "drawing" });
  await flush(host);
  if (grant)
    assert.equal((await emit(host, "host.assign", { slot: 0 })).ok, true);
  return {
    ...f,
    host,
    identity,
    phones,
    room: f.party.rooms.get(identity.code),
  };
}
const collect = (socket) => {
  const packets = [];
  socket.on("phone-text", (packet) => packets.push(packet));
  return packets;
};

test("only the designated ready host phone receives a text prompt; response text is never relayed", async (t) => {
  const f = await setup(t),
    received = collect(f.phones[0].socket),
    other = collect(f.phones[1].socket);
  const display = await f.connect();
  await emit(display, "display", {
    code: f.identity.code,
    token: f.identity.displayToken,
  });
  const displayed = collect(display);
  f.phones[0].socket.on("phone-text", (_data, ack) =>
    ack({ ok: true, words: ["private"], token: "secret" }),
  );
  assert.deepEqual(await request(f.host), { ok: true });
  assert.deepEqual(received, [{ field: "customWords" }]);
  assert.deepEqual(other, []);
  assert.deepEqual(displayed, []);
  f.room.phase = "results";
  assert.deepEqual(await request(f.host), { ok: true });
});

test("players, delegated host phone, staff, waiting phones, displays, game views and outsiders are denied", async (t) => {
  const f = await setup(t, 4),
    got = collect(f.phones[0].socket);
  const queue = new FakePhone(f, f.identity.code);
  assert.equal((await queue.join()).queued, true);
  await emit(f.host, "arcade.configure", { pin: "735182", mode: "party" });
  assert.equal(
    (await emit(f.phones[1].socket, "staff.unlock", { pin: "735182" })).ok,
    true,
  );
  await emit(f.host, "host.assign", { slot: 0 });
  const display = await f.connect();
  await emit(display, "display", {
    code: f.identity.code,
    token: f.identity.displayToken,
  });
  const outsider = await f.connect();
  for (const socket of [
    f.phones[0].socket,
    f.phones[1].socket,
    f.phones[2].socket,
    queue.socket,
    display,
    outsider,
  ])
    assert.match((await request(socket)).error, /Only the main screen/);
  assert.ok(
    (
      await emit(f.phones[0].socket, "host.cmd", {
        seq: 1,
        cmd: "phone-text",
        args: { field: "customWords" },
      })
    ).error,
  );
  f.host.emit("start");
  await flush(f.host);
  const viewer = await f.connect(),
    screen = await f.connect();
  assert.equal(
    (
      await emit(viewer, "watch-game", {
        code: f.identity.code,
        token: f.identity.displayToken,
        game: "drawing",
        roundId: f.room.roundId,
        view: -1,
      })
    ).ok,
    true,
  );
  assert.equal(
    (
      await emit(screen, "screen", {
        code: f.identity.code,
        token: f.identity.token,
        game: "drawing",
        roundId: f.room.roundId,
      })
    ).ok,
    true,
  );
  for (const socket of [viewer, screen])
    assert.match((await request(socket)).error, /Only the main screen/);
  assert.deepEqual(got, []);
});

test("a pending grant, unready, away, disconnected or revoked host phone cannot be targeted", async (t) => {
  const f = await setup(t, 2, false),
    phone = f.phones[0],
    got = collect(phone.socket);
  assert.ok((await request(f.host)).error);
  await emit(f.host, "host.assign", { slot: 0 });
  phone.socket.emit("ready", { ready: false });
  await flush(phone.socket);
  assert.ok((await request(f.host)).error);
  phone.ready();
  await flush(phone.socket);
  phone.socket.emit("away", { away: true });
  await flush(phone.socket);
  assert.ok((await request(f.host)).error);
  phone.socket.emit("away", { away: false });
  await flush(phone.socket);
  await emit(f.host, "host.assign", { slot: null });
  assert.ok((await request(f.host)).error);
  await emit(f.host, "host.assign", { slot: 0 });
  phone.disconnect();
  await f.advance(10);
  assert.ok((await request(f.host)).error);
  assert.deepEqual(got, []);
});

test("malformed payloads, other fields, other games, active rounds and kiosk mode are rejected", async (t) => {
  const f = await setup(t),
    got = collect(f.phones[0].socket);
  for (const data of [
    null,
    [],
    "customWords",
    {},
    { field: "name" },
    { field: "customWords", value: "private" },
    { field: "customWords", slot: 1 },
  ])
    assert.ok((await request(f.host, data)).error);
  f.host.emit("select", { game: "star-catch" });
  await flush(f.host);
  assert.ok((await request(f.host)).error);
  f.host.emit("select", { game: "drawing" });
  f.host.emit("start");
  await flush(f.host);
  assert.equal(f.room.phase, "classic");
  assert.ok((await request(f.host)).error);
  f.host.emit("lobby");
  await flush(f.host);
  await emit(f.host, "arcade.configure", { pin: "735182", mode: "kiosk" });
  assert.ok((await request(f.host)).error);
  assert.deepEqual(got, []);
});

test("pending prompts are exclusive and a changed grant invalidates a late acknowledgement", async (t) => {
  const f = await setup(t);
  let reply;
  const delivered = new Promise((resolve) =>
    f.phones[0].socket.once("phone-text", (_data, ack) => {
      reply = ack;
      resolve();
    }),
  );
  const pending = request(f.host);
  await delivered;
  assert.match((await request(f.host)).error, /moment/);
  await emit(f.host, "host.assign", { slot: 1 });
  reply({ ok: true });
  assert.match((await pending).error, /changed/);
  f.phones[1].socket.on("phone-text", (_data, ack) => ack({ ok: true }));
  assert.deepEqual(await request(f.host), { ok: true });
});

test("the previous TV socket cannot prompt after room reclaim", async (t) => {
  const f = await setup(t),
    serverHost = f.io.of("/party").sockets.get(f.host.id),
    handler = serverHost.listeners("phone-text")[0];
  const replacement = await f.connect();
  await emit(replacement, "host", {
    code: f.identity.code,
    token: f.identity.token,
  });
  const answer = await new Promise((resolve) =>
    handler({ field: "customWords" }, resolve),
  );
  assert.match(answer.error, /Only the main screen/);
});

test("phone errors are sanitized, prompts are rate limited, and an unanswered prompt times out", async (t) => {
  const f = await setup(t);
  const fail = (_data, ack) =>
    ack({ error: "private words and credentials", token: "private" });
  f.phones[0].socket.on("phone-text", fail);
  for (let i = 0; i < 4; i++)
    assert.deepEqual(await request(f.host), {
      error: "The host phone could not open the word editor.",
    });
  assert.match((await request(f.host)).error, /moment/);
  await f.advance(10001);
  f.phones[0].socket.off("phone-text", fail);
  assert.match((await request(f.host)).error, /did not respond/);
  f.phones[0].socket.on("phone-text", (_data, ack) => ack({ ok: true }));
  assert.deepEqual(
    await request(f.host),
    { ok: true },
    "timeout releases the pending prompt",
  );
});
