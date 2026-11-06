import { SHELL_STRINGS as S } from "../strings.js";
import { h } from "../util/h.js";
import { recoverConnection } from "../shell/connection.js";

export function open(ctx) {
  const connection = h("p", { class: "os-connection-state", role: "status" });
  const code = h("strong", { class: "os-room-code" });
  const players = h("ul", { class: "os-session-players" });
  const notice = h("p", { class: "os-session-notice", role: "status" });
  const retry = h("button", {
    class: "xp-button",
    text: S.reconnect,
    dataset: { nav: "", id: "retry-session" },
    onclick: () => recoverConnection(ctx.store.get(), ctx.getSession()),
  });
  const el = h(
    "div",
    { class: "os-session-status" },
    connection,
    h("div", { class: "os-room-label" }, S.room, code),
    players,
    notice,
    h(
      "div",
      { class: "os-welcome-actions" },
      retry,
      h("button", {
        class: "xp-button",
        text: S.about,
        dataset: { nav: "", id: "about" },
        onclick: () =>
          ctx.wm.modal({
            title: S.about,
            text: ctx.demo ? S.aboutDemo : S.aboutSession,
          }),
      }),
    ),
  );
  function update(state) {
    connection.textContent = ctx.demo
      ? S.demo
      : S.connections[state.connection] || S.connecting;
    code.textContent = state.room?.code || state.identity?.code || "—";
    const joined = state.room?.players || [];
    players.replaceChildren(
      ...(joined.length
        ? joined.map((player) =>
            h(
              "li",
              {},
              h("span", { text: player.name || S.player(player.slot + 1) }),
              h("span", {
                text: !player.connected
                  ? S.away
                  : player.ready
                    ? S.ready
                    : S.joined,
              }),
            ),
          )
        : [h("li", { text: S.noPlayers })]),
    );
    notice.textContent = state.error || state.notice || "";
    notice.hidden = !notice.textContent;
    retry.hidden =
      ctx.demo || ["connected", "connecting"].includes(state.connection);
    retry.textContent =
      state.connection === "update"
        ? S.reload
        : state.connection === "ended"
          ? S.newParty
          : S.reconnect;
  }
  update(ctx.store.get());
  return { el, update, destroy() {} };
}
