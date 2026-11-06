import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import {
  initialCodeFiles,
  initialSpriteFiles,
} from "../../scripts/os-assets/initial-files.mjs";
const root = resolve(import.meta.dirname, "../.."),
  base = join(root, "assets/os");
const read = (path) => JSON.parse(readFileSync(join(base, path), "utf8"));
const manifest = read("theme/theme-manifest.json");
function file(path) {
  assert.equal(typeof path, "string");
  assert.ok(!path.includes("..") && !path.startsWith("/"));
  assert.ok(existsSync(join(base, path)), path);
}
test("all manifest asset roles resolve locally, including all lazy sounds and mascot sheets", () => {
  for (const p of Object.values(manifest.wallpaper)) file(p);
  for (const p of [
    manifest.sprites,
    manifest.atlas,
    manifest.tokens,
    manifest.mascot,
    ...Object.values(manifest.fonts),
    ...Object.values(manifest.icons.files),
    ...Object.values(manifest.cursors).map((x) => x[0]),
  ])
    file(p);
  for (const cue of [
    "startup",
    "shutdown",
    "logon",
    "logoff",
    "click",
    "open",
    "close",
    "minimise",
    "restore",
    "menu",
    "ding",
    "notify",
    "balloon",
    "error",
    "warning",
    "edge",
    "joined",
    "left",
    "countdown",
    "go",
    "win",
    "lose",
  ])
    assert.ok(manifest.sounds[cue], cue);
  for (const cue of Object.values(manifest.sounds)) {
    if (cue.synth) continue;
    file(cue.ogg);
    file(cue.mp3);
  }
  const mascot = read(manifest.mascot);
  assert.equal(Object.keys(mascot.anims).length, 25);
  for (const anim of Object.values(mascot.anims)) {
    file(anim.file);
    assert.equal(anim.frameDurationsMs.length, anim.frames);
    assert.ok(anim.frameDurationsMs.every((x) => x > 0));
    assert.ok(anim.emptyFrames.every((x) => x < anim.frames));
  }
});
test("base atlas crops stay inside the sheet without overlapping; expanded states exist", () => {
  const atlas = read(manifest.atlas);
  assert.equal(atlas.baseRoles.length, 131);
  const boxes = atlas.baseRoles.map((role) => atlas.sprites[role]);
  for (const [i, a] of boxes.entries()) {
    assert.ok(
      a.x >= 0 &&
        a.y >= 0 &&
        a.x + a.w <= atlas.size[0] &&
        a.y + a.h <= atlas.size[1],
    );
    for (const b of boxes.slice(i + 1))
      assert.ok(
        Math.max(a.x, b.x) >= Math.min(a.x + a.w, b.x + b.w) ||
          Math.max(a.y, b.y) >= Math.min(a.y + a.h, b.y + b.h),
      );
  }
  for (const sprite of Object.values(atlas.sprites)) file(sprite.file);
  for (const state of ["hover", "pressed", "disabled", "inactive.hover"])
    file(atlas.sprites[`titlebtn.close.${state}`].file);
});
test("size budgets are enforced against current files, not a stale total", () => {
  const report = read("theme/size-report.json");
  const sum = (paths) => paths.reduce((n, p) => n + statSync(p).size, 0);
  const bytes = {
    wallpaper1080: statSync(join(base, manifest.wallpaper["1080"])).size,
    wallpaper2160: statSync(join(base, manifest.wallpaper["2160"])).size,
    fonts: sum(
      Object.values(manifest.fonts)
        .filter((x) => x.endsWith(".woff2"))
        .map((x) => join(base, x)),
    ),
    sounds: sum(
      readdirSync(join(base, "sounds")).map((x) => join(base, "sounds", x)),
    ),
  };
  // Recompute the dependency graph; lazy windows are not part of first load.
  const sources = initialCodeFiles(root);
  const sprites = initialSpriteFiles(root);
  const assets = report.initialFiles.filter(
    (path) =>
      (path.startsWith("assets/os/") && !path.startsWith("assets/os/ui/")) ||
      path === "assets/os/ui/luna-sprites.css" ||
      path.startsWith("public/fonts/"),
  );
  bytes.initialShell = sum([
    ...new Set([
      ...sources,
      ...sprites,
      ...assets.map((path) => join(root, path)),
    ]),
  ]);
  assert.ok(sources.includes(join(root, "core/catalog.js")));
  assert.ok(sources.includes(join(root, "public/party/art.js")));
  assert.ok(
    !sources.includes(join(root, "public/os/windows/game-properties.js")),
  );
  for (const [key, value] of Object.entries(bytes))
    assert.ok(
      value <= report.limits[key],
      `${key}: ${value} > ${report.limits[key]}`,
    );
});
test("font gaps are measured and every generated media asset has provenance", () => {
  assert.equal(read("fonts/coverage.json").tahoma.rupee, false);
  const credits = JSON.parse(
    readFileSync(join(root, "assets/CREDITS.json"), "utf8"),
  );
  const files = new Set(credits.map((x) => x.file));
  function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(png|webp|woff2|ogg|mp3)$/.test(e.name))
        assert.ok(files.has(p.slice(root.length + 1)), p);
    }
  }
  walk(base);
});

test("sprite variables use root URLs so consuming stylesheets can live outside the asset folder", () => {
  const css = readFileSync(join(base, manifest.sprites), "utf8");
  const urls = [...css.matchAll(/url\("([^"\n]+)"\)/g)].map(
    (match) => match[1],
  );
  assert.ok(urls.length >= 198);
  for (const url of urls) {
    assert.ok(url.startsWith("/assets/os/ui/"), url);
    file(url.replace("/assets/os/", ""));
  }
});

test("optional glove is a small transparent 128px export with the retained source and fingertip anchor", () => {
  const [path, x, y] = manifest.cursors.glove,
    png = readFileSync(join(base, path)),
    credits = JSON.parse(
      readFileSync(join(root, "assets/CREDITS.json"), "utf8"),
    ),
    credit = credits.find((entry) => entry.file === `assets/os/${path}`);
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [128, 128]);
  assert.equal(png[25], 6, "RGBA preserves transparency around the glove");
  assert.ok(png.length < 60_000);
  assert.deepEqual([x / 128, y / 128], [0.32, 0.09]);
  assert.equal(credit.source, "public/assets/hand-p1.png");
  assert.equal(
    createHash("sha256")
      .update(readFileSync(join(root, credit.source)))
      .digest("hex"),
    credit.sourceSha256,
  );
  assert.ok(
    !read("theme/size-report.json").initialFiles.includes(`assets/os/${path}`),
    "optional cursor is lazy",
  );
});
