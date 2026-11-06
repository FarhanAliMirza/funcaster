"use strict";
const {
  createOutbox,
  createReceiptReader,
} = require("../../integrations/shared/outbox.mjs");
const { loadConfig } = require("../../integrations/shared/config.mjs");
function createWeb3({ config = loadConfig(), now = Date.now } = {}) {
  if (config.PARTNERS === "off") return null;
  const mock =
    config.PARTNERS === "mock"
      ? require("./mock.cjs").createMockProviders()
      : null;
  const identity = require("./identity.cjs").createIdentity({ config, now });
  const names = require("./names.cjs").createNames({ config, now });
  const states = new WeakMap(),
    results = new Map();
  let closed = false,
    workerUp = false,
    outboxDepth = 0;
  const rooms = new Map(),
    pending = new Map();
  const outbox = createOutbox(config.WEB3_DATA_DIR, { now });
  const reader = createReceiptReader(config.WEB3_DATA_DIR, {
    now,
    onReceipt(receipt) {
      const item = pending.get(receipt.id);
      if (!item || closed) return;
      pending.delete(receipt.id);
      const state = states.get(item.room);
      if (state && item.matchId)
        state.receipts[item.matchId] = {
          arc: null,
          arkiv: null,
          ens: null,
          state: "local",
          ...(receipt.mock ? { mock: true } : {}),
        };
      rooms.get(item.room.code)?.broadcast?.(item.room);
    },
    onHealth(value) {
      if (closed) return;
      workerUp = value.up;
      outboxDepth = value.depth;
      for (const { room, broadcast } of rooms.values()) {
        const state = states.get(room);
        if (state) state.health = health();
        broadcast?.(room);
      }
    },
  });
  function enqueue(room, input, matchId = null) {
    outbox
      .enqueue({ ...input, room: room.code })
      .then((job) => {
        if (!closed) pending.set(job.id, { room, matchId });
      })
      .catch(() => {
        const state = states.get(room);
        if (state && matchId)
          state.receipts[matchId] = {
            arc: null,
            arkiv: null,
            ens: null,
            state: "local",
          };
        rooms.get(room.code)?.broadcast?.(room);
      });
  }
  const health = () =>
    Object.fromEntries(
      ["ens", "arc", "arkiv"].map((p) => [
        p,
        config[`WEB3_${p.toUpperCase()}`] === "off"
          ? "off"
          : config[`WEB3_${p.toUpperCase()}`] === "mock"
            ? workerUp
              ? "ok"
              : "down"
            : "down",
      ]),
    );
  function initial(room) {
    return {
      mode: config.PARTNERS,
      health: health(),
      party: { status: "pending", name: null, expiresAt: null, explorer: null },
      seats: [],
      host: { slot: null, authorised: false, roles: [], revocable: false },
      stakes: mock?.pot.initial() || {
        rung: 0,
        status: "off",
        playMoney: true,
      },
      receipts: {},
    };
  }
  function view(room) {
    const state = states.get(room) || initial(room);
    return {
      web3: {
        ...structuredClone(state),
        seats: room.players.filter(Boolean).map((p) => ({
          slot: p.slot,
          label: p.displayName || null,
          name: null,
          addr: p.address
            ? `${p.address.slice(0, 6)}…${p.address.slice(-4)}`
            : null,
          named: false,
        })),
      },
    };
  }
  function tick(room, time, broadcast) {
    if (closed) return;
    rooms.set(room.code, { room, broadcast });
    if (!states.has(room)) {
      const state = initial(room);
      if (mock && config.WEB3_ENS === "mock")
        state.party = mock.naming.party(room);
      else if (config.WEB3_ENS === "on") state.party.status = "failed";
      states.set(room, state);
      if (config.WEB3_ENS !== "off")
        enqueue(room, {
          type: "ens.party.open",
          idempotencyKey: `ens.party.open:${room.created}:${room.code}`,
          payload: { name: state.party.name },
        });
      broadcast?.(room);
    }
  }
  function finish(room, record) {
    if (closed) return;
    const state = states.get(room) || initial(room);
    states.set(room, state);
    // Keep canonical game data separate: never mutate the record or its hash.
    if (record?.result?.hash) {
      results.set(record.result.hash, record.result);
      if (config.WEB3_ENS !== "off")
        enqueue(
          room,
          {
            type: "ens.record.set",
            idempotencyKey: `ens.record.set:${record.result.hash}`,
            payload: { result: record.result },
          },
          record.result.matchId,
        );

      if (results.size > 2000) results.delete(results.keys().next().value);
      state.receipts[record.result.matchId] = mock?.records.finish() || {
        arc: null,
        arkiv: null,
        ens: null,
        state: "local",
      };
    }
  }
  const { router, potRouter } = require("./router.cjs").createRouter({
    config,
    health: () => ({
      ok: config.PARTNERS === "mock" && workerUp,
      providers: health(),
      worker: workerUp ? "up" : "down",
      outboxDepth: outboxDepth + outbox.pending,
    }),
    getResult: (value) => results.get(value),
    getPot: (id) => {
      for (const { room } of rooms.values()) {
        const stakes = states.get(room)?.stakes;
        if (stakes?.potId?.toLowerCase() === id.toLowerCase())
          return structuredClone(stakes);
      }
      return null;
    },
  });
  return {
    router,
    potRouter,
    view,
    bind(socket, membership, broadcast) {
      identity.bind(socket, membership, broadcast);
      names.bind(socket, membership, broadcast);
    },
    joined: identity.joined,
    release(p) {
      identity.release(p);
      names.release(p);
    },
    tick,
    finish,
    end(room) {
      rooms.delete(room.code);
      for (const [id, item] of pending)
        if (item.room === room) pending.delete(id);
      states.delete(room);
    },
    startReason() {
      return null;
    },
    close() {
      closed = true;
      reader.close();
      rooms.clear();
      pending.clear();
      results.clear();
      return outbox.close();
    },
  };
}
module.exports = { createWeb3 };
