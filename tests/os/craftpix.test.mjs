import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";
const root = resolve(import.meta.dirname, "../..");
const base = join(root, "assets/os");
const read = (path) => JSON.parse(readFileSync(join(base, path), "utf8"));
const manifest = read("theme/theme-manifest.json");
const pets = read("pets/pets.json");
const avatars = read("avatars/avatars.json");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const archives = new Map();

// Inspect ZIP members in memory using Node built-ins. The default test suite
// needs neither Python/Pillow nor a platform-specific unzip executable.
function archiveMember(filename, member) {
  if (!archives.has(filename))
    archives.set(
      filename,
      readFileSync(join(root, "assets/source/craftpix", filename)),
    );
  const zip = archives.get(filename);
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--;
  assert.ok(end >= 0, "ZIP central directory exists");
  let at = zip.readUInt32LE(end + 16);
  const count = zip.readUInt16LE(end + 10);
  for (let i = 0; i < count; i++) {
    assert.equal(zip.readUInt32LE(at), 0x02014b50);
    const method = zip.readUInt16LE(at + 10),
      size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28),
      extraLength = zip.readUInt16LE(at + 30),
      commentLength = zip.readUInt16LE(at + 32);
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString("utf8");
    if (name === member) {
      const local = zip.readUInt32LE(at + 42);
      assert.equal(zip.readUInt32LE(local), 0x04034b50);
      const start =
        local +
        30 +
        zip.readUInt16LE(local + 26) +
        zip.readUInt16LE(local + 28);
      const bytes = zip.subarray(start, start + size);
      assert.ok([0, 8].includes(method));
      return method === 8 ? inflateRawSync(bytes) : bytes;
    }
    at += 46 + nameLength + extraLength + commentLength;
  }
  assert.fail(`Missing ZIP member ${member}`);
}

const sprites = [
  ...Object.values(pets.pets),
  ...Object.values(avatars.avatars),
];
test("the approved five pets and four fixed seat avatars are complete, with no combat sheets", () => {
  assert.equal(manifest.pets, "pets/pets.json");
  assert.equal(manifest.avatars, "avatars/avatars.json");
  assert.equal(pets.maxVisible, 2);
  assert.deepEqual(Object.keys(pets.pets), [
    "dog",
    "dog-2",
    "cat",
    "cat-2",
    "crow",
  ]);
  assert.deepEqual(avatars.seats, ["biker", "punk", "cyborg", "townsperson"]);
  assert.deepEqual(Object.keys(avatars.avatars), avatars.seats);
  for (const pet of Object.values(pets.pets))
    assert.deepEqual(Object.keys(pet.anims), ["idle", "walk"]);
  for (const avatar of Object.values(avatars.avatars))
    assert.deepEqual(Object.keys(avatar.anims), ["idle", "run"]);
  for (const folder of ["pets", "avatars"]) {
    const expected = sprites
      .flatMap((sprite) => Object.values(sprite.anims).map((anim) => anim.file))
      .filter((file) => file.startsWith(folder + "/"))
      .map((file) => file.split("/").at(-1));
    assert.deepEqual(
      readdirSync(join(base, folder))
        .filter((name) => name.endsWith(".png"))
        .sort(),
      expected.sort(),
    );
  }
});

test("every shipped sheet is byte-identical to its approved source member, with valid measured frames", () => {
  for (const sprite of sprites) {
    const cell = sprite.id === "crow" ? 32 : 48;
    assert.deepEqual(sprite.frame, [cell, cell]);
    assert.ok(sprite.anchor[0] >= 0 && sprite.anchor[0] <= cell);
    assert.ok(sprite.anchor[1] > 0 && sprite.anchor[1] <= cell);
    for (const [role, anim] of Object.entries(sprite.anims)) {
      const bytes = readFileSync(join(base, anim.file));
      assert.deepEqual(
        bytes,
        archiveMember(anim.source.archive, anim.source.member),
      );
      assert.equal(digest(bytes), anim.source.sha256);
      assert.equal(
        digest(archives.get(anim.source.archive)),
        anim.source.archiveSha256,
      );
      assert.equal(bytes.subarray(1, 4).toString(), "PNG");
      const width = bytes.readUInt32BE(16),
        height = bytes.readUInt32BE(20);
      assert.deepEqual(anim.sheet, [width, height]);
      assert.equal(height, cell);
      assert.equal(width, anim.frames * cell);
      assert.equal(anim.frames, role === "idle" ? 4 : 6);
      assert.deepEqual(anim.frameDurationsMs, Array(anim.frames).fill(120));
      assert.equal(anim.frameRects.length, anim.frames);
      for (const [index, rect] of anim.frameRects.entries()) {
        assert.deepEqual(
          [rect.x, rect.y, rect.w, rect.h],
          [index * cell, 0, cell, cell],
        );
        const [left, top, right, bottom] = rect.inkBounds;
        assert.ok(0 <= left && left < right && right <= cell);
        assert.ok(0 <= top && top < bottom && bottom <= sprite.anchor[1]);
      }
    }
  }
  const townsperson = avatars.avatars.townsperson;
  assert.equal(townsperson.selection.sourceCharacter, 4);
  assert.equal(townsperson.anims.idle.source.member, "4/Idle.png");
  assert.equal(townsperson.anims.run.source.member, "4/Walk.png");
  assert.equal(townsperson.anims.run.sourceAnimation, "walk");
});

test("each used pack and sheet has unmodified provenance, and all CraftPix media stays lazy", () => {
  const credits = JSON.parse(
    readFileSync(join(root, "assets/CREDITS.json"), "utf8"),
  );
  const used = credits.filter((entry) => entry.author === "CraftPix.net");
  const packs = used.filter((entry) => entry.file.endsWith(".zip"));
  assert.equal(packs.length, 3);
  for (const entry of used) {
    assert.equal(entry.modified, false);
    assert.equal(entry.sourceUrl, "https://craftpix.net/file-licenses/");
  }
  for (const sprite of sprites)
    for (const anim of Object.values(sprite.anims)) {
      assert.ok(used.some((entry) => entry.file === `assets/os/${anim.file}`));
      assert.ok(
        packs.some((entry) => entry.outputs.includes(`assets/os/${anim.file}`)),
      );
    }
  const report = read("theme/size-report.json");
  assert.ok(report.bytes.lazyPets > 0 && report.bytes.lazyAvatars > 0);
  assert.ok(
    report.initialFiles.every(
      (file) => !/^assets\/os\/(pets|avatars)\//.test(file),
    ),
  );
});
