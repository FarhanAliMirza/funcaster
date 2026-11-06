export const REMOTE_SKINS = Object.freeze(["luna", "cream", "taxi", "classic"]);
/** Retain saved paint jobs, including the two pre-OS names. */
export function normalizeRemoteSkin(value) {
  const migrated = { bus: "luna", local: "classic" }[value] || value;
  return REMOTE_SKINS.includes(migrated) ? migrated : "luna";
}

/** The four lamps always retain their shape and seat; only the owner lights up. */
export function paintSeatLamps(element, seats, identity) {
  const queued = !!identity?.queued;
  const slot = Number.isInteger(identity?.slot) ? identity.slot : -1;
  element.classList.toggle("seek", queued || slot < 0);
  element.setAttribute(
    "aria-label",
    queued
      ? "Next up: waiting for your seat"
      : seats[slot]
        ? `Player ${slot + 1}: ${seats[slot].name}`
        : "Finding your seat",
  );
  for (const lamp of element.querySelectorAll("[data-seat]")) {
    const index = Number(lamp.dataset.seat),
      seat = seats[index];
    if (!seat) continue;
    lamp.textContent = seat.shape;
    lamp.style.setProperty("--seat-color", seat.color);
    lamp.classList.toggle("on", !queued && index === slot);
    lamp.setAttribute("aria-hidden", "true");
  }
}

export const REMOTE_BUTTONS = Object.freeze([
  "A",
  "B",
  "1",
  "2",
  "up",
  "down",
  "left",
  "right",
  "minus",
  "home",
  "plus",
]);
const WHEEL_GAMES = new Set(["mario-kart", "kart", "neon-drift"]);
const PLAY_PHASES = new Set(["classic", "practice", "countdown", "playing"]);
/** Only capabilities present in the shipped game/relay are assigned. */
export const GAME_REMOTE = Object.freeze({
  "mario-kart": { A: "Boost", wheel: true, unavailable: ["Look back"] },
  kart: { A: "Boost", wheel: true, unavailable: ["Look back"] },
  "neon-drift": { A: "Boost", wheel: true, unavailable: [] },
  golf: {
    A: "Take shot",
    B: "Cancel shot",
    unavailable: [
      "Club/spin selection",
      "Phone scorecard",
      "Wind direction (the relay supplies magnitude only)",
    ],
  },
  "fruit-ninja": { A: null, unavailable: [] },
  "table-tennis": { A: "Power return", unavailable: ["Separate serve action"] },
  swordplay: {
    A: "Strike",
    unavailable: ["Guard button (guarding uses tilt)", "Taunt"],
  },
  "shooting-range": { A: "Fire", unavailable: ["Reload", "Zoom"] },
  "alien-attack": { A: "Fire", unavailable: ["Special"] },
  "island-flyover": { A: null, unavailable: ["Trim"] },
  drawing: {
    A: "Pen up/down",
    unavailable: ["Undo", "Colour selection", "Clear"],
  },
  "star-catch": { A: null, unavailable: [] },
  "bubble-burst": { A: "Pop extra", unavailable: [] },
});

/** A disabled button may never receive pointerup, so room transitions release holds. */
export function remoteInputInterrupted(previous, next, slot) {
  return (
    !previous ||
    !next ||
    previous.game !== next.game ||
    previous.roundId !== next.roundId ||
    previous.phase !== next.phase ||
    (!previous.paused && !!next.paused) ||
    (previous.active?.includes(slot) && !next.active?.includes(slot))
  );
}

export function racingRemote({ game, phase, pointerMode = false }) {
  return WHEEL_GAMES.has(game) && PLAY_PHASES.has(phase) && !pointerMode;
}
/** Party setup has one confirmation; the shell already owns lap selection. */
export function kartGasCaption(status) {
  if (!status || status.stage === "ready")
    return status?.confirmed || status?.waiting ? "Ready" : "Choose driver";
  if (status.stage === "paused") return "Resume";
  if (status.stage === "results") return "Race again";
  return "Accelerate";
}

export function remotePosture(context) {
  return racingRemote(context) && context.landscape ? "sideways" : "pointer";
}

/** A complete map is returned even when a game has no action for a button. */
export function remoteButtonMap(context = {}) {
  const {
    game,
    phase,
    ready = false,
    active = false,
    paused = false,
    connected = true,
    pointerMode = false,
    shellReady = false,
    primaryEnabled = false,
    primaryCaption,
    canDrive = false,
    boostEnabled = false,
    gasEnabled = false,
    gasCaption = "Gas",
    driverSetup = false,
    shotStarted = false,
    guessing = false,
  } = context;
  const map = Object.fromEntries(
    REMOTE_BUTTONS.map((name) => [
      name,
      { caption: "", action: null, enabled: false },
    ]),
  );
  const set = (name, caption, action, enabled = true) => {
    map[name] = { caption, action, enabled };
  };
  set("home", "Menu", "menu");
  set("minus", "Slower", "slower");
  set("plus", "Faster", "faster");
  set("1", "Recentre", "recenter");
  set("2", "Help", "help");
  const shell = pointerMode || !PLAY_PHASES.has(phase);
  if (shell) {
    if (pointerMode) {
      set("minus", "Less", "shell-minus", shellReady && connected);
      set("plus", "More", "shell-plus", shellReady && connected);
    }
    set("A", "Click", "shell-click", shellReady && connected);
    set("B", "Back", "shell-back", shellReady && connected);
    for (const direction of ["up", "down", "left", "right"])
      set(direction, direction, `shell-${direction}`, shellReady && connected);
    return map;
  }
  const spec = GAME_REMOTE[game];
  if (!spec) return map;
  const playing = ready && active && !paused && connected;
  if (racingRemote(context)) {
    set("A", "Boost", "boost", playing && canDrive && boostEnabled);
    set("1", "Brake", "brake", playing && canDrive);
    set("2", gasCaption, "gas", playing && canDrive && gasEnabled);
    if (game === "mario-kart" && driverSetup) {
      set("left", "Previous driver", "left", playing);
      set("right", "Next driver", "right", playing);
    }
    return map;
  }
  if (spec.A)
    set(
      "A",
      primaryCaption || spec.A,
      game === "golf" ? "shot" : game === "bubble-burst" ? "pulse" : "primary",
      playing && primaryEnabled,
    );
  if (game === "golf")
    set("B", "Cancel shot", "cancel", playing && shotStarted);
  if (game === "drawing" && guessing) {
    map.A = { caption: "", action: null, enabled: false };
    set("2", "Guess", "guess", playing);
  }
  return map;
}

export function paintButtons(elements, map) {
  for (const name of REMOTE_BUTTONS) {
    const element = elements[name];
    if (!element) continue;
    const role = map[name] || {};
    element.dataset.caption = role.caption || "";
    element.dataset.action = role.action || "";
    element.disabled = !role.caption || !role.enabled;
    element.classList.toggle("is-idle", element.disabled);
    element.setAttribute(
      "aria-label",
      role.caption
        ? `${name}: ${role.caption}`
        : `${name}: no action in this game`,
    );
  }
}

/** Pure hold state machine: one tap, confirmation at 800ms, leave at 1800ms. */
export class HomeGesture {
  start(time) {
    this.began = time;
    this.confirmed = false;
    this.left = false;
  }
  advance(time) {
    if (this.began == null || this.left) return [];
    const actions = [];
    if (!this.confirmed && time - this.began >= 800) {
      this.confirmed = true;
      actions.push("confirm");
    }
    if (time - this.began >= 1800) {
      this.left = true;
      actions.push("leave");
    }
    return actions;
  }
  end(time) {
    if (this.began == null) return [];
    const actions = this.advance(time);
    if (!this.confirmed && !this.left) actions.push("menu");
    actions.push("dismiss");
    this.began = null;
    return actions;
  }
  cancel() {
    this.began = null;
    return ["dismiss"];
  }
}
