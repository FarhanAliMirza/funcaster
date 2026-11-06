"use strict";
const { gameById, sharedWorld } = require("../core/catalog.js");
const { SEATS } = require("../core/seats.js");
function createRemote({
  ns,
  now,
  buildId,
  equal,
  token,
  broadcast,
  presence,
  independent,
}) {
  function init(room) {
    room.remote = {
      enabled: false,
      records: new Map(),
      seats: new Map(),
      views: new Map(),
      gate: null,
    };
  }
  const live = (r) => r && r.socket && ns.sockets.has(r.socket);
  function state(room) {
    const r = room.remote;
    if (!r) return {};
    return {
      remoteViews: r.enabled,
      screenPairings: [...r.seats].map(([slot, ref]) => ({
        slot,
        ref,
        label: r.records.get(ref)?.label || "Remote screen",
        ready: !!r.records.get(ref)?.ready,
      })),
      seatViews: [...r.views].map(([view, v]) => ({
        view,
        slot: v.slot,
        where:
          v.state === "revoked"
            ? "host"
            : v.state === "registered"
              ? "remote"
              : v.state === "lost"
                ? "lost"
                : "pending",
        label: r.records.get(v.ref)?.label || "Remote screen",
      })),
      gate: !!r.gate,
    };
  }
  function publish(room) {
    const r = room.remote;
    if (!r) return;
    ns.to(room.host).emit(
      "displays",
      [...r.records.values()].map((d) => ({
        ref: d.ref,
        label: d.label,
        connected: !!live(d),
        ready: d.ready,
        slot: [...r.seats].find(([, ref]) => ref === d.ref)?.[0] ?? null,
      })),
    );
  }
  function register(room, socket, data) {
    const r = room.remote;
    if (!r) return { ok: true };
    if (buildId && data.buildId !== buildId)
      return { error: "Reload this screen to update.", update: true };
    let d = [...r.records.values()].find((d) =>
      equal(d.resumeKey, data.resumeKey),
    );
    if (!d) {
      if (r.records.size >= 8)
        return { error: "Eight screens are already paired." };
      d = {
        ref: token().slice(0, 12),
        resumeKey: token(),
        label: `Screen ${String.fromCharCode(65 + r.records.size)}`,
        ready: false,
      };
      r.records.set(d.ref, d);
    }
    if (d.socket && d.socket !== socket.id)
      ns.sockets.get(d.socket)?.disconnect(true);
    d.socket = socket.id;
    d.lostAt = 0;
    socket.data.screenRef = d.ref;
    publish(room);
    return { ok: true, ref: d.ref, resumeKey: d.resumeKey };
  }
  function pairError(room, slot, ref) {
    const r = room.remote;
    if (!r?.enabled) return "Remote play is off in this room.";
    const d = r.records.get(ref);
    if (!live(d)) return "That screen is no longer connected.";
    if ([...r.seats].some(([s, x]) => s !== slot && x === ref))
      return "This screen already has a player.";
    if (!["lobby", "results"].includes(room.phase) && r.seats.get(slot) !== ref)
      return "Pair this screen between rounds.";
    return null;
  }
  function pair(room, slot, ref) {
    const error = pairError(room, slot, ref);
    if (error) return error;
    const r = room.remote;
    r.seats.set(slot, ref);
    publish(room);
    return null;
  }
  function reason(room) {
    const r = room.remote;
    if (!r?.enabled) return null;
    for (const p of room.players.filter((p) => p?.socket && p.ready)) {
      const ref = r.seats.get(p.slot);
      if (!ref) continue;
      const d = r.records.get(ref);
      if (
        d?.webgl === false &&
        gameById(room.game).classic &&
        !sharedWorld(room.game, room.setup) &&
        room.game !== "drawing"
      )
        return `${d.label} needs WebGL to play this game. Try Star Catch, Bubble Burst or Neon Drift.`;
      if (!live(d) || !d.ready)
        return `Waiting for ${d?.label || "the remote screen"} to be ready`;
    }
    return null;
  }
  function prepare(room) {
    const r = room.remote;
    if (!r?.enabled || !independent(room)) return;
    r.views.clear();
    for (const [view, slot] of room.active.entries()) {
      const ref = r.seats.get(slot),
        d = r.records.get(ref);
      if (!ref || !live(d) || !d.ready) continue;
      const v = {
        view,
        slot,
        ref,
        secret: token(),
        state: "offered",
        acceptBy: now() + 15000,
        lostAt: 0,
        used: false,
      };
      r.views.set(view, v);
      ns.to(d.socket).emit("view-offer", {
        roundId: room.roundId,
        game: room.game,
        view,
        slot,
        ...SEATS[slot],
        token: v.secret,
        acceptBy: v.acceptBy,
      });
    }
    if (r.views.size)
      r.gate = {
        until: now() + 20000,
        duration: gameById(room.game).roundPolicy.hardCapMs,
      };
  }
  function authorize(room, data) {
    const r = room.remote;
    if (data.viewToken) {
      const v = [...(r?.views.values() || [])].find((v) =>
        equal(v.secret, data.viewToken),
      );
      if (
        !v ||
        !r.enabled ||
        !["accepted", "registered"].includes(v.state) ||
        (v.lostAt && now() - v.lostAt > 10000)
      )
        return { error: "This playing view has expired." };
      if (data.fresh && v.used)
        return {
          error: "A running view cannot restart. Wait for the next round.",
        };
      return { view: v.view, remote: true };
    }
    const view = independent(room) ? Number(data.view) : -1,
      v = r?.views.get(view);
    if (v && v.state !== "revoked")
      return { error: "That player is assigned to another screen." };
    return { view, remote: false };
  }
  function registered(room, view, isRemote) {
    const v = room.remote?.views.get(view);
    if (v && isRemote) {
      v.state = "registered";
      v.used = true;
      v.lostAt = 0;
    }
    tick(room, 0);
    broadcast(room);
  }
  function close(room) {
    if (!room.remote) return;
    room.remote.gate = null;
    for (const v of room.remote.views.values())
      ns.to(room.remote.records.get(v.ref)?.socket).emit("view-revoked");
    room.remote.views.clear();
  }
  function revoke(room, slot, outcome = "removed") {
    const r = room.remote;
    if (!r) return;
    const entry = [...r.views].find(([, v]) => v.slot === slot);
    if (entry) {
      const [view, v] = entry;
      v.secret = null;
      v.state = "revoked";
      const sid = room.screens.get(view);
      room.screens.delete(view);
      ns.sockets.get(sid)?.disconnect(true);
      ns.to(r.records.get(v.ref)?.socket).emit("view-revoked");
      if (!r.gate) {
        v.state = "lost";
        room.outcomes[slot] = outcome;
      }
    }
    r.seats.delete(slot);
    publish(room);
    broadcast(room);
  }
  function disconnect(room, role, socket, view) {
    const r = room.remote;
    if (!r) return;
    if (role === "display") {
      const d = r.records.get(socket.data.screenRef);
      if (d?.socket === socket.id) {
        d.socket = null;
        d.lostAt = now();
        d.ready = false;
      }
      publish(room);
    }
    if (role === "screen") {
      const v = r.views.get(view);
      if (v?.state === "registered") v.lostAt = now();
    }
  }
  function tick(room, elapsed) {
    const r = room.remote;
    if (!r) return;
    for (const [ref, d] of r.records) {
      if (
        !live(d) &&
        d.lostAt &&
        now() - d.lostAt > 120000 &&
        ![...r.seats.values()].includes(ref) &&
        ![...r.views.values()].some((v) => v.ref === ref)
      )
        r.records.delete(ref);
    }
    if (room.paused || !room.host) {
      if (r.gate) r.gate.until += elapsed;
      for (const v of r.views.values()) {
        v.acceptBy += elapsed;
        if (v.lostAt) v.lostAt += elapsed;
      }
      return;
    }
    for (const [view, v] of r.views) {
      if (
        r.gate &&
        v.state !== "revoked" &&
        ((v.state === "offered" && now() > v.acceptBy) ||
          (now() > r.gate.until && !room.screens.has(view)))
      ) {
        v.state = "revoked";
        v.secret = null;
        ns.to(r.records.get(v.ref)?.socket).emit("view-revoked");
        broadcast(room);
      }
      if (
        !r.gate &&
        v.state === "registered" &&
        v.lostAt &&
        now() - v.lostAt > 10000
      ) {
        v.state = "lost";
        v.secret = null;
        room.outcomes[v.slot] = "forfeit";
        broadcast(room);
      }
    }
    if (r.gate && now() > r.gate.until + 20000) {
      for (const [i, slot] of room.active.entries())
        if (!room.screens.has(i)) room.outcomes[slot] = "forfeit";
      room.endsAt = now();
      r.gate = null;
      broadcast(room);
      return;
    }
    if (
      r.gate &&
      room.phase === "classic" &&
      room.active.every((_, i) => room.screens.has(i))
    ) {
      room.endsAt = now() + r.gate.duration;
      r.gate = null;
      for (const [view, id] of room.screens)
        ns.to(id).emit("presence", presence(room, view));
      broadcast(room);
    }
  }
  function bind(socket, get) {
    socket.on("remote.configure", (data, ack = () => {}) => {
      const m = get();
      if (typeof ack !== "function") return;
      if (m?.role !== "host" || !m.room.remote)
        return ack({ error: "Remote play is unavailable." });
      const room = m.room;
      if (!["lobby", "results"].includes(room.phase))
        return ack({ error: "Wait until the round ends." });
      if (room.arcade?.mode === "kiosk")
        return ack({ error: "Remote play is off in Kiosk mode." });
      room.remote.enabled = data?.enabled === true;
      if (!room.remote.enabled) {
        close(room);
        room.remote.seats.clear();
      }
      broadcast(room);
      ack({ ok: true });
    });
    socket.on("display.ready", (data, ack = () => {}) => {
      const m = get();
      if (typeof ack !== "function") return;
      if (m?.role !== "display" || !m.room.remote)
        return ack({ error: "Open a display invite first." });
      const d = m.room.remote.records.get(socket.data.screenRef);
      if (d) {
        d.ready = data?.ready === true;
        if (typeof data?.webgl === "boolean") d.webgl = data.webgl;
        publish(m.room);
        broadcast(m.room);
      }
      ack({ ok: true });
    });
    socket.on("assign-seat", (data, ack = () => {}) => {
      const m = get();
      if (typeof ack !== "function") return;
      if (
        m?.role !== "host" ||
        !m.room.remote ||
        !["lobby", "results"].includes(m.room.phase)
      )
        return ack({
          error: "Only the main screen can reassign seats between rounds.",
        });
      if (!m.room.players[data?.slot])
        return ack({ error: "Choose a seated player." });
      if (data.ref === null) {
        revoke(m.room, data.slot);
        return ack({ ok: true });
      }
      const error = pair(m.room, data.slot, data.ref);
      broadcast(m.room);
      ack(error ? { error } : { ok: true });
    });
    for (const event of ["view-accept", "view-decline"])
      socket.on(event, (data, ack = () => {}) => {
        const m = get();
        if (typeof ack !== "function") return;
        if (m?.role !== "display" || data?.roundId !== m.room.roundId)
          return ack({ error: "That offer has expired." });
        const v = [...(m.room.remote?.views.values() || [])].find(
          (v) => v.ref === socket.data.screenRef && v.state === "offered",
        );
        if (!v || now() > v.acceptBy)
          return ack({ error: "That offer has expired." });
        v.state = event === "view-accept" ? "accepted" : "revoked";
        if (v.state === "revoked") v.secret = null;
        broadcast(m.room);
        ack({ ok: true });
      });
    socket.on("revoke-view", (data, ack = () => {}) => {
      const m = get();
      if (typeof ack !== "function") return;
      if (m?.role !== "host")
        return ack({ error: "Only the main screen can revoke a view." });
      revoke(m.room, data?.slot);
      ack({ ok: true });
    });
  }
  return {
    init,
    state,
    publish,
    register,
    pair,
    pairError,
    reason,
    prepare,
    authorize,
    registered,
    close,
    revoke,
    disconnect,
    tick,
    bind,
  };
}
module.exports = { createRemote };
