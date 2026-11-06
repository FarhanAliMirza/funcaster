import { h } from "../util/h.js";
export function mountDesktop(root, theme) {
  const wallpaper = h("img", {
    class: "os-wallpaper",
    alt: "",
    draggable: false,
  });
  const work = h("main", {
    class: "os-work",
    "aria-label": "Desktop",
    dataset: { desktop: "" },
  });
  root.append(wallpaper, work);
  let previous;
  async function refresh() {
    const url = theme.wallpaper();
    if (url === previous) return;
    previous = url;
    wallpaper.src = url;
    try {
      await wallpaper.decode();
      wallpaper.classList.add("ready");
    } catch {
      /* The sky placeholder remains usable. */
    }
  }
  addEventListener("resize", refresh);
  const ready = refresh();
  return {
    el: work,
    ready,
    destroy() {
      removeEventListener("resize", refresh);
      wallpaper.remove();
      work.remove();
    },
  };
}
