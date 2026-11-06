import { matchSetup, gameById } from "./catalog.js";
export function scoreboardKey(id, requested = {}) {
  const s = matchSetup(
    gameById(id),
    requested,
    requested.mode === "multiplayer" ? 2 : 1,
  );
  const keys =
    id === "golf"
      ? ["golfMode", "holes", "course", "wind", "cpuCount"]
      : id === "mario-kart"
        ? ["laps", "cpuCount"]
        : id === "fruit-ninja"
          ? ["variant", "bot"]
          : id === "table-tennis"
            ? ["tennisMode", "winScore"]
            : ["shooting-range", "alien-attack", "island-flyover"].includes(id)
              ? ["worldMode", "bot"]
              : id === "drawing"
                ? ["drawing"]
                : ["star-catch", "neon-drift", "bubble-burst"].includes(id)
                  ? ["interaction"]
                  : [];
  return id + "|" + JSON.stringify(keys.map((k) => s[k]));
}
