const make = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};
export function mountHostAdmin(socket) {
  let state,
    seq = Date.now(),
    modeDirty = false,
    hostDirty = false,
    hostSignature = "";
  const consent = make("aside", null, "host-consent"),
    copy = make("span"),
    veto = make("button", "Keep controls on TV", "secondary-button");
  consent.hidden = true;
  consent.append(copy, veto);
  document.body.append(consent);
  veto.onclick = () => socket.emit("host.assign", { slot: null });
  const panel = make("details", null, "party-extras arcade-tools"),
    summary = make("summary", "Booth & host controls"),
    body = make("div", null, "extras-content"),
    status = make("p", null, "admin-message"),
    form = make("form"),
    modeLabel = make("label", "Operating mode"),
    mode = make("select"),
    pinLabel = make("label", "Six-digit staff PIN (required for Kiosk)"),
    pin = make("input"),
    apply = make("button", "Apply mode", "secondary-button"),
    hostLabel = make("label", "Phone host"),
    host = make("select"),
    assign = make("button", "Assign host", "secondary-button"),
    lock = make("button", "Lock new joins", "secondary-button"),
    metrics = make("button", "Event stats", "secondary-button"),
    stats = make("pre"),
    board = make("ol"),
    queue = make("p");
  for (const [value, label] of [
    ["party", "Party · phone host"],
    ["kiosk", "Kiosk · staff only"],
  ]) {
    const o = make("option", label);
    o.value = value;
    mode.append(o);
  }
  modeLabel.append(mode);
  pin.type = "password";
  pin.inputMode = "numeric";
  pin.maxLength = 6;
  pin.autocomplete = "new-password";
  pinLabel.append(pin);
  form.append(modeLabel, pinLabel, apply);
  hostLabel.append(host);
  body.append(
    form,
    hostLabel,
    assign,
    lock,
    queue,
    make("h3", "This game’s leaderboard"),
    board,
    metrics,
    stats,
    status,
  );
  panel.append(summary, body);
  document.body.append(panel);
  function command(cmd, args = {}) {
    socket
      .timeout(5000)
      .emit("host.cmd", { seq: ++seq, cmd, args }, (error, r) => {
        status.textContent = error ? "Connection lost." : r?.error || "";
        if (cmd === "stats" && r?.ok) {
          const m = r.metrics;
          stats.textContent = `${m.joins} joins · ${m.completed} completed rounds · ${m.forfeits} forfeits${m.storageError ? "\n" + m.storageError : ""}`;
        }
      });
  }
  mode.onchange = () => {
    modeDirty = true;
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    socket.timeout(5000).emit(
      "arcade.configure",
      {
        enabled: true,
        mode: mode.value,
        ...(pin.value ? { pin: pin.value } : {}),
      },
      (error, r) => {
        pin.value = "";
        if (r?.ok) modeDirty = false;
        status.textContent = error
          ? "Connection lost."
          : r?.error || "Mode updated.";
      },
    );
  };
  host.onchange = () => {
    hostDirty = true;
  };
  assign.onclick = () =>
    socket.emit(
      "host.assign",
      { slot: host.value === "" ? null : Number(host.value) },
      (r) => {
        if (r?.ok) hostDirty = false;
        status.textContent = r?.error || "Host updated.";
      },
    );
  lock.onclick = () => command("lock", { locked: !state?.locked });
  metrics.onclick = () => command("stats");
  const remoteButton = make(
      "button",
      "Enable remote screens",
      "secondary-button",
    ),
    remoteList = make("div", null, "admin-remote-list");
  const extend = make("button", "Add a little time", "secondary-button");
  extend.onclick = () => command("extend");
  document.getElementById("pause-game").after(extend);
  body.append(remoteButton, remoteList);
  remoteButton.hidden = true;
  remoteButton.onclick = () =>
    socket.emit("remote.configure", { enabled: !state?.remoteViews }, (r) => {
      status.textContent = r?.error || "Remote setting updated.";
    });
  let displaySignature = "";
  socket.on("displays", (list) => {
    const signature = JSON.stringify(list);
    if (signature === displaySignature) return;
    displaySignature = signature;
    remoteList.replaceChildren();
    for (const d of list) {
      const row = make("div", null, "admin-remote-row");
      const label = make(
        "span",
        `${d.label} · ${d.connected ? (d.ready ? "ready" : "tap Ready on screen") : "offline"}`,
      );
      row.append(label);
      if (d.slot !== null) {
        label.append(
          make(
            "span",
            ` · ${state?.players.find((p) => p.slot === d.slot)?.name || "player"}`,
          ),
        );
        const back = make("button", "Bring back to TV", "text-button");
        back.onclick = () => socket.emit("revoke-view", { slot: d.slot });
        row.append(back);
      }
      remoteList.append(row);
    }
  });
  socket.on("state", (s) => {
    remoteButton.hidden = s.remoteViews === undefined;
    remoteButton.disabled =
      s.operatingMode === "kiosk" || !["lobby", "results"].includes(s.phase);
    remoteButton.textContent = s.remoteViews
      ? "Turn remote screens off"
      : "Enable remote screens";
    state = s;
    panel.hidden = !["lobby", "results"].includes(s.phase);
    extend.hidden = s.phase !== "classic";
    extend.disabled = s.paused || s.extensions >= 2;
    extend.textContent =
      s.game === "golf" ? "Add 30 seconds to this turn" : "Add 60 seconds";
    consent.hidden = !s.pendingHost;
    if (s.pendingHost) {
      const player = s.players.find((p) => p.slot === s.pendingHost.slot);
      copy.textContent = `${player?.name || "A player"} gets party controls in ${Math.max(0, Math.ceil((s.pendingHost.until - s.serverTime) / 1000))}s.`;
    }
    const waiting = ["lobby", "results"].includes(s.phase);
    apply.disabled = !waiting;
    mode.disabled = !waiting;
    pin.disabled = !waiting;
    if (!modeDirty) mode.value = s.operatingMode || "party";
    lock.textContent = s.locked ? "Unlock new joins" : "Lock new joins";
    assign.disabled = s.operatingMode === "kiosk";
    const nextSignature = JSON.stringify([
      s.hostSeat,
      s.players.map((p) => [p.slot, p.ready, p.connected]),
    ]);
    if (nextSignature !== hostSignature) {
      hostSignature = nextSignature;
      const selected = host.value;
      host.replaceChildren();
      const none = make("option", "TV only / revoke");
      none.value = "";
      host.append(none);
      for (const p of s.players.filter((p) => p.connected && p.ready)) {
        const o = make("option", `${p.shape || "●"} ${p.name}`);
        o.value = p.slot;
        host.append(o);
      }
      host.value =
        hostDirty && [...host.options].some((o) => o.value === selected)
          ? selected
          : String(s.hostSeat ?? "");
    }
    queue.textContent = s.kioskStartsAt
      ? `Next round in ${Math.max(0, Math.ceil((s.kioskStartsAt - s.serverTime) / 1000))}s · ${s.queueCount} waiting`
      : `${s.queueCount || 0} visitors waiting${s.hostSeat != null ? " · " + s.players.find((p) => p.slot === s.hostSeat)?.name + " is host" : ""}`;
    board.replaceChildren();
    for (const entry of s.leaderboard || [])
      board.append(make("li", `${entry.name} · ${entry.score}`));
    if (!board.children.length)
      board.append(make("li", "The first score is yours to set."));
  });
}
