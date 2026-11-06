import { SHELL_STRINGS as S } from "../strings.js";
import { h } from "../util/h.js";
export function recoveryAction(state, session) {
  if (!session || state.connection === "update") return "reload";
  return state.connection === "ended" ? "newParty" : "reconnect";
}
export function recoverConnection(
  state,
  session,
  reload = () => location.reload(),
) {
  const action = recoveryAction(state, session);
  return action === "reload" ? reload() : session[action]();
}
/** Native modal recovery stays above game frames and releases on reconnection. */
export function mountConnection({ root, store, context }) {
  const message = h("span", { role: "status" });
  const retry = h("button", {
    class: "xp-button",
    dataset: { nav: "", id: "connection-retry" },
    onclick: () => recoverConnection(store.get(), context.getSession()),
  });
  const el = h(
    "dialog",
    { class: "xp-window os-connection-dialog", "aria-label": S.connection },
    h("header", { class: "xp-titlebar" }, h("h2", { text: S.connection })),
    h("div", { class: "os-connection-content" }, message, retry),
  );
  // Keep the native top-layer dialog outside the WM root: a pending XP
  // confirmation makes root siblings inert, which must never disable recovery.
  root.ownerDocument.body.append(el);
  let previous = null;
  function update(state) {
    const hidden =
      context.shuttingDown ||
      (context.demo && !context.previewConnection) ||
      ["connected", "connecting", "demo"].includes(state.connection) ||
      context.boot?.stage() === "booting";
    if (hidden && el.open) el.close();
    else if (!hidden && state.connection !== previous) {
      el.showModal();
      retry.focus();
      context.audio?.cue("error");
    }
    previous = state.connection;
    message.textContent =
      state.error ||
      (state.connection === "reconnecting"
        ? S.connectionPaused
        : S.connections[state.connection]) ||
      S.connecting;
    retry.textContent =
      state.connection === "update"
        ? S.reload
        : state.connection === "ended"
          ? S.newParty
          : S.reconnect;
  }
  const unsubscribe = store.subscribe((s) => s, update);
  update(store.get());
  return {
    scope: () => (el.open ? el : null),
    refresh: () => update(store.get()),
    dismiss: () => el.close(),
    destroy() {
      unsubscribe();
      if (el.open) el.close();
      el.remove();
    },
  };
}
