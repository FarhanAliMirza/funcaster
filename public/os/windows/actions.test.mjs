import test from "node:test";
import assert from "node:assert/strict";
import { shutdownAction } from "./shutdown.js";
import { nextPlaylist, skipGame } from "./staff-actions.js";
import { DESKTOP_STRINGS as S } from "../strings.js";
function shutdownFixture({
  decision = "confirm",
  reply = { ok: true },
  throws = false,
} = {}) {
  const calls = [],
    flags = [];
  const ctx = {
    window: { id: "shutdown" },
    setShuttingDown(value) {
      flags.push(value);
    },
    audio: { cue: (name) => calls.push(["audio", name]) },
    mascot: { event: (name) => calls.push(["mascot", name]) },
    getSession: () => ({
      lobby: async () => {
        calls.push(["lobby"]);
        return reply;
      },
      endRoom: async () => {
        calls.push(["end-room"]);
        assert.equal(
          flags.at(-1),
          true,
          "intent must precede the server's ended event",
        );
        if (throws) throw new Error("offline");
        return reply;
      },
    }),
    wm: {
      list: () => [
        { id: "shutdown", kind: "tool" },
        { id: "game", kind: "game" },
      ],
      close: async (id) => calls.push(["close", id]),
      modal: async (options) => {
        calls.push(["modal", options.text]);
        return options.buttons ? decision : "ok";
      },
    },
  };
  return { ctx, calls, flags };
}
test("cancelling either shutdown confirmation keeps the room and screen without farewell cues", async () => {
  const match = shutdownFixture({ reply: { cancelled: true } });
  assert.deepEqual(await shutdownAction(match.ctx, "match"), {
    cancelled: true,
  });
  assert.deepEqual(match.calls, [["lobby"]]);
  assert.deepEqual(match.flags, []);
  const room = shutdownFixture({ decision: "cancel" });
  assert.deepEqual(await shutdownAction(room.ctx, "room"), { cancelled: true });
  assert.deepEqual(room.calls, [["modal", S.endRoomText]]);
  assert.deepEqual(room.flags, []);
});
test("intentional room shutdown suppresses recovery before ending and shows the final farewell", async () => {
  const f = shutdownFixture();
  assert.deepEqual(await shutdownAction(f.ctx, "room"), { ok: true });
  assert.deepEqual(f.flags, [true]);
  assert.deepEqual(f.calls, [
    ["modal", S.endRoomText],
    ["end-room"],
    ["mascot", "shutdown"],
    ["audio", "shutdown"],
    ["close", "shutdown"],
    ["modal", S.safeClose],
  ]);
});
test("room shutdown errors restore recovery and leave the shutdown screen open", async () => {
  for (const options of [
    { reply: { error: "No connection" } },
    { throws: true },
  ]) {
    const f = shutdownFixture(options);
    assert.ok((await shutdownAction(f.ctx, "room")).error);
    assert.deepEqual(f.flags, [true, false]);
    assert.equal(
      f.calls.some(([name]) => ["close", "audio", "mascot"].includes(name)),
      false,
    );
    assert.equal(f.calls.at(-1)[0], "modal");
    assert.notEqual(f.calls.at(-1)[1], S.safeClose);
  }
});
function skipFixture({
  phase = "classic",
  reply = { ok: true },
  setupReply = { ok: true },
  differentRoom = false,
} = {}) {
  let room = {
    code: "ABCDEF",
    phase,
    game: "golf",
    playlist: ["kart", "golf", "star-catch"],
  };
  const calls = [];
  const session = {
    async lobby() {
      calls.push(["lobby"]);
      if (reply.ok)
        room = {
          ...room,
          phase: "lobby",
          ...(differentRoom ? { code: "NEW" } : {}),
        };
      return reply;
    },
    async setup(value) {
      calls.push(["setup", value]);
      return setupReply;
    },
    select(value) {
      calls.push(["select", value]);
      return { ok: true };
    },
  };
  return { session, getRoom: () => room, calls };
}
test("Skip game confirms an active round, rotates the live playlist, then selects its new head", async () => {
  const f = skipFixture();
  assert.deepEqual(await skipGame(f.session, f.getRoom), { ok: true });
  assert.deepEqual(f.calls, [
    ["lobby"],
    ["setup", { playlist: ["star-catch", "kart", "golf"] }],
    ["select", "star-catch"],
  ]);
  const editing = skipFixture({ phase: "results" });
  await skipGame(editing.session, editing.getRoom);
  assert.equal(editing.calls[0][0], "setup");
  assert.deepEqual(nextPlaylist({ game: "golf", playlist: ["kart", "golf"] }), [
    "kart",
    "golf",
  ]);
  assert.deepEqual(
    nextPlaylist({ game: "golf", playlist: ["golf", "unknown", "golf"] }),
    [],
  );
});
test("Skip cancellation, room replacement and failed setup never select another game", async () => {
  for (const options of [
    { reply: { cancelled: true } },
    { reply: { error: "Offline" } },
    { differentRoom: true },
    { setupReply: { error: "Unavailable" } },
  ]) {
    const f = skipFixture(options);
    const result = await skipGame(f.session, f.getRoom);
    assert.ok(result.cancelled || result.error);
    assert.equal(
      f.calls.some(([name]) => name === "select"),
      false,
    );
  }
  const f = skipFixture();
  assert.ok(
    (await skipGame(f.session, () => ({ ...f.getRoom(), playlist: ["golf"] })))
      .error,
  );
  assert.deepEqual(f.calls, []);
});
