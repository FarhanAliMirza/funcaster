export const games = [
  {
    id: "mario-kart",
    title: "Kart Rush",
    verb: "Your phone. Your steering wheel.",
    detail: "Hold Accelerate. Tilt gently to steer. Boost out of the pack.",
    color: "#d74842",
    bg: "#ffe5d8",
    icon: "↝",
    mode: "wheel",
    classic: true,
    players: "1–4 drivers",
    tag: "THE STARTING GRID",
    duration: "1 or 3 laps",
    action: "Start race",
  },
  {
    id: "star-catch",
    title: "Star Catch",
    verb: "Tilt to catch.",
    detail: "Catch the stars. Dodge the pink comets.",
    color: "#7357f5",
    bg: "#eeeaff",
    icon: "✦",
    target: 180,
    mode: "side",
    tag: "EASY TO LOVE",
  },
  {
    id: "neon-drift",
    title: "Neon Drift",
    verb: "Tilt to steer.",
    detail:
      "Hold Accelerate. Grab rings, dodge blocks, and tap Boost for a burst.",
    color: "#178878",
    bg: "#e0f5e9",
    icon: "↝",
    target: 250,
    mode: "wheel",
    tag: "A LITTLE COMPETITIVE",
  },
  {
    id: "bubble-burst",
    title: "Bubble Burst",
    verb: "Tilt to pop.",
    detail: "Float over bubbles to pop them. A gentle flick adds a burst.",
    color: "#e57050",
    bg: "#ffebe2",
    icon: "◌",
    target: 250,
    mode: "aim",
    tag: "HAPPY LITTLE CHAOS",
  },
];
games.push(
  {
    id: "fruit-ninja",
    title: "Slice Dojo",
    verb: "Tilt. Slice. Repeat.",
    detail: "Slice the fruit together. Watch out for bombs.",
    color: "#377d49",
    bg: "#e4f2d4",
    icon: "✳",
    mode: "aim",
    classic: true,
    players: "1–4 players",
    tag: "SLICE TOGETHER",
    duration: "Arcade rounds",
    action: "Start slicing",
  },
  {
    id: "alien-attack",
    title: "Alien Attack",
    verb: "Tilt to dodge. Tap to fire.",
    detail: "Dodge the invaders and blast your way through.",
    color: "#6661b8",
    bg: "#e9e6ff",
    icon: "✧",
    mode: "side",
    classic: true,
    players: "1–4 players",
    tag: "SPACE FOR A HERO",
    duration: "Arcade run",
    action: "Fire",
  },
  {
    id: "shooting-range",
    title: "Shooting Range",
    verb: "Aim with a little tilt.",
    detail: "Find a target. Tap Fire. Beat your best.",
    color: "#a35f35",
    bg: "#f6e6c9",
    icon: "◎",
    mode: "aim",
    classic: true,
    players: "1–4 players",
    tag: "NICE SHOT",
    duration: "Target challenge",
    action: "Fire",
  },
  {
    id: "drawing",
    title: "Drawing",
    verb: "Make a little masterpiece.",
    detail: "Tilt to draw. Tap to lift or lower your pen.",
    color: "#b15986",
    bg: "#f9e1ee",
    icon: "〰",
    mode: "aim",
    classic: true,
    players: "1–4 artists",
    tag: "DRAW A LITTLE. GUESS A LOT.",
    duration: "Draw & guess / free draw",
    action: "Pen up / down",
  },
);

games.push(
  {
    id: "golf",
    title: "Pocket Greens",
    verb: "Aim. Tap. Take your shot.",
    detail:
      "Tilt to aim. Hold to build power, release to putt. Lowest score wins.",
    color: "#377d49",
    bg: "#e4f2d4",
    icon: "⚑",
    mode: "aim",
    classic: true,
    tag: "TAKE YOUR TIME",
    duration: "3 holes",
    action: "Take shot",
  },
  {
    id: "table-tennis",
    title: "Table Tennis",
    verb: "A little tilt. A great rally.",
    detail: "Move your paddle with a tilt. First to 7 wins.",
    color: "#218779",
    bg: "#e0f5e9",
    icon: "◒",
    mode: "aim",
    classic: true,
    tag: "ONE MORE RALLY",
    duration: "First to 7",
    action: "Power return",
  },
  {
    id: "swordplay",
    title: "Foam Fencers",
    verb: "Block. Swoosh. Smile.",
    detail: "Tilt to guard. Tap to strike. Keep your phone close.",
    color: "#9760b9",
    bg: "#efe1f9",
    icon: "⚔",
    mode: "aim",
    classic: true,
    tag: "A FRIENDLY DUEL",
    duration: "First to 3",
    action: "Strike",
  },
  {
    id: "kart",
    title: "Time Trial",
    verb: "Find your fastest lap.",
    detail: "Hold Accelerate. Tilt to steer. Race the clock with your crew.",
    color: "#dc7449",
    bg: "#ffe8da",
    icon: "↝",
    mode: "wheel",
    classic: true,
    tag: "CHASE YOUR BEST",
    duration: "3 laps",
    action: "Start driving",
  },
  {
    id: "island-flyover",
    title: "Cloud Cruise",
    verb: "Tilt into the blue.",
    detail:
      "Tilt left and right to bank. Tilt forward and back to climb and dive.",
    color: "#3884b0",
    bg: "#dff1fa",
    icon: "✈",
    mode: "flight",
    classic: true,
    tag: "ROOM TO ROAM",
    duration: "20 checkpoints",
    action: "Take off",
  },
);
const twoPlayer = new Set(["table-tennis", "swordplay"]);
const split = new Set([
  "mario-kart",
  "kart",
  "island-flyover",
  "alien-attack",
  "shooting-range",
]);
const order = [
  "mario-kart",
  "golf",
  "fruit-ninja",
  "star-catch",
  "neon-drift",
  "bubble-burst",
  "table-tennis",
  "swordplay",
  "kart",
  "island-flyover",
  "shooting-range",
  "alien-attack",
  "drawing",
];
for (const game of games) {
  const max = twoPlayer.has(game.id) ? 2 : 4;
  Object.assign(game, {
    schemaVersion: 2,
    gameId: `funcaster.${game.id === "mario-kart" ? "kart-rush" : game.id}`,
    version: "1.0.0",
    order: order.indexOf(game.id),
    maxPlayers: max,
    controller: game.mode,
    view: split.has(game.id) ? "split" : "shared",
    verification: [
      "star-catch",
      "neon-drift",
      "bubble-burst",
      "fruit-ninja",
    ].includes(game.id)
      ? "verifiable"
      : "attested",
    scoring: {
      direction: ["golf", "mario-kart"].includes(game.id) ? "lower" : "higher",
      unit:
        game.id === "golf"
          ? "strokes"
          : game.id === "mario-kart"
            ? "place"
            : "points",
    },
    modes: {
      solo: {
        minHumans: 1,
        maxHumans: 1,
        aiDefault:
          game.id === "mario-kart" ? 7 : twoPlayer.has(game.id) ? 1 : 0,
      },
      multiplayer: { minHumans: 2, maxHumans: max, aiDefault: 0 },
    },
    topologies: ["shared", "remote", "hybrid", "spectator"],
    players: twoPlayer.has(game.id)
      ? "1–2 · crew rotation"
      : game.players || "1–4 players",
    input: {
      x: [-1, 1],
      y: [-1, 1],
      actions: ["primary", "left", "right", "confirm"],
    },
  });
}
games.sort((a, b) => a.order - b.order);
export const gameById = (id) => games.find((g) => g.id === id) || games[0];
export function validateManifest(g) {
  const errors = [];
  if (g?.schemaVersion !== 2) errors.push("schemaVersion must be 2");
  if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(g?.gameId || ""))
    errors.push("gameId must be namespaced");
  if (!/^\d+\.\d+\.\d+$/.test(g?.version || ""))
    errors.push("version must be semantic");
  if (!g?.title || g.title.length > 64)
    errors.push("title must be 1–64 characters");
  if (!["shared", "split"].includes(g?.view))
    errors.push("unknown view policy");
  if (!["verifiable", "attested", "casual"].includes(g?.verification))
    errors.push("unknown verification tier");
  if (!["aim", "side", "wheel", "flight"].includes(g?.controller))
    errors.push("unknown controller profile");
  if (
    !["higher", "lower"].includes(g?.scoring?.direction) ||
    typeof g?.scoring?.unit !== "string" ||
    g.scoring.unit.length > 24
  )
    errors.push("invalid scoring contract");
  if (
    !Array.isArray(g?.topologies) ||
    !g.topologies.length ||
    g.topologies.some(
      (t) => !["shared", "remote", "hybrid", "spectator"].includes(t),
    )
  )
    errors.push("invalid topology");
  for (const name of ["solo", "multiplayer"]) {
    const m = g?.modes?.[name];
    if (
      !m ||
      !Number.isInteger(m.minHumans) ||
      !Number.isInteger(m.maxHumans) ||
      m.minHumans < 1 ||
      m.maxHumans > 4 ||
      m.minHumans > m.maxHumans
    )
      errors.push(`invalid ${name} seats`);
    if (name === "multiplayer" && m?.minHumans < 2)
      errors.push("multiplayer needs two humans");
  }
  return errors;
}
export function matchSetup(game, requested = {}, humans = 1) {
  const mode =
    requested.mode === "solo"
      ? "solo"
      : requested.mode === "multiplayer"
        ? "multiplayer"
        : humans > 1
          ? "multiplayer"
          : "solo";
  const rules = game.modes[mode];
  return {
    mode,
    minHumans: rules.minHumans,
    maxHumans: rules.maxHumans,
    cpuCount: ["mario-kart", "golf"].includes(game.id)
      ? Math.max(
          0,
          Math.min(
            game.id === "golf" ? 4 : 8 - Math.min(humans, rules.maxHumans),
            Number.isInteger(requested.cpuCount)
              ? requested.cpuCount
              : rules.aiDefault,
          ),
        )
      : rules.aiDefault,
    drawing: requested.drawing === "free" ? "free" : "guess",
    laps: requested.laps === 3 ? 3 : 1,
    holes: [1, 3, 6].includes(requested.holes) ? requested.holes : 3,
    rotation: ["pick", "winner", "bracket"].includes(requested.rotation)
      ? requested.rotation
      : "winner",
    variant: ["co-op", "battle", "race"].includes(requested.variant)
      ? requested.variant
      : "co-op",
  };
}
