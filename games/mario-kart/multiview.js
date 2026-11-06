import * as THREE from "three";
import { viewports, QualityGovernor } from "../../core/viewports.js";
import { rivalVisible } from "./rival-visibility.js";
import { chasePose, cameraClearance } from "./visual-frame.js";
const colors = ["#7357f5", "#fb7858", "#20a88a", "#e4ad26"];
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
    c.aspect = viewport.width / viewport.height;
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
    const layout = viewports(visible.length, innerWidth, innerHeight),
      renderer = this.renderer;
    const desired = this.governor.sample(dt * 1000);
    if (Math.abs(renderer.getPixelRatio() - desired) > 0.04)
      renderer.setPixelRatio(desired);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, innerWidth, innerHeight);
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
      const text = `${player?.name || `Player ${racer.seat + 1}`} · ${racer.character.name}\n${race.position(racer)} / ${race.racers.length}   ·   LAP ${Math.min(racer.lap, race.laps)} / ${race.laps}\n${racer.finishTime !== null ? "FINISHED" : race.state === "countdown" ? race.count || "GO!" : `${Math.round(Math.abs(racer.speed) * 3.6)} km/h`} ${player?.occupied === false ? " · AUTO DRIVE" : ""}`;
      if (label.textContent !== text) label.textContent = text;
      const camera = rig.update(racer, v, dt);
      for (const [kartIndex, kart] of karts.entries())
        kart.root.visible =
          race.racers[kartIndex] === racer || rivalVisible(kart.model, camera);
      renderer.setViewport(
        v.x,
        innerHeight - v.y - v.height,
        v.width,
        v.height,
      );
      renderer.setScissor(v.x, innerHeight - v.y - v.height, v.width, v.height);
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
    renderer.setViewport(0, 0, innerWidth, innerHeight);
  }
  hide() {
    this.layer.hidden = true;
  }
}
