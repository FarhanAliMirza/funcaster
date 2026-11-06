"use strict";
// Standalone, loopback-only S3 laboratory. No party grants or production records.
const express = require("express"),
  http = require("node:http"),
  path = require("node:path"),
  { randomBytes } = require("node:crypto"),
  { Server } = require("socket.io"),
  { InputSequencer } = require("../core/lockstep-spike.js");
const app = express(),
  server = http.createServer(app),
  io = new Server(server, { maxHttpBufferSize: 8192 }),
  rooms = new Map(),
  root = path.join(__dirname, "..");
app.get("/", (_q, r) =>
  r.sendFile(path.join(root, "public/lockstep-lab.html")),
);
app.get("/lab.js", (_q, r) =>
  r.sendFile(path.join(root, "public/party/lockstep-lab.js")),
);
for (const folder of ["core", "games/mario-kart", "games/shared"])
  app.use(
    "/" + folder,
    (q, r, next) => (q.path.endsWith(".js") ? next() : r.sendStatus(404)),
    express.static(path.join(root, folder)),
  );
io.on("connection", (socket) => {
  let room,
    role,
    seat,
    lastInput = 0;
  socket.on("create", (_, ack) => {
    if (typeof ack !== "function" || room) return;
    if (rooms.size >= 8) return ack({ error: "Eight labs are already open." });
    const code = randomBytes(4).toString("hex").toUpperCase();
    room = {
      code,
      owner: socket.id,
      screens: new Set([socket.id]),
      phones: new Map(),
      created: Date.now(),
      run: 0,
    };
    rooms.set(code, room);
    role = "screen";
    socket.join(code);
    ack({ code });
  });
  socket.on("join", (data, ack) => {
    if (typeof ack !== "function" || room) return;
    const r = rooms.get(String(data?.code || "").toUpperCase());
    if (!r) return ack({ error: "Lab not found." });
    if (data.role === "phone") {
      if (r.phones.size >= 2)
        return ack({ error: "Two phones are already joined." });
      seat = [0, 1].find((n) => ![...r.phones.values()].includes(n));
      r.phones.set(socket.id, seat);
      role = "phone";
    } else {
      if (r.screens.size >= 2)
        return ack({ error: "Two screens are already joined." });
      r.screens.add(socket.id);
      role = "screen";
    }
    room = r;
    socket.join(r.code);
    ack({ code: r.code, seat });
    if (r.seq) socket.emit("begin", { seed: r.seed, run: r.run });
  });
  socket.on("start", () => {
    if (
      !room ||
      room.owner !== socket.id ||
      Date.now() - (room.started || 0) < 3000
    )
      return;
    room.seq = new InputSequencer();
    room.hashes = new Map();
    room.seed = 381 + room.run++;
    room.started = Date.now();
    io.to(room.code).emit("begin", { seed: room.seed, run: room.run });
  });
  socket.on("input", (data) => {
    if (role !== "phone" || !room?.seq || Date.now() - lastInput < 25) return;
    lastInput = Date.now();
    room.seq.input(seat, data || {}, Date.now());
  });
  socket.on("recover", (from, ack) => {
    if (
      typeof ack === "function" &&
      role === "screen" &&
      room?.seq &&
      Number.isInteger(from) &&
      from >= 0
    )
      ack(room.seq.frames.slice(from, from + 240));
  });
  socket.on("hash", (data) => {
    if (
      role !== "screen" ||
      !room?.seq ||
      !Number.isInteger(data?.tick) ||
      data.tick < 0 ||
      data.tick > room.seq.tick ||
      !/^([a-f0-9]{8})$/.test(data.hash)
    )
      return;
    const key = data.tick,
      rows = room.hashes.get(key) || new Map();
    rows.set(socket.id, data.hash);
    room.hashes.set(key, rows);
    if (rows.size === 2)
      io.to(room.code).emit("comparison", {
        tick: key,
        equal: new Set(rows.values()).size === 1,
      });
    if (room.hashes.size > 600)
      room.hashes.delete(room.hashes.keys().next().value);
  });
  socket.on("disconnect", () => {
    if (!room) return;
    room.screens.delete(socket.id);
    room.phones.delete(socket.id);
    if (room.owner === socket.id) {
      io.to(room.code).emit("ended");
      rooms.delete(room.code);
    }
  });
});
setInterval(() => {
  for (const r of rooms.values()) {
    if (Date.now() - r.created > 900000) {
      io.to(r.code).emit("ended");
      rooms.delete(r.code);
      continue;
    }
    if (r.seq) {
      const target = Math.min(
        36000,
        Math.floor(((Date.now() - r.started) * 60) / 1000),
      );
      let sent = 0;
      while (r.seq.tick < target && sent++ < 12) {
        const f = r.seq.next(Date.now());
        if (f) io.to(r.code).emit("frame", f);
      }
    }
  }
}, 8).unref();
server.listen(Number(process.env.LAB_PORT) || 8667, "127.0.0.1", () =>
  console.log(
    "Lockstep spike: http://127.0.0.1:" +
      server.address().port +
      " · loopback only · Ctrl+C to stop. For real phones use an explicitly configured HTTPS proxy to this lab; this is not the production party server.",
  ),
);
