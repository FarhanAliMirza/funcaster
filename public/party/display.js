import { gameById } from "./catalog.js";
import { PartyRenderer } from "./render.js";
const $ = (id) => document.getElementById(id),
  params = new URLSearchParams(location.search),
  code = params.get("room"),
  key = params.get("key");
if (key) {
  sessionStorage.setItem("funcaster.display." + code, key);
  history.replaceState(null, "", `/screen?room=${encodeURIComponent(code)}`);
}
const token = sessionStorage.getItem("funcaster.display." + code),
  socket = io("/party");
let state, frameKey, renderer;
socket.on("connect", () =>
  socket.emit("display", { code, token }, (r) => {
    if (r.error) $("display-title").textContent = r.error;
  }),
);
socket.on("disconnect", () => {
  $("display-title").textContent = "Reconnecting to the party…";
});
function draw(next) {
  state = next;
  for (const option of $("display-seats").options)
    option.disabled =
      !!option.value &&
      option.value.split(",").every((s) => Number(s) >= state.active.length);
  if ($("display-seats").selectedOptions[0]?.disabled)
    $("display-seats").value = "";
  const game = gameById(state.game),
    selection = $("display-seats").value,
    viewKey = [state.game, state.roundId, state.phase, selection].join(":");
  $("display-title").textContent =
    `${game.title} · ${state.code}${state.paused ? " · Paused" : ""}`;
  if (frameKey === viewKey) return;
  frameKey = viewKey;
  $("display-stage").replaceChildren();
  if (renderer) {
    renderer.running = false;
    renderer.observer.disconnect();
  }
  renderer = null;
  if (state.phase === "classic") {
    const independent =
      ["kart", "island-flyover", "alien-attack", "shooting-range"].includes(
        state.game,
      ) ||
      (state.game === "fruit-ninja" && state.match?.variant === "race");
    const selected = selection
      ? selection.split(",").map(Number)
      : state.active.map((_, i) => i);
    const views = independent
      ? selected.filter((s) => s < state.active.length)
      : [0];
    $("display-stage").dataset.count = views.length;
    const loading = document.createElement("p");
    loading.id = "display-loading";
    loading.textContent = "Getting the view ready…";
    loading.setAttribute("role", "status");
    $("display-stage").append(loading);
    for (const view of views) {
      const frame = document.createElement("iframe");
      frame.title = game.title;
      frame.style.visibility = "hidden";
      frame.allow = "autoplay; fullscreen";
      frame.src = `/games/${state.game}/?party=${code}&round=${state.roundId}&view=${view}&display=1&seats=${selection}`;
      $("display-stage").append(frame);
    }
  } else if (["practice", "playing", "countdown"].includes(state.phase)) {
    const canvas = document.createElement("canvas");
    $("display-stage").append(canvas);
    renderer = new PartyRenderer(canvas);
    renderer.resize();
  } else {
    const note = document.createElement("p");
    note.id = "display-note";
    note.textContent =
      state.phase === "results"
        ? `Nice moves! ${state.result?.scores.map((s) => `Player ${s.slot + 1}: ${s.score}`).join(" · ") || ""}`
        : `Scan the host’s QR to join. ${state.players.length} of 4 players are here.`;
    $("display-stage").append(note);
  }
}
socket.on("state", draw);
socket.on("frame", (f) => renderer?.setFrame(f));

$("display-seats").onchange = () => {
  if (state) draw(state);
};
$("display-fullscreen").onclick = () =>
  document.documentElement.requestFullscreen?.();

window.addEventListener("message", (event) => {
  if (event.origin !== location.origin) return;
  const frame = [...$("display-stage").querySelectorAll("iframe")].find(
    (f) => f.contentWindow === event.source,
  );
  if (!frame) return;
  if (event.data?.type === "funcaster:view-ready") {
    frame.style.visibility = "";
    frame.dataset.ready = "true";
    if (
      [...$("display-stage").querySelectorAll("iframe")].every(
        (f) => f.dataset.ready,
      )
    )
      $("display-loading")?.remove();
  }
  if (event.data?.type === "funcaster:error") {
    const note = $("display-loading");
    if (note) note.textContent = event.data.message;
  }
});
