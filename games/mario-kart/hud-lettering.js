const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function raceLettering(text, palette = "gold") {
  const color =
    {
      gold: "#ffe08a",
      silver: "#e7f5ff",
      bronze: "#f4c49b",
      orange: "#ffb16f",
    }[palette] || "white";
  return `<span style="font:900 1em/1 system-ui,sans-serif;color:${color};text-shadow:0 3px 0 #463969">${escape(text)}</span>`;
}
export function lapBoard(lap) {
  return raceLettering(`LAP ${lap}`);
}
