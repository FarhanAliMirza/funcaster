import { h } from "../util/h.js";
import { BRAND } from "../brand.js";
import { WINDOW_STRINGS } from "../strings.js";

export const manifest = {
  id: "message-box",
  title: BRAND.os,
  kind: "modal",
  size: { w: 460, h: 250 },
  singleton: false,
};

/** Plain text only: server errors and player-facing messages are untrusted. */
export function open(ctx, props = ctx.props || {}) {
  const actions = props.buttons?.length
    ? props.buttons
    : [{ id: "ok", label: WINDOW_STRINGS.ok }];
  const text = h("p", { class: "os-message-text", text: props.text || "" });
  const buttons = new Map();
  const el = h(
    "div",
    { class: "os-message" },
    text,
    h(
      "div",
      { class: "os-message-actions" },
      actions.map((action) => {
        const button = h("button", {
          class: `xp-button${action.id === props.defaultButton ? " xp-default" : ""}${action.danger ? " os-danger" : ""}`,
          type: "button",
          text: action.label || action.id,
          dataset: { nav: "", id: action.id },
          onclick: () => ctx.choose(action.id),
        });
        buttons.set(action.id, button);
        return button;
      }),
    ),
  );
  return {
    el,
    focus() {
      (
        buttons.get(props.defaultButton) || buttons.values().next().value
      )?.focus();
    },
    update(next) {
      if (typeof next?.text === "string") text.textContent = next.text;
    },
    destroy() {},
  };
}
