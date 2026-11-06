import test from "node:test";
import assert from "node:assert/strict";
import { games } from "../../core/catalog.js";
import { RacingMotion } from "../../core/racing-motion.js";
import {
  GAME_REMOTE,
  REMOTE_BUTTONS,
  remoteButtonMap,
  remotePosture,
  racingRemote,
  paintButtons,
  HomeGesture,
  remoteInputInterrupted,
} from "./remote.js";

const playing = {
  phase: "classic",
  ready: true,
  active: true,
  connected: true,
  primaryEnabled: true,
  canDrive: true,
  gasEnabled: true,
  boostEnabled: true,
};
test("all 13 catalog games have a complete remote map in both postures", () => {
  assert.equal(games.length, 13);
  assert.deepEqual(
    Object.keys(GAME_REMOTE).sort(),
    games.map((game) => game.id).sort(),
  );
  for (const game of games)
    for (const landscape of [false, true]) {
      const context = { ...playing, game: game.id, landscape };
      const map = remoteButtonMap(context);
      assert.deepEqual(Object.keys(map).sort(), [...REMOTE_BUTTONS].sort());
      assert.equal(
        remotePosture(context),
        game.mode === "wheel" && landscape ? "sideways" : "pointer",
      );
      assert.equal(map.home.action, "menu");
      assert.equal(map.minus.action, "slower");
      assert.equal(map.plus.action, "faster");
      for (const role of Object.values(map)) {
        assert.equal(typeof role.caption, "string");
        assert.equal(typeof role.enabled, "boolean");
        if (role.enabled) assert.ok(role.caption && role.action);
      }
    }
});

test("racing uses the real three pedals in either grip and restores pointer layout in lobby", () => {
  for (const game of ["mario-kart", "kart", "neon-drift"])
    for (const landscape of [false, true]) {
      const context = { ...playing, game, landscape };
      const map = remoteButtonMap(context);
      assert.deepEqual(
        [map["1"].action, map.A.action, map["2"].action],
        ["brake", "boost", "gas"],
      );
      for (const phase of ["lobby", "results", "attract"]) {
        assert.equal(racingRemote({ ...context, phase }), false);
        assert.equal(remotePosture({ ...context, phase }), "pointer");
        assert.equal(
          remoteButtonMap({ ...context, phase })["1"].action,
          "recenter",
        );
      }
      assert.equal(remotePosture({ ...context, pointerMode: true }), "pointer");
      assert.equal(
        remoteButtonMap({ ...context, boostEnabled: false }).A.enabled,
        false,
      );
      assert.equal(
        remoteButtonMap({ ...context, gasEnabled: false })["2"].enabled,
        false,
      );
    }
  const setup = remoteButtonMap({
    ...playing,
    game: "mario-kart",
    driverSetup: true,
    gasCaption: "Confirm",
  });
  assert.equal(setup.left.action, "left");
  assert.equal(setup.right.action, "right");
  assert.equal(setup["2"].caption, "Confirm");
});

test("primary, golf cancel, drawing guess and inactive states use actual supported roles", () => {
  for (const [game, action] of [
    ["golf", "shot"],
    ["table-tennis", "primary"],
    ["swordplay", "primary"],
    ["shooting-range", "primary"],
    ["alien-attack", "primary"],
    ["drawing", "primary"],
    ["bubble-burst", "pulse"],
  ]) {
    assert.equal(remoteButtonMap({ ...playing, game }).A.action, action);
    for (const blocked of [
      { paused: true },
      { ready: false },
      { active: false },
      { connected: false },
      { primaryEnabled: false },
    ])
      assert.equal(
        remoteButtonMap({ ...playing, game, ...blocked }).A.enabled,
        false,
      );
  }
  for (const game of ["fruit-ninja", "island-flyover", "star-catch"])
    assert.deepEqual(remoteButtonMap({ ...playing, game }).A, {
      caption: "",
      action: null,
      enabled: false,
    });
  assert.equal(remoteButtonMap({ ...playing, game: "golf" }).B.enabled, false);
  assert.equal(
    remoteButtonMap({ ...playing, game: "golf", shotStarted: true }).B.action,
    "cancel",
  );
  assert.equal(
    remoteButtonMap({ ...playing, game: "golf", shotStarted: true }).B.enabled,
    true,
  );
  const guesser = remoteButtonMap({
    ...playing,
    game: "drawing",
    guessing: true,
  });
  assert.equal(guesser.A.enabled, false);
  assert.equal(guesser["2"].action, "guess");
  for (const game of games.filter((game) => game.id !== "golf"))
    assert.equal(
      remoteButtonMap({ ...playing, game: game.id }).B.enabled,
      false,
    );
});

test("shell roles remain safely disabled until the shell client is present", () => {
  const map = remoteButtonMap({ game: "mario-kart", phase: "lobby" });
  for (const name of ["A", "B", "up", "down", "left", "right"])
    assert.equal(map[name].enabled, false);
  const connected = remoteButtonMap({ pointerMode: true, shellReady: true });
  assert.equal(connected.A.action, "shell-click");
  assert.equal(connected.A.enabled, true);
  assert.equal(connected.left.action, "shell-left");
  assert.deepEqual(connected.minus, {
    caption: "Less",
    action: "shell-minus",
    enabled: true,
  });
  assert.deepEqual(connected.plus, {
    caption: "More",
    action: "shell-plus",
    enabled: true,
  });
  assert.equal(remoteButtonMap({ pointerMode: true }).plus.enabled, false);
});

test("button painting updates captions, accessibility and idle state without removing controls", () => {
  const elements = Object.fromEntries(
    REMOTE_BUTTONS.map((name) => [
      name,
      {
        dataset: {},
        attrs: {},
        flags: new Set(),
        get classList() {
          return {
            toggle: (key, yes) =>
              yes ? this.flags.add(key) : this.flags.delete(key),
          };
        },
        setAttribute(key, value) {
          this.attrs[key] = value;
        },
      },
    ]),
  );
  paintButtons(
    elements,
    remoteButtonMap({ ...playing, game: "shooting-range" }),
  );
  assert.equal(elements.A.dataset.caption, "Fire");
  assert.equal(elements.A.attrs["aria-label"], "A: Fire");
  assert.equal(elements.B.disabled, true);
  assert.ok(elements.B.flags.has("is-idle"));
  paintButtons(elements, remoteButtonMap({ ...playing, game: "fruit-ninja" }));
  assert.equal(elements.A.dataset.caption, "");
  assert.equal(elements.A.disabled, true);
  assert.equal(elements.A.hidden, undefined);
});

test("Home tap, hold confirmation, release cancellation and leave are mutually exclusive", () => {
  const gesture = new HomeGesture();
  gesture.start(0);
  assert.deepEqual(gesture.advance(799), []);
  assert.deepEqual(gesture.end(799), ["menu", "dismiss"]);
  gesture.start(1000);
  assert.deepEqual(gesture.advance(1800), ["confirm"]);
  assert.deepEqual(gesture.advance(1850), []);
  assert.deepEqual(gesture.end(2000), ["dismiss"]);
  gesture.start(3000);
  assert.deepEqual(gesture.advance(3800), ["confirm"]);
  assert.deepEqual(gesture.advance(4800), ["leave"]);
  assert.deepEqual(gesture.advance(5000), []);
  assert.deepEqual(gesture.end(5001), ["dismiss"]);
  gesture.start(6000);
  gesture.advance(6800);
  assert.deepEqual(gesture.cancel(), ["dismiss"]);
  assert.deepEqual(gesture.advance(9000), []);
  assert.deepEqual(gesture.end(9001), []);
});

test("the retained calibrated racing mapper accepts portrait samples without an Euler shortcut", () => {
  for (const screenAngle of [0, 180]) {
    const motion = new RacingMotion();
    const pose = (degrees) => ({
      quat: [
        0,
        0,
        -Math.sin((degrees * Math.PI) / 360),
        Math.cos((degrees * Math.PI) / 360),
      ],
      screenAngle,
    });
    let result;
    for (let time = 0; time <= 800; time += 20)
      result = motion.update(pose(0), time);
    assert.equal(result.ready, true);
    for (let time = 820; time <= 1200; time += 20)
      result = motion.update(pose(10), time);
    assert.ok(result.x > 0.16 && result.x < 0.18);
    for (let time = 1220; time <= 1600; time += 20)
      result = motion.update(pose(-10), time);
    assert.ok(result.x < -0.16 && result.x > -0.18);
  }
});

import {
  requestMotionPermissions,
  deviceProfile,
  probeDevice,
  sensorErrorMessage,
  createWakeKeeper,
  createOrientationControl,
} from "./phone-capabilities.js";
import { PhonePointer } from "./phone-pointer.js";
import { Pointer } from "../../core/pointer.js";
import { createRequire } from "node:module";
import { kartGasCaption } from "./remote.js";
const { deviceInfo, pointerSample } = createRequire(import.meta.url)(
  "../../server/shell-input.cjs",
);

function fakePhone({
  ua = "Android Chrome",
  secure = true,
  events = [],
  fine = false,
  ...overrides
} = {}) {
  let time = 0;
  const listeners = new Map(),
    queue = [...events];
  const window = {
    isSecureContext: secure,
    matchMedia: (query) => ({ matches: query === "(pointer: fine)" && fine }),
    addEventListener(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
    },
    removeEventListener(name, listener) {
      listeners.get(name)?.delete(listener);
    },
  };
  const navigator = {
    userAgent: ua,
    platform: "Linux",
    maxTouchPoints: 5,
    ...overrides,
  };
  const document = { fullscreenElement: null };
  return {
    window,
    navigator,
    document,
    now: () => time,
    async wait(ms) {
      const until = time + ms;
      queue.sort((a, b) => a.at - b.at);
      while (queue.length && queue[0].at <= until) {
        const event = queue.shift();
        time = event.at;
        if (event.run) event.run();
        else
          for (const listener of listeners.get(event.type) || [])
            listener(event);
      }
      time = until;
    },
    schedule(event) {
      queue.push(event);
    },
    listenerCount: () =>
      [...listeners.values()].reduce((n, group) => n + group.size, 0),
  };
}
const orientations = (start = 900, type = "deviceorientation") =>
  Array.from({ length: 6 }, (_, i) => ({
    at: start + i * 15,
    type,
    alpha: 12,
    beta: 70,
    gamma: 0,
  }));

test("one tap calls both permission APIs synchronously and tolerates rejection or missing APIs", async () => {
  const calls = [];
  const granted = requestMotionPermissions({
    isSecureContext: true,
    DeviceOrientationEvent: {
      requestPermission() {
        calls.push("orientation");
        return Promise.resolve("granted");
      },
    },
    DeviceMotionEvent: {
      requestPermission() {
        calls.push("motion");
        return Promise.resolve("granted");
      },
    },
  });
  assert.deepEqual(calls, ["orientation", "motion"]);
  assert.deepEqual(await granted, { denied: false });
  calls.length = 0;
  const rejected = requestMotionPermissions({
    isSecureContext: true,
    DeviceOrientationEvent: {
      requestPermission() {
        calls.push("orientation");
        throw new Error("denied");
      },
    },
    DeviceMotionEvent: {
      requestPermission() {
        calls.push("motion");
        return Promise.reject(new Error("denied"));
      },
    },
  });
  assert.deepEqual(calls, ["orientation", "motion"]);
  assert.deepEqual(await rejected, { denied: true });
  assert.deepEqual(await requestMotionPermissions({ isSecureContext: true }), {
    denied: false,
  });
  assert.deepEqual(await requestMotionPermissions({ isSecureContext: false }), {
    denied: true,
  });
  assert.deepEqual(
    await requestMotionPermissions({
      isSecureContext: true,
      DeviceMotionEvent: { requestPermission: () => "denied" },
    }),
    { denied: true },
  );
});

test("capability probe falls back within two seconds for absent, stale, null, and denied sensors", async () => {
  for (const events of [
    [],
    orientations(0),
    [{ at: 990, type: "deviceorientation", beta: null, gamma: 0 }],
  ]) {
    const env = fakePhone({ events });
    const { device } = await probeDevice(env);
    assert.equal(device.tier, "B");
    assert.equal(device.gyro, false);
    assert.equal(env.now(), 1800);
    assert.equal(env.listenerCount(), 0);
  }
  for (const options of [{ denied: true }, { secure: false }]) {
    const env = fakePhone({ ...options, events: orientations() });
    const { device } = await probeDevice({ ...env, ...options });
    assert.equal(device.tier, "B");
    assert.equal(env.now(), 1000);
    assert.equal(env.listenerCount(), 0);
  }
});

test("fresh orientation is tier A, duplicated absolute events do not inflate rate, and gyro is independently probed", async () => {
  const env = fakePhone({
    events: [
      ...orientations(),
      ...orientations(900, "deviceorientationabsolute"),
      {
        at: 990,
        type: "devicemotion",
        rotationRate: { alpha: 1, beta: 2, gamma: 3 },
        accelerationIncludingGravity: { z: -9.8 },
      },
    ],
  });
  const { device, diagnostics } = await probeDevice(env);
  assert.equal(device.tier, "A");
  assert.equal(device.hz, 6);
  assert.equal(device.gyro, true);
  assert.equal(diagnostics.samples, 6);
  assert.equal(diagnostics.gravityZ, -9.8);
  assert.equal(env.now(), 1000);
  assert.equal(env.listenerCount(), 0);
  const absoluteOnly = fakePhone({
    events: orientations(900, "deviceorientationabsolute"),
  });
  assert.equal((await probeDevice(absoluteOnly)).device.tier, "A");
});

test("Generic Sensor fallback starts at 1.5 seconds and accepts only a fresh normalized quaternion stream", async () => {
  const env = fakePhone();
  let fallbackAt = null;
  const result = await probeDevice({
    ...env,
    startFallback(sample) {
      fallbackAt = env.now();
      sample([0, 0, 0, 4]);
      sample([NaN, 0, 0, 1]);
      for (let i = 0; i < 6; i++)
        env.schedule({ at: 1710 + i * 15, run: () => sample([0, 0, 0, 1]) });
    },
  });
  assert.equal(fallbackAt, 1500);
  assert.equal(env.now(), 1800);
  assert.equal(result.device.tier, "A");
  assert.equal(result.diagnostics.samples, 6);
  assert.equal(env.listenerCount(), 0);
});

test("device reports are bounded, contain only supported fields, and identify coached browsers without inventing haptics", () => {
  const make = (options = {}) => {
    const env = fakePhone(options);
    return deviceProfile({
      ...env,
      samples: 99999,
      fresh: true,
      gyro: true,
      elapsed: 1000,
    });
  };
  for (const profile of [
    make({ maxTouchPoints: Infinity }),
    make({ ua: "iPhone Safari", vibrate() {} }),
    make({ ua: "Macintosh Safari", platform: "MacIntel", maxTouchPoints: 10 }),
    make({ ua: "Windows Chrome", fine: true }),
    make({ ua: "Instagram 123 Android", arbitrarySecret: "excluded" }),
  ]) {
    assert.deepEqual(deviceInfo(profile), profile);
    assert.deepEqual(
      Object.keys(profile).sort(),
      [
        "platform",
        "tier",
        "gyro",
        "hz",
        "haptics",
        "fullscreen",
        "standalone",
        "touchMax",
        "inApp",
        "secure",
      ].sort(),
    );
    assert.equal(profile.hz, 240);
  }
  assert.equal(make({ ua: "iPhone Safari", vibrate() {} }).haptics, "none");
  assert.equal(make({ ua: "Android Chrome", vibrate() {} }).haptics, "vibrate");
  assert.equal(
    make({ ua: "Macintosh Safari", platform: "MacIntel", maxTouchPoints: 10 })
      .tier,
    "D",
  );
  assert.equal(make({ ua: "Windows Chrome", fine: true }).tier, "D");
  assert.equal(make({ ua: "Instagram 123 Android" }).tier, "C");
  assert.equal(make({ ua: "Instagram 123 Android" }).inApp, "Instagram");
  for (const name of ["SecurityError", "NotAllowedError", "NotReadableError"]) {
    assert.notEqual(
      sensorErrorMessage({ name }),
      sensorErrorMessage({ name: "unknown" }),
    );
    assert.equal(
      sensorErrorMessage({ error: { name } }),
      sensorErrorMessage({ name }),
    );
  }
});

test("phone pointer keeps a separate validated raw stream and preserves rotation-rate axis order", () => {
  const stream = new PhonePointer();
  const original = { alpha: 400, beta: 200, gamma: -100 };
  assert.equal(stream.orientation(original, 0), true);
  assert.equal(stream.motion({ beta: 30, gamma: -4000, alpha: 10 }, 0), true);
  const packet = stream.flush(0, { enabled: true });
  assert.deepEqual(packet, {
    a: 360,
    b: 180,
    g: -90,
    r: [30, -2000, 10],
    seq: 1,
  });
  assert.deepEqual(original, { alpha: 400, beta: 200, gamma: -100 });
  const { seq, ...sample } = packet;
  assert.deepEqual(pointerSample(packet), sample);
  assert.equal(stream.orientation({ beta: null, gamma: 0 }, 9), false);
  assert.equal(stream.orientation({ beta: Infinity, gamma: 0 }, 9), false);
  assert.equal(stream.motion({ alpha: null, beta: 0, gamma: 0 }, 9), false);
  assert.equal(stream.quaternion([0, 0, 0, 2], 9), false);
  assert.equal(stream.quaternion([0, 0, 0, 1], NaN), false);
  assert.equal(stream.quaternion([0, 0, 0, 1], 300), true);
  assert.deepEqual(stream.flush(300, { enabled: true }), {
    q: [0, 0, 0, 1],
    seq: 2,
  });
});

test("phone pointer honors mode, transport backpressure, sample age and 8ms floor without losing the final touch", () => {
  const stream = new PhonePointer();
  stream.point(0, 0, 0);
  assert.equal(stream.flush(0, { enabled: false, mode: "touch" }), null);
  assert.equal(
    stream.flush(0, { enabled: true, writable: false, mode: "touch" }),
    null,
  );
  assert.equal(stream.flush(0, { enabled: true }), null);
  assert.deepEqual(stream.flush(0, { enabled: true, mode: "touch" }), {
    x: 0,
    y: 0,
    seq: 1,
  });
  stream.point(0.2, 0.4, 2);
  assert.equal(stream.flush(2, { enabled: true, mode: "touch" }), null);
  assert.equal(stream.pending(2, "touch"), true);
  assert.deepEqual(stream.flush(8, { enabled: true, mode: "touch" }), {
    x: 0.2,
    y: 0.4,
    seq: 2,
  });
  assert.equal(stream.pending(8, "touch"), false);
  assert.equal(
    stream.flush(18, { enabled: true, mode: "touch" }),
    null,
    "transport drain cannot resend the same sample",
  );
  for (const [x, time] of [
    [0.5, 20],
    [0.8, 30],
    [2, 40],
  ]) {
    stream.point(x, -2, time);
    assert.equal(
      stream.flush(time, { enabled: true, writable: false, mode: "touch" }),
      null,
    );
  }
  assert.deepEqual(stream.flush(45, { enabled: true, mode: "touch" }), {
    x: 1,
    y: -1,
    seq: 3,
  });
  stream.point(-1, 1, 50);
  assert.equal(
    stream.flush(301, { enabled: true, mode: "touch" }),
    null,
    "old samples freeze rather than jump after a stalled transport",
  );
  assert.equal(stream.pending(301, "touch"), false);
  assert.equal(stream.point(NaN, 1, 302), false);
  assert.equal(stream.point(1, 1, Infinity), false);
});

test("retained Pointer maps touch party samples and mouse positions in the same downward-positive viewport", () => {
  const pointer = new Pointer();
  pointer.setViewport(1280, 720);
  pointer.update({ party: { active: true, x: -0.5, y: 0.5 } }, 1 / 60, 1000);
  assert.deepEqual(pointer.display, { x: 0.25, y: 0.75 });
  assert.deepEqual(pointer.pixels, { x: 320, y: 540 });
  pointer.update({ party: { active: false, x: 1, y: -1 } }, 1 / 60, 1016);
  assert.deepEqual(pointer.display, { x: 0.25, y: 0.75 });
  pointer.setFromMouse(2, -1);
  assert.deepEqual(pointer.display, { x: 1, y: 0 });
  pointer.recentre();
  assert.deepEqual(pointer.display, { x: 0.5, y: 0.5 });
});

test("Kart party confirmation never presents a second Start button during countdown", () => {
  assert.equal(kartGasCaption(null), "Choose driver");
  assert.equal(
    kartGasCaption({ stage: "ready", confirmed: false }),
    "Choose driver",
  );
  assert.equal(kartGasCaption({ stage: "ready", confirmed: true }), "Ready");
  for (const stage of ["countdown", "racing", "finishing"])
    assert.equal(kartGasCaption({ stage, confirmed: true }), "Accelerate");
  assert.equal(kartGasCaption({ stage: "paused" }), "Resume");
  assert.equal(kartGasCaption({ stage: "results" }), "Race again");
});

import { playPhoneCue } from "./phone-audio.js";
test("remote feedback ports distinct click, swoosh and thud cues without creating audio before the gate", () => {
  assert.equal(playPhoneCue(null), false);
  assert.equal(playPhoneCue({ state: "suspended" }), false);
  const created = [];
  const node = (kind) => {
    const values = [],
      result = {
        kind,
        values,
        gain: {
          setValueAtTime: (v, t) => values.push(["gain", v, t]),
          exponentialRampToValueAtTime: (v, t) => values.push(["fade", v, t]),
        },
        frequency: {
          setValueAtTime: (v, t) => values.push(["frequency", v, t]),
          exponentialRampToValueAtTime: (v, t) => values.push(["slide", v, t]),
        },
        Q: {},
        connect: (next) => next,
        disconnect() {},
        start: (t) => values.push(["start", t]),
        stop: (t) => values.push(["stop", t]),
      };
    created.push(result);
    return result;
  };
  const context = {
    state: "running",
    currentTime: 10,
    sampleRate: 1000,
    destination: {},
    createGain: () => node("gain"),
    createOscillator: () => node("oscillator"),
    createBufferSource: () => node("source"),
    createBiquadFilter: () => node("filter"),
    createBuffer(channels, size) {
      assert.equal(channels, 1);
      assert.equal(size, 120);
      return { getChannelData: () => new Float32Array(size) };
    },
  };
  assert.equal(playPhoneCue(context, "click"), true);
  assert.equal(created.at(-1).type, "square");
  assert.ok(
    created.at(-1).values.some((v) => v[0] === "stop" && v[1] === 10.06),
  );
  assert.equal(playPhoneCue(context, "thud"), true);
  assert.equal(created.at(-1).type, "sine");
  assert.ok(created.at(-1).values.some((v) => v[0] === "slide" && v[1] === 50));
  assert.equal(
    playPhoneCue(context, "swoosh", () => 0.5),
    true,
  );
  assert.equal(created.at(-1).type, "bandpass");
  assert.equal(created.at(-2).kind, "source");
});

test("wake lock requests are shared, reacquired after system release, and cannot leak after hiding", async () => {
  let requests = 0,
    resolveLock;
  const keeper = createWakeKeeper({
    wakeLock: {
      request(type) {
        assert.equal(type, "screen");
        requests++;
        return new Promise((resolve) => {
          resolveLock = resolve;
        });
      },
    },
  });
  const lock = () => {
    const target = new EventTarget();
    target.released = false;
    target.releases = 0;
    target.release = async () => {
      target.releases++;
      target.released = true;
      target.dispatchEvent(new Event("release"));
    };
    return target;
  };
  const first = keeper.keep();
  assert.equal(keeper.keep(), first);
  assert.equal(requests, 1);
  const a = lock();
  resolveLock(a);
  assert.equal(await first, a);
  assert.equal(await keeper.keep(), a);
  assert.equal(requests, 1);
  await a.release();
  const second = keeper.keep();
  assert.equal(requests, 2);
  keeper.release();
  const b = lock();
  resolveLock(b);
  assert.equal(await second, null);
  assert.equal(
    b.releases,
    1,
    "a request resolving after hide releases immediately",
  );
  const third = keeper.keep();
  const c = lock();
  resolveLock(c);
  assert.equal(await third, c);
  keeper.release();
  assert.equal(c.releases, 1);
  keeper.release();
  assert.equal(c.releases, 1);
  assert.equal(await createWakeKeeper({}).keep(), null);
  assert.equal(
    await createWakeKeeper({
      wakeLock: {
        request() {
          throw new Error("unavailable");
        },
      },
    }).keep(),
    null,
  );
});

test("wake lock can retry after a synchronous platform error", async () => {
  let calls = 0;
  const lock = new EventTarget();
  lock.release = async () => {};
  const keeper = createWakeKeeper({
    wakeLock: {
      request() {
        if (++calls === 1) throw new Error("NotAllowedError");
        return Promise.resolve(lock);
      },
    },
  });
  assert.equal(await keeper.keep(), null);
  assert.equal(await keeper.keep(), lock);
  assert.equal(calls, 2);
  keeper.release();
});

test("pausing, switching phase or losing a seat releases held controls without waiting for disabled pointerup", () => {
  const previous = {
    game: "golf",
    roundId: 5,
    phase: "classic",
    active: [0, 2],
    paused: false,
  };
  assert.equal(remoteInputInterrupted(previous, { ...previous }, 0), false);
  assert.equal(
    remoteInputInterrupted(previous, { ...previous, score: 30 }, 0),
    false,
  );
  for (const changed of [
    { phase: "results" },
    { phase: "lobby" },
    { paused: true },
    { game: "mario-kart" },
    { roundId: 6 },
    { active: [2] },
  ])
    assert.equal(
      remoteInputInterrupted(previous, { ...previous, ...changed }, 0),
      true,
    );
  assert.equal(
    remoteInputInterrupted({ ...previous, paused: true }, previous, 0),
    false,
  );
  assert.equal(
    remoteInputInterrupted(previous, { ...previous, active: [0] }, 0),
    false,
  );
});

test("orientation follows shell and racing posture changes without repeating locks on every render", async () => {
  const calls = [];
  const control = createOrientationControl({
    lock: async (posture) => calls.push(posture),
    unlock: () => calls.push("unlock"),
  });
  const render = async (context) => {
    control.set(racingRemote(context) ? "landscape" : "portrait");
    await Promise.resolve();
  };
  await render({ game: "mario-kart", phase: "lobby", pointerMode: true });
  await render({ game: "mario-kart", phase: "lobby", pointerMode: true });
  await render({ game: "mario-kart", phase: "classic" });
  await render({ game: "mario-kart", phase: "classic" });
  await render({ game: "mario-kart", phase: "results" });
  await render({ game: "neon-drift", phase: "playing" });
  await render({ game: "neon-drift", phase: "playing", pointerMode: true });
  await render({ game: "golf", phase: "classic" });
  assert.deepEqual(calls, [
    "portrait",
    "landscape",
    "portrait",
    "landscape",
    "portrait",
  ]);
  control.release();
  await render({ game: "golf", phase: "classic" });
  control.set("portrait", true);
  await Promise.resolve();
  assert.deepEqual(
    calls.slice(-3),
    ["unlock", "portrait", "portrait"],
    "wake reacquires and the fullscreen gesture may retry a previously denied lock",
  );
});

test("late orientation locks reconcile to the current posture and cannot lock a hidden or departed phone", async () => {
  const calls = [],
    pending = [];
  let unlocks = 0;
  const control = createOrientationControl({
    lock(posture) {
      calls.push(posture);
      return new Promise((resolve) => pending.push(resolve));
    },
    unlock() {
      unlocks++;
    },
  });
  control.set("portrait");
  control.set("landscape");
  pending.shift()();
  await Promise.resolve();
  assert.deepEqual(calls, ["portrait", "landscape", "landscape"]);
  pending.shift()();
  await Promise.resolve();
  assert.equal(
    calls.length,
    3,
    "the current target does not start a promise loop",
  );
  control.release();
  assert.equal(unlocks, 1);
  pending.shift()();
  await Promise.resolve();
  assert.equal(unlocks, 2, "a late native lock after leaving is undone");
  assert.equal(pending.length, 0);
});

test("unsupported, throwing and rejected orientation APIs never block the remote", async () => {
  for (const api of [
    undefined,
    {
      lock() {
        throw new Error("NotSupportedError");
      },
      unlock() {
        throw new Error("NotSupportedError");
      },
    },
    {
      lock: async () => {
        throw new Error("NotAllowedError");
      },
    },
  ]) {
    const control = createOrientationControl(api);
    assert.doesNotThrow(() => {
      control.set("portrait");
      control.set("landscape");
      control.set("invalid");
      control.release();
    });
    await Promise.resolve();
    await Promise.resolve();
  }
});
