/** Party races use the frozen room setup; device preferences are solo-only. */
export function raceMenuLaps(party, setup, preferred = 3) {
  const laps = party ? setup?.laps : preferred;
  return laps === 3 ? 3 : 1;
}

/** Menu authority stays with the shell in a party; driver choice stays local. */
export function installRaceMenu({
  document,
  party,
  getConfirmed,
  setConfirmed,
  playConfirm,
  startRace,
  selectLaps,
}) {
  const start = document.getElementById("start");
  const laps = document.getElementById("lap-options");
  const fullscreen = document.getElementById("fullscreen");
  start.hidden = laps.hidden = fullscreen.hidden = !!party;
  for (const button of document.querySelectorAll("[data-laps]"))
    button.onclick = () => {
      if (!party) selectLaps(Number(button.dataset.laps));
    };
  const confirmDriver = () => {
    if (!getConfirmed()) {
      setConfirmed(true);
      playConfirm();
      // The party already chose its race in the shell. One driver confirmation
      // is enough; do not leave a hidden second Start step on the phone.
      if (party) startRace();
    } else startRace();
  };
  const toggleFullscreen = () => {
    if (party) return;
    if (document.fullscreenElement) return document.exitFullscreen();
    return document.documentElement.requestFullscreen().catch(() => {});
  };
  fullscreen.addEventListener("click", toggleFullscreen);
  return { confirmDriver, toggleFullscreen };
}
