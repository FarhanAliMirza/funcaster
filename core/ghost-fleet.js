import { SEATS } from "./seats.js";
/** Non-colliding rival poses. Lost peers fade instead of freezing forever. */
export function ghostFleet(link, scene, model, { height = 0 } = {}) {
  const ghosts = new Map();
  let active = true,
    previousStart = null,
    previousMesh = null,
    previousIndex = 0;
  link.socket.on("ghost", ({ slot, pose }) => {
    if (!SEATS[slot]) return;
    let g = ghosts.get(slot);
    if (!g) {
      const mesh = model.clone(true);
      mesh.traverse((n) => {
        if (n.material) {
          n.material = n.material.clone();
          n.material.transparent = true;
          n.material.opacity = 0.42;
          n.material.depthWrite = false;
          n.material.color?.set(SEATS[slot].color);
        }
      });
      scene.add(mesh);
      g = { mesh };
      mesh.position.set(pose.x, pose.y + height, pose.z);
      ghosts.set(slot, g);
    }
    g.pose = pose;
    g.at = performance.now();
  });
  function frame() {
    if (!active) return;
    requestAnimationFrame(frame);
    const run = link.previousGhost,
      local = link.stateSource?.();
    if (run && local?.state === "racing") {
      previousStart ??= link.timeNow;
      if (!previousMesh) {
        previousMesh = model.clone(true);
        previousMesh.traverse((n) => {
          if (n.material) {
            n.material = n.material.clone();
            n.material.transparent = true;
            n.material.opacity = 0.24;
            n.material.depthWrite = false;
          }
        });
        scene.add(previousMesh);
      }
      const t = link.timeNow - previousStart;
      while (
        previousIndex < run.poses.length - 1 &&
        run.poses[previousIndex + 1].t <= t
      )
        previousIndex++;
      const q = run.poses[previousIndex];
      previousMesh.visible = t <= run.poses.at(-1).t;
      previousMesh.position.set(q.x, q.y + height, q.z);
      previousMesh.rotation.y = -q.heading + Math.PI;
    } else if (previousMesh) previousMesh.visible = false;
    for (const g of ghosts.values()) {
      const age = performance.now() - g.at;
      g.mesh.visible = age < 2000;
      if (!g.mesh.visible) continue;
      const p = g.mesh.position,
        q = g.pose;
      p.set(
        p.x + (q.x - p.x) * 0.25,
        p.y + (q.y + height - p.y) * 0.25,
        p.z + (q.z - p.z) * 0.25,
      );
      g.mesh.rotation.y = q.heading;
    }
  }
  requestAnimationFrame(frame);
  window.addEventListener(
    "pagehide",
    () => {
      active = false;
      for (const g of ghosts.values()) scene.remove(g.mesh);
      if (previousMesh) scene.remove(previousMesh);
    },
    { once: true },
  );
}
