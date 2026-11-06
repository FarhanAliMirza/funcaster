import {
  dprFor,
  SINGLE_VIEW_PIXELS,
  SPLIT_VIEW_PIXELS,
} from "../../core/pixel-budget.js";
import * as THREE from "three";
import { viewports, QualityGovernor } from "../../core/viewports.js";
import { rivalVisible } from "./rival-visibility.js";
import { chasePose, cameraClearance } from "./visual-frame.js";
import { SEATS } from "../../core/seats.js";
const colors = SEATS.map((s) => s.color);
export class ChaseCamera {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.12, 1500);
    this.aim = new THREE.Vector3();
    this.initialized = false;
  }
  update(racer, viewport, dt) {
    const p = chasePose(racer),
      c = this.camera;
    const eye = new THREE.Vector3(p.eye.x, p.eye.y, p.eye.z);
    const aim = new THREE.Vector3(p.aim.x, p.aim.y, p.aim.z);
    const mix = this.initialized ? 1 - Math.exp(-Math.min(dt, 0.1) * 12) : 1;
    c.position.lerp(eye, mix);
    this.aim.lerp(aim, mix);
    c.position.copy(cameraClearance(c.position, racer.s));
    c.up.set(p.up.x, p.up.y, p.up.z);
    c.lookAt(this.aim);
    c.aspect = Math.max(1, viewport.width) / Math.max(1, viewport.height);
    c.updateProjectionMatrix();
    this.initialized = true;
    return c;
  }
}
export class RaceViews {
  constructor(renderer) {
    this.renderer = renderer;
    this.rigs = new Map();
    this.governor = new QualityGovernor();
    this.layer = document.createElement("div");
    this.layer.className = "race-views";
    document.body.append(this.layer);
    this.labels = new Map();
  }
  render(scene, race, players, dt, now, karts) {
    const visible = race.humans.filter((r) =>
      players.some((p) => p.slot === r.seat),
    );
    // A hidden iframe can temporarily report no usable drawing area.
    const width = Math.max(1, innerWidth),
      height = Math.max(1, innerHeight);
    const layout = viewports(visible.length, width, height).map((viewport) => ({
        ...viewport,
        width: Math.max(1, viewport.width),
        height: Math.max(1, viewport.height),
      })),
      renderer = this.renderer;
    // One backing store contains all cameras; budget each actual viewport.
    const baseDpr = Math.min(
      ...layout.map((v) =>
        dprFor(v.width, v.height, {
          cap: 1.6,
          maxPixels: visible.length > 1 ? SPLIT_VIEW_PIXELS : SINGLE_VIEW_PIXELS,
        }),
      ),
    );
    const desired = baseDpr * this.governor.sample(dt * 1000);
    if (Math.abs(renderer.getPixelRatio() - desired) > 1e-6)
      renderer.setPixelRatio(desired);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
    renderer.clear();
    renderer.setScissorTest(true);
    renderer.autoClear = true;
    this.layer.hidden = race.state === "ready" || race.state === "results";
    for (const [index, racer] of visible.entries()) {
      const v = layout[index],
        player = players.find((p) => p.slot === racer.seat),
        color = player?.color || colors[racer.seat % 4];
      let rig = this.rigs.get(racer.seat);
      if (!rig) {
        rig = new ChaseCamera();
        this.rigs.set(racer.seat, rig);
      }
      let label = this.labels.get(racer.seat);
      if (!label) {
        label = document.createElement("section");
        label.className = "race-view-hud";
        for (const part of [
          "identity",
          "place",
          "lap",
          "speed",
          "item",
          "nitro",
        ]) {
          const node = document.createElement("span");
          node.className = `race-stat race-stat-${part}`;
          label.append(node);
        }
        this.layer.append(label);
        this.labels.set(racer.seat, label);
      }
      Object.assign(label.style, {
        left: v.x + "px",
        top: v.y + "px",
        width: v.width + "px",
        height: v.height + "px",
        borderColor: color,
      });
      const details = {
        identity: `${SEATS[racer.seat]?.shape || "●"} ${player?.name || `Player ${racer.seat + 1}`} · ${racer.character.name}`,
        place: `${race.position(racer)} / ${race.racers.length}`,
        lap: `LAP ${Math.min(racer.lap, race.laps)} / ${race.laps}`,
        speed: racer.dnf
          ? "DID NOT FINISH"
          : racer.finishTime !== null
            ? `FINISHED · ${racer.finishTime.toFixed(1)}s`
            : race.state === "countdown"
              ? String(race.count || "GO!")
              : `${Math.round(Math.abs(racer.speed) * 3.6)} km/h${racer.autoDriving ? " · AUTO" : ""}`,
        item:
          racer.roulette > 0
            ? "SURPRISE…"
            : racer.item
              ? `ITEM · ${racer.item.toUpperCase()}`
              : `${racer.coins} COINS`,
        nitro: `BOOST ${"●".repeat(racer.nitroRemaining)}${"○".repeat(3 - racer.nitroRemaining)}${racer.nitroCooldown > 0 ? ` · ${Math.ceil(racer.nitroCooldown)}s` : ""}`,
      };
      for (const [key, text] of Object.entries(details)) {
        const node = label.querySelector(`.race-stat-${key}`);
        if (node.textContent !== text) node.textContent = text;
      }
      const camera = rig.update(racer, v, dt);
      for (const [kartIndex, kart] of karts.entries())
        kart.root.visible =
          race.racers[kartIndex] === racer || rivalVisible(kart.model, camera);
      renderer.setViewport(v.x, height - v.y - v.height, v.width, v.height);
      renderer.setScissor(v.x, height - v.y - v.height, v.width, v.height);
      renderer.render(scene, camera);
    }
    for (const [seat, label] of this.labels)
      if (!visible.some((r) => r.seat === seat)) {
        label.remove();
        this.labels.delete(seat);
        this.rigs.delete(seat);
      }
    for (const kart of karts) kart.root.visible = true;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
  }
  hide() {
    this.layer.hidden = true;
  }
}
