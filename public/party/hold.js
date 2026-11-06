/** Pointer and keyboard equivalent, with cancellation when focus is lost. */
export function holdButton(button, action, duration = 800) {
  let began = 0,
    frame = 0;
  function cancel() {
    began = 0;
    cancelAnimationFrame(frame);
    button.style.removeProperty("--hold");
    button.classList.remove("holding");
  }
  function tick(time) {
    if (!began) return;
    const progress = Math.min(1, (time - began) / duration);
    button.style.setProperty("--hold", `${progress * 100}%`);
    if (progress >= 1) {
      cancel();
      action();
    } else frame = requestAnimationFrame(tick);
  }
  function start(e) {
    if (button.disabled || began) return;
    e.preventDefault();
    began = performance.now();
    button.classList.add("holding");
    if (e.pointerId !== undefined) button.setPointerCapture(e.pointerId);
    frame = requestAnimationFrame(tick);
  }
  button.onclick = (e) => e.preventDefault();
  button.addEventListener("pointerdown", start);
  for (const event of [
    "pointerup",
    "pointercancel",
    "lostpointercapture",
    "blur",
  ])
    button.addEventListener(event, cancel);
  button.addEventListener("keydown", (e) => {
    if ([" ", "Enter"].includes(e.key) && !e.repeat) start(e);
  });
  button.addEventListener("keyup", cancel);
  button.addEventListener("contextmenu", (e) => e.preventDefault());
  return cancel;
}
