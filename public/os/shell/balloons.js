import { h } from "../util/h.js";
import { DESKTOP_STRINGS as S } from "../strings.js";
export function mountBalloons(root, { onShow = () => {} } = {}) {
  const el = h("aside", { class: "os-balloons", "aria-live": "polite" });
  root.append(el);
  const queue = [];
  let timer = null,
    current = null,
    suspended = false;
  function next() {
    clearTimeout(timer);
    current = queue.shift();
    el.replaceChildren();
    if (!current) return;
    onShow(current);
    el.append(
      h("button", {
        class: "os-balloon-close",
        text: "×",
        "aria-label": S.closeNotice,
        onclick: next,
        dataset: { nav: "", id: "dismiss-notification" },
      }),
      h("strong", { text: current.title }),
      h("p", { text: current.text }),
    );
    if (current.action)
      el.append(
        h("button", {
          class: "xp-button",
          text: current.action.label,
          dataset: { nav: "", id: "notification-action" },
          onclick() {
            const action = current.action.run;
            next();
            action();
          },
        }),
      );
    timer = setTimeout(next, current.duration || 6000);
  }
  return {
    suspend(value) {
      suspended = !!value;
      if (suspended) this.clear();
    },
    show(message) {
      if (suspended) return;
      if (
        message.key &&
        (current?.key === message.key ||
          queue.some((item) => item.key === message.key))
      )
        return;
      queue.push(message);
      if (queue.length > 3) queue.shift();
      if (!current) next();
    },
    clear() {
      queue.length = 0;
      clearTimeout(timer);
      current = null;
      el.replaceChildren();
    },
    destroy() {
      clearTimeout(timer);
      el.remove();
    },
  };
}
