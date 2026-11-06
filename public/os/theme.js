const BASE = "/assets/os/";
export function assetUrl(path) {
  if (
    typeof path !== "string" ||
    path.startsWith("/") ||
    path.includes("..") ||
    /^[a-z]+:/i.test(path)
  )
    return null;
  return BASE + path;
}
export async function loadTheme() {
  const response = await fetch(`${BASE}theme/theme-manifest.json`);
  if (!response.ok) throw new Error("Theme manifest is unavailable");
  const manifest = await response.json();
  const style = (path) =>
    new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = assetUrl(path);
      link.onload = resolve;
      link.onerror = reject;
      document.head.append(link);
    });
  await Promise.all([style(manifest.sprites), style(manifest.fonts.css)]);
  const cursor = manifest.cursors.arrow;
  document.documentElement.style.setProperty(
    "--cursor-arrow",
    `url("${assetUrl(cursor[0])}") ${cursor[1]} ${cursor[2]}, auto`,
  );
  return {
    manifest,
    asset: (role) =>
      assetUrl(role.split(".").reduce((node, key) => node?.[key], manifest)),
    url: assetUrl,
    icon: (role) => assetUrl(manifest.icons.files[role]),
    wallpaper: () =>
      assetUrl(
        manifest.wallpaper[
          innerHeight * devicePixelRatio >= 1500 ? "2160" : "1080"
        ],
      ),
  };
}
