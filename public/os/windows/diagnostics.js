import { h } from "../util/h.js";
import { playerRows, ageText } from "../window-data.js";
import { WINDOW_CONTENT_STRINGS as S } from "../strings.js";
import { utility, button, note, section } from "./utility.js";
export function open(ctx) {
  const page = utility(ctx, S.diagnosticsIntro),
    build = h("dd"),
    age = h("dd"),
    health = h("dd", { text: S.unavailable }),
    details = h("dl", { class: "os-diagnostic-facts" }),
    players = h("ul", { class: "os-diagnostic-players" }),
    metrics = h("dl", { class: "os-diagnostic-facts" });
  let abort = null,
    alive = true,
    healthBuild = "";
  for (const [label, value] of [
    [S.build, build],
    [S.roomAge, age],
    [S.serverHealth, health],
  ])
    details.append(h("dt", { text: label }), value);
  const refresh = button("diagnostics-health", S.refreshHealth, () =>
    page.run(refresh, async () => {
      abort?.abort();
      abort = new AbortController();
      try {
        const response = await fetch("/api/health", {
          signal: abort.signal,
          cache: "no-store",
        });
        if (!response.ok) throw Error();
        const data = await response.json();
        if (!alive) return;
        if (!data.ok) throw Error();
        health.textContent = S.healthy;
        healthBuild = typeof data.buildId === "string" ? data.buildId : "";
      } catch (error) {
        if (error.name !== "AbortError" && alive)
          health.textContent = S.healthFail;
      }
      if (ctx.store.get().connection === "connected" && !ctx.demo) {
        const answer = await ctx.getSession().cmd("stats");
        if (!alive) return;
        metrics.replaceChildren(
          ...(answer?.metrics
            ? ["joins", "rounds", "completed", "forfeits"].flatMap((key) => [
                h("dt", { text: S[key] }),
                h("dd", {
                  text: Number.isFinite(answer.metrics[key])
                    ? answer.metrics[key]
                    : S.unavailable,
                }),
              ])
            : [h("dd", { text: S.statsUnavailable })]),
        );
      }
      return { ok: true };
    }),
  );
  page.content.append(
    details,
    section(S.playersIntro, players),
    section(S.metrics, metrics),
  );
  page.footer.append(
    h("a", {
      class: "xp-button",
      text: S.selfTest,
      href: "/self-test",
      target: "_blank",
      rel: "noopener noreferrer",
      dataset: { nav: "", id: "diagnostics-self-test" },
    }),
    refresh,
  );
  function update(state) {
    const room = state.room;
    build.textContent = room?.buildId || healthBuild || S.unavailable;
    age.textContent = ageText(
      room?.createdAt,
      Date.now() + (state.serverOffset || 0),
    );
    const rows = playerRows(room).filter((row) => row.player);
    players.replaceChildren(
      ...(rows.length
        ? rows.map((row) => {
            const device = row.player.device;
            return h(
              "li",
              {},
              h("strong", { text: `${row.shape} ${row.name}` }),
              note(
                device
                  ? `${S.tier(device.tier)} · ${device.platform} · ${S.sampling(device.hz)} · ${device.secure ? S.secure : S.insecure}`
                  : S.noDevice,
              ),
              note(
                `${S.latency}: ${Number.isFinite(device?.latencyMs) ? device.latencyMs + " ms" : S.latencyUnknown}`,
              ),
            );
          })
        : [h("li", { text: S.noPlayers })]),
    );
  }
  page.refresh = () => update(ctx.store.get());
  page.refresh();
  refresh.click();
  return {
    el: page.el,
    update,
    destroy() {
      alive = false;
      abort?.abort();
      page.destroy();
    },
  };
}
