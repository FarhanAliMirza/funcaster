import * as THREE from "three";
import { RoundedBoxGeometry } from "/vendor/three-examples/geometries/RoundedBoxGeometry.js";
export const DRIVER_ART = {
  mario: { name: "Comet", color: "#8870ef", accent: "#ffe4a3", crest: 0 },
  luigi: { name: "Pip", color: "#36bba0", accent: "#ccffe9", crest: 1 },
  peach: { name: "Nova", color: "#ee86b2", accent: "#fff2bb", crest: 2 },
  yoshi: { name: "Ziggy", color: "#c7df62", accent: "#fff4d4", crest: 3 },
  toad: { name: "Skye", color: "#61b6ee", accent: "#d8f4ff", crest: 4 },
  bowser: { name: "Ember", color: "#f79b62", accent: "#fff0c0", crest: 5 },
  "donkey-kong": {
    name: "Pebble",
    color: "#bb9a85",
    accent: "#e7dcff",
    crest: 6,
  },
  koopa: { name: "Orbit", color: "#e9c75e", accent: "#fffbd6", crest: 7 },
};
export function originalKart(id) {
  const a = DRIVER_ART[id] || DRIVER_ART.mario,
    g = new THREE.Group();
  const material = (color, metalness = 0.12) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.38 });
  const paint = material(a.color),
    dark = material("#202940"),
    ivory = material(a.accent),
    chrome = material("#dfe5ff", 0.75);
  function mesh(geo, mat, x, y, z, name = "", parent = g) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.name = name;
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  const body = mesh(
    new RoundedBoxGeometry(1.62, 0.5, 2.35, 3, 0.19),
    paint,
    0,
    0.55,
    0,
    "body",
  );
  mesh(
    new RoundedBoxGeometry(1.1, 0.14, 1.35, 2, 0.08),
    ivory,
    0,
    0.84,
    -0.33,
    "hood-stripe",
  );
  mesh(
    new RoundedBoxGeometry(1.85, 0.14, 0.22, 2, 0.05),
    chrome,
    0,
    0.41,
    -1.26,
    "bumper",
  );
  mesh(
    new RoundedBoxGeometry(1.86, 0.15, 0.45, 2, 0.07),
    ivory,
    0,
    1.02,
    1.02,
    "spoiler",
  );
  for (const x of [-0.7, 0.7])
    mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.52, 8),
      chrome,
      x,
      0.78,
      0.98,
    );
  for (const [i, [x, z]] of [
    [-0.94, -0.74],
    [0.94, -0.74],
    [-0.94, 0.72],
    [0.94, 0.72],
  ].entries()) {
    const wheel = new THREE.Group();
    wheel.position.set(x, 0.42, z);
    wheel.name = `wheel-${i}`;
    g.add(wheel);
    const tire = mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.26, 20),
      dark,
      0,
      0,
      0,
      "tire",
      wheel,
    );
    tire.rotation.z = Math.PI / 2;
    const hub = mesh(
      new THREE.CylinderGeometry(0.23, 0.23, 0.29, 12),
      ivory,
      0,
      0,
      0,
      "hub",
      wheel,
    );
    hub.rotation.z = Math.PI / 2;
  }
  mesh(
    new RoundedBoxGeometry(0.68, 0.67, 0.5, 3, 0.19),
    paint,
    0,
    1.14,
    0.15,
    "driver-body",
  );
  const head = new THREE.Group();
  head.name = "driver-head";
  head.position.set(0, 1.75, 0.07);
  g.add(head);
  mesh(
    new THREE.SphereGeometry(0.49, 24, 16),
    ivory,
    0,
    0,
    0,
    "helmet",
    head,
  ).scale.set(1, 1.03, 0.92);
  const visor = mesh(
    new THREE.SphereGeometry(0.42, 24, 16),
    dark,
    0,
    0.015,
    -0.18,
    "visor",
    head,
  );
  visor.scale.set(0.96, 0.55, 0.66);
  for (const x of [-0.12, 0.12])
    mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshBasicMaterial({ color: "#b8ffe6" }),
      x,
      0.03,
      -0.458,
      "eye",
      head,
    ).scale.y = 1.5;
  const antenna = mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.36, 8),
    chrome,
    0,
    0.52,
    0,
    "antenna",
    head,
  );
  mesh(
    a.crest % 2
      ? new THREE.OctahedronGeometry(0.13)
      : new THREE.SphereGeometry(0.13, 10, 8),
    paint,
    0,
    0.74,
    0,
    "beacon",
    head,
  );
  for (const x of [-0.32, 0.32])
    mesh(new THREE.SphereGeometry(0.14, 12, 8), ivory, x, 1.25, -0.35, "hand");
  for (const x of [-0.55, 0.55])
    mesh(
      new THREE.SphereGeometry(0.11, 12, 8),
      new THREE.MeshStandardMaterial({
        color: "#fff6cf",
        emissive: "#ffca75",
        emissiveIntensity: 1.2,
      }),
      x,
      0.65,
      -1.18,
      "lamp",
    );
  return g;
}
export function driverPortrait(id) {
  const a = DRIVER_ART[id] || DRIVER_ART.mario;
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="${a.color}"/><circle cx="80" cy="18" r="29" fill="${a.accent}" opacity=".3"/><path d="M22 100V83Q50 62 78 83V100" fill="${a.accent}"/><path d="M50 22V10" stroke="${a.accent}" stroke-width="5"/><circle cx="50" cy="9" r="6" fill="white"/><ellipse cx="50" cy="51" rx="32" ry="33" fill="${a.accent}"/><rect x="22" y="39" width="56" height="25" rx="12" fill="#202940"/><path d="M38 47V55M62 47V55" stroke="#b8ffe6" stroke-width="5" stroke-linecap="round"/><path d="M35 31Q50 22 63 29" fill="none" stroke="white" stroke-width="4" opacity=".7"/></svg>`,
    )
  );
}
