import { h } from "../util/h.js";
export function createContextMenu(root, { onScope = () => {} } = {}) {
  let el, opener;
  const close = () => {
    if (!el) return;
    el.remove();
    el = null;
    onScope(null);
    if (opener?.isConnected) opener.focus();
  };
  const outside = (e) => {
    if (el && !el.contains(e.target)) close();
  };
  const key = (e) => {
    if (!el) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (["ArrowUp", "ArrowDown", "Tab"].includes(e.key)) {
      e.preventDefault();
      const buttons = [...el.querySelectorAll("button:not([disabled])")];
      const delta = e.key === "ArrowUp" || e.shiftKey ? -1 : 1;
      const at = buttons.indexOf(document.activeElement);
      buttons[(at + delta + buttons.length) % buttons.length]?.focus();
    }
  };
  document.addEventListener("pointerdown", outside);
  document.addEventListener("keydown", key);
  return {
    close,
    open(event, entries) {
      close();
      opener = document.activeElement;
      el = h("div", { class: "os-context-menu", role: "menu" });
      for (const entry of entries)
        el.append(
          h("button", {
            text: entry.label,
            role: "menuitem",
            disabled: entry.disabled,
            dataset: { nav: "", id: entry.id || entry.label },
            onclick() {
              close();
              entry.action();
            },
          }),
        );
      root.append(el);
      const rect = el.getBoundingClientRect();
      el.style.left = `${Math.max(8, Math.min(event.clientX, innerWidth - rect.width - 8))}px`;
      el.style.top = `${Math.max(8, Math.min(event.clientY, innerHeight - rect.height - 8))}px`;
      el.querySelector("button:not([disabled])")?.focus();
      onScope(el);
    },
    destroy() {
      close();
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    },
  };
}
