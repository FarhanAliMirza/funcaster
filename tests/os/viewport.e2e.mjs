/** Real Chromium matrix: node tests/os/viewport.e2e.mjs [--smoke] [--games=id,id] [--dpr] [--compact] [--representative]. */
import { resolve } from "node:path";
import { games } from "../../core/catalog.js";
import { gameFit } from "../../public/os/game-fit.js";
import {
  browserFixture,
  sleep,
  until,
  writeReport,
} from "./browser-fixture.mjs";
export const VIEWPORTS = [
  ["hd", 1280, 720],
  ["laptop", 1366, 768],
  ["full-hd", 1920, 1080],
  ["qhd", 2560, 1440],
  ["4k", 3840, 2160],
  ["ultrawide", 2560, 1080],
  ["projector", 1024, 768],
  ["short", 1280, 600],
  ["split-cell", 960, 1006],
];
const representative = process.argv.includes("--representative"),
  compact = process.argv.includes("--compact"),
  dprProbe = process.argv.includes("--dpr"),
  smoke = process.argv.includes("--smoke"),
  filter = process.argv
    .find((arg) => arg.startsWith("--games="))
    ?.slice(8)
    .split(",");
const selected = games.filter((game) =>
  filter
    ? filter.includes(game.id)
    : compact
      ? ["star-catch", "neon-drift", "bubble-burst"].includes(game.id)
      : !smoke ||
        ["mario-kart", "star-catch", "shooting-range"].includes(game.id),
);
const viewports = compact
  ? [["compact", 640, 360]]
  : representative
    ? VIEWPORTS.filter(([name]) => name === "hd")
    : dprProbe
      ? VIEWPORTS.filter(([name]) => name === "4k")
      : smoke
        ? VIEWPORTS.filter(([name]) =>
            ["hd", "short", "split-cell"].includes(name),
          )
        : VIEWPORTS;
const f = await browserFixture("viewport"),
  report = {
    at: new Date().toISOString(),
    buildId: f.health.buildId,
    smoke,
    dprProbe,
    compact,
    representative,
    samples: [],
    failures: [],
    zeroSizes: [],
    unverified: [
      "Physical iPhone and Android sensor/multitouch behavior",
      "Visual review of every exported screenshot",
    ],
  };
function inspectViewport() {
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    return (
      element.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      }) &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.bottom > 0 &&
      rect.left < innerWidth &&
      rect.top < innerHeight
    );
  };
  const key = (element) =>
    `${element.tagName.toLowerCase()}${element.id ? "#" + element.id : element.className && typeof element.className === "string" ? "." + element.className.trim().split(/\s/).join(".") : ""}`;
  const surface = document.querySelector(".os-game-surface") || document.body;
  const elements = [...surface.querySelectorAll("*")].filter(visible),
    scrolling = [],
    wide = [],
    smallText = [],
    invalid = [],
    menuOverlap = [];
  const shellMenu = (
      window.parent === window ? document : window.parent.document
    ).querySelector(".os-game-menu"),
    menuRect = shellMenu?.getBoundingClientRect(),
    frameRect = window.frameElement?.getBoundingClientRect() || { x: 0, y: 0 };
  for (const element of elements) {
    const style = getComputedStyle(element),
      rect = element.getBoundingClientRect();
    if (
      (["auto", "scroll"].includes(style.overflowY) &&
        element.scrollHeight > element.clientHeight + 1) ||
      (["auto", "scroll"].includes(style.overflowX) &&
        element.scrollWidth > element.clientWidth + 1)
    )
      scrolling.push(key(element));
    if (rect.width > innerWidth + 1)
      wide.push({ element: key(element), width: rect.width });
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite))
      invalid.push(key(element));
    if (
      [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
      )
    ) {
      if (menuRect && !element.closest(".os-game-menu")) {
        for (const node of [...element.childNodes].filter(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
        )) {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const r of range.getClientRects()) {
            const x = r.x + frameRect.x,
              y = r.y + frameRect.y;
            if (
              x < menuRect.right &&
              x + r.width > menuRect.left &&
              y < menuRect.bottom &&
              y + r.height > menuRect.top
            )
              menuOverlap.push({
                element: key(element),
                text: node.textContent.trim().slice(0, 70),
              });
          }
        }
      }
      const size = parseFloat(style.fontSize),
        floor = (16 * innerHeight) / 1080;
      if (size + 0.1 < floor)
        smallText.push({
          element: key(element),
          size,
          minimum: +floor.toFixed(2),
          text: element.textContent.trim().slice(0, 70),
        });
    }
  }
  const canvases = [...document.querySelectorAll("canvas")]
    .filter(visible)
    .map((canvas) => {
      const r = canvas.getBoundingClientRect();
      return {
        id: canvas.id,
        width: r.width,
        height: r.height,
        pixels: canvas.width * canvas.height,
        finite: Number.isFinite(canvas.width) && Number.isFinite(canvas.height),
      };
    });
  let tableFits = null;
  if (
    document.body.dataset.game === "table-tennis" &&
    window.__openwii?.camera
  ) {
    const { scene, camera } = window.__openwii,
      table = scene.children.find(
        (node) => node.geometry?.parameters?.height === 0.06,
      );
    if (table) {
      table.geometry.computeBoundingBox();
      const { min, max } = table.geometry.boundingBox;
      const corners = [min.x, max.x].flatMap((x) =>
        [min.y, max.y].flatMap((y) =>
          [min.z, max.z].map((z) =>
            table
              .localToWorld(camera.position.clone().set(x, y, z))
              .project(camera),
          ),
        ),
      );
      tableFits = corners.every(
        (p) =>
          [p.x, p.y, p.z].every(Number.isFinite) &&
          Math.abs(p.x) <= 1.01 &&
          Math.abs(p.y) <= 1.01,
      );
    }
  }
  const uiScale = Math.min(innerWidth, innerHeight) / 720;
  const power = document.getElementById("powerwrap"),
    rail = document.querySelector(".game-statusbar"),
    powerBox = power?.getBoundingClientRect(),
    railBox = rail?.getBoundingClientRect();
  const powerBar = powerBox
    ? {
        width: powerBox.width,
        height: powerBox.height,
        scaled:
          Math.abs(powerBox.width - 240 * uiScale) < 1 &&
          Math.abs(powerBox.height - 12 * uiScale) < 1,
        aboveRail: !railBox || powerBox.bottom + 4 <= railBox.top,
        contained:
          powerBox.left >= 0 &&
          powerBox.right <= innerWidth &&
          powerBox.top >= 0 &&
          powerBox.bottom <= innerHeight,
      }
    : null;
  const kartCard =
    document.body.dataset.game === "kart"
      ? document.getElementById("card")?.getBoundingClientRect()
      : null;
  const kartOffsets = kartCard
    ? Math.abs(kartCard.left - 28 * uiScale) < 1 &&
      Math.abs(kartCard.top - 24 * uiScale) < 1
    : null;
  return {
    powerBar,
    kartOffsets,
    tableFits,
    playable: surface.querySelector(".os-arena-canvas")?.dataset.playableHeight
      ? {
          top: Number(
            surface.querySelector(".os-arena-canvas").dataset.playableTop,
          ),
          bottom: Number(
            surface.querySelector(".os-arena-canvas").dataset.playableBottom,
          ),
          height: Number(
            surface.querySelector(".os-arena-canvas").dataset.playableHeight,
          ),
        }
      : null,
    viewport: [innerWidth, innerHeight],
    devicePixelRatio,
    menuOverlap,
    camera: window.__openwii?.camera
      ? {
          finite: [
            window.__openwii.camera.aspect,
            ...window.__openwii.camera.projectionMatrix.elements,
            ...window.__openwii.camera.position.toArray(),
          ].every(Number.isFinite),
        }
      : null,
    aimRoundtrip:
      window.__openwii?.toWorld && window.__openwii?.toScreen
        ? [
            [0, 0],
            [0.5, 0.5],
            [1, 1],
          ].every(([x, y]) => {
            const w = window.__openwii.toWorld(x, y),
              p = window.__openwii.toScreen(w.x, w.y);
            return (
              Math.abs(p.x - x * innerWidth) < 0.01 &&
              Math.abs(p.y - y * innerHeight) < 0.01
            );
          })
        : null,
    document: [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ],
    overflow:
      document.documentElement.scrollWidth > innerWidth + 1 ||
      document.documentElement.scrollHeight > innerHeight + 1,
    scrolling,
    wide,
    smallText,
    invalid,
    canvases,
    fills: canvases.some(
      (c) =>
        Math.abs(c.width - innerWidth) < 3 &&
        Math.abs(c.height - innerHeight) < 3,
    ),
  };
}
try {
  const configs = representative
    ? [
        { count: 4, dpr: 1, ids: ["mario-kart", "star-catch", "drawing"] },
        { count: 1, dpr: 1, ids: ["golf"] },
      ]
    : dprProbe
      ? [2, 3].flatMap((dpr) => [
          { count: 4, dpr, ids: ["mario-kart", "star-catch"] },
          { count: 1, dpr, ids: ["golf"] },
        ])
      : [
          { count: 1, dpr: 1 },
          { count: 4, dpr: 1 },
        ];
  for (const { count, dpr, ids } of configs) {
    const room = await f.createRoom(count, { dpr });
    for (const game of selected.filter(
      (game) => !ids || ids.includes(game.id),
    )) {
      console.log(`START ${game.id} ${count}p`);
      try {
        await room.page.setViewportSize({ width: 1280, height: 720 });
        await room.startGame(game.id, { maxViews: count > 1 });
        if (
          compact ||
          (representative && gameFit(game.id).surface !== "iframe")
        )
          await until(
            () => room.state.phase === "playing",
            15000,
            "active compact arena",
          );
        if (!dprProbe && gameFit(game.id).surface === "iframe") {
          const saved = await room.page
            .locator("[data-game-frame]")
            .evaluateAll((frames) =>
              frames.map((frame) => {
                const size = {
                  width: frame.style.width,
                  height: frame.style.height,
                };
                frame.style.width = "0px";
                frame.style.height = "0px";
                return size;
              }),
            );
          try {
            await sleep(80);
            const checks = [];
            for (const frame of room.page
              .frames()
              .filter((frame) => /\/games\//.test(frame.url())))
              checks.push(
                await frame.evaluate(() => {
                  const camera = window.__openwii?.camera;
                  return {
                    viewport: [innerWidth, innerHeight],
                    canvasFinite: [
                      ...document.querySelectorAll("canvas"),
                    ].every(
                      (canvas) =>
                        Number.isFinite(canvas.width) &&
                        Number.isFinite(canvas.height),
                    ),
                    cameraFinite: camera
                      ? [
                          camera.aspect,
                          ...camera.projectionMatrix.elements,
                        ].every(Number.isFinite)
                      : null,
                  };
                }),
              );
            report.zeroSizes.push({ game: game.id, players: count, checks });
            if (
              checks.some(
                (check) => !check.canvasFinite || check.cameraFinite === false,
              )
            )
              throw Error("Non-finite hidden-frame geometry");
          } finally {
            await room.page
              .locator("[data-game-frame]")
              .evaluateAll(
                (frames, sizes) =>
                  frames.forEach((frame, i) =>
                    Object.assign(frame.style, sizes[i]),
                  ),
                saved,
              );
            await sleep(80);
          }
        }
        for (const [name, width, height] of viewports) {
          await room.page.setViewportSize({ width, height });
          await sleep(250);
          const outer = await room.page.evaluate(() => ({
            width: innerWidth,
            height: innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
            scrollHeight: document.documentElement.scrollHeight,
          }));
          const frames =
            gameFit(game.id).surface === "iframe"
              ? room.page
                  .frames()
                  .filter((frame) => /\/games\//.test(frame.url()))
              : [room.page];
          const views = [];
          for (const frame of frames)
            views.push(await frame.evaluate(inspectViewport));
          const screenshot = `${game.id}-${count}p-${name}${dpr > 1 ? `-dpr${dpr}` : ""}.png`;
          await room.page.screenshot({
            path: resolve(f.output, screenshot),
            animations: "disabled",
            scale: "css",
          });
          const sample = {
            game: game.id,
            players: count,
            dpr,
            active: room.state.active?.length,
            viewport: name,
            screenshot,
            outer,
            views,
            errors: [...room.errors],
            expectedAudioProbes: [...room.expectedAudioProbes],
            consoleWarnings: [...new Set(room.consoleWarnings)],
          };
          report.samples.push(sample);
          const issues = [];
          if (outer.scrollWidth > width + 1 || outer.scrollHeight > height + 1)
            issues.push("shell overflow");
          if (!views.length) issues.push("no game view");
          views.forEach((view, i) => {
            for (const [condition, label] of [
              [view.overflow, "document overflow"],
              [view.scrolling.length, "scroll container"],
              [view.wide.length, "wide element"],
              [view.smallText.length, "small text"],
              [view.menuOverlap.length, "text covered by Game menu"],
              [view.camera && !view.camera.finite, "invalid camera"],
              [view.aimRoundtrip === false, "aim mapping roundtrip"],
              [view.tableFits === false, "table clipped"],
              [view.kartOffsets === false, "Time Trial HUD offset not scaled"],
              [
                view.powerBar &&
                  (!view.powerBar.scaled ||
                    !view.powerBar.aboveRail ||
                    !view.powerBar.contained),
                "golf power bar clipped or not scaled",
              ],
              [
                view.playable && view.playable.height < view.viewport[1] * 0.3,
                "arena playfield too small",
              ],
              [
                view.invalid.length || view.canvases.some((c) => !c.finite),
                "invalid dimensions",
              ],
              [!view.fills, "canvas does not fill frame"],
            ])
              if (condition) issues.push(`view ${i}: ${label}`);
          });
          if (dprProbe) {
            for (const [i, view] of views.entries()) {
              const primary = view.canvases.find(
                (c) =>
                  Math.abs(c.width - view.viewport[0]) < 3 &&
                  Math.abs(c.height - view.viewport[1]) < 3,
              );
              const split = game.id === "mario-kart" && count > 1;
              const budget = split
                ? 2100000 * count
                : views.length > 1
                  ? 2100000
                  : 4200000;
              if (primary && primary.pixels > budget)
                issues.push(`view ${i}: backing pixel budget exceeded`);
            }
          }
          if (room.errors.length) issues.push("page errors");
          if (issues.length)
            report.failures.push({
              game: game.id,
              players: count,
              viewport: name,
              issues,
            });
          console.log(
            `${issues.length ? "FAIL" : "PASS"} ${game.id} ${count}p ${name}${issues.length ? ": " + issues.join(", ") : ""}`,
          );
        }
      } catch (error) {
        report.failures.push({
          game: game.id,
          players: count,
          error: error.message,
          pageErrors: [...room.errors],
          state: {
            phase: room.state?.phase,
            game: room.state?.game,
            reason: room.state?.startReason,
          },
        });
        console.log(`FAIL ${game.id} ${count}p: ${error.message}`);
      }
      await room.command("lobby").catch(() => {});
      room.errors.length = 0;
      room.expectedAudioProbes.clear();
      room.consoleWarnings.length = 0;
    }
    room.phones.forEach((phone) => phone.disconnect());
    await room.context.close();
  }
} finally {
  await writeReport(f.output, report);
  await f.close();
}
console.log(
  `${report.samples.length} samples, ${report.failures.length} failing samples`,
);
if (report.failures.length) process.exitCode = 1;
