import { visibleTargets, navigationScore, DIRECTIONS } from "./nav.js";
/** Development-only geometry overlay; loaded only with ?debug=1. */
export function mountDebug({ root, nav, scale }) {
  const canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d"),
    output = document.createElement("output");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    zIndex: "5000",
    pointerEvents: "none",
  });
  output.className = "os-debug";
  output.style.zIndex = "5001";
  root.append(canvas, output);
  let frame = 0,
    frames = 0,
    last = performance.now(),
    fps = 0,
    previous = 0;
  function draw(now) {
    frames++;
    if (now - last >= 1000) {
      fps = Math.round((frames * 1000) / (now - last));
      frames = 0;
      last = now;
    }
    if (now - previous > 100) {
      previous = now;
      if (canvas.width !== innerWidth) canvas.width = innerWidth;
      if (canvas.height !== innerHeight) canvas.height = innerHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = "12px monospace";
      const scope = nav.scope(),
        targets = visibleTargets(scope),
        active = document.activeElement,
        origin = active?.getBoundingClientRect();
      for (const target of targets) {
        const r = target.getBoundingClientRect();
        ctx.strokeStyle = target === active ? "#ffb200" : "#00f6ff";
        ctx.strokeRect(r.left, r.top, r.width, r.height);
      }
      if (targets.includes(active))
        for (const direction of DIRECTIONS) {
          const nearest = targets
            .filter((t) => t !== active)
            .map((t) => ({ t, r: t.getBoundingClientRect() }))
            .map((v) => ({
              ...v,
              score: navigationScore(origin, v.r, direction),
            }))
            .filter((v) => Number.isFinite(v.score))
            .sort((a, b) => a.score - b.score)[0];
          if (!nearest) continue;
          const x = origin.left + origin.width / 2,
            y = origin.top + origin.height / 2,
            tx = nearest.r.left + nearest.r.width / 2,
            ty = nearest.r.top + nearest.r.height / 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(tx, ty);
          ctx.strokeStyle = "#ff3bf7";
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.fillText(
            `${direction}: ${nearest.score.toFixed(0)}`,
            (x + tx) / 2,
            (y + ty) / 2,
          );
        }
      const cursors = [...root.querySelectorAll(".os-pointer")]
        .map((e) => {
          const r = e.getBoundingClientRect();
          return `${Number(e.dataset.slot) + 1}:${r.left.toFixed(0)},${r.top.toFixed(0)}`;
        })
        .join(" ");
      const s = scale.get();
      output.textContent = `${fps} FPS · ${s.width}×${s.height} · ${s.ui.toFixed(3)}x · scope:${scope.dataset.window || scope.getAttribute("aria-label") || scope.id || scope.tagName} · ${targets.length} targets · cursors ${cursors || "none"}`;
    }
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);
  return {
    destroy() {
      cancelAnimationFrame(frame);
      canvas.remove();
      output.remove();
    },
  };
}
