import { BRAND } from "../brand.js";
import { STRINGS, SHELL_STRINGS as S } from "../strings.js";
import { h } from "../util/h.js";

export function open(ctx) {
  const fullscreen = h("button", {
    class: "xp-button",
    dataset: { nav: "", id: "fullscreen" },
    async onclick() {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else
          await document.documentElement.requestFullscreen({
            navigationUI: "hide",
          });
      } catch {
        void ctx.wm.modal({
          title: S.fullscreenTitle,
          text: S.fullscreenUnavailable,
        });
      }
    },
  });
  const reflectFullscreen = () => {
    fullscreen.textContent = document.fullscreenElement
      ? STRINGS.exitFullscreen
      : STRINGS.fullscreen;
  };
  reflectFullscreen();
  document.addEventListener("fullscreenchange", reflectFullscreen);
  const el = h(
    "div",
    { class: "os-welcome-view" },
    h(
      "div",
      { class: "os-welcome-banner" },
      h(
        "div",
        { class: "os-wordmark" },
        BRAND.wordmark,
        " ",
        h("small", { text: "OS" }),
      ),
    ),
    h(
      "div",
      { class: "os-welcome-content" },
      h("h2", { text: STRINGS.intro }),
      h("p", { text: STRINGS.subtitle }),
      h(
        "div",
        { class: "os-welcome-actions" },
        h("button", {
          class: "xp-button xp-default",
          text: STRINGS.desktop,
          dataset: { nav: "", id: "show-desktop" },
          onclick: () => ctx.wm.close(ctx.window.id),
        }),
        fullscreen,
        h("button", {
          class: "xp-button",
          text: S.connection,
          dataset: { nav: "", id: "connection" },
          onclick: () => ctx.wm.open("session-status"),
        }),
      ),
      h("p", {
        class: "os-preview-note",
        text: ctx.demo ? STRINGS.demoNote : STRINGS.previewNote,
      }),
    ),
  );
  return {
    el,
    destroy() {
      document.removeEventListener("fullscreenchange", reflectFullscreen);
    },
  };
}
