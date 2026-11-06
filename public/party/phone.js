import { buildId } from "/build.js";
import { MotionSettings, MOTION_PROFILES } from "/core/motion-settings.js";
import { RacingMotion } from "/core/racing-motion.js";
import { DriveControls } from "/core/drive-controls.js";
import { PartyMotion } from "/core/party-motion.js";
import { gameById, remember, recalled } from "./catalog.js";
const $ = (id) => document.getElementById(id),
  socket = io("/party", { transports: ["websocket", "polling"] });
let code =
    new URLSearchParams(location.search).get("room")?.toUpperCase() || "",
  identity = null,
  state = null,
  mode = "motion",
  started = false,
  ready = false,
  removed = false,
  latest = null,
  lastSample = 0,
  lastSend = 0,
  lastPulse = false,
  generic = null,
  wake = null,
  offset = 0,
  joinPending = false,
  retryTimer = null,
  sensorTimeout = null,
  gravity = null,
  latency = null;
let preferenceStorage;
try {
  preferenceStorage = localStorage;
} catch {}
const motionSettings = new MotionSettings(preferenceStorage);
const motion = new PartyMotion({ sensitivity: motionSettings.get("party") });
const wheelMotion = new RacingMotion({
  sensitivity: motionSettings.get("racing"),
});
const pedals = new DriveControls();
let sketchStatus = null;
let raceStatus = null,
  playStatus = null,
  shotStarted = 0;
const isWheel = () => gameById(state?.game).mode === "wheel";
const landscape = () => matchMedia("(orientation: landscape)").matches;
function releasePedals() {
  shotStarted = 0;
  pedals.release();
  for (const id of ["gas", "brake", "boost"]) $(id).classList.remove("pressed");
  if (identity && socket.connected)
    socket.emit("input", {
      x: 0,
      y: 0,
      gas: false,
      brake: false,
      boost: false,
    });
}
function syncSettings() {
  const wheel = isWheel(),
    name = wheel ? "racing" : "party",
    profile = MOTION_PROFILES[name];
  $("settings-title").textContent = wheel
    ? "Find your steering feel."
    : "Your kind of motion.";
  $("settings-description").textContent = wheel
    ? "Gentle near the center. Tilt farther for tighter turns."
    : "Small moves or big moves. Find your sweet spot.";
  $("sensitivity-label").textContent = wheel
    ? "Steering sensitivity"
    : "Motion sensitivity";
  $("sensitivity").min = String(profile.min * 100);
  $("sensitivity").max = String(profile.max * 100);
  $("sensitivity").value = String(motionSettings.get(name) * 100);
  $("sensitivity-value").textContent =
    `${Math.round(motionSettings.get(name) * 100)}%`;
  $("range-low").textContent = wheel ? "Gentler" : "Steady";
  $("range-middle").textContent = wheel ? "Default" : "Balanced";
  $("range-high").textContent = wheel ? "Quicker" : "Extra lively";
  $("settings-note").textContent = wheel
    ? "Saved for racing only. Lower it for gentler steering. Recenter whenever you change your grip."
    : "Calibration filters your phone’s natural wobble. Recenter whenever you change your grip.";
}
function setSensitivity(value) {
  const wheel = isWheel();
  const sensitivity = motionSettings.set(wheel ? "racing" : "party", value);
  (wheel ? wheelMotion : motion).setSensitivity(sensitivity);
  syncSettings();
}
syncSettings();
const buzz = (pattern) => {
  try {
    $("phone-haptics").checked && navigator.vibrate?.(pattern);
  } catch {}
};
function message(text) {
  $("join-error").textContent = text;
  $("join-error").hidden = !text;
}
function status(text, online = false) {
  $("phone-status").textContent = text;
  $("phone-status").classList.toggle("online", online);
}
function setReady(value) {
  ready = value;
  if (identity && socket.connected)
    socket.emit("ready", { ready: value, mode });
}
async function keepAwake() {
  try {
    wake = await navigator.wakeLock?.request("screen");
  } catch {}
}
function join() {
  if (!code || removed || joinPending || identity || !socket.connected) return;
  joinPending = true;
  const saved = recalled(`funcaster.player.${code}`);
  socket.emit("join", { buildId, code, token: saved?.token }, (answer) => {
    joinPending = false;
    if (answer.error) {
      message(answer.error);
      status(answer.full ? "Waiting for a spot" : "Party unavailable");
      $("join-title").textContent = answer.full
        ? "Good things are worth the wait."
        : "Let’s find your party.";
      $("join-description").textContent = answer.full
        ? "We’ll save you a place when one opens."
        : "Scan the current code on the big screen.";
      if (answer.full) retryTimer = setTimeout(join, 3000);
      return;
    }
    identity = answer;
    remember(`funcaster.player.${code}`, answer);
    document.documentElement.style.setProperty("--player", answer.color);
    $("player-identity").textContent =
      `You’re ${answer.name} · Player ${answer.slot + 1}`;
    $("play-identity").textContent = `You’re ${answer.name}`;
    $("join-title").innerHTML = "Your phone.<br>Your superpower.";
    $("join-description").textContent = "One little tilt. A whole lot of fun.";
    $("enable").disabled = false;
    $("touch-mode").disabled = false;
    message("");
    status("You’re connected", true);
    if (started) {
      if (mode === "touch") setReady(true);
      else calibrate();
    }
    buzz([25, 50, 25]);
  });
}
if (!code) {
  $("code-form").hidden = false;
  $("join-view").hidden = true;
}
$("code-form").onsubmit = (event) => {
  event.preventDefault();
  code = $("code-input").value.trim().toUpperCase();
  history.replaceState({}, "", `/controller?room=${encodeURIComponent(code)}`);
  $("code-form").hidden = true;
  $("join-view").hidden = false;
  removed = false;
  join();
};
socket.on("connect", () => {
  identity = null;
  joinPending = false;
  status("Finding your party…");
  clearTimeout(retryTimer);
  join();
});
socket.on("disconnect", () => {
  releasePedals();
  identity = null;
  ready = false;
  status("Reconnecting…");
  $("enable").disabled = true;
  $("touch-mode").disabled = true;
  $("connection-detail").textContent = "Connection lost · retrying";
});
socket.on("removed", () => {
  releasePedals();
  removed = true;
  started = false;
  identity = null;
  remember(`funcaster.player.${code}`, null);
  $("play-view").hidden = true;
  $("join-view").hidden = false;
  message(
    "Your spot was freed on the big screen. Scan again to join a new round.",
  );
});
socket.on("ended", () => {
  releasePedals();
  removed = true;
  setReady(false);
  $("play-view").hidden = true;
  $("join-view").hidden = false;
  message("That party has ended. Scan the new code on the big screen.");
});
function calibrate() {
  releasePedals();
  motion.reset();
  wheelMotion.reset();
  latest = null;
  setReady(false);
  $("calibration-track").hidden = false;
  $("sensor-message").hidden = true;
  $("retry-sensors").hidden = true;
  render();
  clearTimeout(sensorTimeout);
  sensorTimeout = setTimeout(() => {
    if (!ready && mode === "motion" && (!isWheel() || landscape())) {
      sensorProblem(
        "No motion yet. Allow Motion & Orientation in your browser, or play with touch.",
      );
    }
  }, 5500);
}
function sensorProblem(text) {
  $("sensor-message").textContent = text;
  $("sensor-message").hidden = false;
  $("retry-sensors").hidden = false;
  $("retry-sensors").textContent = "Use touch instead";
  $("retry-sensors").onclick = () => beginTouch();
  setReady(false);
}
function sensor(sample) {
  if (!started || mode !== "motion" || document.hidden) return;
  lastSample = performance.now();
  if (isWheel() && !landscape()) return;
  const result = (isWheel() ? wheelMotion : motion).update(sample, lastSample);
  if (!result) return;
  latest = result;
  $("calibration-progress").style.width = `${result.progress * 100}%`;
  if (result.ready && !ready) {
    setReady(true);
    clearTimeout(sensorTimeout);
    $("calibration-track").hidden = true;
    $("sensor-message").hidden = true;
    $("retry-sensors").hidden = true;
    buzz([15, 35, 25]);
    render();
  }
}
function orientation(event) {
  if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
  sensor({
    alpha: Number.isFinite(event.alpha) ? event.alpha : 0,
    beta: event.beta,
    gamma: event.gamma,
    screenAngle: screen.orientation?.angle || window.orientation || 0,
  });
}
function acceleration(event) {
  if (!started || mode !== "motion") return;
  let a = event.acceleration;
  if (!a || ![a.x, a.y, a.z].every(Number.isFinite)) {
    const g = event.accelerationIncludingGravity;
    if (!g || ![g.x, g.y, g.z].every(Number.isFinite)) return;
    if (!gravity) gravity = { ...g, x: g.x, y: g.y, z: g.z };
    a = {};
    for (const k of ["x", "y", "z"]) {
      gravity[k] += (g[k] - gravity[k]) * 0.08;
      a[k] = g[k] - gravity[k];
    }
  }
  if (!isWheel() && motion.flick(a, performance.now())) lastPulse = true;
}
window.addEventListener("deviceorientation", orientation);
window.addEventListener("devicemotion", acceleration);
async function permission() {
  if (!window.isSecureContext)
    throw Error(
      "Motion needs a secure invite link. You can still play with touch.",
    );
  // Request both permissions synchronously inside the tap's user activation.
  const requests = [];
  for (const Ctor of [window.DeviceOrientationEvent, window.DeviceMotionEvent])
    if (typeof Ctor?.requestPermission === "function")
      requests.push(Ctor.requestPermission());
  const decisions = await Promise.allSettled(requests);
  if (
    decisions.some((d) => d.status === "fulfilled" && d.value !== "granted") ||
    decisions.some((d) => d.status === "rejected")
  )
    throw Error(
      "Motion wasn’t allowed. Try again, or play with touch — you’re still invited.",
    );
}
function genericFallback() {
  if (lastSample || generic || mode !== "motion") return;
  const Ctor =
    window.RelativeOrientationSensor || window.AbsoluteOrientationSensor;
  if (!Ctor) return;
  try {
    generic = new Ctor({ frequency: 60, referenceFrame: "device" });
    generic.addEventListener("reading", () => {
      if (generic.quaternion)
        sensor({
          quat: [...generic.quaternion],
          screenAngle: screen.orientation?.angle || 0,
        });
    });
    generic.addEventListener("error", () => {});
    generic.start();
  } catch {
    generic = null;
  }
}
$("enable").onclick = async () => {
  if (!identity) return;
  $("enable").disabled = true;
  message("");
  try {
    await permission();
    mode = "motion";
    started = true;
    $("join-view").hidden = true;
    $("play-view").hidden = false;
    lastSample = 0;
    calibrate();
    keepAwake();
    setTimeout(genericFallback, 1500);
  } catch (error) {
    message(error.message);
    $("enable").disabled = false;
  }
};
function beginTouch() {
  if (!identity) return;
  releasePedals();
  mode = "touch";
  $("connection-detail").textContent = "Touch controls · connected";
  started = true;
  latest = { x: 0, y: 0 };
  $("join-view").hidden = true;
  $("play-view").hidden = false;
  $("sensor-message").hidden = true;
  $("retry-sensors").hidden = true;
  $("calibration-track").hidden = true;
  clearTimeout(sensorTimeout);
  setReady(true);
  keepAwake();
  render();
}
$("touch-mode").onclick = beginTouch;
let touchId = null;
function touch(event) {
  const r = $("motion-pad").getBoundingClientRect();
  latest = {
    x: Math.max(
      -1,
      Math.min(1, ((event.clientX - r.left) / r.width - 0.5) * 2.4),
    ),
    y: Math.max(
      -1,
      Math.min(1, ((event.clientY - r.top) / r.height - 0.5) * 2.4),
    ),
  };
}
$("motion-pad").onpointerdown = (event) => {
  if (mode !== "touch") return;
  event.preventDefault();
  touchId = event.pointerId;
  $("motion-pad").setPointerCapture(event.pointerId);
  touch(event);
};
$("motion-pad").onpointermove = (event) => {
  if (mode === "touch" && event.pointerId === touchId) touch(event);
};
for (const name of ["pointerup", "pointercancel"])
  $("motion-pad").addEventListener(name, (event) => {
    if (event.pointerId === touchId) touchId = null;
  });
$("motion-pad").onkeydown = (event) => {
  if (mode !== "touch") return;
  const moves = {
    ArrowLeft: [-0.15, 0],
    ArrowRight: [0.15, 0],
    ArrowUp: [0, -0.15],
    ArrowDown: [0, 0.15],
  };
  if (moves[event.key]) {
    event.preventDefault();
    const [x, y] = moves[event.key];
    latest = {
      x: Math.max(-1, Math.min(1, (latest?.x || 0) + x)),
      y: Math.max(-1, Math.min(1, (latest?.y || 0) + y)),
    };
  }
};
$("pulse").onclick = () => {
  lastPulse = true;
  buzz(12);
};
$("recenter").onclick = () => {
  if (mode === "touch") {
    $("touch-steer").value = "0";
    latest = { x: 0, y: 0 };
    setReady(true);
  } else calibrate();
};
function render() {
  if (!started || !state || !identity) return;
  const g = gameById(state.game),
    self = state.players.find((p) => p.slot === identity.slot),
    active = state.active.includes(identity.slot);
  const wheel = g.mode === "wheel",
    rotate = wheel && mode === "motion" && !landscape();
  document.body.classList.toggle("wheel-mode", wheel);
  $("motion-pad").hidden = wheel;
  $("wheel-controls").hidden = !wheel || rotate;
  $("rotate-phone").hidden = !rotate;
  $("touch-steer-wrap").hidden = mode !== "touch";
  $("classic-action").hidden =
    !g.classic ||
    ["fruit-ninja", "island-flyover"].includes(state.game) ||
    wheel ||
    !ready ||
    !active ||
    state.phase !== "classic";
  $("classic-action").textContent = g.action || "Play";
  $("classic-action").disabled = !state.screenConnected;
  $("phone-score").textContent = g.classic
    ? active
      ? "YOUR TURN"
      : "UP NEXT"
    : `${self?.score || 0} PTS`;
  const setup =
    state.game === "mario-kart" &&
    (!raceStatus || raceStatus.stage === "ready");
  $("driver-choices").hidden = !setup || !active;
  $("driver-name").textContent = raceStatus?.waiting
    ? "Waiting for your crew…"
    : raceStatus?.confirmed
      ? "Choose 1 or 3 laps"
      : raceStatus?.driver || "Choose your driver";
  $("gas-label").textContent = setup
    ? raceStatus?.confirmed
      ? "Start race"
      : "Choose driver"
    : raceStatus?.stage === "paused"
      ? "Resume"
      : raceStatus?.stage === "results"
        ? "Race again"
        : "Accelerate";
  $("gas-hint").textContent =
    setup || ["paused", "results"].includes(raceStatus?.stage)
      ? "TAP TO CONTINUE"
      : "HOLD TO GO";
  const boostIn =
    g.classic && wheel ? raceStatus?.boostIn || 0 : self?.boostIn || 0;
  const boostsLeft =
    g.classic && wheel ? raceStatus?.boostsLeft : self?.boostsLeft;
  const stockKnown = Number.isInteger(boostsLeft),
    exhausted = stockKnown && boostsLeft === 0;
  const stockLabel = stockKnown ? `${boostsLeft} LEFT` : "— LEFT";
  if ($("boost-left").textContent !== stockLabel)
    $("boost-left").textContent = stockLabel;
  $("boost-label").textContent = exhausted
    ? "ALL USED · NEXT RACE"
    : boostIn > 0
      ? `READY IN ${Math.ceil(boostIn)}s`
      : "TAP FOR NITRO";
  $("boost-recharge").hidden = !stockKnown || exhausted;
  $("boost-recharge-fill").style.width =
    `${Math.max(0, Math.min(1, 1 - boostIn / 8)) * 100}%`;
  $("gas").setAttribute("aria-label", $("gas-label").textContent);
  const canDrive =
    ready &&
    active &&
    state.hostConnected &&
    (state.phase !== "classic" || state.screenConnected) &&
    ["classic", "practice", "countdown", "playing"].includes(state.phase);
  $("gas").disabled = !canDrive;
  $("brake").disabled = !canDrive;
  $("boost").disabled =
    !canDrive ||
    !stockKnown ||
    exhausted ||
    boostIn > 0 ||
    (state.game === "mario-kart" && raceStatus?.stage !== "racing");
  $("pulse").hidden =
    state.game !== "bubble-burst" ||
    !ready ||
    !active ||
    !["practice", "playing"].includes(state.phase);
  $("pad-caption").textContent =
    mode === "touch" ? "DRAG HERE TO MOVE" : "A LITTLE TILT IS ALL IT TAKES";
  $("switch-mode").textContent =
    mode === "touch" ? "Try motion controls" : "Use touch controls";
  $("phone-phase").textContent = !ready
    ? "FIND YOUR BALANCE"
    : state.phase === "practice"
      ? "A LITTLE WARM-UP"
      : state.phase === "playing"
        ? g.title.toUpperCase()
        : state.phase === "results"
          ? "NICELY PLAYED"
          : "YOU’RE IN";
  if (rotate) {
    $("phone-title").textContent = "Take the wheel.";
    $("phone-hint").textContent =
      "Rotate sideways, then hold your comfortable driving grip still.";
  } else if (!ready && mode === "motion") {
    $("phone-title").innerHTML = "Hold comfy.<br>Stay still.";
    $("phone-hint").textContent = "We’re finding your natural grip.";
  } else if (!state.hostConnected) {
    $("phone-title").textContent = "Keep your spot.";
    $("phone-hint").textContent = "The big screen is reconnecting. Hang tight.";
  } else if (state.phase === "classic" && !state.screenConnected) {
    $("phone-title").textContent = "A little warm-up…";
    $("phone-hint").textContent =
      "Your phone is connected. The big screen is getting the game ready.";
  } else if (state.phase === "lobby") {
    if (!self?.ready) {
      $("phone-title").textContent = "Ready for more?";
      $("phone-hint").textContent = "Tap Recenter to join the next game.";
    } else {
      $("phone-title").innerHTML = "You’re ready.<br>Look up!";
      $("phone-hint").textContent =
        "Waiting for your crew. We’ll start together.";
    }
  } else if (!active) {
    $("phone-title").textContent = "You’re up next.";
    $("phone-hint").textContent =
      "Cheer on your crew. You’ll join the next round.";
  } else if (
    wheel &&
    active &&
    ["classic", "practice", "countdown", "playing"].includes(state.phase)
  ) {
    $("phone-title").textContent = setup
      ? raceStatus?.confirmed
        ? "Ready for the grid?"
        : "Pick your favorite."
      : "Easy turns. Smooth racing.";
    $("phone-hint").textContent = setup
      ? "Use the arrows. Your driver is on the big screen."
      : "Hold Accelerate. Tilt left or right. Tap Boost for a burst.";
  } else if (state.phase === "classic" && active) {
    $("phone-title").textContent = mode === "touch" ? "Drag to move." : g.verb;
    $("phone-hint").textContent = g.detail;
  } else if (state.phase === "results") {
    const scored = state.players.filter((p) => state.active.includes(p.slot));
    const max = Math.max(...scored.map((p) => p.score));
    $("phone-title").textContent =
      self?.score === max ? "Good moves!" : "Nicely played!";
    $("phone-hint").textContent =
      "Another round is on the way. Keep your phone ready.";
  } else {
    $("phone-title").textContent =
      mode === "touch"
        ? g.mode === "side"
          ? "Slide to move."
          : "Drag to pop."
        : g.verb;
    $("phone-hint").textContent =
      state.phase === "practice"
        ? "Try it now. Find your color on the big screen."
        : g.detail;
  }
  if (playStatus && state.phase === "classic" && active) {
    $("phone-hint").textContent = playStatus.caption;
    $("classic-action").disabled = !ready || !playStatus.active;
    if (!shotStarted)
      $("classic-action").textContent = playStatus.active
        ? playStatus.action
        : "Your turn soon";
  }
  const guessing =
    state.game === "drawing" &&
    state.phase === "classic" &&
    !!state.sketch &&
    active;
  $("guess-panel").hidden = !guessing;
  if (guessing) {
    const drawing = state.sketch.drawer === identity.slot;
    $("phone-title").textContent = drawing
      ? "Your turn to draw."
      : "What could it be?";
    $("phone-hint").textContent = state.sketch.reveal
      ? "Nice guesses! Next artist in a moment."
      : drawing
        ? "Keep the word secret. Tilt to draw; tap to lift your pen."
        : "Look at the big screen. Type your guess below.";
    $("secret-word").textContent = state.sketch.reveal
      ? state.sketch.label
      : drawing
        ? sketchStatus?.word || "Your word is arriving…"
        : state.sketch.label;
    $("guess-form").hidden =
      drawing || state.sketch.reveal || !!sketchStatus?.guessed;
    $("motion-pad").hidden = !drawing;
    $("classic-action").hidden = !drawing || state.sketch.reveal;
    $("guess-text").disabled = state.paused;
    $("phone-score").textContent =
      `${state.sketch.scores[identity.slot] || 0} PTS`;
  }
  if (state.paused) {
    $("phone-title").textContent = "Taking a breather.";
    $("phone-hint").textContent = "Waiting for the host to resume.";
    for (const id of ["gas", "brake", "boost", "classic-action"])
      $(id).disabled = true;
  }
}
let previousScore = 0;
socket.on("state", (next) => {
  const oldGame = state?.game,
    oldRound = state?.roundId,
    oldActive = state?.active.includes(identity?.slot);
  state = next;
  if (oldGame !== next.game) syncSettings();
  if (
    oldGame !== next.game ||
    oldRound !== next.roundId ||
    (oldActive && !next.active.includes(identity?.slot))
  ) {
    releasePedals();
    raceStatus = null;
    playStatus = null;
    sketchStatus = null;
    if (mode === "touch") {
      latest = { x: 0, y: 0 };
      $("touch-steer").value = "0";
    }
    if (started && mode === "motion" && oldGame !== next.game) calibrate();
  }
  offset = state.serverTime - Date.now();
  if (identity) {
    const self = state.players.find((p) => p.slot === identity.slot);
    if (self && self.score > previousScore) buzz(9);
    previousScore = self?.score || 0;
    // Calibration readiness belongs to this phone. An older server broadcast
    // may arrive after the user taps Join; it must not stop fresh inputs.
  }
  render();
});
function frame(time) {
  requestAnimationFrame(frame);
  if (!started) return;
  if (shotStarted)
    $("classic-action").textContent =
      `Release to shoot · ${Math.round(Math.min(1, (time - shotStarted) / 1600) * 100)}%`;
  if (latest) {
    $("steering-dot").style.left = `${50 + latest.x * 45}%`;
    $("motion-dot").style.transform =
      `translate(${latest.x * 85}px,${(gameById(state?.game).mode === "aim" ? latest.y : 0) * 65}px)`;
  }
  if (identity && state) {
    const remaining = Math.max(
      0,
      Math.ceil((state.endsAt - Date.now() - offset) / 1000),
    );
    $("phone-countdown").hidden =
      state.phase !== "countdown" || !state.active.includes(identity.slot);
    $("phone-countdown").textContent = remaining || "GO";
  }
  if (
    ready &&
    mode === "motion" &&
    lastSample &&
    time - lastSample > 1800 &&
    !document.hidden
  ) {
    sensorProblem("Motion paused. Keep this page open, or switch to touch.");
  }
  if (
    socket.connected &&
    identity &&
    ready &&
    latest &&
    time - lastSend >= 30 &&
    !document.hidden
  ) {
    lastSend = time;
    socket.emit("input", {
      x: latest.x,
      y: latest.y,
      pulse: lastPulse,
      ...pedals.read(time),
    });
    lastPulse = false;
  }
}
requestAnimationFrame(frame);
setInterval(() => {
  if (!socket.connected || !identity) return;
  const began = performance.now();
  socket.timeout(2500).emit("ping-check", {}, (error) => {
    if (error) {
      $("connection-detail").textContent = "Connection is slow";
      return;
    }
    latency = Math.round(performance.now() - began);
    $("connection-detail").textContent =
      latency > 180
        ? "Connection is a little slow"
        : mode === "touch"
          ? "Touch controls · connected"
          : ready
            ? "Motion connected"
            : "Waiting for motion";
    status("Connected", true);
  });
}, 3000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    releasePedals();
    setReady(false);
    socket.emit("input", { x: 0, y: 0 });
    wake?.release().catch(() => {});
  } else if (started) {
    keepAwake();
    if (mode === "motion") calibrate();
    else setReady(true);
  }
});
matchMedia("(orientation: landscape)").addEventListener("change", () => {
  if (!started) return;
  releasePedals();
  if (mode === "motion") calibrate();
  else render();
});
window.addEventListener("orientationchange", () => {
  if (started && mode === "motion") setTimeout(calibrate, 150);
});
window.addEventListener("blur", releasePedals);
$("tune").onclick = () => {
  releasePedals();
  syncSettings();
  $("settings").showModal();
};
$("close-settings").onclick = () => $("settings").close();
$("sensitivity").oninput = () =>
  setSensitivity(Number($("sensitivity").value) / 100);
$("reset-sensitivity").onclick = () => {
  const name = isWheel() ? "racing" : "party";
  setSensitivity(MOTION_PROFILES[name].default);
};
$("switch-mode").onclick = async () => {
  $("settings").close();
  if (mode === "motion") beginTouch();
  else {
    try {
      await permission();
      mode = "motion";
      lastSample = 0;
      calibrate();
      setTimeout(genericFallback, 1500);
    } catch (error) {
      $("sensor-message").textContent = error.message;
      $("sensor-message").hidden = false;
    }
  }
};
$("leave").onclick = () => {
  releasePedals();
  removed = true;
  socket.emit("leave");
  remember(`funcaster.player.${code}`, null);
  identity = null;
  started = false;
  generic?.stop();
  wake?.release().catch(() => {});
  $("settings").close();
  $("play-view").hidden = true;
  $("join-view").hidden = false;
  message("Thanks for playing! Scan the big screen whenever you want back in.");
  $("enable").disabled = true;
  $("touch-mode").disabled = true;
  status("You’ve left the party");
};

$("classic-action").onclick = () => {
  if (state?.game === "golf") return;
  socket.emit("action", { action: "primary" });
  buzz(12);
};
function startShot(event) {
  if (state?.game !== "golf" || $("classic-action").disabled) return;
  event.preventDefault();
  shotStarted = performance.now();
  if (event.pointerId !== undefined)
    $("classic-action").setPointerCapture(event.pointerId);
}
function finishShot(event) {
  if (!shotStarted) return;
  event.preventDefault();
  const power = Math.min(
    1,
    Math.max(0.12, (performance.now() - shotStarted) / 1600),
  );
  shotStarted = 0;
  socket.emit("action", { action: "primary", power });
  buzz(18);
  render();
}
$("classic-action").onpointerdown = startShot;
$("classic-action").onpointerup = finishShot;
$("classic-action").onpointercancel = () => {
  shotStarted = 0;
};
$("classic-action").onkeydown = (e) => {
  if ([" ", "Enter"].includes(e.key) && !e.repeat) startShot(e);
};
$("classic-action").onkeyup = (e) => {
  if ([" ", "Enter"].includes(e.key)) finishShot(e);
};
$("driver-left").onclick = () => socket.emit("action", { action: "left" });
$("driver-right").onclick = () => socket.emit("action", { action: "right" });
$("touch-steer").oninput = () => {
  latest = { x: Number($("touch-steer").value) / 100, y: 0 };
};
for (const event of ["pointerup", "pointercancel", "blur"])
  $("touch-steer").addEventListener(event, () => {
    $("touch-steer").value = "0";
    if (mode === "touch") latest = { x: 0, y: 0 };
  });
for (const id of ["gas", "brake", "boost"]) {
  const button = $(id);
  const press = (pointer) => {
    if (button.disabled) return;
    pedals.down(id, pointer, performance.now());
    button.classList.add("pressed");
    if (
      id === "gas" &&
      state?.game === "mario-kart" &&
      (!raceStatus || ["ready", "results", "paused"].includes(raceStatus.stage))
    )
      socket.emit("action", { action: "confirm" });
    buzz(10);
  };
  button.onpointerdown = (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    press(event.pointerId);
  };
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(event, (e) => {
      pedals.up(e.pointerId);
      button.classList.remove("pressed");
    });
  button.onkeydown = (e) => {
    if ([" ", "Enter"].includes(e.key) && !e.repeat) {
      e.preventDefault();
      press(id);
    }
  };
  button.onkeyup = (e) => {
    if ([" ", "Enter"].includes(e.key)) {
      e.preventDefault();
      pedals.up(id);
      button.classList.remove("pressed");
    }
  };
  button.oncontextmenu = (e) => e.preventDefault();
}
socket.on("feedback", (data) => {
  if (data.type === "play-status") {
    playStatus = data;
    render();
  }
  if (data.type === "race-status") {
    raceStatus = data;
    render();
  }
  if (data.type === "rumble") buzz(data.pattern);
  if (["slice", "hit"].includes(data.type)) buzz(12);
});

for (const id of ["left-handed", "phone-haptics"]) {
  try {
    $(id).checked =
      JSON.parse(localStorage.getItem("funcaster." + id)) ??
      id === "phone-haptics";
  } catch {}
  $(id).onchange = () => {
    localStorage.setItem("funcaster." + id, JSON.stringify($(id).checked));
    document.body.classList.toggle("left-handed", $("left-handed").checked);
  };
}
document.body.classList.toggle("left-handed", $("left-handed").checked);
try {
  $("profile-name").value = localStorage.getItem("funcaster.nickname") || "";
} catch {}
$("profile-name").onchange = () =>
  localStorage.setItem(
    "funcaster.nickname",
    $("profile-name").value.trim().slice(0, 20),
  );
socket.on("match.finish", (result) => {
  if (result.status !== "completed") return;
  const score = result.scores.find((s) => s.slot === identity?.slot);
  if (!score) return;
  const game = gameById(state.game),
    key = "funcaster.best." + game.gameId;
  try {
    const old = Number(localStorage.getItem(key)),
      best =
        localStorage.getItem(key) === null
          ? score.score
          : game.scoring.direction === "lower"
            ? Math.min(old, score.score)
            : Math.max(old, score.score);
    localStorage.setItem(key, String(best));
    $("personal-best").textContent =
      `${game.title} best: ${best} ${game.scoring.unit}`;
  } catch {}
});

socket.on("sketch-turn", (data) => {
  if (sketchStatus?.turn !== data.turn) {
    $("guess-text").value = "";
    $("guess-note").textContent = "";
  }
  sketchStatus = data;
  render();
});
$("guess-form").onsubmit = (event) => {
  event.preventDefault();
  socket.emit("guess", { text: $("guess-text").value }, (answer) => {
    $("guess-note").textContent =
      answer.error ||
      (answer.correct
        ? "You got it! Keep the answer to yourself."
        : "Not quite. Try another guess.");
    if (answer.correct) buzz([25, 40, 25]);
  });
};
