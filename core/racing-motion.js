import { MOTION_PROFILES } from "./motion-settings.js";
import { PartyMotion } from "./party-motion.js";

/**
 * Racing uses the same one-axis, grip-independent screen twist as every other
 * motion mode, with a gentler steering curve for fine corrections.
 */
export class RacingMotion extends PartyMotion {
  constructor({ sensitivity = MOTION_PROFILES.racing.default } = {}) {
    super({
      sensitivity: Number.isFinite(sensitivity)
        ? sensitivity
        : MOTION_PROFILES.racing.default,
      minSensitivity: MOTION_PROFILES.racing.min,
      maxSensitivity: MOTION_PROFILES.racing.max,
      fullTurn: 32,
      exponent: 1.35,
      responseRate: 16,
      deadzone: 2,
    });
  }
}
