"use strict";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const finiteArray = (value, length) =>
  Array.isArray(value) &&
  value.length === length &&
  value.every(Number.isFinite);
const BUTTONS = new Set([
  "A",
  "B",
  "home",
  "1",
  "2",
  "minus",
  "plus",
  "up",
  "down",
  "left",
  "right",
]);
const IN_APP = [
  "Instagram",
  "FBAN",
  "FBAV",
  "Line/",
  "WhatsApp",
  "Telegram",
  "TikTok",
  "Snapchat",
  "Twitter",
  "MicroMessenger",
  "Messenger",
  "; wv)",
];

function pointerMode(room) {
  return (
    !!room.pointerMode &&
    !!room.host &&
    ["lobby", "results"].includes(room.phase)
  );
}

// The shell feeds this retained raw orientation into core/pointer.js. Never
// replace the game's calibrated input with these samples or trust extra fields.
function pointerSample(data) {
  if (!object(data)) return null;
  const forms = [
    "q" in data,
    ["a", "b", "g"].some((key) => key in data),
    ["x", "y"].some((key) => key in data),
  ];
  if (forms.filter(Boolean).length !== 1) return null;
  let sample;
  if (forms[0]) {
    if (!finiteArray(data.q, 4) || Math.abs(Math.hypot(...data.q) - 1) > 0.05)
      return null;
    sample = { q: [...data.q] };
  } else if (forms[1]) {
    if (![data.a, data.b, data.g].every(Number.isFinite)) return null;
    sample = {
      a: clamp(data.a, 0, 360),
      b: clamp(data.b, -180, 180),
      g: clamp(data.g, -90, 90),
    };
  } else {
    if (![data.x, data.y].every(Number.isFinite)) return null;
    sample = { x: clamp(data.x, -1, 1), y: clamp(data.y, -1, 1) };
  }
  if (data.r !== undefined) {
    if (!finiteArray(data.r, 3)) return null;
    sample.r = data.r.map((n) => clamp(n, -2000, 2000));
  }
  return sample;
}

function shellButton(data) {
  return object(data) &&
    BUTTONS.has(data.button) &&
    typeof data.pressed === "boolean"
    ? { button: data.button, pressed: data.pressed }
    : null;
}

function deviceInfo(data) {
  if (!object(data)) return null;
  const choice = (value, options, fallback) =>
    options.includes(value) ? value : fallback;
  const bounded = (value, max) =>
    Number.isFinite(value) ? clamp(Math.round(value), 0, max) : 0;
  return {
    platform: choice(
      data.platform,
      ["ios", "android", "desktop", "other"],
      "other",
    ),
    tier: choice(data.tier, ["A", "B", "C", "D"], "B"),
    gyro: data.gyro === true,
    hz: bounded(data.hz, 240),
    haptics: choice(data.haptics, ["vibrate", "ios-switch", "none"], "none"),
    fullscreen: data.fullscreen === true,
    standalone: data.standalone === true,
    touchMax: bounded(data.touchMax, 20),
    inApp:
      typeof data.inApp === "string"
        ? IN_APP.find(
            (name) => name.toLowerCase() === data.inApp.toLowerCase(),
          ) || null
        : null,
    secure: data.secure === true,
  };
}

module.exports = { pointerMode, pointerSample, shellButton, deviceInfo };
