import { SEATS } from "../../../core/seats.js";
import { h } from "../util/h.js";
import { DESKTOP_STRINGS as S } from "../strings.js";

export function mountTray({
  theme,
  settings,
  onWindow,
  onVolume,
  onFullscreen,
}) {
  const lamps = h("button", {
    class: "os-seat-lamps",
    "aria-label": S.showPlayers,
    dataset: { nav: "", id: "tray-players" },
    onclick: () => onWindow("players"),
  });
  const seats = SEATS.map((seat) => {
    const lamp = h("span", {
      text: seat.shape,
      title: `${seat.name}: ${S.empty}`,
      dataset: { slot: SEATS.indexOf(seat) },
    });
    lamp.style.setProperty("--seat", seat.color);
    lamps.append(lamp);
    return lamp;
  });
  const connection = h(
    "button",
    {
      class: "os-link-state",
      "aria-label": S.connection,
      dataset: { nav: "", id: "tray-connection" },
      onclick: () => onWindow("diagnostics"),
    },
    h("span", { text: "▂▄▆", "aria-hidden": "true" }),
  );
  const mute = h(
    "button",
    {
      "aria-label": settings.volume ? S.mute : S.unmute,
      dataset: { nav: "", id: "tray-mute" },
      onclick() {
        onVolume(settings.volume ? 0 : 70);
        reflectVolume();
      },
    },
    h("img", { src: theme.icon("volume.speaker"), alt: "" }),
  );
  const code = h("button", {
    class: "os-tray-room",
    text: S.noRoom,
    dataset: { nav: "", id: "tray-invite" },
    onclick: () => onWindow("invite"),
  });
  const fullscreen = h("button", {
    class: "os-tray-fullscreen",
    text: "⛶",
    "aria-label": S.fullscreen,
    dataset: { nav: "", id: "tray-fullscreen" },
    onclick: onFullscreen,
  });
  const clock = h("time", { "aria-label": "Current time" });
  const el = h(
    "div",
    { class: "os-tray" },
    lamps,
    connection,
    mute,
    code,
    fullscreen,
    clock,
  );
  const tick = () => {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    clock.dateTime = now.toISOString();
  };
  tick();
  const timer = setInterval(tick, 30000);
  const reflectVolume = () => {
    mute.classList.toggle("muted", settings.volume === 0);
    mute.setAttribute("aria-label", settings.volume ? S.mute : S.unmute);
  };
  const full = () =>
    fullscreen.setAttribute(
      "aria-label",
      document.fullscreenElement ? S.exitFullscreen : S.fullscreen,
    );
  document.addEventListener("fullscreenchange", full);
  return {
    el,
    update(state) {
      const room = state.room;
      code.textContent =
        state.connection === "demo"
          ? S.demo
          : S.room(room?.code || state.identity?.code);
      connection.title =
        state.connection === "connected"
          ? S.connected
          : state.connection === "demo"
            ? S.demo
            : S.disconnected;
      connection.dataset.connected = String(
        ["demo", "connected"].includes(state.connection),
      );
      seats.forEach((lamp, slot) => {
        const player = room?.players?.find((p) => p.slot === slot);
        const status = !player
          ? S.empty
          : !player.connected
            ? S.away
            : player.ready
              ? S.ready
              : S.waiting;
        lamp.title = `${SEATS[slot].name}: ${status}`;
        lamp.dataset.status = status;
      });
      reflectVolume();
    },
    pointing(slot, on) {
      seats[slot]?.classList.toggle("pointing", on);
    },
    destroy() {
      clearInterval(timer);
      document.removeEventListener("fullscreenchange", full);
      el.remove();
    },
  };
}
