/** TV navigation mirrors keyboard focus. No gamepad can bypass disabled actions. */
export function gamepadMenu(root = document) {
  let last = 0,
    held = false,
    live = true;
  function frame(time) {
    if (!live) return;
    requestAnimationFrame(frame);
    const pad = [...(navigator.getGamepads?.() || [])].find(Boolean);
    if (!pad) return;
    const press = pad.buttons[0]?.pressed,
      back = pad.buttons[1]?.pressed;
    const direction =
      pad.buttons[15]?.pressed ||
      pad.buttons[13]?.pressed ||
      pad.axes[0] > 0.55 ||
      pad.axes[1] > 0.55
        ? 1
        : pad.buttons[14]?.pressed ||
            pad.buttons[12]?.pressed ||
            pad.axes[0] < -0.55 ||
            pad.axes[1] < -0.55
          ? -1
          : 0;
    const buttons = [
      ...root.querySelectorAll("button:not(:disabled),a[href],summary"),
    ].filter((el) => el.getClientRects().length && !el.closest("[hidden]"));
    if (direction && time - last > 230) {
      last = time;
      const i = buttons.indexOf(document.activeElement);
      buttons[(i + direction + buttons.length) % buttons.length]?.focus();
    }
    if (press && !held && buttons.includes(document.activeElement))
      document.activeElement.click();
    if (back && !held) {
      const dialog = root.querySelector("dialog[open]");
      dialog?.close();
    }
    held = press || back;
  }
  requestAnimationFrame(frame);
  window.addEventListener(
    "pagehide",
    () => {
      live = false;
    },
    { once: true },
  );
}
