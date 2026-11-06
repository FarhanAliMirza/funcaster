import { h } from "../util/h.js";
import { BOOT_STRINGS as S } from "../strings.js";
import { canNextPlayer, safePlaylist } from "../window-data.js";
import { skipGame } from "./staff-actions.js";
import { utility, button, note } from "./utility.js";
export function open(ctx) {
  const page = utility(ctx, S.staffIntro),
    status = note(""),
    stats = h("pre", { class: "os-staff-stats" });
  const controls = [
    ["staff-pause", S.pause, () => ctx.getSession().pause()],
    ["staff-next", S.nextPlayer, () => ctx.getSession().nextPlayer()],
    [
      "staff-lock",
      S.lock,
      () =>
        ctx.getSession().cmd("lock", { locked: !ctx.store.get().room?.locked }),
    ],
    ["staff-end", S.endMatch, () => ctx.getSession().lobby()],
  ].map(([id, label, action]) => {
    const control = button(id, label, () => page.run(control, action));
    return control;
  });
  const skip = button("staff-skip", S.skipGame, () =>
    page.run(skip, () =>
      skipGame(ctx.getSession(), () => ctx.store.get().room),
    ),
  );
  const pin = button("staff-pin", S.pinGame, () =>
    page.run(pin, () =>
      ctx.getSession().setup({ playlist: [ctx.store.get().room.game] }),
    ),
  );
  const classic = h("a", {
    class: "xp-button",
    href: "/?shell=classic",
    text: S.classic,
    dataset: { nav: "", id: "staff-classic" },
  });
  const settings = button("staff-settings", S.roomSettings, () =>
    ctx.openWindow("settings"),
  );
  const players = button("staff-players", S.players, () =>
    ctx.openWindow("players"),
  );
  const refresh = button("staff-stats", S.refresh, () =>
    page.run(refresh, async () => {
      const answer = await ctx.getSession().cmd("stats");
      if (answer.error) return answer;
      stats.textContent = JSON.stringify(answer.stats || answer, null, 2);
      return answer;
    }),
  );
  page.content.append(
    status,
    h(
      "div",
      { class: "os-staff-actions" },
      ...controls,
      skip,
      pin,
      players,
      settings,
      refresh,
      classic,
    ),
    stats,
  );
  function update(state) {
    const room = state.room;
    status.textContent = room
      ? S.staffStatus(room.operatingMode, room.locked)
      : S.connecting;
    controls[0].textContent = room?.paused ? S.resume : S.pause;
    const live = state.connection === "connected" && !ctx.demo;
    for (const control of [...controls, refresh]) page.enabled(control, live);
    page.enabled(
      controls[0],
      live &&
        ["classic", "playing", "countdown", "practice"].includes(room?.phase),
    );
    page.enabled(controls[1], live && canNextPlayer(state));
    page.enabled(skip, live && safePlaylist(room?.playlist).length >= 2);
    page.enabled(pin, live && ["lobby", "results"].includes(room?.phase));
    controls[2].textContent = room?.locked ? S.unlock : S.lock;
  }
  update(ctx.store.get());
  return page.finish(update);
}
