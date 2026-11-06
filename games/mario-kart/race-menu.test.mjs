import test from "node:test";
import assert from "node:assert/strict";
import { installRaceMenu, raceMenuLaps } from "./race-menu.js";
function fixture(party) {
  let confirmed = false,
    starts = 0,
    confirms = 0,
    selected = 3,
    fullscreenCalls = 0;
  const node = (dataset = {}) => ({
    dataset,
    listeners: {},
    addEventListener(name, fn) {
      this.listeners[name] = fn;
    },
  });
  const nodes = {
    start: node(),
    "lap-options": node(),
    fullscreen: node(),
    characters: node(),
  };
  const laps = [node({ laps: "1" }), node({ laps: "3" })];
  const document = {
    getElementById: (id) => nodes[id],
    querySelectorAll: () => laps,
    documentElement: {
      requestFullscreen() {
        fullscreenCalls++;
        return Promise.resolve();
      },
    },
    exitFullscreen() {
      fullscreenCalls++;
      return Promise.resolve();
    },
  };
  const menu = installRaceMenu({
    document,
    party,
    getConfirmed: () => confirmed,
    setConfirmed: (value) => {
      confirmed = value;
    },
    playConfirm: () => {
      confirms++;
    },
    startRace: () => {
      starts++;
    },
    selectLaps: (value) => {
      selected = value;
    },
  });
  return {
    menu,
    nodes,
    laps,
    document,
    state: () => ({ confirmed, starts, confirms, selected, fullscreenCalls }),
  };
}

test("party menu cannot override room laps or fullscreen, while driver confirmation starts the local view", async () => {
  const f = fixture(true);
  assert.equal(f.nodes.start.hidden, true);
  assert.equal(f.nodes["lap-options"].hidden, true);
  assert.equal(f.nodes.fullscreen.hidden, true);
  assert.notEqual(f.nodes.characters.hidden, true);
  f.laps[0].onclick();
  assert.equal(f.state().selected, 3);
  await f.menu.toggleFullscreen();
  f.document.fullscreenElement = {};
  await f.nodes.fullscreen.listeners.click();
  assert.equal(
    f.state().fullscreenCalls,
    0,
    "neither request nor exit the shell fullscreen",
  );
  f.menu.confirmDriver();
  assert.deepEqual(f.state(), {
    confirmed: true,
    starts: 1,
    confirms: 1,
    selected: 3,
    fullscreenCalls: 0,
  });
});

test("standalone keeps driver confirmation, lap choice, then Start, plus its fullscreen control", async () => {
  const f = fixture(false);
  assert.equal(f.nodes.start.hidden, false);
  assert.equal(f.nodes["lap-options"].hidden, false);
  f.menu.confirmDriver();
  assert.equal(f.state().starts, 0);
  f.laps[0].onclick();
  assert.equal(f.state().selected, 1);
  f.menu.confirmDriver();
  assert.equal(f.state().starts, 1);
  await f.menu.toggleFullscreen();
  f.document.fullscreenElement = {};
  await f.menu.toggleFullscreen();
  assert.equal(f.state().fullscreenCalls, 2);
});

test("party setup wins over a conflicting saved preference and an absent setup uses the room default", () => {
  assert.equal(raceMenuLaps(true, { laps: 1 }, 3), 1);
  assert.equal(raceMenuLaps(true, { laps: 3 }, 1), 3);
  assert.equal(raceMenuLaps(true, {}, 3), 1);
  assert.equal(raceMenuLaps(false, { laps: 1 }, 3), 3);
  assert.equal(raceMenuLaps(false, { laps: 3 }, 1), 1);
});
