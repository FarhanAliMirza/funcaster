import { h } from "../util/h.js";
import { WINDOW_CONTENT_STRINGS as S } from "../strings.js";
import { utility, button, note, confirm } from "./utility.js";
export function open(ctx) {
  const page = utility(ctx, S.recycleIntro),
    list = h("ul", { class: "os-record-list" });
  let signature = "",
    rows = [],
    offset = 0;
  const previous = button(
    "removed-previous",
    "←",
    () => {
      offset = Math.max(0, offset - 8);
      page.refresh();
    },
    { "aria-label": S.previous },
  );
  const next = button(
    "removed-next",
    "→",
    () => {
      offset += 8;
      page.refresh();
    },
    { "aria-label": S.nextPage },
  );
  page.content.append(list);
  page.footer.append(previous, next);
  function update(state) {
    const removed = Array.isArray(state.room?.removedPlayers)
        ? state.room.removedPlayers
        : [],
      lastPage = Math.max(0, Math.floor((removed.length - 1) / 8) * 8);
    offset = Math.min(offset, lastPage);
    page.enabled(previous, offset > 0);
    page.enabled(next, offset < lastPage);
    previous.hidden = next.hidden = removed.length <= 8;
    const key = JSON.stringify([
      removed,
      offset,
      state.room?.removedPlayers !== undefined,
    ]);
    if (key !== signature) {
      signature = key;
      rows = [];
      list.replaceChildren(
        ...(removed.length
          ? removed.slice(offset, offset + 8).map((player) => {
              const timer = note("");
              const restore = button(
                `restore-${player.restoreId}`,
                S.restore,
                () =>
                  page.run(restore, async () => {
                    if (
                      !(await confirm(
                        ctx,
                        S.restoreTitle,
                        S.restoreText,
                        S.restore,
                      ))
                    )
                      return { cancelled: true };
                    return ctx.getSession().restorePlayer(player.restoreId);
                  }),
              );
              rows.push({ player, timer, restore });
              return h(
                "li",
                { class: "os-record-row" },
                h("div", {}, h("strong", { text: player.name }), timer),
                restore,
              );
            })
          : [
              h("li", {
                text:
                  state.room && state.room.removedPlayers === undefined
                    ? S.recycleUnsupported
                    : S.noRemoved,
              }),
            ]),
      );
    }
    const serverNow = Date.now() + (state.serverOffset || 0);
    for (const row of rows) {
      const seconds = Math.max(0, (row.player.expiresAt - serverNow) / 1000);
      row.timer.textContent = seconds ? S.timeout(seconds) : S.expired;
      page.enabled(
        row.restore,
        state.connection === "connected" && !ctx.demo && seconds > 0,
      );
    }
  }
  page.refresh = () => update(ctx.store.get());
  const timer = setInterval(page.refresh, 1000);
  page.refresh();
  return {
    el: page.el,
    update,
    destroy() {
      clearInterval(timer);
      page.destroy();
    },
  };
}
