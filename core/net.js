import { buildId } from "./build-id.js";
import { FixedStep } from "./fixed-step.js";
import { encodeState, restoreState } from "./state.js";
/**
 * Client side of the relay protocol.
 *
 * Every sample carries a `slot` — the player index the server assigned to that
 * controller. Only slot 0 is used today, but games that read `slot` from the
 * start cost nothing now and don't need rewriting when a second phone appears.
 */
export class GameLink {
  constructor({ onOrientation, onCommand, onPresence } = {}) {
    // eslint-disable-next-line no-undef
    const params = new URLSearchParams(location.search);
    this.party =
      window.parent !== window &&
      /^[A-Z2-9]{6}$/.test(params.get("party") || "");
    this.socket = io(this.party ? "/party" : "/", {
      transports: ["websocket", "polling"],
    });
    if (this.party) {
      const slug = location.pathname.split("/")[2];
      const intro = document.querySelector("#panel > p");
      if (intro && slug === "alien-attack")
        intro.textContent =
          "Tilt your phone to dodge. Tap Start / Fire to blast the invaders.";
      if (intro && slug === "shooting-range")
        intro.textContent = "Tilt to aim. Tap Start / Fire on your phone.";
      const panel = document.getElementById("panel");
      const label =
        slug === "fruit-ninja"
          ? "Tap Start slicing on your phone"
          : "Tap Start / Fire on your phone";
      const refreshHint = () => {
        const cta = panel?.querySelector(".cta");
        if (cta && cta.textContent !== label) cta.textContent = label;
      };
      refreshHint();
      if (panel)
        new MutationObserver(refreshHint).observe(panel, {
          childList: true,
          subtree: true,
        });
      const grip = panel?.querySelector(".grip");
      if (grip)
        grip.textContent = "Hold comfortably. A little tilt is all it takes.";
      const keys = document.getElementById("keys");
      if (keys && slug === "fruit-ninja")
        keys.textContent =
          "Tilt to slice · Recenter on your phone · Game room above to switch games";
      if (keys && ["alien-attack", "shooting-range"].includes(slug))
        keys.textContent =
          "Tilt to aim · Tap Start / Fire on your phone · Game room above to switch games";
      if (keys && slug === "drawing")
        keys.textContent =
          "Tilt to draw · Tap Pen up / down on your phone · Choose colors on the big screen";
      if (keys && slug === "golf")
        keys.textContent =
          "Tilt to aim · hold and release on your phone · wait for your color";
      if (keys && slug === "table-tennis")
        keys.textContent =
          "Tilt to move your paddle · tap for a stronger return";
      if (keys && slug === "swordplay")
        keys.textContent =
          "Tilt to guard · tap to strike · keep your phone close";
      if (keys && slug === "kart")
        keys.textContent = "Tilt to steer · hold Accelerate · three Boosts";
      if (keys && slug === "island-flyover")
        keys.textContent =
          "Tilt to bank and climb · fly through the glowing rings";
    }
    if (this.party)
      document.addEventListener("click", (e) => {
        const home = e.target.closest('a[href="/"]');
        if (
          home &&
          location.pathname.split("/")[2] !== "mario-kart" &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey
        ) {
          e.preventDefault();
          window.parent.postMessage({ type: "funcaster:home" }, location.origin);
        }
      });
    this.gentleEffects = matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      this.gentleEffects ||=
        JSON.parse(localStorage.getItem("funcaster.reduced-effects")) === true;
    } catch {}
    document.documentElement.classList.toggle(
      "gentle-effects",
      this.gentleEffects,
    );
    this.authority = !params.has("display");
    this.paused = false;
    this.lastClock = performance.now();
    this.timeNow = this.lastClock;
    this.localSeats = (params.get("seats") || "")
      .split(",")
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0 && n < 4);
    this.socket.on("pause", (p) => {
      this.paused = p.paused;
    });
    this.socket.on("snapshot", (s) => this.receiveState(s));
    this.socket.on("state", (s) => {
      this.paused = !!s.paused || !s.hostConnected;
    });
    this.controllers = 0;
    this.slots = [];
    this.rate = 0;

    this.socket.on("connect", async () => {
      if (!this.party) return this.socket.emit("register", "game");
      let saved;
      try {
        saved = JSON.parse(sessionStorage.getItem("funcaster.host"));
      } catch {}
      this.socket.emit(
        this.authority ? "screen" : "watch-game",
        {
          buildId,
          code: params.get("party"),
          token: this.authority
            ? saved?.token
            : sessionStorage.getItem("funcaster.display." + params.get("party")),
          game: location.pathname.split("/")[2],
          roundId: Number(params.get("round")),
          view: Number(params.get("view") || 0),
        },
        (answer) => {
          if (answer?.error)
            window.parent.postMessage(
              { type: "funcaster:error", message: answer.error },
              location.origin,
            );
          else {
            this.setup = answer.setup;
            if (answer.snapshot) this.pendingState = answer.snapshot;
            window.parent.postMessage(
              { type: "funcaster:loaded" },
              location.origin,
            );
          }
        },
      );
    });

    let samples = 0;
    let mark = performance.now();
    this.socket.on("orientation", (data) => {
      const now = performance.now();
      samples += 1;
      if (now - mark >= 1000) {
        this.rate = (samples * 1000) / (now - mark);
        samples = 0;
        mark = now;
      }
      if (this.authority && !this.paused && onOrientation)
        onOrientation(data, data.slot ?? 0);
    });

    this.socket.on(
      "command",
      (cmd) =>
        this.authority &&
        !this.paused &&
        onCommand &&
        onCommand(cmd, cmd.slot ?? 0),
    );
    this.socket.on("presence", (p) => {
      this.controllers = p.controller;
      this.slots = p.slots || [];
      if (this.party)
        for (const [i, id] of ["p-tag", "a-tag"].entries()) {
          const el = document.getElementById(id);
          if (el && p.slots?.[i]) {
            el.textContent = p.slots[i].name;
            el.style.color = p.slots[i].color;
          }
        }

      if (onPresence) onPresence(p);
    });

    // Latency probe: the phone echoes these back so we can measure a true
    // round trip. One-way timestamps would need synchronised clocks across two
    // devices, which we do not have.
    this.pingCallbacks = new Map();
    this.socket.on("pong-probe", ({ id }) => {
      const started = this.pingCallbacks.get(id);
      if (started === undefined) return;
      this.pingCallbacks.delete(id);
      if (this.onLatency) this.onLatency(performance.now() - started);
    });
  }

  advance(elapsed, update) {
    if (!this.authority || this.paused) return;
    this.stepper ||= new FixedStep(120);
    this.stepper.advance(elapsed, (dt) =>
      update(this.timeNow - (this.stepper.accumulator || 0) * 1000, dt),
    );
  }
  clock(timestamp) {
    const delta = Math.max(0, Math.min(100, timestamp - this.lastClock));
    this.lastClock = timestamp;
    if (!this.paused) this.timeNow += delta;
    return this.timeNow;
  }
  bindReplay(game) {
    if (!this.party || !this.authority) return;
    let calls = [],
      sequence = 0;
    for (const method of ["start", "setAspect", "setCursor", "update"]) {
      const original = game[method].bind(game);
      game[method] = (...args) => {
        const result = original(...args);
        calls.push([method, ...args]);
        return result;
      };
    }
    const timer = setInterval(() => {
      if (!calls.length) return;
      this.socket.emit("replay-chunk", {
        sequence: sequence++,
        calls: calls.splice(0),
      });
    }, 250);
    window.addEventListener("pagehide", () => clearInterval(timer), {
      once: true,
    });
  }
  bindState(getState, after = () => {}) {
    this.stateSource = getState;
    this.afterState = after;
    this.stateTimer = setInterval(() => {
      const state = getState();
      if (!state) return;
      if (this.pendingState) {
        const pending = this.pendingState;
        this.pendingState = null;
        this.receiveState(pending);
      }
      if (this.party && this.authority && !this.paused)
        this.socket.emit("snapshot", {
          clock: this.timeNow,
          state: encodeState(state),
        });
    }, 100);
    window.addEventListener("pagehide", () => clearInterval(this.stateTimer), {
      once: true,
    });
  }
  receiveState(packet) {
    if (this.authority) return;
    const target = this.stateSource?.();
    if (!target) {
      this.pendingState = packet;
      return;
    }
    restoreState(target, packet.state);
    this.timeNow = packet.clock;
    this.lastClock = performance.now();
    this.afterState?.();
    window.parent.postMessage({ type: "funcaster:view-ready" }, location.origin);
  }
  report(scores) {
    if (this.party && this.authority && !this.finished)
      this.socket.emit("score", { scores });
  }

  finish(scores) {
    if (!this.party || !this.authority || this.finished) return;
    this.finished = true;
    this.socket.emit("match.finish", { scores }, (answer) => {
      if (answer?.error) this.finished = false;
    });
  }

  feedback(msg) {
    if (this.authority) this.socket.emit("feedback", msg);
  }

  /** Fire a round-trip probe; resolves via onLatency. */
  probeLatency() {
    if (this.party) {
      const began = performance.now();
      this.socket.emit("ping-check", {}, () =>
        this.onLatency?.(performance.now() - began),
      );
      return;
    }
    const id = Math.floor(performance.now() * 1000) % 1e9;
    this.pingCallbacks.set(id, performance.now());
    this.socket.emit("ping-probe", { id });
    // Don't leak entries when a phone drops mid-probe.
    setTimeout(() => this.pingCallbacks.delete(id), 5000);
  }
}
