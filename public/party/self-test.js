import { buildId } from "/build.js";
const list = document.getElementById("checks"),
  note = document.getElementById("sensor-note");
function check(text, good) {
  const li = document.createElement("li");
  li.textContent = (good ? "✓ " : "→ ") + text;
  list.append(li);
}
check(
  isSecureContext
    ? "Secure connection ready"
    : "Motion needs a trusted HTTPS link. Touch still works.",
  isSecureContext,
);
const canvas = document.createElement("canvas"),
  gl = canvas.getContext("webgl2");
check(
  gl
    ? "3D games ready"
    : "This browser cannot draw 3D games. Use another screen; phones can still control.",
  !!gl,
);
gl?.getExtension("WEBGL_lose_context")?.loseContext();
check("Touch controls are always available", true);
try {
  const r = await fetch("/api/health").then((r) => r.json());
  check(
    r.buildId === buildId
      ? "Game version is current"
      : "Reload this page to update the game",
    r.buildId === buildId,
  );
} catch {
  check("Can’t reach the game server. Check the connection.", false);
}
const socket = io("/party"),
  samples = [];
socket.on("connect", () => {
  let n = 0;
  const timer = setInterval(() => {
    const start = performance.now();
    socket.timeout(3000).emit("ping-check", {}, (error) => {
      if (!error) samples.push(performance.now() - start);
      if (++n === 5) {
        clearInterval(timer);
        const average = Math.round(
          samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length),
        );
        check(
          !samples.length
            ? "Connection check timed out. Reconnect and try again."
            : `Connection round trip: ${average} ms${average < 100 ? " · ready for quick reactions" : " · try a closer network for fast games"}`,
          samples.length === 5 && average < 100,
        );
        socket.disconnect();
      }
    });
  }, 250);
});
document.getElementById("check-motion").onclick = async () => {
  try {
    if (typeof DeviceOrientationEvent === "undefined")
      throw Error("This phone has no motion access. Use touch controls.");
    if (
      typeof DeviceOrientationEvent.requestPermission === "function" &&
      (await DeviceOrientationEvent.requestPermission()) !== "granted"
    )
      throw Error(
        "Motion was declined. Touch controls work without permission.",
      );
    let seen = false;
    const handler = (e) => {
      if (!Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return;
      seen = true;
      note.textContent =
        "✓ Motion is working. Your natural grip will be calibrated when you join.";
      window.removeEventListener("deviceorientation", handler);
    };
    window.addEventListener("deviceorientation", handler);
    setTimeout(() => {
      window.removeEventListener("deviceorientation", handler);
      if (!seen)
        note.textContent =
          "No motion signal yet. Open the trusted HTTPS invite in Safari or Chrome, or use touch.";
    }, 5000);
  } catch (e) {
    note.textContent = e.message;
  }
};
