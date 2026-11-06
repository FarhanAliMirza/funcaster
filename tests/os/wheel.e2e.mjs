/** Real phone racing captions and pedal geometry: node tests/os/wheel.e2e.mjs. */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  browserFixture,
  until,
  sleep,
  writeReport,
} from "./browser-fixture.mjs";

function inspectWheelLayout() {
  const controls = ["brake", "boost", "gas"].map((id) => {
    const element = document.getElementById(id),
      box = element.getBoundingClientRect(),
      style = getComputedStyle(element, "::after");
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.font = style.font;
    const caption = element.dataset.caption;
    const longestWord = Math.max(
      ...caption.split(/\s+/).map((word) => ctx.measureText(word).width),
    );
    return {
      id,
      caption,
      visible: element.checkVisibility(),
      label: element.getAttribute("aria-label"),
      width: box.width,
      height: box.height,
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      captionWidth: parseFloat(style.width),
      longestWord,
      wordBreak: style.wordBreak,
      overflowWrap: style.overflowWrap,
      whiteSpace: style.whiteSpace,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    };
  });
  const screen = document.getElementById("screen").getBoundingClientRect();
  const screenClips = ["boost-info", "driver-choices", "touch-steer-wrap"]
    .map((id) => document.getElementById(id))
    .filter((element) => element?.checkVisibility())
    .filter((element) => {
      const box = element.getBoundingClientRect();
      return (
        box.top < screen.top ||
        box.bottom > screen.bottom ||
        box.left < screen.left ||
        box.right > screen.right
      );
    })
    .map((element) => element.id);
  return {
    screenClips,
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    posture: document.getElementById("remote").dataset.posture,
    controls,
    boosts: document.getElementById("boost-left").textContent,
    boostVisible: document.getElementById("boost-left").checkVisibility(),
  };
}
function validateWheelLayout(layout, expectedCaption = "Accelerate") {
  const { width, height } = layout;
  const [brake, boost, gas] = layout.controls;
  assert.ok(
    layout.scrollWidth <= width + 1 && layout.scrollHeight <= height + 1,
    "phone remains locked without outer overflow",
  );
  assert.ok(
    brake.right <= boost.left + 1 && boost.right <= gas.left + 1,
    "Brake is left, Boost centre, Accelerate right",
  );
  for (const control of layout.controls) {
    assert.ok(
      control.visible &&
        control.label &&
        control.width >= 48 &&
        control.height >= 48,
      `${control.id} has a visible labelled touch target`,
    );
    assert.ok(
      control.left >= 0 &&
        control.right <= width + 1 &&
        control.top >= 0 &&
        control.bottom <= height + 1,
      `${control.id} stays within the viewport`,
    );
    assert.ok(
      control.longestWord <= control.captionWidth + 1,
      `${control.id} caption keeps each word whole (${control.longestWord} in ${control.captionWidth})`,
    );
    assert.ok(
      control.scrollWidth <= control.clientWidth + 1,
      `${control.id} has no overflowing caption`,
    );
  }
  assert.equal(gas.caption, expectedCaption);
  assert.equal(layout.boosts, "3 LEFT");
  assert.ok(layout.boostVisible, "remaining boosts are visible");
  assert.deepEqual(
    layout.screenClips,
    [],
    "Driver and boost information fit inside the remote screen",
  );
}

const f = await browserFixture("wheel");
const report = {
  at: new Date().toISOString(),
  buildId: f.health.buildId,
  checks: [],
  layouts: [],
  errors: [],
  unverified: [
    "Physical iPhone/Android sensors and simultaneous physical touch",
  ],
};
const mark = (name) => {
  report.checks.push(name);
  console.log(`PASS ${name}`);
};
try {
  const room = await f.createRoom(1);
  const context = await f.browser.newContext({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await context.newPage();
  phone.setDefaultTimeout(15000);
  phone.on("pageerror", (error) => report.errors.push(error.message));
  phone.on("console", (message) => {
    if (message.type() === "error")
      report.errors.push(`phone: ${message.text()}`);
  });
  await phone.goto(`${f.base}/controller?room=${room.identity.code}`);
  await phone.locator("#touch-mode").click();
  await until(
    () =>
      room.state.players.filter((player) => player.connected && player.ready)
        .length === 2,
    15000,
    "browser phone ready",
  );
  await room.startGame("mario-kart");
  await until(
    () =>
      phone
        .locator("#gas")
        .getAttribute("data-caption")
        .then((text) => text === "Choose driver"),
    15000,
    "driver confirmation caption",
  );
  await phone.screenshot({
    path: resolve(f.output, "choose-driver-320x568.png"),
  });
  report.driverSetup = await phone.evaluate(inspectWheelLayout);
  validateWheelLayout(report.driverSetup, "Choose driver");
  mark(
    "Driver confirmation text and boost information fit the compact phone screen",
  );
  await phone.locator("#gas").tap();
  await until(
    () =>
      phone
        .locator("#gas")
        .getAttribute("data-caption")
        .then((text) => text === "Accelerate"),
    15000,
    "Accelerate caption",
  );
  await until(
    () =>
      phone
        .locator("#boost-left")
        .textContent()
        .then((text) => text === "3 LEFT"),
    15000,
    "three boosts",
  );
  mark(
    "Touch phone joins and confirms a driver before the pedal changes to Accelerate",
  );

  for (const [width, height] of [
    [320, 568],
    [844, 390],
    [320, 568],
  ]) {
    await phone.setViewportSize({ width, height });
    await sleep(250);
    const layout = await phone.evaluate(inspectWheelLayout);
    validateWheelLayout(layout);
    report.layouts.push(layout);
    await phone.screenshot({
      path: resolve(
        f.output,
        `racing-${width}x${height}${report.layouts.length === 3 ? "-returned" : ""}.png`,
      ),
    });
  }
  mark(
    "Portrait, landscape and portrait return keep whole pedal labels, 3 boosts, correct order and no overflow",
  );
  await until(
    () => phone.locator("#boost").isEnabled(),
    15000,
    "racing boost enabled",
  );
  const touch = await context.newCDPSession(phone);
  const pointFor = async (id, finger) => {
    const box = await phone.locator(`#${id}`).boundingBox();
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
      id: finger,
      radiusX: 4,
      radiusY: 4,
      force: 1,
    };
  };
  const gasFinger = await pointFor("gas", 1),
    boostFinger = await pointFor("boost", 2);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [gasFinger],
  });
  await sleep(150);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [gasFinger, boostFinger],
  });
  await sleep(150);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [gasFinger],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await until(
    () =>
      phone
        .locator("#boost-left")
        .textContent()
        .then((text) => text === "2 LEFT"),
    4000,
    "consumed boost",
  );
  assert.equal(await phone.locator("#boost").isEnabled(), false);
  assert.match(
    await phone.locator("#boost-label").textContent(),
    /READY IN \d+s/,
  );
  await phone.screenshot({
    path: resolve(f.output, "boost-cooldown-320x568.png"),
  });
  mark(
    "A real boost decrements the stock and disables its pedal during cooldown",
  );
  report.expectedAudioProbes = [...room.expectedAudioProbes];
  report.errors.push(...room.errors);
  assert.deepEqual(report.errors, []);
  await context.close();
} catch (error) {
  report.errors.push(error.stack || error.message);
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeReport(f.output, report);
  await f.close();
}
