import test from "node:test";
import assert from "node:assert/strict";
import { createStorage } from "./storage.js";
import { games } from "../../core/catalog.js";
import {
  PLAYLISTS,
  canEdit,
  canNextPlayer,
  safePlaylist,
  playerRows,
  recentRecords,
  verificationText,
  safeWebUrl,
  screenUrl,
  modeOptions,
  ageText,
} from "./window-data.js";

test("playlist presets resolve to working games and queued state rejects unknown entries", () => {
  const ids = new Set(games.map((g) => g.id));
  for (const list of Object.values(PLAYLISTS))
    assert.ok(list.every((id) => ids.has(id)));
  assert.deepEqual(safePlaylist(["kart", "unknown", "kart", "golf"]), [
    "kart",
    "golf",
  ]);
  assert.deepEqual(safePlaylist(null), []);
  for (const phase of ["lobby", "results"])
    assert.equal(canEdit({ connection: "connected", room: { phase } }), true);
  for (const phase of ["classic", "playing", "countdown"])
    assert.equal(canEdit({ connection: "connected", room: { phase } }), false);
  assert.equal(
    canEdit({ connection: "reconnecting", room: { phase: "lobby" } }),
    false,
  );
});
test("four stable seat rows distinguish hosts, pending grants and outcomes", () => {
  const rows = playerRows({
    hostSeat: 1,
    pendingHost: { slot: 2 },
    players: [
      { slot: 1, name: "<img src=x>", ready: true, connected: true },
      { slot: 2, ready: true, connected: false },
      { slot: 3, status: "forfeit", connected: true },
    ],
  });
  assert.equal(rows.length, 4);
  assert.equal(rows[0].status, "empty");
  assert.equal(rows[1].host, true);
  assert.equal(rows[1].name, "<img src=x>");
  assert.equal(rows[2].pending, true);
  assert.equal(rows[2].status, "away");
  assert.equal(rows[3].status, "forfeit");
});
test("records use the classic room key, remain bounded, and treat corrupt stored data as empty", () => {
  const storage = createStorage();
  storage.write(
    "records.ABCDEF",
    Array.from({ length: 30 }, (_, i) => ({
      matchId: `m-${i}`,
      title: `Round ${i}`,
      verification: i === 0 ? "verified" : "unknown",
      token: "must not be returned",
    })),
  );
  const rows = recentRecords(storage, "ABCDEF");
  assert.equal(rows.length, 20);
  assert.equal(rows[0].token, undefined);
  assert.match(verificationText(rows[0].verification), /Verified/);
  assert.equal(verificationText("__proto__"), verificationText("unverified"));
  storage.write("records.ABCDEF", {});
  assert.deepEqual(recentRecords(storage, "ABCDEF"), []);
});
test("invite URLs permit web links and never promote executable schemes or omit display credentials", () => {
  for (const missing of [null, undefined, "", " "])
    assert.equal(safeWebUrl(missing, "https://console.test"), null);
  assert.equal(safeWebUrl("javascript:alert(1)", "https://console.test"), null);
  assert.equal(safeWebUrl("data:text/html,hi", "https://console.test"), null);
  const link = new URL(
    screenUrl(
      { code: "ABCDEF", displayToken: "a+b &c" },
      "https://console.test/controller?room=ABCDEF",
    ),
  );
  assert.equal(link.pathname, "/screen");
  assert.equal(link.searchParams.get("key"), "a+b &c");
  assert.equal(screenUrl({ code: "ABCDEF" }, "https://console.test"), null);
});
test("kiosk options explicitly require six digits; party never carries a PIN", () => {
  for (const pin of ["", "12345", "1234567", "12ab56"])
    assert.ok(modeOptions("kiosk", pin).error);
  assert.deepEqual(modeOptions("kiosk", "012345"), {
    mode: "kiosk",
    pin: "012345",
  });
  assert.deepEqual(modeOptions("party", "123456"), { mode: "party" });
  assert.ok(modeOptions("admin", "123456").error);
  assert.equal(ageText(1000, 62000), "1m 1s");
  assert.equal(ageText(undefined, 62000), "Not available");
  assert.equal(ageText(63000, 62000), "Not available");
});

test("Next player is available only between solo turns with two connected ready humans", () => {
  const state = {
    connection: "connected",
    room: {
      phase: "lobby",
      setup: { mode: "solo" },
      players: [
        { connected: true, ready: true },
        { connected: true, ready: true },
      ],
    },
  };
  assert.equal(canNextPlayer(state), true);
  assert.equal(
    canNextPlayer({ ...state, room: { ...state.room, phase: "results" } }),
    true,
  );
  assert.equal(canNextPlayer({ ...state, connection: "reconnecting" }), false);
  for (const patch of [
    { phase: "classic" },
    { setup: { mode: "multiplayer" } },
    { players: [{ connected: true, ready: true }] },
    {
      players: [
        { connected: true, ready: true },
        { connected: false, ready: true },
      ],
    },
    {
      players: [
        { connected: true, ready: true },
        { connected: true, ready: false },
      ],
    },
  ])
    assert.equal(
      canNextPlayer({ ...state, room: { ...state.room, ...patch } }),
      false,
    );
});
