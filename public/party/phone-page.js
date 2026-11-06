/** UA checks are coaching only; PH4 probes the actual sensor capabilities. */
export function detectInAppBrowser(userAgent = "") {
  return (
    /Instagram|FBAN|FBAV|Line\/|WhatsApp|Telegram|TikTok|Snapchat|Twitter|MicroMessenger|Messenger|; wv\)/i.exec(
      userAgent,
    )?.[0] || null
  );
}

/** Keep feedback channels independent: disabling vibration cannot silence visuals or audio. */
export function phoneFeedback(
  { visual, haptics, vibrate, userActivation, sound, playSound },
  pattern,
) {
  for (const effect of [
    visual,
    haptics &&
      userActivation?.hasBeenActive !== false &&
      vibrate &&
      (() => vibrate(pattern)),
    sound && playSound,
  ]) {
    try {
      if (effect) effect();
    } catch {
      /* A missing device capability must not suppress the others. */
    }
  }
}

/** Lock the document while retaining deliberate scrolling in forms and sheets. */
export function installPhonePageGuards({
  window,
  document,
  openPartyMenu,
  returnUrl,
}) {
  const contextmenu = (event) => event.preventDefault();
  const touchmove = (event) => {
    const target = event.target;
    const control = target?.closest?.(
      ".pad, #motion-pad, #gas, #brake, #boost, #touch-steer",
    );
    if (control || !target?.closest?.("[data-scroll]")) event.preventDefault();
  };
  const retain = (restoreUrl = false) =>
    window.history.pushState(
      { ...window.history.state, funcasterPhoneGuard: true },
      "",
      restoreUrl ? returnUrl?.() : undefined,
    );
  const back = () => {
    retain(true);
    openPartyMenu();
  };
  // Reuse the guard after a reload rather than growing the history stack.
  if (!window.history.state?.funcasterPhoneGuard) retain();
  document.addEventListener("contextmenu", contextmenu);
  document.addEventListener("touchmove", touchmove, { passive: false });
  window.addEventListener("popstate", back);
  return () => {
    document.removeEventListener("contextmenu", contextmenu);
    document.removeEventListener("touchmove", touchmove);
    window.removeEventListener("popstate", back);
  };
}
