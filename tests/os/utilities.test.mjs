import test from "node:test";
import assert from "node:assert/strict";
import { createStorage } from "../../public/os/storage.js";
import { createStore } from "../../public/os/util/store.js";
import { open as players } from "../../public/os/windows/players.js";
import { open as invite } from "../../public/os/windows/invite.js";
import { open as settings } from "../../public/os/windows/settings.js";
import { open as playlists } from "../../public/os/windows/playlists.js";
import { open as records } from "../../public/os/windows/records.js";
import { open as recycle } from "../../public/os/windows/recycle-bin.js";
import { open as help } from "../../public/os/windows/help.js";
import { open as diagnostics } from "../../public/os/windows/diagnostics.js";
import { open as staff } from "../../public/os/windows/staff.js";

class Node {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.attrs = {};
    this.handlers = new Map();
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.textContent = "";
    this.id = "";
    this.checked = false;
    this.tabIndex = 0;
    this.style = { setProperty() {} };
    this.classList = { add() {}, remove() {} };
  }
  append(...children) {
    for (const child of children.flat()) {
      if (child && typeof child === "object") child.parent = this;
      this.children.push(child);
    }
  }
  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  getAttribute(k) {
    return this.attrs[k] ?? null;
  }
  removeAttribute(k) {
    delete this.attrs[k];
  }
  addEventListener(k, fn) {
    if (!this.handlers.has(k)) this.handlers.set(k, []);
    this.handlers.get(k).push(fn);
  }
  removeEventListener() {}
  async send(type) {
    if (this.disabled) return;
    await Promise.all(
      (this.handlers.get(type) || []).map((fn) =>
        fn({ target: this, preventDefault() {}, stopPropagation() {} }),
      ),
    );
  }
  click() {
    return this.send("click");
  }
  focus() {
    document.activeElement = this;
  }
  contains(target) {
    return this === target || this.children.some((c) => c?.contains?.(target));
  }
}
const all = (root) => [
  root,
  ...root.children.filter((c) => c && typeof c === "object").flatMap(all),
];
const byId = (view, id) => {
  const node = all(view.el).find((n) => n.dataset.id === id);
  assert.ok(node, `missing ${id}`);
  return node;
};
const visible = (node) =>
  !node.hidden && (!node.parent || visible(node.parent));
function fixture(t, patch = {}) {
  const views = [];
  const original = new Map(
    ["document", "location", "fetch"].map((k) => [
      k,
      Object.getOwnPropertyDescriptor(globalThis, k),
    ]),
  );
  t.after(() => {
    views.forEach((view) => view.destroy());
    for (const [k, v] of original) {
      if (v) Object.defineProperty(globalThis, k, v);
      else delete globalThis[k];
    }
  });
  globalThis.document = {
    createElement: (tag) => new Node(tag),
    addEventListener() {},
    removeEventListener() {},
    activeElement: null,
  };
  globalThis.location = { origin: "https://console.test" };
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: true, buildId: "build-1" }),
  });
  const calls = [],
    storage = createStorage(),
    store = createStore({
      connection: "connected",
      identity: { code: "ABCDEF", displayToken: "display-key" },
      serverOffset: 0,
      pairing: {
        url: "https://console.test/controller?room=ABCDEF",
        qr: "data:image/png;base64,AAA",
      },
      displays: [],
      room: {
        code: "ABCDEF",
        arcade: true,
        phase: "lobby",
        operatingMode: "party",
        hostSeat: 0,
        players: [0, 1, 2, 3].map((slot) => ({
          slot,
          name: `Player ${slot + 1}`,
          connected: true,
          ready: true,
        })),
        removedPlayers: [],
        ...patch,
      },
    });
  const session = Object.fromEntries(
    [
      "hostAssign",
      "remove",
      "nextPlayer",
      "assignSeat",
      "revokeView",
      "remoteConfigure",
      "arcadeConfigure",
      "restorePlayer",
      "retryPairing",
      "setup",
      "select",
      "record",
    ].map((name) => [
      name,
      async (...args) => {
        calls.push([name, ...args]);
        return { ok: true };
      },
    ]),
  );
  session.select = (...args) => {
    calls.push(["select", ...args]);
    return { ok: true };
  };
  session.cmd = async (...args) => {
    calls.push(["cmd", ...args]);
    return {
      ok: true,
      metrics: { joins: 4, rounds: 3, completed: 2, forfeits: 1 },
    };
  };
  const ctx = {
    demo: false,
    store,
    storage,
    settings: {
      volume: 70,
      tvScale: "auto",
      safeArea: 0,
      skin: "luna",
      gentle: false,
    },
    window: { body: new Node("div") },
    getSession: () => session,
    openWindow: async (id) => calls.push(["window", id]),
    openGame: async (id) => calls.push(["game", id]),
    wm: {
      modal: async (props) => {
        calls.push(["confirm", props]);
        return "confirm";
      },
    },
    pointers: {
      model: { sensitivity: 1 },
      setSensitivity(value) {
        this.model.sensitivity = value;
      },
    },
    applySettings(next) {
      Object.assign(this.settings, next);
      calls.push(["settings", next]);
    },
  };
  const open = (fn) => {
    const view = fn(ctx);
    views.push(view);
    return view;
  };
  return { ctx, calls, store, storage, open };
}

test("Players reflects grants and dispatches only the selected seat actions", async (t) => {
  const f = fixture(t),
    view = f.open(players);
  await byId(view, "host-1").click();
  assert.deepEqual(f.calls.at(-1), ["hostAssign", 1]);
  f.store.set({ room: { ...f.store.get().room, hostSeat: 1 } });
  view.update(f.store.get());
  await byId(view, "host-1").click();
  assert.deepEqual(f.calls.at(-1), ["hostAssign", null]);
  await byId(view, "remove-2").click();
  assert.deepEqual(f.calls.at(-1), ["remove", 2]);
  f.store.set({ connection: "reconnecting" });
  view.update(f.store.get());
  assert.ok(byId(view, "remove-2").disabled);
});

test("Invite hides unadvertised remote controls, encodes the display invitation and retries only this room", async (t) => {
  const f = fixture(t),
    view = f.open(invite);
  assert.equal(visible(byId(view, "remote-views")), false);
  assert.equal(
    new URL(byId(view, "second-screen").href).searchParams.get("key"),
    "display-key",
  );
  byId(view, "pairing-code").value = "WRONG1";
  await byId(view, "confirm-qr").click();
  assert.equal(f.calls.length, 0);
  byId(view, "pairing-code").value = "abcdef";
  await byId(view, "confirm-qr").click();
  assert.deepEqual(f.calls.at(-1), ["retryPairing"]);
  f.store.set({ room: { ...f.store.get().room, remoteViews: false } });
  view.update(f.store.get());
  assert.equal(visible(byId(view, "remote-views")), true);
});

test("Settings applies view preferences and confirms a six-digit PIN replacement without persisting it", async (t) => {
  const f = fixture(t),
    view = f.open(settings);
  byId(view, "settings-volume").value = "35";
  await byId(view, "settings-volume").send("input");
  assert.equal(f.ctx.settings.volume, 35);
  await byId(view, "settings-cursor").click();
  await byId(view, "settings-cursor-glove").click();
  assert.equal(f.ctx.settings.cursorSkin, "glove");
  await byId(view, "settings-cursor").click();
  await byId(view, "settings-cursor-arrow").click();
  assert.equal(f.ctx.settings.cursorSkin, "arrow");
  await byId(view, "settings-room-mode").click();
  await byId(view, "settings-room-mode-kiosk").click();
  await byId(view, "apply-room-mode").click();
  assert.equal(
    f.calls.some((c) => c[0] === "arcadeConfigure"),
    false,
  );
  byId(view, "settings-pin").value = "012345";
  await byId(view, "apply-room-mode").click();
  assert.deepEqual(
    f.calls.find((c) => c[0] === "arcadeConfigure"),
    ["arcadeConfigure", { mode: "kiosk", pin: "012345" }],
  );
  assert.equal(byId(view, "settings-pin").value, "");
  assert.equal(f.storage.read("pin"), null);
  assert.equal(
    f.calls.some((c) => c[0] === "confirm"),
    true,
  );
});

test("Run playlist awaits setup before select/open and stops when the server rejects it", async (t) => {
  const f = fixture(t),
    view = f.open(playlists);
  await byId(view, "playlist-race").click();
  await byId(view, "run-playlist").click();
  assert.deepEqual(
    f.calls.map((c) => c[0]),
    ["setup", "select", "game"],
  );
  assert.equal(f.calls[1][1], "mario-kart");
  f.calls.length = 0;
  f.ctx.getSession().setup = async () => ({ error: "Finish the round first" });
  await byId(view, "run-playlist").click();
  assert.equal(f.calls.length, 0);
});

test("Recycle Bin paginates large removals, confirms restore, and never restores into an occupied seat", async (t) => {
  const removedPlayers = Array.from({ length: 30 }, (_, i) => ({
    restoreId: `restore-${i}`,
    name: `Player ${i}`,
    expiresAt: Date.now() + 600000,
  }));
  const f = fixture(t, { removedPlayers }),
    view = f.open(recycle);
  assert.equal(
    all(view.el).filter((n) => n.dataset.id?.startsWith("restore-")).length,
    8,
  );
  await byId(view, "restore-restore-0").click();
  assert.deepEqual(f.calls.at(-1), ["restorePlayer", "restore-0"]);
  await byId(view, "removed-next").click();
  assert.ok(byId(view, "restore-restore-8"));
  assert.equal(
    f.calls.some((c) => c[0] === "assignSeat"),
    false,
  );
});

test("all utility windows keep fewer than forty available targets and safely render hostile labels", async (t) => {
  const f = fixture(t, {
    players: [
      {
        slot: 0,
        name: "<img src=x onerror=alert(1)>",
        ready: true,
        connected: true,
      },
    ],
    remoteViews: true,
  });
  f.storage.write(
    "records.ABCDEF",
    Array.from({ length: 20 }, (_, i) => ({
      matchId: `r${i}`,
      title: "<script>unsafe</script>",
      verification: "verified",
    })),
  );
  for (const factory of [
    players,
    invite,
    settings,
    playlists,
    records,
    recycle,
    help,
    diagnostics,
  ]) {
    const view = f.open(factory),
      nodes = all(view.el);
    assert.ok(
      nodes.filter((n) => "nav" in n.dataset && visible(n) && !n.disabled)
        .length <= 35,
      "reserve five window chrome targets",
    );
    assert.ok(!nodes.some((n) => n.tag === "script"));
  }
  await new Promise((resolve) => setImmediate(resolve));
});

test("utility actions recover after async completion and Staff uses the shared lifecycle", async (t) => {
  const f = fixture(t),
    view = f.open(diagnostics);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(byId(view, "diagnostics-health").disabled, false);
  await byId(view, "diagnostics-health").click();
  assert.equal(
    f.calls.filter((call) => call[0] === "cmd" && call[1] === "stats").length,
    2,
  );
  const staffView = f.open(staff);
  await byId(staffView, "staff-lock").click();
  assert.equal(byId(staffView, "staff-lock").disabled, false);
});
