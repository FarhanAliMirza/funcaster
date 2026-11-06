import { clamp } from "./util/h.js";
export function computeScale(
  width,
  height,
  { tvScale = "auto", safeArea = 0, dpr = 1 } = {},
) {
  width = Math.max(1, Number(width) || 1);
  height = Math.max(1, Number(height) || 1);
  const tv = [1, 1.25, 1.5, 2].includes(Number(tvScale)) ? Number(tvScale) : 1;
  const ui = clamp(Math.min(width / 1280, height / 720) * tv, 0.9, 4);
  const safe = [3, 5].includes(Number(safeArea)) ? Number(safeArea) / 100 : 0;
  return {
    ui,
    width,
    height,
    designWidth: width / ui,
    designHeight: height / ui,
    pixelScale: Math.max(1, Math.round(ui * dpr)) / dpr,
    safeX: width * safe,
    safeY: height * safe,
    work: {
      x: width * safe,
      y: height * safe,
      w: width * (1 - 2 * safe),
      h: Math.max(0, height * (1 - 2 * safe) - 42 * ui),
    },
  };
}
export function mountScale(root, settings = {}) {
  let frame = 0,
    latest;
  const apply = () => {
    frame = 0;
    latest = computeScale(innerWidth, innerHeight, {
      ...settings,
      dpr: devicePixelRatio || 1,
    });
    const values = {
      "--ui": latest.ui,
      "--px": `${latest.ui}px`,
      "--vw-d": `${latest.designWidth}px`,
      "--vh-d": `${latest.designHeight}px`,
      "--pixel-scale": latest.pixelScale,
      "--safe-x": `${latest.safeX}px`,
      "--safe-y": `${latest.safeY}px`,
    };
    for (const [key, value] of Object.entries(values))
      root.style.setProperty(key, value);
    root.dispatchEvent(new CustomEvent("os:resize", { detail: latest }));
  };
  const resize = () => {
    if (!frame) frame = requestAnimationFrame(apply);
  };
  addEventListener("resize", resize);
  globalThis.visualViewport?.addEventListener("resize", resize);
  apply();
  return {
    get: () => latest,
    update: (next) => {
      Object.assign(settings, next);
      apply();
    },
    destroy() {
      removeEventListener("resize", resize);
      globalThis.visualViewport?.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
    },
  };
}
