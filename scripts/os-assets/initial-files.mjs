import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
/** Follow the initial module/CSS graph. Lazy window/game modules are not first-load bytes. */
export function initialCodeFiles(root) {
  const seen = new Set();
  function add(file) {
    file = resolve(file);
    if (seen.has(file) || !existsSync(file)) return;
    if (relative(root, file).startsWith(".."))
      throw new Error("Initial module escaped the repository");
    seen.add(file);
    const extension = extname(file),
      text = readFileSync(file, "utf8");
    const refs = [];
    if ([".js", ".mjs"].includes(extension)) {
      // Static import/export declarations only; import(...) is deliberately lazy.
      for (const match of text.matchAll(
        /\b(?:import|export)\s+(?:(?:[^;"'`]+?)\s+from\s*)?["']([^"']+)["']/g,
      ))
        refs.push(match[1]);
    } else if (extension === ".html") {
      for (const match of text.matchAll(
        /<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/g,
      ))
        refs.push(match[1]);
    } else if (extension === ".css") {
      for (const match of text.matchAll(
        /(?:url\(\s*|@import\s*)["']?([^\s"')]+)["']?\s*\)?/g,
      ))
        refs.push(match[1]);
    }
    for (const ref of refs) {
      if (ref.startsWith("data:") || ref.includes("://") || ref.startsWith("#"))
        continue;
      if (!ref.startsWith(".") && !ref.startsWith("/")) continue;
      const path = ref.split(/[?#]/)[0];
      const target = path.startsWith("/")
        ? resolve(
            root,
            /^(?:\/core\/|\/sdk\/|\/assets\/)/.test(path)
              ? `.${path}`
              : `public${path}`,
          )
        : resolve(dirname(file), path);
      if (target.includes("/assets/source/"))
        throw new Error("Source asset referenced by initial shell");
      add(target);
    }
  }
  add(resolve(root, "public/os/index.html"));
  return [...seen].sort();
}
export function initialSpriteFiles(root) {
  const source = initialCodeFiles(root)
    .filter((p) => extname(p) === ".css")
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  const used = new Set(
    [...source.matchAll(/var\((--sp-[a-z0-9-]+)/g)].map((m) => m[1]),
  );
  const css = readFileSync(
    resolve(root, "assets/os/ui/luna-sprites.css"),
    "utf8",
  );
  return [...css.matchAll(/(--sp-[a-z0-9-]+): url\("([^"\n]+)"\)/g)]
    .filter((m) => used.has(m[1]))
    .map((m) => resolve(root, `.${m[2]}`));
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  process.stdout.write(
    JSON.stringify(
      [...initialCodeFiles(root), ...initialSpriteFiles(root)].map((path) =>
        relative(root, path),
      ),
    ),
  );
}
