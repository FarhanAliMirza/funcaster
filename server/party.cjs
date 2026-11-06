"use strict";
const { randomBytes, randomInt, timingSafeEqual } = require("node:crypto");
const {
  GAMES,
  createRound,
  stepRound,
  snapshot,
} = require("./party-engine.cjs");
const { SketchRound } = require("./sketch-round.cjs");
const { SliceReplay } = require("./slice-replay.cjs");
const { normalizeScores, makeResult } = require("./records.cjs");
const { games, gameById, matchSetup } = require("../core/catalog.js");
const CLASSICS = Object.fromEntries(
  games.filter((g) => g.classic).map((g) => [g.id, g.maxPlayers]),
);
const INDEPENDENT = new Set([
  "kart",
  "island-flyover",
  "alien-attack",
  "shooting-range",
]);
const independent = (room) =>
  INDEPENDENT.has(room.game) ||
  (room.game === "fruit-ninja" && room.match?.variant === "race");
const SUPPORTED = games.map((g) => g.id);
const COLORS = ["#7357f5", "#fb7858", "#20a88a", "#e4ad26"];
const NAMES = ["Lilac", "Peach", "Mint", "Sunny"];
const token = () => randomBytes(24).toString("base64url");
const equal = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
function attachParty(
  io,
  { now = Date.now, tickMs = 1000 / 30, buildId = null } = {},
) {
  const ns = io.of("/party"),
    rooms = new Map();
  const code = () =>
    Array.from(
      { length: 6 },
      () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)],
    ).join("");
  const view = (room) => ({
    code: room.code,
    buildId: room.buildId,
    game: room.game,
    autoStart: room.auto,
    setup: room.setup || {},
    match: room.match || null,
    phase: room.phase,
    endsAt: room.endsAt,
    serverTime: now(),
    hostConnected: !!room.host,
    screenConnected: !!room.screen,
    displays: room.displays?.size || 0,
    active: room.active,
    roundId: room.roundId,
    result: room.result || null,
    sketch: room.sketch?.publicState() || null,
    standings: room.standings || {},
    bracket: room.bracket || null,
    playlist: room.playlist || [],
    playlistIndex: room.playlistIndex || 0,
    paused: !!room.paused,
    maxPlayers: CLASSICS[room.game] || 4,
    players: room.players.filter(Boolean).map((p) => ({
      slot: p.slot,
      name: NAMES[p.slot],
      color: COLORS[p.slot],
      connected: !!p.socket,
      ready: p.ready,
      mode: p.mode,
      boostIn:
        room.round?.players.find((r) => r.slot === p.slot)?.cooldown || 0,
      boostsLeft:
        room.round?.players.find((r) => r.slot === p.slot)?.boostsLeft ?? null,
      score: Math.floor(
        room.result?.scores.find((r) => r.slot === p.slot)?.score ??
          room.round?.players.find((r) => r.slot === p.slot)?.score ??
          0,
      ),
    })),
  });
  const presence = (room, view = -1) => ({
    controller: room.active.filter(
      (s) => room.host && room.players[s]?.socket && room.players[s].ready,
    ).length,
    setup: room.match || {},
    sketch: room.sketch
      ? {
          ...room.sketch.publicState(),
          drawer: room.active.indexOf(room.sketch.drawer),
        }
      : null,
    slots: room.active
      .map((s, i) => ({
        slot: i,
        name: NAMES[s],
        color: COLORS[s],
        occupied: !!(
          room.host &&
          room.players[s]?.socket &&
          room.players[s].ready
        ),
      }))
      .filter((s) => view < 0 || s.slot === view)
      .map((s) => ({ ...s, slot: view < 0 ? s.slot : 0 })),
  });
  const broadcast = (room) => {
    ns.to(room.code).emit("state", view(room));
    if (room.sketch && room.phase === "classic")
      for (const p of room.players.filter(Boolean))
        if (p.socket)
          ns.to(p.socket).emit("sketch-turn", room.sketch.privateState(p.slot));
    for (const [view, id] of room.screens || [])
      ns.to(id).emit("presence", presence(room, view));
    for (const [id, v] of room.viewers || [])
      ns.to(id).emit("presence", presence(room, v));
  };
  function closeScreen(room) {
    const old = [...(room.screens?.values() || [])];
    room.screens = new Map();
    room.screen = null;
    old.forEach((id) => ns.sockets.get(id)?.disconnect(true));
    for (const id of room.viewers?.keys() || [])
      ns.sockets.get(id)?.disconnect(true);
    room.viewers?.clear();
    room.snapshots?.clear();
  }
  function classicEmit(room, event, data, index) {
    for (const [view, id] of room.screens || []) {
      if (view < 0 || view === index)
        ns.to(id).emit(event, { ...data, slot: view < 0 ? index : 0 });
    }
  }
  function relayClassic(room, time) {
    room.active.forEach((slot, index) => {
      const p = room.players[slot],
        live = !!(
          room.host &&
          !room.paused &&
          p?.socket &&
          p.ready &&
          time - p.lastInput < 500
        );
      classicEmit(
        room,
        "orientation",
        {
          party: live
            ? { ...p.input, active: true }
            : {
                x: 0,
                y: 0,
                gas: false,
                brake: false,
                boost: false,
                active: false,
              },
        },
        index,
      );
    });
  }
  function phase(room, next, seconds = 0) {
    room.phase = next;
    room.endsAt = seconds ? now() + seconds * 1000 : 0;
    broadcast(room);
  }
  function finish(room, scores, abandoned = false) {
    if (
      room.result ||
      !["classic", "playing", "countdown", "practice"].includes(room.phase)
    )
      return;
    const game = gameById(room.game);
    const record = makeResult(room, game, scores, now(), { abandoned });
    room.result = record.result;
    room.history ||= [];
    room.history.push(record);
    let retainedBytes = room.history.reduce(
      (sum, r) => sum + JSON.stringify(r).length,
      0,
    );
    while (
      room.history.length > 1 &&
      (room.history.length > 20 || retainedBytes > 24000000)
    )
      retainedBytes -= JSON.stringify(room.history.shift()).length;
    room.standings ||= {};
    if (!abandoned && !(room.game === "drawing" && !room.sketch))
      for (const s of room.result.scores)
        room.standings[s.slot] =
          (room.standings[s.slot] || 0) + Math.max(1, 5 - s.rank);
    if (
      game.maxPlayers === 2 &&
      room.active.length === 2 &&
      room.players.filter((p) => p?.ready && p.socket).length > 2
    ) {
      const [winner, loser] = room.result.scores;
      const waiting = room.players
        .filter((p) => p?.ready && p.socket && !room.active.includes(p.slot))
        .map((p) => p.slot);
      if (room.match.rotation === "bracket" && room.bracket) {
        const b = room.bracket;
        if (b.stage === "final") {
          b.champion = winner.slot;
          room.auto = false;
          room.nextSeats = null;
        } else {
          b.winners.push(winner.slot);
          if (b.field.length === 4 && b.winners.length === 1)
            room.nextSeats = b.field.slice(2);
          else {
            b.stage = "final";
            room.nextSeats =
              b.field.length === 3
                ? [winner.slot, b.field[2]]
                : b.winners.slice();
          }
        }
      } else
        room.nextSeats =
          room.match.rotation === "bracket"
            ? [...waiting, winner.slot, loser.slot]
            : room.match.rotation === "winner"
              ? [winner.slot, ...waiting, loser.slot]
              : null;
    }
    ns.to(room.code).emit("match.finish", room.result);
    phase(room, "results", 12);
  }
  function enterLobby(room) {
    if (room.active.length && !room.result && room.match)
      finish(
        room,
        room.active.map((slot) => ({
          slot,
          score:
            room.progress?.[slot] ??
            Math.floor(
              room.round?.players.find((p) => p.slot === slot)?.score || 0,
            ),
        })),
        true,
      );
    closeScreen(room);
    room.round = null;
    room.sketch = null;
    room.active = [];
    room.paused = false;
    phase(room, "lobby");
  }
  function start(room, firstSlot = null) {
    let eligible = room.players.filter((p) => p?.socket && p.ready);
    if (firstSlot !== null)
      eligible.sort(
        (a, b) =>
          ((a.slot - firstSlot + 4) % 4) - ((b.slot - firstSlot + 4) % 4),
      );
    if (room.nextSeats) {
      const order = room.nextSeats;
      eligible.sort(
        (a, b) =>
          (order.includes(a.slot) ? order.indexOf(a.slot) : 10 + a.slot) -
          (order.includes(b.slot) ? order.indexOf(b.slot) : 10 + b.slot),
      );
      room.nextSeats = null;
    }
    if (!eligible.length || !room.host) return;
    const setup = matchSetup(
      gameById(room.game),
      room.setup || {},
      eligible.length,
    );
    if (eligible.length < setup.minHumans) {
      room.auto = false;
      broadcast(room);
      return;
    }
    if (
      gameById(room.game).maxPlayers === 2 &&
      setup.rotation === "bracket" &&
      eligible.length > 2 &&
      (!room.bracket || room.bracket.champion !== null)
    )
      room.bracket = {
        field: eligible.map((p) => p.slot),
        winners: [],
        stage: "semifinal",
        champion: null,
      };
    if (
      gameById(room.game).maxPlayers === 2 &&
      setup.rotation === "pick" &&
      room.setup?.pair?.length === 2
    ) {
      const pair = room.setup.pair;
      if (!pair.every((slot) => eligible.some((p) => p.slot === slot))) {
        room.auto = false;
        broadcast(room);
        return;
      }
      eligible.sort(
        (a, b) =>
          (pair.includes(a.slot) ? pair.indexOf(a.slot) : 10 + a.slot) -
          (pair.includes(b.slot) ? pair.indexOf(b.slot) : 10 + b.slot),
      );
    }
    room.match = { ...setup, seed: randomInt(2147483647) };
    room.result = null;
    room.replay = [];
    room.startedAt = now();
    room.finishedViews = {};
    room.sliceReplays = new Map();
    room.classicStage = "ready";
    closeScreen(room);
    room.roundId++;
    room.active = eligible
      .slice(0, Math.min(CLASSICS[room.game] || 4, setup.maxHumans))
      .map((p) => p.slot);
    room.sketch =
      room.game === "drawing" &&
      setup.drawing === "guess" &&
      room.active.length > 1
        ? new SketchRound(room.active, randomInt(2147483647))
        : null;
    if (CLASSICS[room.game]) {
      room.round = null;
      room.progress = {};
      phase(
        room,
        "classic",
        room.game === "mario-kart"
          ? 600
          : room.game === "golf"
            ? 480
            : room.game === "drawing"
              ? 180
              : 120,
      );
      return;
    }
    room.round = createRound(room.game, room.active, room.match.seed);
    phase(room, "practice", 6);
  }
  ns.on("connection", (socket) => {
    let membership = null;
    socket.on("host", (data, ack = () => {}) => {
      if (typeof ack !== "function") return;
      if (buildId && data?.buildId !== buildId)
        return ack({
          error: "This page has an older version. Reload to join.",
          update: true,
        });
      if (membership) return ack({ error: "This tab has already joined." });
      let room;
      if (data?.code) {
        room = rooms.get(data.code);
        if (!room || !equal(room.hostToken, data.token))
          return ack({ error: "Session expired. Start a new party." });
        if (room.host && room.host !== socket.id)
          ns.sockets.get(room.host)?.disconnect(true);
      } else {
        if (rooms.size >= 100)
          return ack({ error: "The party server is busy. Please try again." });
        let id;
        do {
          id = code();
        } while (rooms.has(id));
        room = {
          code: id,
          buildId,
          hostToken: token(),
          displayToken: token(),
          displays: new Set(),
          viewers: new Map(),
          snapshots: new Map(),
          host: null,
          hostLost: 0,
          players: Array(4).fill(null),
          phase: "lobby",
          auto: true,
          game: GAMES[0],
          endsAt: 0,
          active: [],
          round: null,
          roundId: 0,
          setup: {},
          match: null,
          screen: null,
          screens: new Map(),
          created: now(),
        };
        rooms.set(id, room);
      }
      membership = { room, role: "host" };
      room.host = socket.id;
      socket.join(room.code);
      ack({
        code: room.code,
        token: room.hostToken,
        displayToken: room.displayToken,
      });
      broadcast(room);
    });
    // Display invites grant read access only. They can never become a game authority.
    socket.on("display", (data, ack = () => {}) => {
      if (typeof ack !== "function" || membership) return;
      const room = rooms.get(data?.code);
      if (!room || !equal(room.displayToken, data?.token))
        return ack({ error: "Display invite expired." });
      if (room.displays.size >= 8)
        return ack({ error: "Eight displays are already watching." });
      membership = { room, role: "display" };
      room.displays.add(socket.id);
      socket.join(room.code);
      ack({ ok: true });
      socket.emit("state", view(room));
    });
    socket.on("watch-game", (data, ack = () => {}) => {
      if (typeof ack !== "function" || membership) return;
      if (buildId && data?.buildId !== buildId)
        return ack({
          error: "Reload this screen to update the game.",
          update: true,
        });
      const room = rooms.get(data?.code),
        v = Number(data?.view);
      if (
        !room ||
        !equal(room.displayToken, data?.token) ||
        room.phase !== "classic" ||
        data.roundId !== room.roundId ||
        data.game !== room.game ||
        room.viewers.size >= 32
      )
        return ack({ error: "Game invite expired." });
      const view = independent(room) ? v : -1;
      if (view >= room.active.length || view < -1 || !Number.isInteger(view))
        return ack({ error: "Invalid view." });
      membership = { room, role: "viewer" };
      room.viewers.set(socket.id, view);
      socket.join(room.code);
      ack({
        ok: true,
        setup: room.match,
        authority: false,
        snapshot: room.snapshots.get(view) || null,
      });
      socket.emit("presence", presence(room, view));
    });
    socket.on("snapshot", (data) => {
      if (membership?.role !== "screen") return;
      const { room, view } = membership;
      if (
        room.phase !== "classic" ||
        room.screens.get(view) !== socket.id ||
        now() - (membership.lastSnapshot || 0) < 65
      )
        return;
      if (
        !data ||
        !Number.isFinite(data.clock) ||
        !data.state ||
        JSON.stringify(data).length > 250000
      )
        return;
      membership.lastSnapshot = now();
      room.snapshots.set(view, data);
      for (const [id, v] of room.viewers)
        if (v === view) ns.to(id).emit("snapshot", data);
    });
    // Only the host's same-origin game frame can receive this room's inputs.
    // The host token is read from tab storage; it is never in a QR or URL.
    socket.on("screen", (data, ack = () => {}) => {
      if (typeof ack !== "function" || membership) return;
      if (buildId && data?.buildId !== buildId)
        return ack({
          error: "Reload this screen to update the game.",
          update: true,
        });
      const room = rooms.get(data?.code);
      if (
        !room ||
        !equal(room.hostToken, data?.token) ||
        room.phase !== "classic" ||
        data.game !== room.game ||
        data.roundId !== room.roundId
      )
        return ack({ error: "Game session expired. Return to the game room." });
      const view = independent(room) ? Number(data.view) : -1;
      if (
        independent(room) &&
        (!Number.isInteger(view) || view < 0 || view >= room.active.length)
      )
        return ack({ error: "Invalid player view." });
      const old = room.screens.get(view);
      if (old) ns.sockets.get(old)?.disconnect(true);
      room.screens.set(view, socket.id);
      room.screen = room.screens.values().next().value;
      membership = { room, role: "screen", view };
      socket.join(room.code);
      ack({ ok: true, setup: room.match, active: room.active });
      socket.emit("presence", presence(room, view));
    });
    socket.on("match.finish", (data, ack = () => {}) => {
      if (typeof ack !== "function") return;
      if (
        membership?.role !== "screen" ||
        ![...membership.room.screens.values()].includes(socket.id)
      )
        return ack({ error: "Only the active game can finish." });
      const room = membership.room;
      if (room.phase !== "classic" || room.result)
        return ack({ error: "Round already ended." });
      const view = membership.view;
      const scores = normalizeScores(
        data?.scores,
        view < 0 ? room.active.map((_, i) => i) : [0],
      );
      if (!scores) return ack({ error: "Invalid scores." });
      if (view >= 0) {
        room.finishedViews[view] = scores[0].score;
        if (Object.keys(room.finishedViews).length === room.active.length)
          finish(
            room,
            room.active.map((slot, i) => ({
              slot,
              score: room.finishedViews[i],
            })),
          );
      } else
        finish(
          room,
          scores.map((s) => ({ ...s, slot: room.active[s.slot] })),
        );
      ack({ ok: true, result: room.result });
    });
    socket.on("replay-chunk", (data) => {
      if (membership?.role !== "screen") return;
      const { room, view } = membership;
      if (
        room.game !== "fruit-ninja" ||
        room.phase !== "classic" ||
        room.screens.get(view) !== socket.id
      )
        return;
      let replay = room.sliceReplays.get(view);
      if (!replay) {
        replay = new SliceReplay(room.match.seed);
        room.sliceReplays.set(view, replay);
      }
      if (!replay.accept(data?.sequence, data?.calls)) return;
      if (view >= 0) room.progress[room.active[view]] = replay.score(0);
      else
        room.active.forEach(
          (slot, i) =>
            (room.progress[slot] = replay.score(
              i,
              room.match.variant === "co-op",
            )),
        );
    });
    socket.on("guess", (data, ack = () => {}) => {
      if (typeof ack !== "function") return;
      if (membership?.role !== "player")
        return ack({ error: "Join the game to guess." });
      const { room, player } = membership;
      if (
        room.phase !== "classic" ||
        !room.sketch ||
        room.paused ||
        !room.host ||
        !player.ready
      )
        return ack({ error: "Wait for the next drawing." });
      if (now() - (player.guessAt || 0) < 500)
        return ack({ error: "Give it a moment." });
      player.guessAt = now();
      const correct = room.sketch.guess(player.slot, data?.text);
      room.progress = { ...room.sketch.scores };
      ack({ correct });
      broadcast(room);
    });
    socket.on("score", (data) => {
      if (membership?.role !== "screen" || membership.room.phase !== "classic")
        return;
      const room = membership.room,
        view = membership.view;
      if (room.game === "fruit-ninja" || room.sketch) return;
      const scores = normalizeScores(
        data?.scores,
        view < 0 ? room.active.map((_, i) => i) : [0],
      );
      if (scores)
        for (const s of scores)
          room.progress[room.active[view < 0 ? s.slot : view]] = s.score;
    });
    socket.on("record", (data, ack = () => {}) => {
      if (typeof ack !== "function" || membership?.role !== "host") return;
      const record = membership.room.history?.find(
        (r) => r.result.matchId === data?.matchId,
      );
      ack(record || { error: "Record not found." });
    });
    socket.on("feedback", (data) => {
      if (
        membership?.role !== "screen" ||
        ![...membership.room.screens.values()].includes(socket.id) ||
        !data
      )
        return;
      const room = membership.room;
      if (
        ![
          "rumble",
          "controller-profile",
          "race-status",
          "play-status",
          "slice",
          "bomb",
          "hit",
        ].includes(data.type)
      )
        return;
      // Feedback is bounded and addressed by the game's local player index.
      let safe;
      if (data.type === "play-status")
        safe = {
          type: data.type,
          active: data.active === true,
          caption: String(data.caption || "").slice(0, 140),
          action: String(data.action || "Play").slice(0, 32),
          score: Math.max(0, Math.min(100000, Number(data.score) || 0)),
        };
      else if (data.type === "race-status") {
        if (data.slot === 0) room.classicStage = data.stage;
        safe = {
          type: data.type,
          stage: ["ready", "countdown", "racing", "results", "paused"].includes(
            data.stage,
          )
            ? data.stage
            : "ready",
          confirmed: data.confirmed === true,
          waiting: data.waiting === true,
          boostIn: Math.max(0, Math.min(8, Number(data.boostIn) || 0)),
          boostsLeft: Number.isInteger(data.boostsLeft)
            ? Math.max(0, Math.min(3, data.boostsLeft))
            : null,
          driver: String(data.driver || "").slice(0, 32),
        };
      } else if (data.type === "rumble")
        safe = {
          type: data.type,
          pattern: (Array.isArray(data.pattern) ? data.pattern : [15])
            .slice(0, 6)
            .map((v) => Math.max(0, Math.min(150, Number(v) || 0))),
        };
      else
        safe = {
          type: data.type,
          profile: data.profile === "wheel" ? "wheel" : "default",
        };
      const slots = Number.isInteger(data.slot)
        ? [room.active[membership.view < 0 ? data.slot : membership.view]]
        : membership.view < 0
          ? room.active
          : [room.active[membership.view]];
      for (const slot of slots)
        if (room.players[slot]?.socket)
          ns.to(room.players[slot].socket).emit("feedback", safe);
    });
    socket.on("action", (data) => {
      if (membership?.role !== "player") return;
      const { room, player: p } = membership;
      const index = room.active.indexOf(p.slot);
      if (
        !room.host ||
        !room.screen ||
        !p.ready ||
        index < 0 ||
        now() - (p.lastAction || 0) < 100
      )
        return;
      const actions =
        room.game === "mario-kart"
          ? { confirm: "2", left: "left", right: "right" }
          : { primary: "A" };
      const button = actions[data?.action];
      if (!button) return;
      p.lastAction = now();
      classicEmit(
        room,
        "command",
        {
          type: "button",
          button,
          pressed: true,
          power: Math.max(0.12, Math.min(1, Number(data?.power) || 0.6)),
          slot: index,
        },
        index,
      );
    });
    socket.on("next-player", () => {
      if (membership?.role !== "host") return;
      const room = membership.room;
      if (room.phase === "classic" && room.match?.maxHumans === 1)
        start(room, ((room.active[0] ?? 0) + 1) % 4);
    });
    socket.on("join", (data, ack = () => {}) => {
      if (typeof ack !== "function") return;
      if (buildId && data?.buildId !== buildId)
        return ack({
          error: "This page has an older version. Reload to join.",
          update: true,
        });
      if (membership) return ack({ error: "This phone has already joined." });
      const room = rooms.get(String(data?.code || "").toUpperCase());
      if (!room)
        return ack({
          error: "This party has ended. Scan the QR on the big screen.",
        });
      let p = room.players.find((p) => p && equal(p.token, data?.token));
      if (p?.socket) ns.sockets.get(p.socket)?.disconnect(true);
      if (!p) {
        // A disconnected active slot stays reserved until the end of the round.
        const slot = room.players.findIndex(
          (p) =>
            !p ||
            (!p.socket &&
              now() - p.lost > 20000 &&
              !room.active.includes(p.slot)),
        );
        if (slot < 0)
          return ack({
            full: true,
            error:
              "Four players are in. Your turn is up next — keep this page open.",
          });
        p = {
          slot,
          token: token(),
          socket: null,
          ready: false,
          mode: "motion",
          input: { x: 0, y: 0 },
          lastInput: 0,
          lastPulse: 0,
          lost: 0,
        };
        room.players[slot] = p;
      }
      p.socket = socket.id;
      p.lastInput = 0;
      p.ready = false;
      membership = { room, role: "player", player: p };
      socket.join(room.code);
      ack({
        slot: p.slot,
        token: p.token,
        name: NAMES[p.slot],
        color: COLORS[p.slot],
      });
      broadcast(room);
    });
    socket.on("ready", (data) => {
      if (membership?.role !== "player") return;
      const { room, player: p } = membership;
      p.ready = data?.ready === true;
      p.mode = data?.mode === "touch" ? "touch" : "motion";
      if (!p.ready) p.input = { x: 0, y: 0 };
      if (
        p.ready &&
        room.phase === "classic" &&
        room.game === "fruit-ninja" &&
        room.match.variant !== "race" &&
        room.active.length < room.match.maxHumans &&
        !room.active.includes(p.slot)
      )
        room.active.push(p.slot);
      broadcast(room);
    });
    socket.on("input", (data) => {
      if (
        membership?.role !== "player" ||
        !data ||
        !Number.isFinite(data.x) ||
        !Number.isFinite(data.y)
      )
        return;
      const p = membership.player,
        time = now();
      if (time - p.lastInput < 12) return;
      p.input = {
        x: Math.max(-1, Math.min(1, data.x)),
        y: Math.max(-1, Math.min(1, data.y)),
        gas: data.gas === true,
        brake: data.brake === true,
        boost: data.boost === true,
        pulse:
          p.input.pulse || (data.pulse === true && time - p.lastPulse > 900),
      };
      if (data.pulse && p.input.pulse) p.lastPulse = time;
      p.lastInput = time;
    });
    socket.on("setup", (data, ack = () => {}) => {
      if (membership?.role !== "host") return;
      const room = membership.room;
      if (!["lobby", "results"].includes(room.phase)) return;
      room.setup = {
        mode: ["solo", "multiplayer"].includes(data?.mode) ? data.mode : "auto",
        cpuCount: Number.isInteger(data?.cpuCount)
          ? Math.max(0, Math.min(7, data.cpuCount))
          : undefined,
        drawing: data?.drawing === "free" ? "free" : "guess",
        laps: data?.laps === 3 ? 3 : 1,
        holes: [1, 3, 6].includes(data?.holes) ? data.holes : 3,
        pair:
          Array.isArray(data?.pair) &&
          data.pair.length === 2 &&
          data.pair[0] !== data.pair[1] &&
          data.pair.every((s) => Number.isInteger(s) && s >= 0 && s < 4)
            ? data.pair
            : undefined,
        rotation: ["pick", "winner", "bracket"].includes(data?.rotation)
          ? data.rotation
          : "winner",
        variant: ["co-op", "battle", "race"].includes(data?.variant)
          ? data.variant
          : "co-op",
      };
      room.playlist = Array.isArray(data?.playlist)
        ? [
            ...new Set(data.playlist.filter((id) => SUPPORTED.includes(id))),
          ].slice(0, 8)
        : room.playlist || [];
      room.playlistIndex = 0;
      room.auto = false;
      broadcast(room);
      if (typeof ack === "function") ack({ ok: true });
    });
    socket.on("select", (data) => {
      if (membership?.role !== "host" || !SUPPORTED.includes(data?.game))
        return;
      const room = membership.room;
      if (room.phase !== "lobby" && room.phase !== "results") return;
      room.game = data.game;
      room.bracket = null;
      room.nextSeats = null;
      room.auto = !CLASSICS[room.game];
      enterLobby(room);
    });
    socket.on("pause", () => {
      if (membership?.role !== "host") return;
      const room = membership.room;
      if (!["classic", "playing", "practice", "countdown"].includes(room.phase))
        return;
      room.paused = !room.paused;
      ns.to(room.code).emit("pause", { paused: room.paused });
      broadcast(room);
    });
    socket.on("start", () => {
      if (
        membership?.role === "host" &&
        ["lobby", "results"].includes(membership.room.phase)
      ) {
        membership.room.auto = true;
        enterLobby(membership.room);
        start(membership.room);
      }
    });
    socket.on("lobby", () => {
      if (membership?.role === "host") {
        const room = membership.room;
        room.auto = false;
        enterLobby(room);
      }
    });
    socket.on("remove", (data) => {
      if (membership?.role !== "host") return;
      const room = membership.room,
        p = room.players[data?.slot];
      if (!p) return;
      const s = ns.sockets.get(p.socket);
      if (s) {
        s.emit("removed");
        s.disconnect(true);
      }
      room.players[p.slot] = null;
      if (room.active.includes(p.slot)) {
        room.auto = false;
        enterLobby(room);
      }
      broadcast(room);
    });
    socket.on("leave", () => {
      if (membership?.role !== "player") return;
      const { room, player: p } = membership;
      p.socket = null;
      p.lost = now() - 20001;
      p.ready = false;
      p.token = token();
      if (!room.active.includes(p.slot)) room.players[p.slot] = null;
      membership = null;
      socket.leave(room.code);
      broadcast(room);
    });
    socket.on("ping-check", (_, ack) => {
      if (typeof ack === "function") ack(now());
    });
    socket.on("disconnect", () => {
      if (!membership) return;
      const { room, role, player: p } = membership;
      if (role === "host" && room.host === socket.id) {
        room.host = null;
        room.hostLost = now();
      }
      if (role === "screen") {
        if (room.screens.get(membership.view) === socket.id)
          room.screens.delete(membership.view);
        room.screen = room.screens.values().next().value || null;
      }
      if (role === "display") room.displays.delete(socket.id);
      if (role === "viewer") room.viewers.delete(socket.id);
      if (role === "player" && p.socket === socket.id) {
        p.socket = null;
        p.lost = now();
        p.input = { x: 0, y: 0 };
      }
      broadcast(room);
    });
  });
  let previous = now(),
    count = 0;
  const timer = setInterval(() => {
    const time = now(),
      elapsed = Math.max(0, time - previous),
      dt = Math.min(0.1, elapsed / 1000);
    previous = time;
    count++;
    for (const room of rooms.values()) {
      if (
        (!room.host && time - room.hostLost > 120000) ||
        time - room.created > 14400000
      ) {
        ns.to(room.code).emit("ended");
        ns.in(room.code).disconnectSockets();
        rooms.delete(room.code);
        continue;
      }
      if (!room.host || room.paused) {
        relayClassic(room, time);
        if (room.endsAt) room.endsAt += elapsed;
        continue;
      }
      room.players.forEach((p, i) => {
        if (p && !p.socket && time - p.lost > 20000 && !room.active.includes(i))
          room.players[i] = null;
      });
      const connected = room.players.filter((p) => p?.socket);
      if (
        room.phase === "lobby" &&
        room.auto &&
        connected.length &&
        connected.every((p) => p.ready)
      )
        start(room);
      if (room.phase === "classic") {
        relayClassic(room, time);
        if (room.sketch) {
          room.sketch.step(dt);
          room.progress = { ...room.sketch.scores };
          if (room.sketch.finished)
            finish(
              room,
              room.active.map((slot) => ({
                slot,
                score: room.sketch.scores[slot],
              })),
            );
        }
      }
      if (room.phase === "practice" && room.setup.mode !== "solo") {
        for (const p of connected.filter(
          (p) => p.ready && !room.active.includes(p.slot),
        )) {
          room.active.push(p.slot);
          room.round.players.push(createRound(room.game, [p.slot]).players[0]);
          broadcast(room);
        }
      }
      if (room.phase === "practice" || room.phase === "playing") {
        const inputs = Object.fromEntries(
          room.players.filter(Boolean).map((p) => [
            p.slot,
            {
              ...p.input,
              active: !!p.socket && p.ready && time - p.lastInput < 500,
            },
          ]),
        );
        if (room.round) {
          stepRound(room.round, inputs, dt);
          if (room.phase === "playing" && room.replay.length < 6000)
            room.replay.push([dt, JSON.parse(JSON.stringify(inputs))]);
          ns.to(room.host).emit("frame", snapshot(room.round));
          for (const id of room.displays)
            ns.to(id).emit("frame", snapshot(room.round));
        }
        room.players.filter(Boolean).forEach((p) => {
          p.input.pulse = false;
        });
      }
      if (
        room.active.length &&
        !connected.some((p) => room.active.includes(p.slot)) &&
        (room.phase !== "classic" ||
          room.active.every(
            (slot) =>
              !room.players[slot] || time - room.players[slot].lost > 20000,
          ))
      )
        enterLobby(room);
      if (room.endsAt && time >= room.endsAt) {
        if (room.phase === "classic")
          finish(
            room,
            room.active.map((slot) => ({
              slot,
              score:
                room.finishedViews[room.active.indexOf(slot)] ??
                room.progress[slot] ??
                0,
            })),
          );
        else if (room.phase === "practice") {
          room.match = {
            ...matchSetup(gameById(room.game), room.setup, room.active.length),
            seed: room.match.seed,
          };
          room.round = createRound(room.game, room.active, room.match.seed);
          phase(room, "countdown", 3);
        } else if (room.phase === "countdown") phase(room, "playing", 60);
        else if (room.phase === "playing")
          finish(
            room,
            room.round.players.map((p) => ({
              slot: p.slot,
              score: Math.floor(p.score),
            })),
          );
        else if (room.phase === "results") {
          if (room.playlist?.length) {
            room.playlistIndex =
              ((room.playlistIndex || 0) + 1) % room.playlist.length;
            room.game = room.playlist[room.playlistIndex];
          }
          enterLobby(room);
        }
      }
      if (count % 12 === 0) broadcast(room);
    }
  }, tickMs);
  timer.unref();
  return { rooms, view, close: () => clearInterval(timer) };
}
module.exports = { attachParty };
