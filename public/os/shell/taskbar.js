import { BRAND } from "../brand.js";
import { SHELL_STRINGS as S } from "../strings.js";
import { h } from "../util/h.js";

export function mountTaskbar(root, { onStart, onWindow, tray, onContext }) {
  const start = h("button", {
    class: "os-start",
    text: BRAND.wordmark,
    "aria-label": S.openDesktop,
    dataset: { nav: "", id: "start" },
    onclick: onStart,
  });
  const tasks = h("nav", { class: "os-tasks", "aria-label": S.openWindows });
  const status = h("span", { class: "os-status", text: S.connecting });
  const clock = h("time", { "aria-label": S.currentTime });
  const el = h(
    "footer",
    { class: "os-taskbar", "aria-label": S.taskbar },
    start,
    tasks,
    tray || h("div", { class: "os-tray" }, status, clock),
  );
  root.append(el);
  const tick = () => {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    clock.dateTime = now.toISOString();
  };
  tick();
  const timer = setInterval(tick, 30000);
  const buttons = new Map();
  return {
    el,
    start,
    update(windows) {
      const visible = windows.filter((entry) => entry.kind !== "modal");
      for (const [id, button] of buttons) {
        if (!visible.some((entry) => entry.id === id)) {
          button.remove();
          buttons.delete(id);
        }
      }
      for (const entry of visible) {
        let button = buttons.get(entry.id);
        if (!button) {
          button = h(
            "button",
            {
              class: "os-task",
              type: "button",
              title: entry.title,
              "aria-label": entry.title,
              dataset: { nav: "", id: `task-${entry.id}` },
              onclick: () => onWindow(entry.id),
              oncontextmenu: (event) => {
                event.preventDefault();
                onContext?.(event, entry.id);
              },
            },
            entry.icon ? h("img", { src: entry.icon, alt: "" }) : null,
            h("span", { text: entry.title }),
          );
          buttons.set(entry.id, button);
          tasks.append(button);
        }
        button.title = entry.title;
        button.setAttribute("aria-label", entry.title);
        button.querySelector("span").textContent = entry.title;
        const image = button.querySelector("img");
        if (image && entry.icon) image.src = entry.icon;
        button.setAttribute("aria-pressed", String(entry.active));
        button.dataset.state = entry.state;
      }
    },
    status(text) {
      status.textContent = text;
    },
    destroy() {
      clearInterval(timer);
      el.remove();
    },
  };
}
