import { h } from "../util/h.js";
import { SEATS } from "../../../core/seats.js";
import { BOOT_STRINGS as S } from "../strings.js";
export function open(ctx) {
  ctx.window.body.classList.add("os-who-body");
  const players = h("div", { class: "os-who-seats" }),
    tiles = SEATS.map((seat, slot) => {
      const name = h("strong"),
        status = h("span"),
        avatar = h("span", {
          class: "os-avatar-slot",
          dataset: { avatarSlot: slot },
        });
      const tile = h(
        "div",
        { class: "os-who-seat" },
        h("span", {
          class: "os-who-shape",
          text: seat.shape,
          style: `color:${seat.color}`,
        }),
        avatar,
        name,
        status,
      );
      players.append(tile);
      return { tile, name, status };
    });
  const code = h("strong", { class: "os-who-code" }),
    qr = h("img", { class: "os-who-qr", alt: S.qrAlt, hidden: true }),
    qrNote = h("p", { text: S.qrLoading }),
    retry = h("button", {
      class: "xp-button",
      text: S.retry,
      dataset: { nav: "", id: "who-retry" },
      onclick: () => ctx.getSession()?.retryPairing?.(),
    });
  const join = h(
    "section",
    { class: "os-who-join", tabIndex: -1 },
    qr,
    qrNote,
    code,
    retry,
  );
  const fullscreen = h("button", {
    class: "xp-button",
    text: S.startScreen,
    dataset: { nav: "", id: "who-fullscreen" },
    onclick: () => ctx.enterFullscreen(),
  });
  const el = h(
    "div",
    { class: "os-who" },
    h("div", { class: "os-who-content" }, players, join),
    h(
      "footer",
      {},
      h("button", {
        class: "xp-button",
        text: S.scan,
        dataset: { nav: "", id: "who-scan" },
        onclick: () => join.focus(),
      }),
      fullscreen,
      h("button", {
        class: "xp-button xp-default",
        text: S.continue,
        dataset: { nav: "", id: "who-continue", navDefault: "" },
        onclick: () => ctx.boot.complete(),
      }),
    ),
  );
  function update(state) {
    tiles.forEach((tile, slot) => {
      const p = state.room?.players?.find((p) => p.slot === slot);
      tile.name.textContent = p?.name || SEATS[slot].name;
      tile.status.textContent = !p
        ? S.openSeat
        : !p.connected
          ? S.away
          : p.ready
            ? S.ready
            : S.gettingReady;
      tile.tile.classList.toggle("empty", !p);
    });
    code.textContent = state.room?.code || S.connecting;
    const src = state.pairing?.qr;
    qr.hidden = !src;
    if (src && qr.src !== src) qr.src = src;
    qrNote.hidden = !!src;
    qrNote.textContent = ctx.demo
      ? S.qrDemo
      : state.pairingError || S.qrLoading;
    qrNote.classList.toggle("os-qr-placeholder", !!ctx.demo);
    retry.hidden = !!ctx.demo || !!src || state.pairingLoading;
    fullscreen.hidden = !!document.fullscreenElement;
  }
  update(ctx.store.get());
  return {
    el,
    update,
    onClose() {
      ctx.boot.dismiss();
      return true;
    },
    destroy() {
      ctx.window.body.classList.remove("os-who-body");
    },
  };
}
