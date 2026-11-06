import { raceMath as physicsMath } from "../../core/dmath.js";
/** Art-directed source-course glide, independent of renderer and camera. */
export function stepSourceGlide(height, velocity, speed, dt) {
  // Lift arrests the steep launch-ramp dive. A stable descent angle carries
  // the kart along the landing straight instead of accelerating into it.
  const terminal = -Math.max(10, Math.abs(speed) * 0.42);
  const response = 5;
  const decay = physicsMath.exp(-response * dt);
  return {
    height:
      height + terminal * dt + ((velocity - terminal) * (1 - decay)) / response,
    velocity: terminal + (velocity - terminal) * decay,
  };
}
