import { gameById } from "../../../core/catalog.js";
import { artwork } from "../../party/art.js";
import { GAME_STRINGS as S } from "../strings.js";
import { h } from "../util/h.js";
export function open(ctx) {
  const art = h("div", { class: "os-loading-art", "aria-hidden": "true" }),
    title = h("h2"),
    message = h("p", { role: "status", "aria-live": "polite" });
  const progress = h(
    "div",
    {
      class: "os-loading-progress",
      role: "progressbar",
      "aria-label": S.loading,
    },
    h("span"),
  );
  const retry = h("button", {
    type: "button",
    text: S.retry,
    class: "xp-button",
    dataset: { nav: "", id: "retry-game" },
    onclick: () => ctx.gameHost.retry(),
  });
  const back = h("button", {
    type: "button",
    text: S.back,
    class: "xp-button",
    dataset: { nav: "", id: "loading-back" },
    onclick: () => ctx.getSession().lobby(),
  });
  const actions = h("div", { class: "os-loading-actions" }, retry, back);
  const el = h(
    "div",
    { class: "os-loading" },
    art,
    title,
    message,
    progress,
    actions,
  );
  let gameId;
  function update(state) {
    const loading = ctx.gameHost.loading(),
      game = gameById(state.room?.game);
    if (gameId !== game.id) {
      gameId = game.id;
      art.innerHTML = artwork(game.id);
      art.style.setProperty("--bg", game.bg);
      art.style.setProperty("--c", game.color);
    }
    title.textContent = loading?.slow
      ? S.takingAWhile
      : S.loadingGame(game.title);
    message.textContent =
      loading?.error ||
      (state.room?.gate
        ? state.room.startReason || S.loadingGate
        : S.loadingViews(loading?.ready || 0, loading?.total || 1));
    actions.hidden = !loading?.slow;
    progress.hidden = !!loading?.slow;
  }
  update(ctx.store.get());
  return {
    el,
    update,
    onClose: () => {
      void ctx.getSession().lobby();
      return false;
    },
    destroy() {},
  };
}
