const test = require("node:test"),
  assert = require("node:assert/strict");
const { fixture, emit, FakePhone } = require("./harness.cjs");
for (const transport of ["websocket", "polling"])
  test(`four phones retain identity through repeated reconnects over ${transport}`, async (t) => {
    const f = await fixture(t, { transports: [transport] }),
      host = await f.connect(),
      room = await emit(host, "host");
    const phones = [];
    for (let slot = 0; slot < 4; slot++) {
      const p = new FakePhone(f, room.code);
      assert.equal((await p.join()).slot, slot);
      p.ready();
      phones.push(p);
    }
    await f.advance(20);
    for (let cycle = 0; cycle < 4; cycle++) {
      for (let tick = 0; tick < 20; tick++)
        for (const [slot, p] of phones.entries())
          p.sample({ x: (slot - 1.5) / 2, y: 0, gas: tick % 2 === 0 });
      const p = phones[cycle];
      const token = p.identity.token;
      p.disconnect();
      await f.advance(100);
      assert.equal((await p.join()).slot, cycle);
      assert.equal(p.identity.token, token);
      p.ready();
      await f.advance(100);
      assert.equal(
        f.party.rooms.get(room.code).players.filter(Boolean).length,
        4,
      );
    }
    assert.deepEqual(
      f.party.view(f.party.rooms.get(room.code)).players.map((p) => p.slot),
      [0, 1, 2, 3],
    );
  });
test("four-seat identity palette and room isolation remain stable", async (t) => {
  const f = await fixture(t),
    h = await f.connect(),
    room = await emit(h, "host"),
    phones = [];
  for (let slot = 0; slot < 4; slot++) {
    const p = new FakePhone(f, room.code);
    phones.push(p);
    await p.join();
  }
  const players = f.party.view(f.party.rooms.get(room.code)).players;
  assert.deepEqual(
    players.map((p) => [p.slot, p.name, p.color]),
    [
      [0, "Peeli", "#f7c600"],
      [1, "Magenta", "#ef5da8"],
      [2, "Cyan", "#4de2df"],
      [3, "Marigold", "#ffad42"],
    ],
  );
  const stranger = await f.connect();
  await emit(stranger, "host");
  stranger.emit("remove", { slot: 0 });
  await f.advance(20);
  assert.equal(f.party.rooms.get(room.code).players.filter(Boolean).length, 4);
});
