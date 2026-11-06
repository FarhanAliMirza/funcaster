import { h } from "../util/h.js";
import { gameById } from "../../../core/catalog.js";
import { BOOT_STRINGS as S } from "../strings.js";
export function open(ctx) {
  const qr = h("img", { class: "os-who-qr", alt: S.qrAlt, hidden: true }),
    code = h("strong", { class: "os-attract-code" }),
    next = h("p"),
    placeholder = h("p", {
      class: "os-qr-placeholder",
      text: ctx.demo ? S.qrDemo : S.qrLoading,
    }),
    scores = h("ol", { class: "os-attract-scores" });
  const el = h(
    "div",
    { class: "os-attract" },
    h(
      "div",
      { class: "os-attract-columns" },
      h("section", {}, qr, placeholder, code, next),
      h("section", {}, h("h2", { text: S.leaderboard }), scores),
    ),
    h("button", {
      class: "xp-button xp-default",
      text: S.wake,
      dataset: { nav: "", id: "attract-wake", navDefault: "" },
      onclick: () => ctx.boot.complete(),
    }),
  );
  function update(state) {
    const room = state.room;
    code.textContent = room?.code || S.connecting;
    next.textContent = S.next(gameById(room?.game).title);
    const src = state.pairing?.qr;
    qr.hidden = !src;
    placeholder.hidden = !!src;
    if (src) qr.src = src;
    scores.replaceChildren();
    const records = Array.isArray(room?.leaderboard) ? room.leaderboard : [];
    for (const row of records.slice(0, 5))
      scores.append(
        h("li", {
          text: `${row.name || row.player || S.player} · ${row.score ?? row.total ?? 0}`,
        }),
      );
    if (!records.length) scores.append(h("li", { text: S.firstScore }));
  }
  update(ctx.store.get());
  return {
    el,
    update,
    onClose() {
      ctx.boot.dismiss();
      return true;
    },
    destroy() {},
  };
}
