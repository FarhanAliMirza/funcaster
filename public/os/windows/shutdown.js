import { h } from "../util/h.js";
import { DESKTOP_STRINGS as S } from "../strings.js";
export function open(ctx) {
  let choice = "desktop";
  const field = h(
    "fieldset",
    { class: "os-shutdown-choices" },
    h("legend", { text: S.shutdownText }),
  );
  for (const [id, label] of [
    ["desktop", S.desktopAction],
    ["match", S.endMatch],
    ["room", S.endRoom],
  ])
    field.append(
      h(
        "label",
        {},
        h("input", {
          type: "radio",
          name: "shutdown",
          value: id,
          checked: id === choice,
          dataset: { nav: "", id: `shutdown-${id}` },
          onchange: () => (choice = id),
        }),
        label,
      ),
    );
  const ok = h("button", {
    class: "xp-button xp-default",
    text: S.confirm,
    dataset: { nav: "", id: "shutdown-confirm" },
    async onclick() {
      ok.disabled = true;
      try {
        await shutdownAction(ctx, choice);
      } finally {
        ok.disabled = false;
      }
    },
  });
  return {
    el: h(
      "div",
      { class: "os-shutdown" },
      field,
      h(
        "div",
        { class: "os-message-actions" },
        h("button", {
          class: "xp-button",
          text: S.cancel,
          dataset: { nav: "", id: "shutdown-cancel" },
          onclick: () => ctx.wm.close(ctx.window.id),
        }),
        ok,
      ),
    ),
    destroy() {},
  };
}

/** Keep cancellation and deliberate room closure separate from recovery. */
export async function shutdownAction(ctx, choice) {
  if (choice === "desktop") {
    for (const entry of ctx.wm.list())
      if (entry.kind === "tool") await ctx.wm.close(entry.id);
    return;
  }
  let intentional = false,
    ended = false;
  const fail = async (message) => {
    if (intentional && !ended) ctx.setShuttingDown(false);
    await ctx.wm.modal({ title: S.notYet, text: message || S.shutdownFailed });
  };
  try {
    const session = ctx.getSession();
    if (choice === "room") {
      const selected = await ctx.wm.modal({
        title: S.endRoom,
        text: S.endRoomText,
        buttons: [
          { id: "cancel", label: S.cancel },
          { id: "confirm", label: S.endRoom, danger: true },
        ],
        defaultButton: "cancel",
        cancelButton: "cancel",
      });
      if (selected !== "confirm") return { cancelled: true };
      intentional = true;
      ctx.setShuttingDown(true);
    }
    const reply = await (choice === "room"
      ? session.endRoom()
      : session.lobby());
    if (reply?.cancelled) {
      if (intentional) ctx.setShuttingDown(false);
      return reply;
    }
    if (reply?.error) {
      await fail(reply.error);
      return reply;
    }
    ended = intentional;
    ctx.mascot?.event("shutdown");
    ctx.audio?.cue("shutdown");
    await ctx.wm.close(ctx.window.id);
    if (ended)
      await ctx.wm.modal({ title: S.shutdownTitle, text: S.safeClose });
    return reply;
  } catch {
    await fail();
    return { error: S.shutdownFailed };
  }
}
