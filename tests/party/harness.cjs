const http = require("node:http");
const { Server } = require("socket.io");
const { io: client } = require("socket.io-client");
const { attachParty } = require("../../server/party.cjs");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, name, payload = {}) =>
  new Promise((resolve, reject) =>
    s.timeout(1000).emit(name, payload, (e, r) => (e ? reject(e) : resolve(r))),
  );
async function fixture(t, options = {}) {
  let time = 100000;
  const server = http.createServer(),
    io = new Server(server),
    party = attachParty(io, { now: () => time, tickMs: 5, ...options });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const sockets = [];
  t.after(async () => {
    sockets.forEach((s) => s.disconnect());
    party.close();
    await new Promise((r) => io.close(r));
  });
  async function connect() {
    const s = client(`http://127.0.0.1:${server.address().port}/party`, {
      forceNew: true,
      transports: options.transports || ["websocket"],
      reconnection: false,
    });
    sockets.push(s);
    await new Promise((r, j) => {
      s.once("connect", r);
      s.once("connect_error", j);
    });
    return s;
  }
  return {
    io,
    party,
    connect,
    advance: async (ms) => {
      time += ms;
      await wait(20);
    },
  };
}

class FakePhone {
  constructor(fixture, code) {
    this.fixture = fixture;
    this.code = code;
    this.sequence = 0;
  }
  async join() {
    this.socket = await this.fixture.connect();
    this.identity = await emit(this.socket, "join", {
      code: this.code,
      token: this.identity?.token,
    });
    return this.identity;
  }
  ready() {
    this.socket.emit("ready", { ready: true, mode: "touch" });
  }
  sample(packet = {}) {
    this.socket.emit("input", {
      x: 0,
      y: 0,
      pulse: false,
      seq: ++this.sequence,
      ...packet,
    });
  }
  disconnect() {
    this.socket.disconnect();
  }
}
module.exports = { fixture, emit, wait, FakePhone };
