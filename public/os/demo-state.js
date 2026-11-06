import { SEATS } from "../../core/seats.js";
import { gameById, matchSetup } from "../../core/catalog.js";
export function demoSetup(game, requested = {}, humans = 0) {
  return {
    ...matchSetup(gameById(game), requested, humans),
    mode: ["solo", "multiplayer"].includes(requested.mode)
      ? requested.mode
      : "auto",
    cpuCount: Number.isInteger(requested.cpuCount)
      ? Math.max(0, Math.min(7, requested.cpuCount))
      : undefined,
    pair:
      Array.isArray(requested.pair) &&
      requested.pair.length === 2 &&
      requested.pair[0] !== requested.pair[1] &&
      requested.pair.every((n) => Number.isInteger(n) && n >= 0 && n < 4)
        ? [...requested.pair]
        : undefined,
  };
}
export function demoStartReason(room) {
  if (!room.hostConnected) return "Waiting for the main screen";
  const count = room.players.filter((p) => p.connected && p.ready).length,
    missing =
      matchSetup(gameById(room.game), room.setup, count).minHumans - count;
  return missing > 0
    ? `Waiting for ${missing} more ready player${missing === 1 ? "" : "s"}`
    : "Ready to play";
}
export function demoState(scenario = "empty", now = Date.now()) {
  const round = ["playing", "results"].includes(scenario),
    populated = [
      "three",
      "ready",
      "playing",
      "results",
      "reconnecting",
    ].includes(scenario),
    game = round ? "star-catch" : "mario-kart",
    players = populated
      ? [0, 1, 2].map((slot) => ({
          ...SEATS[slot],
          slot,
          connected: true,
          ready: true,
          mode: "touch",
          status: round ? "active" : "ready",
          score: 0,
        }))
      : [],
    setup = demoSetup(game, {}, players.length),
    room = {
      code: "DEMO",
      phase: round ? scenario : "lobby",
      game,
      setup,
      players,
      maxPlayers: 4,
      queueCount: 0,
      queue: [],
      operatingMode: "party",
      pointerMode: false,
      hostConnected: scenario !== "reconnecting",
      hostSeat: populated ? 0 : null,
      createdAt: now - 120000,
      serverTime: now,
      endsAt: 0,
      startedAt: 0,
      roundId: 0,
      active: [],
      match: null,
      result: null,
      paused: false,
      leaderboard: [],
      standings: {},
      playlist: [],
      playlistIndex: 0,
      locked: false,
      removedPlayers: [],
      displays: 0,
      resultsHeld: false,
      resultsRemainingMs: null,
    };
  if (round)
    Object.assign(room, {
      roundId: 1,
      active: [0, 1, 2],
      startedAt: now - 15000,
      endsAt: now + 45000,
      match: { ...matchSetup(gameById(game), setup, players.length), seed: 42 },
    });
  if (scenario === "playing")
    players.forEach((p, i) => {
      p.score = [92, 71, 54][i];
    });
  if (scenario === "results") {
    const scores = [240, 180, 0].map((score, slot) => ({
      slot,
      rank: slot + 1,
      score,
      outcome: slot === 2 ? "forfeit" : "finished",
    }));
    players.forEach((p, i) =>
      Object.assign(p, {
        score: scores[i].score,
        status: scores[i].outcome,
        connected: i !== 2,
        ready: i !== 2,
      }),
    );
    Object.assign(room, {
      startedAt: now - 60000,
      endsAt: now + 20000,
      standings: { 0: 3, 1: 2, 2: 0 },
      result: {
        schemaVersion: 1,
        matchId: "demo-round-1",
        gameId: gameById(game).gameId,
        version: gameById(game).version,
        status: "completed",
        verification: "unverified",
        setup: { ...room.match },
        seed: 42,
        seedSource: "demo",
        startedAt: now - 60000,
        endedAt: now,
        scores,
      },
    });
  }
  if (scenario === "kiosk")
    Object.assign(room, {
      operatingMode: "kiosk",
      attract: true,
      autoStart: true,
      playlist: ["star-catch", "neon-drift", "bubble-burst"],
    });
  room.startReason = demoStartReason(room);
  return room;
}
/** Static renderer fixture, deliberately not an imported simulation engine. */
export function demoFrame(room) {
  if (room?.phase !== "playing" || room.game !== "star-catch") return null;
  return {
    game: room.game,
    interaction: room.match.interaction,
    elapsed: 15,
    duration: 60,
    players: room.active.map((slot) => ({
      slot,
      x: 0.35 + slot * 0.15,
      y: 0.8,
      score: room.players.find((p) => p.slot === slot)?.score || 0,
      combo: slot + 2,
      bestCombo: slot + 2,
      feedback: 0,
      hit: 0,
      pulse: 0,
      objects: [
        { id: slot * 2, x: 0.3, y: 0.35, radius: 0.05, kind: "star", age: 1 },
        {
          id: slot * 2 + 1,
          x: 0.7,
          y: 0.55,
          radius: 0.04,
          kind: "hazard",
          age: 2,
        },
      ],
    })),
  };
}
