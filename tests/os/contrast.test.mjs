import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(
  new URL("../../public/os/theme/tokens.css", import.meta.url),
  "utf8",
);
const token = (key) => {
  const hex = css.match(new RegExp(`--${key}:\\s*(#[a-f0-9]{6})`, "i"))?.[1];
  assert.ok(hex, key);
  return hex;
};
const lum = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
    .reduce((n, x, i) => n + x * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => {
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
test("body, selection, legends and inactive captions meet contrast", () => {
  for (const [a, b] of [
    ["lu-ink", "lu-face"],
    ["lu-ink-soft", "lu-face"],
    ["lu-select-ink", "lu-select"],
    ["lu-legend", "lu-face"],
  ])
    assert.ok(ratio(token(a), token(b)) >= 4.5, `${a}/${b}`);
  assert.ok(ratio(token("lu-title-ink-inactive"), "#7994de") >= 4.5);
  for (const seat of ["peeli", "magenta", "cyan", "marigold"])
    assert.ok(ratio(token("lu-ink"), token(`seat-${seat}`)) >= 4.5);
});
test("focus uses both light and dark outlines instead of low-contrast orange", () => {
  assert.match(css, /--focus:\s*0 0 0 2px #ffffff, 0 0 0 5px #111111/);
  assert.ok(ratio("#111111", token("lu-face")) >= 3);
  assert.ok(ratio("#ffffff", token("lu-taskbar")) >= 3);
});
test("Classic and Taxi text pairs preserve contrast across optional skins", () => {
  const skins = readFileSync(
    new URL("../../public/os/theme/skins.css", import.meta.url),
    "utf8",
  );
  for (const skin of ["classic", "taxi"]) {
    const block = skins.match(
      new RegExp(`:root\\[data-skin="${skin}"\\] \\{([^}]+)`),
    )[1];
    const value = (name) => {
      const hex = block.match(
        new RegExp(`--${name}:\\s*(#[a-f0-9]+)`, "i"),
      )?.[1];
      assert.ok(hex, `${skin}.${name}`);
      return hex.length === 4
        ? "#" + [...hex.slice(1)].map((c) => c + c).join("")
        : hex;
    };
    for (const [ink, fill] of [
      ["lu-ink", "lu-face"],
      ["lu-ink-soft", "lu-face"],
      ["lu-legend", "lu-face"],
      ["lu-link", "lu-face"],
      ["lu-select-ink", "lu-select"],
    ])
      assert.ok(
        ratio(value(ink), value(fill)) >= 4.5,
        `${skin}: ${ink}/${fill}`,
      );
  }
});
