import { optionSchema, matchSetup, gameById } from "/core/catalog.js";
export function mountSchemaOptions(socket) {
  const container = document.createElement("div");
  container.className = "setup-fields schema-options";
  document.querySelector(".setup-fields").after(container);
  let signature = "";
  const existing = new Set([
    "mode",
    "cpuCount",
    "laps",
    "holes",
    "drawing",
    "rotation",
    "variant",
  ]);
  return (state) => {
    const key = JSON.stringify([state.game, state.setup]);
    if (key === signature) return;
    signature = key;
    container.replaceChildren();
    const defaults = matchSetup(
      gameById(state.game),
      state.setup,
      state.players.length,
    );
    for (const field of optionSchema(state.game).filter(
      (f) => !existing.has(f.key),
    )) {
      const label = document.createElement("fieldset"),
        legend = document.createElement("legend"),
        group = document.createElement("div");
      legend.textContent = field.label;
      group.className = "choice-group";
      label.append(legend, group);
      // Match the setup the server will freeze, including when the previous
      // game used a different set of values for this option.
      const value = defaults[field.key];
      for (const [choice, name] of field.choices) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = name;
        b.setAttribute(
          "aria-pressed",
          String(
            field.key === "wind"
              ? (value === true || value === "on") === (choice === "on")
              : String(value) === String(choice),
          ),
        );
        b.onclick = () =>
          socket.emit("setup", { ...state.setup, [field.key]: choice });
        group.append(b);
      }
      container.append(label);
    }
    if (state.game === "drawing") {
      const label = document.createElement("label"),
        words = document.createElement("textarea"),
        apply = document.createElement("button");
      label.textContent = "Your word deck (optional, one per line)";
      words.rows = 3;
      words.maxLength = 2050;
      words.value = (state.setup.customWords || []).join("\n");
      words.setAttribute("aria-label", "Custom drawing words");
      label.append(words);
      apply.textContent = "Use this word deck";
      apply.onclick = () =>
        socket.emit("setup", {
          ...state.setup,
          customWords: words.value.split(/[,\n]/),
        });
      container.append(label, apply);
    }
  };
}
