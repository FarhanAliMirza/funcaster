import { buildId } from "/build.js";
import {
  games,
  gameById,
  colors,
  names,
  remember,
  recalled,
} from "./catalog.js";
import { artwork } from "./art.js";
import { PartyRenderer } from "./render.js";
const $ = (id) => document.getElementById(id),
  socket = io("/party", { transports: ["websocket", "polling"] });
const renderer = new PartyRenderer($("game-canvas"));
let state = null,
  pairing = null,
  previousPhase = null,
  offset = 0,
  sound = false,
  audio = null,
  lastBeep = null,
  frameKey = null;
const toast = (text) => {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("toast").hidden = true), 4500);
};
function beep(frequency = 660) {
  if (!sound) return;
  try {
    audio ||= new AudioContext();
    audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.connect(g).connect(audio.destination);
    o.frequency.value = frequency;
    g.gain.setValueAtTime(0.07, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.16);
    o.start();
    o.stop(audio.currentTime + 0.17);
  } catch {}
}
$("games").innerHTML = games
  .map(
    (g) =>
      `<button class="game-card ${g.id === "mario-kart" ? "featured-game" : ""}" data-game="${g.id}" style="--card-bg:${g.bg};--card-color:${g.color}" aria-pressed="false"><div class="game-art">${artwork(g.id)}<span class="art-tag">${g.tag}</span><span class="selected-dot">✓</span></div><div class="card-copy"><h3>${g.title}</h3><p>${g.verb}</p><div class="card-bottom"><span>♙ ${g.players || "1–4 players"}</span><span>${g.duration || "60 seconds"} ↗</span></div></div></button>`,
  )
  .join("");
for (const card of document.querySelectorAll("[data-game]"))
  card.onclick = () => {
    socket.emit("select", { game: card.dataset.game });
    beep(460);
  };
function setDisplayInvite(session) {
  $("open-display").href =
    `/screen?room=${session.code}&key=${session.displayToken}`;
  const selected = new URLSearchParams(location.search).get("game");
  if (games.some((g) => g.id === selected))
    socket.emit("select", { game: selected });
}
async function pairingFor(code) {
  try {
    const response = await fetch(`/api/party/pairing/${code}`);
    if (!response.ok) throw Error();
    pairing = await response.json();
    $("qr").src = pairing.qr;
    $("qr").hidden = false;
    $("qr-loading").hidden = true;
    $("room-code").textContent = code;
    $("invite-code").textContent = code;
    $("invite-qr").src = pairing.qr;
    $("pair-note").textContent = pairing.trusted
      ? "Wi-Fi or mobile data. You’re invited."
      : "Local preview · phones need the same Wi-Fi and certificate approval.";
  } catch {
    $("qr-loading").textContent = "Couldn’t load the invite. Reconnecting…";
    setTimeout(() => pairingFor(code), 3000);
  }
}
socket.on("connect", () => {
  const saved = recalled("funcaster.host");
  socket.emit("host", { ...(saved || {}), buildId }, (answer) => {
    if (answer.error) {
      remember("funcaster.host", null);
      socket.emit("host", { buildId }, (retry) => {
        if (retry.error) return toast(retry.error);
        remember("funcaster.host", retry);
        setDisplayInvite(retry);
        pairingFor(retry.code);
      });
    } else {
      remember("funcaster.host", answer);
      setDisplayInvite(answer);
      pairingFor(answer.code);
    }
  });
  $("connection-overlay").hidden = true;
});
socket.on("disconnect", () => {
  $("connection-overlay").hidden = false;
  toast("Connection paused. Keeping your party together…");
});
socket.on("ended", () => {
  remember("funcaster.host", null);
  toast("This party has ended. Reload to start a new one.");
});
socket.on("frame", (frame) => renderer.setFrame(frame));
function playerMarkup(p, slot) {
  return `<div class="player-slot ${p ? "occupied" : ""} ${p && !p.connected ? "offline" : ""}" style="--player:${colors[slot]}"><div class="avatar">${p ? "" : "+"}</div><div><div class="player-name">${p ? names[slot] : `Player ${slot + 1}`}</div><div class="player-status">${!p ? "Waiting for a friend" : !p.connected ? "Reconnecting…" : p.ready ? "Ready to roll ✓" : "Finding their balance…"}</div></div>${p ? `<button class="player-remove" data-remove="${slot}" aria-label="Remove ${names[slot]} from party" title="Free this spot">×</button>` : ""}</div>`;
}
function results() {
  const ranked = [...state.players]
      .filter((p) => state.active.includes(p.slot))
      .sort((a, b) =>
        gameById(state.game).scoring.direction === "lower"
          ? a.score - b.score
          : b.score - a.score,
      ),
    top = ranked[0];
  if (!top) return;
  const tied = ranked.filter((p) => p.score === top.score).length > 1;
  const solo = ranked.length === 1;
  const target = gameById(state.game).target;
  $("winner").textContent = solo
    ? top.score >= target
      ? "You’re on a roll!"
      : "Nicely played!"
    : tied
      ? "A perfect tie!"
      : `${top.name} takes it!`;
  $("result-subtitle").textContent = solo
    ? `${top.score} ${gameById(state.game).scoring.unit}${target ? ` · Try for ${target} next round.` : " · Same phone. One more go?"}`
    : "Good moves. Better company.";
  $("rankings").innerHTML = ranked
    .map(
      (p, i) =>
        `<div class="ranking" style="--player:${p.color}"><span>${state.result?.scores.find((s) => s.slot === p.slot)?.rank || i + 1}. ${p.name}</span><b>${p.score} <small>${gameById(state.game).scoring.unit.toUpperCase()}</small></b></div>`,
    )
    .join("");
  $("crew-standings").textContent =
    (state.bracket?.champion !== null && state.bracket?.champion !== undefined
      ? `${names[state.bracket.champion]} wins the bracket! · `
      : "") +
    Object.entries(state.standings || {})
      .sort((a, b) => b[1] - a[1])
      .map(([s, score]) => `${names[Number(s)]} ${score}`)
      .join(" · ");
  $("result-verification").textContent =
    {
      verified: "Replay checked · scores match",
      attested: "Scores reported by the game screen",
      failed: "Replay check did not match · unverified scores",
      unverified: "Just for fun",
    }[state.result?.verification] || "";
  if (!$("results").open) $("results").showModal();
}
socket.on("state", (next) => {
  state = next;
  const recordsKey = `funcaster.records.${state.code}`;
  const records = recalled(recordsKey) || [];
  if (
    state.result?.status === "completed" &&
    !records.some((r) => r.matchId === state.result.matchId)
  ) {
    records.unshift({
      matchId: state.result.matchId,
      title: gameById(state.game).title,
      round: state.roundId,
    });
    records.splice(20);
    remember(recordsKey, records);
  }
  const history = $("record-history"),
    selected = history.value;
  if (history.dataset.matches !== records.map((r) => r.matchId).join(",")) {
    history.dataset.matches = records.map((r) => r.matchId).join(",");
    history.replaceChildren(
      ...records.map((r) => {
        const option = document.createElement("option");
        option.value = r.matchId;
        option.textContent = `Round ${r.round} · ${r.title}`;
        return option;
      }),
    );
    if (!records.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No completed rounds yet";
      history.append(option);
    }
    if (records.some((r) => r.matchId === selected)) history.value = selected;
  }
  $("save-history").disabled = !records.length;
  $("pause-game").textContent = state.paused ? "Resume" : "Pause";
  document.querySelector(".party-extras").hidden = state.phase !== "lobby";
  offset = next.serverTime - Date.now();
  const game = gameById(state.game),
    inLobby = state.phase === "lobby";
  $("lobby").hidden = !inLobby;
  const classic = state.phase === "classic";
  $("arena").hidden = inLobby || classic;
  $("classic-stage").hidden = !classic;
  document.body.classList.toggle("showing-classic", classic);
  if (classic) {
    $("classic-title").textContent = game.title;
    const activeNames = state.active.map((s) => names[s]).join(" + ");
    $("classic-players").textContent =
      `${activeNames} playing${state.players.length > state.active.length ? " · others up next" : ""}`;
    $("next-player").hidden =
      state.match?.maxHumans !== 1 ||
      state.players.filter((p) => p.connected && p.ready).length < 2;
    const key = `${state.game}:${state.roundId}`;
    if (frameKey !== key) {
      frameKey = key;
      $("classic-loading").hidden = false;
      const independent =
        ["kart", "island-flyover", "alien-attack", "shooting-range"].includes(
          state.game,
        ) ||
        (state.game === "fruit-ninja" && state.match?.variant === "race");
      document
        .querySelectorAll(".extra-game-view")
        .forEach((el) => el.remove());
      const wrap = $("classic-frame").parentElement;
      wrap.querySelectorAll(".view-name").forEach((e) => e.remove());
      wrap.dataset.views = independent ? state.active.length : 1;
      const viewCount = independent ? state.active.length : 1;
      for (let i = 0; i < viewCount; i++) {
        const frame =
          i === 0 ? $("classic-frame") : document.createElement("iframe");
        if (i) {
          frame.className = "extra-game-view";
          frame.allow = "autoplay; fullscreen";
          wrap.append(frame);
        }
        frame.title = `${game.title}${independent ? " · " + names[state.active[i]] : ""}`;
        if (independent) {
          const badge = document.createElement("span");
          badge.className = "view-name";
          badge.textContent = names[state.active[i]];
          badge.style.background = colors[state.active[i]];
          badge.style.left = `calc(${viewCount > 1 ? (i % 2) * 50 : 0}% + 12px)`;
          badge.style.bottom =
            viewCount > 2 && i < 2 ? "calc(50% + 8px)" : "8px";
          wrap.append(badge);
        }
        frame.src = `/games/${state.game}/?party=${state.code}&round=${state.roundId}&view=${i}`;
      }
    }
  } else if (frameKey) {
    frameKey = null;
    $("classic-frame").removeAttribute("src");
    document.querySelectorAll(".extra-game-view").forEach((el) => el.remove());
  }
  if (!inLobby && !classic) renderer.resize();
  $("players").innerHTML = Array.from({ length: 4 }, (_, i) =>
    playerMarkup(
      state.players.find((p) => p.slot === i),
      i,
    ),
  ).join("");
  for (const button of document.querySelectorAll("[data-remove]"))
    button.onclick = () =>
      socket.emit("remove", { slot: Number(button.dataset.remove) });
  const connected = state.players.filter((p) => p.connected),
    ready = connected.filter((p) => p.ready);
  $("player-count").textContent = `${connected.length} / 4`;
  $("crew-hint").textContent = ready.length
    ? `${ready.length} ready · good things incoming`
    : "Scan to claim your color";
  const minHumans = state.setup?.mode === "multiplayer" ? 2 : 1;
  $("start").disabled = ready.length < minHumans;
  $("match-mode").value = state.setup?.mode || "auto";
  $("cpu-count").value = Number.isInteger(state.setup?.cpuCount)
    ? String(state.setup.cpuCount)
    : "auto";
  $("race-laps").value = String(state.setup?.laps || 1);
  $("golf-holes").value = String(state.setup?.holes || 3);
  $("crew-rotation").value = state.setup?.rotation || "winner";
  $("slice-variant").value = state.setup?.variant || "co-op";
  $("cpu-field").hidden = !["mario-kart", "golf"].includes(state.game);
  $("cpu-label").textContent =
    state.game === "golf" ? "Computer golfers" : "Computer racers";
  for (const option of $("cpu-count").options) {
    const n = Number(option.value);
    option.hidden = state.game === "golf" && n > 4;
    if (Number.isFinite(n) && n > 0)
      option.textContent =
        n === 7
          ? "Fill the grid"
          : `${n} ${state.game === "golf" ? "golfers" : "racers"}`;
  }
  $("laps-field").hidden = state.game !== "mario-kart";
  $("holes-field").hidden = state.game !== "golf";
  $("drawing-field").hidden = state.game !== "drawing";
  $("drawing-mode").value = state.setup?.drawing || "guess";
  $("variant-field").hidden = state.game !== "fruit-ninja";
  $("rotation-field").hidden = game.maxPlayers !== 2;
  for (const [i, id] of ["first", "second"].entries()) {
    $("pair-" + id + "-field").hidden =
      game.maxPlayers !== 2 || state.setup?.rotation !== "pick";
    const select = $("pair-" + id),
      selected = state.setup?.pair?.[i] ?? ready[i]?.slot;
    select.replaceChildren(
      ...ready.map((p) => {
        const option = document.createElement("option");
        option.value = p.slot;
        option.textContent = p.name;
        return option;
      }),
    );
    select.value = String(selected);
  }
  if (
    game.maxPlayers === 2 &&
    state.setup?.rotation === "pick" &&
    $("pair-first").value === $("pair-second").value
  )
    $("start").disabled = true;
  $("game-grip").textContent = game.icon;
  $("game-how-title").textContent = game.verb;
  $("game-how-detail").textContent = game.detail;
  $("start-hint").textContent =
    ready.length < minHumans && state.setup?.mode === "multiplayer"
      ? "Waiting for at least two ready players."
      : state.autoStart === false
        ? "Pick your next game, or play this one again."
        : connected.length
          ? ready.length === connected.length
            ? "Everyone’s in. Here we go!"
            : "We’ll start as soon as everyone finds their balance."
          : "Choose a game. We’ll start when everyone is ready.";
  for (const card of document.querySelectorAll("[data-game]")) {
    const selected = card.dataset.game === state.game;
    card.classList.toggle("selected", selected);
    card.setAttribute("aria-pressed", String(selected));
  }
  $("arena").dataset.count = String(state.active.length);
  $("arena-title").textContent = game.title;
  $("instruction").textContent = game.verb;
  $("instruction-detail").textContent = game.detail;
  $("phase-label").textContent = {
    lobby: "THE GAME ROOM",
    practice: "FIND YOUR RHYTHM · PRACTICE",
    countdown: "READY WHEN YOU ARE",
    playing: "MAKE YOUR MOVE",
    results: "THAT WAS A GOOD ONE",
  }[state.phase];
  $("round-status").textContent =
    state.phase === "practice"
      ? "Try a little tilt. This round is just for practice."
      : state.players.length === 1
        ? `Solo challenge · aim for ${game.target} points`
        : "A little friendly competition. A lot of good moves.";
  $("scoreboard").innerHTML = state.players
    .filter((p) => state.active.includes(p.slot))
    .map(
      (p) =>
        `<div class="score-pill" style="--player:${p.color}"><span>${p.name}${!p.connected ? " · reconnecting" : ""}</span><b>${p.score}</b></div>`,
    )
    .join("");
  if (state.phase === "results") results();
  else if ($("results").open) $("results").close();
  if (previousPhase !== state.phase) {
    if (state.phase === "lobby") renderer.clear();
    if (state.phase === "playing") beep(880);
    previousPhase = state.phase;
  }
});
setInterval(() => {
  if (!state) return;
  const remaining = Math.max(
    0,
    Math.ceil((state.endsAt - Date.now() - offset) / 1000),
  );
  $("timer").innerHTML =
    `${state.phase === "playing" ? String(remaining).padStart(2, "0") : state.phase === "practice" ? remaining : "60"}<span>${state.phase === "practice" ? "WARM UP" : "SECONDS"}</span>`;
  $("countdown").hidden = state.phase !== "countdown";
  $("countdown").textContent = remaining || "GO";
  if (state.phase === "countdown" && lastBeep !== remaining) {
    beep(remaining ? 500 : 880);
    lastBeep = remaining;
  }
  $("next-round").textContent =
    `Another round starts in ${remaining}s. Same phones, new chances.`;
}, 100);
for (const id of [
  "match-mode",
  "cpu-count",
  "race-laps",
  "golf-holes",
  "crew-rotation",
  "slice-variant",
  "drawing-mode",
  "pair-first",
  "pair-second",
])
  $(id).onchange = () =>
    socket.emit("setup", {
      mode: $("match-mode").value,
      cpuCount:
        $("cpu-count").value === "auto" ? null : Number($("cpu-count").value),
      laps: Number($("race-laps").value),
      holes: Number($("golf-holes").value),
      rotation: $("crew-rotation").value,
      pair: [$("pair-first").value, $("pair-second").value].map(Number),
      variant: $("slice-variant").value,
      drawing: $("drawing-mode").value,
    });
$("start").onclick = () => socket.emit("start");
$("again").onclick = () => socket.emit("start");
$("choose-game").onclick = $("back").onclick = () => socket.emit("lobby");
$("invite").onclick = () => $("invite-dialog").showModal();
$("close-invite").onclick = () => $("invite-dialog").close();
$("results").addEventListener("cancel", (e) => {
  e.preventDefault();
  socket.emit("lobby");
});
$("sound").onclick = () => {
  sound = !sound;
  $("sound").setAttribute(
    "aria-label",
    sound ? "Turn sound off" : "Turn sound on",
  );
  $("sound").style.background = sound ? "#e8e0ff" : "";
  beep();
};
$("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast("Fullscreen isn’t available in this browser.");
  }
};
$("copy-link").onclick = async () => {
  if (!pairing) return;
  try {
    await navigator.clipboard.writeText(pairing.url);
    toast("Invite link copied. Bring a friend.");
  } catch {
    toast(pairing.url);
  }
};

$("classic-back").onclick = () => socket.emit("lobby");
$("classic-invite").onclick = () => $("invite-dialog").showModal();
$("next-player").onclick = () => socket.emit("next-player");
window.addEventListener("message", (event) => {
  if (
    event.origin !== location.origin ||
    ![...document.querySelectorAll("#classic-frame,.extra-game-view")].some(
      (f) => f.contentWindow === event.source,
    )
  )
    return;
  if (event.data?.type === "funcaster:home") socket.emit("lobby");
  if (event.data?.type === "funcaster:loaded") $("classic-loading").hidden = true;
  if (event.data?.type === "funcaster:error") {
    toast(String(event.data.message));
    socket.emit("lobby");
  }
});

$("pause-game").onclick = () => socket.emit("pause");
const playlists = {
  quick: ["star-catch", "bubble-burst", "fruit-ninja"],
  sports: ["golf", "table-tennis", "swordplay"],
  race: ["mario-kart", "neon-drift", "kart"],
};
$("party-playlist").onchange = () => {
  const playlist = playlists[$("party-playlist").value] || [];
  socket.emit("setup", { ...state.setup, playlist });
  if (playlist.length) socket.emit("select", { game: playlist[0] });
};
function downloadRecord(matchId) {
  if (!matchId) return;
  socket.timeout(5000).emit("record", { matchId }, (error, record) => {
    if (error) return toast("Couldn’t reach this round. Try again.");
    if (record.error) return toast(record.error);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `funcaster-${matchId}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
$("save-result").onclick = () => downloadRecord(state.result?.matchId);
$("save-history").onclick = () => downloadRecord($("record-history").value);
for (const id of ["party-volume", "reduced-effects"]) {
  try {
    $(id)[id === "party-volume" ? "value" : "checked"] =
      JSON.parse(localStorage.getItem("funcaster." + id)) ??
      (id === "party-volume" ? 70 : false);
  } catch {}
  $(id).onchange = () => {
    const value = id === "party-volume" ? Number($(id).value) : $(id).checked;
    localStorage.setItem("funcaster." + id, JSON.stringify(value));
    document.documentElement.classList.toggle(
      "gentle-effects",
      $("reduced-effects").checked,
    );
    renderer.motion = !$("reduced-effects").checked;
  };
}
