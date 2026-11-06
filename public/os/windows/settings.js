import { h } from "../util/h.js";
import { canEdit, modeOptions } from "../window-data.js";
import { WINDOW_CONTENT_STRINGS as S } from "../strings.js";
import {
  utility,
  button,
  checkbox,
  note,
  section,
  confirm,
} from "./utility.js";
import { choiceList } from "./game-properties.js";
export function open(ctx) {
  const page = utility(ctx, S.settingsIntro),
    lists = [];
  const apply = (next) => {
    ctx.applySettings(next);
    page.refresh();
  };
  const field = (id, label, choices, key) => {
    const select = choiceList({
      id,
      label,
      choices,
      change: (value) => apply({ [key]: value }),
    });
    lists.push({ select, key });
    return h(
      "div",
      { class: "os-setting-row" },
      h("span", { text: label }),
      select.el,
    );
  };
  const volume = h("input", {
      type: "range",
      min: 0,
      max: 100,
      step: 5,
      "aria-label": S.volume,
      dataset: { nav: "", id: "settings-volume" },
    }),
    volumeValue = h("output");
  volume.addEventListener("input", () =>
    apply({ volume: Number(volume.value) }),
  );
  let unmuted = ctx.settings.volume || 70;
  const mute = checkbox("settings-mute", S.mute, (on) => {
    if (on) unmuted = ctx.settings.volume || 70;
    apply({ volume: on ? 0 : unmuted });
  });
  const gentle = checkbox("settings-gentle", S.effects, (value) =>
    apply({ gentle: value }),
  );
  const mascot = checkbox("settings-mascot", S.mascot, (value) =>
    apply({ mascot: value }),
  );
  const pets = checkbox("settings-pets", S.pets, (value) =>
    apply({ pets: value }),
  );
  const avatars = checkbox("settings-avatars", S.avatars, (value) =>
    apply({ avatars: value }),
  );
  const pointer = h("input", {
      type: "range",
      min: 0.2,
      max: 6,
      step: 0.1,
      "aria-label": S.pointerSpeed,
      dataset: { nav: "", id: "settings-pointer" },
    }),
    pointerValue = h("output");
  pointer.addEventListener("input", () => {
    const value = Number(pointer.value);
    ctx.pointers?.setSensitivity(value);
    ctx.storage.write("openwii.sensitivity.v2", value);
    pointerValue.textContent = value.toFixed(1);
  });
  let desiredMode = ctx.store.get().room?.operatingMode || "party";
  const mode = choiceList({
    id: "settings-room-mode",
    label: S.roomMode,
    choices: [
      ["party", S.party],
      ["kiosk", S.kiosk],
    ],
    change: (value) => {
      desiredMode = value;
      page.refresh();
    },
  });
  const pin = h("input", {
    type: "password",
    inputMode: "numeric",
    pattern: "[0-9]{6}",
    maxLength: 6,
    autoComplete: "new-password",
    id: "settings-pin",
    dataset: { nav: "", id: "settings-pin" },
  });
  const pinRow = h(
    "div",
    { class: "os-setting-pin" },
    h("label", { htmlFor: pin.id, text: S.setPin }),
    pin,
    note(S.pinHint),
  );
  const applyMode = button("apply-room-mode", S.switchMode, () =>
    page.run(applyMode, async () => {
      const options = modeOptions(desiredMode, pin.value);
      if (options.error) return options;
      if (!(await confirm(ctx, S.switchTitle, S.switchText)))
        return { cancelled: true };
      const answer = await ctx.getSession().arcadeConfigure(options);
      pin.value = "";
      if (!answer?.error) page.report(S.roomModeDone);
      return answer;
    }),
  );
  const remote = checkbox("settings-remote", S.remoteEnable, (value) =>
      page.run(remote.input, () => ctx.getSession().remoteConfigure(value)),
    ),
    remoteNote = note(S.remoteKiosk);
  page.content.append(
    section(
      S.sound,
      h(
        "label",
        { class: "os-setting-row" },
        h("span", { text: S.volume }),
        h("span", { class: "os-slider" }, volume, volumeValue),
      ),
      mute.el,
    ),
    section(
      S.display,
      field(
        "settings-scale",
        S.scale,
        [
          ["auto", S.automatic],
          [1, "1×"],
          [1.25, "1.25×"],
          [1.5, "1.5×"],
          [2, "2×"],
        ],
        "tvScale",
      ),
      field(
        "settings-safe",
        S.safeArea,
        [
          [0, S.noSafe],
          [3, "3%"],
          [5, "5%"],
        ],
        "safeArea",
      ),
    ),
    section(
      S.appearance,
      field(
        "settings-skin",
        S.skin,
        [
          ["luna", S.luna],
          ["classic", S.classic],
          ["taxi", S.taxi],
        ],
        "skin",
      ),
      gentle.el,
      mascot.el,
      pets.el,
      avatars.el,
    ),
    section(
      S.pointerSpeed,
      field(
        "settings-cursor",
        S.cursor,
        [
          ["arrow", S.arrow],
          ["glove", S.glove],
        ],
        "cursorSkin",
      ),
      h("div", { class: "os-slider" }, pointer, pointerValue),
      note(S.sensitivityHint),
    ),
    section(S.roomMode, mode.el, pinRow, applyMode, remote.el, remoteNote),
  );
  page.footer.append(
    button("settings-diagnostics", S.diagnostics, () =>
      ctx.openWindow("diagnostics"),
    ),
  );
  function update(state) {
    const settings = ctx.settings;
    volume.value = settings.volume;
    volumeValue.textContent = `${settings.volume}%`;
    mute.input.checked = settings.volume === 0;
    gentle.input.checked = !!settings.gentle;
    mascot.input.checked = settings.mascot !== false;
    pets.input.checked = settings.pets !== false;
    avatars.input.checked = settings.avatars !== false;
    lists.forEach(({ select, key }) => select.update(settings[key]));
    const sensitivity =
      ctx.pointers?.model.sensitivity ||
      Number(ctx.storage.read("openwii.sensitivity.v2", 1));
    pointer.value = sensitivity;
    pointerValue.textContent = sensitivity.toFixed(1);
    mode.update(desiredMode, canEdit(state) && !ctx.demo);
    pinRow.hidden = desiredMode !== "kiosk";
    page.enabled(pin, canEdit(state) && !ctx.demo);
    page.enabled(applyMode, canEdit(state) && !ctx.demo);
    remote.el.hidden = state.room?.remoteViews === undefined;
    remote.input.checked = !!state.room?.remoteViews;
    page.enabled(
      remote.input,
      canEdit(state) && !ctx.demo && state.room?.operatingMode !== "kiosk",
    );
    remoteNote.hidden =
      remote.el.hidden || state.room?.operatingMode !== "kiosk";
  }
  page.refresh = () => update(ctx.store.get());
  page.refresh();
  return {
    el: page.el,
    update,
    destroy() {
      pin.value = "";
      mode.destroy();
      lists.forEach(({ select }) => select.destroy());
      page.destroy();
    },
  };
}
