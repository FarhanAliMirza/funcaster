import { useDeterministicMath } from "/core/dmath.js";
import { FrameBuffer, raceHash } from "/core/lockstep-spike.js";
useDeterministicMath(true);
const { Race } = await import("/games/mario-kart/logic.js");
const $ = (id) => document.getElementById(id),
  socket = io();
let race,
  buffer,
  run = 0,
  started = 0,
  lastHash = 0,
  equal = 0,
  mismatches = 0,
  catchup = 0,
  recovering = false;
function joined(r, phone = false) {
  if (r.error) {
    $("status").textContent = r.error;
    return;
  }
  $("join").hidden = true;
  $(phone ? "phone" : "view").hidden = false;
  $("identity").textContent = "Lab " + r.code;
  $("seat").textContent = "Driver " + ((r.seat || 0) + 1);
  $("status").textContent =
    "Share lab code " + r.code + " with the other screen and phone.";
}
$("create").onclick = () => socket.emit("create", {}, (r) => joined(r));
$("screen").onclick = () => {
  socket.emit("join", { code: $("code").value }, (r) => joined(r));
  $("start").hidden = true;
};
$("controller").onclick = () =>
  socket.emit("join", { code: $("code").value, role: "phone" }, (r) =>
    joined(r, true),
  );
$("start").onclick = () => socket.emit("start");
socket.on("begin", (r) => {
  run = r.run;
  race = new Race({
    seed: r.seed,
    laps: 3,
    cpuCount: 2,
    humans: [
      { seat: 0, character: "mario" },
      { seat: 1, character: "luigi" },
    ],
  });
  race.start();
  buffer = new FrameBuffer();
  started = performance.now();
  lastHash = equal = mismatches = catchup = 0;
});
socket.on("frame", (f) => {
  const active = run;
  setTimeout(
    () => {
      if (run === active) buffer?.receive(f);
    },
    Number($("delay").value),
  );
});
socket.on("comparison", (r) => {
  if (r.equal) equal++;
  else mismatches++;
});
socket.on("ended", () => {
  $("status").textContent = "Lab ended. Reload to begin another.";
  race = null;
});
setInterval(() => {
  if (!buffer || recovering) return;
  recovering = true;
  socket.timeout(2000).emit("recover", buffer.tick, (error, frames) => {
    recovering = false;
    if (!error) for (const f of frames || []) buffer.receive(f);
  });
}, 1000);
const pedals = { gas: false, brake: false };
for (const key of ["gas", "brake"]) {
  $(key).onpointerdown = (e) => {
    e.preventDefault();
    $(key).setPointerCapture(e.pointerId);
    pedals[key] = true;
  };
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    $(key).addEventListener(event, () => (pedals[key] = false));
}
window.addEventListener("blur", () => {
  pedals.gas = pedals.brake = false;
});
setInterval(() => {
  if (!$("phone").hidden)
    socket.emit("input", { ...pedals, steer: Number($("steer").value) });
}, 34);
const canvas = document.querySelector("canvas"),
  ctx = canvas.getContext("2d");
function draw(now) {
  requestAnimationFrame(draw);
  if (!race || !buffer) return;
  const target = Math.max(0, Math.floor(((now - started) / 1000) * 60) - 6),
    before = performance.now();
  buffer.advance(
    (f) => {
      race.stepPlayers(1 / 120, f.players);
      race.stepPlayers(1 / 120, f.players);
      if (buffer.tick % 60 === 0 && lastHash !== buffer.tick) {
        lastHash = buffer.tick;
        socket.emit("hash", { tick: buffer.tick, hash: raceHash(race) });
      }
    },
    Math.min(240, Math.max(0, target - buffer.tick)),
  );
  catchup = Math.max(catchup, performance.now() - before);
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of race.racers) {
    ctx.fillStyle = ["#f7c600", "#ef5da8", "#4de2df", "#ffad42"][p.seat ?? 2];
    ctx.beginPath();
    ctx.arc(
      canvas.width / 2 + p.x * 0.35,
      canvas.height / 2 + p.z * 0.35,
      7,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  $("status").textContent = JSON.stringify(
    {
      state: race.state,
      tick: buffer.tick,
      hash: raceHash(race),
      matchingCheckpoints: equal,
      mismatches,
      stalls: buffer.stalls,
      largestCatchupMs: Math.round(catchup),
    },
    null,
    2,
  );
}
requestAnimationFrame(draw);
