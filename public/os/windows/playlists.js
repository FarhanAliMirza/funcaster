import { games } from "../../../core/catalog.js";
import { h } from "../util/h.js";
import { PLAYLISTS, safePlaylist, canEdit } from "../window-data.js";
import { WINDOW_CONTENT_STRINGS as S } from "../strings.js";
import { utility, button, note, section } from "./utility.js";
export function open(ctx) {
  const page = utility(ctx, S.playlistsIntro);
  let selected = "quick";
  const presets = h("div", {
    class: "os-playlist-presets",
    role: "radiogroup",
    "aria-label": S.playlistsIntro,
    dataset: { navGroup: "playlist" },
  });
  const buttons = Object.keys(PLAYLISTS).map((id) => {
    const item = button(
      `playlist-${id}`,
      S[id],
      () => {
        selected = id;
        page.refresh();
      },
      { role: "radio" },
    );
    presets.append(item);
    return [id, item];
  });
  const preview = h("ol", { class: "os-game-queue" }),
    current = h("ol", { class: "os-game-queue" }),
    empty = note(S.noQueue);
  const run = button("run-playlist", S.run, () =>
    page.run(run, async () => {
      const session = ctx.getSession(),
        playlist = [...PLAYLISTS[selected]];
      const answer = await session.setup({ playlist });
      if (answer?.error) return answer;
      const chosen = session.select(playlist[0]);
      if (chosen?.error) return chosen;
      await ctx.openGame(playlist[0]);
      return { ok: true };
    }),
  );
  page.content.append(
    presets,
    preview,
    note(S.playlistHint),
    section(S.currentQueue, current, empty),
  );
  page.footer.append(run);
  const rows = (ids, index = -1) =>
    ids.map((id, i) =>
      h("li", {
        text: `${i === index ? S.now + " · " : ""}${games.find((g) => g.id === id)?.title || id}`,
        class: i === index ? "is-current" : "",
      }),
    );
  function update(state) {
    buttons.forEach(([id, b]) =>
      b.setAttribute("aria-checked", String(id === selected)),
    );
    preview.replaceChildren(...rows(PLAYLISTS[selected]));
    const queue = safePlaylist(state.room?.playlist);
    current.replaceChildren(...rows(queue, state.room?.playlistIndex));
    empty.hidden = !!queue.length;
    page.enabled(run, canEdit(state) && !ctx.demo);
  }
  page.refresh = () => update(ctx.store.get());
  page.refresh();
  return { el: page.el, update, destroy: page.destroy };
}
