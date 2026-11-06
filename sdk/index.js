/** Funcaster Game SDK v1. Browser-only services are constructed explicitly. */
export * from "../core/index.js";
export * from "../core/splash.js";
export * from "../core/racing-motion.js";
export * from "../core/random.js";
export * from "../core/viewports.js";
export { validateManifest, matchSetup } from "../core/catalog.js";
export { encodeState, restoreState } from "../core/state.js";
export { GameSession, scopedStorage } from "./session.js";
export const SDK_VERSION = "1.0.0";
export { FixedStep } from "../core/fixed-step.js";

export { defineGame, GameRuntime } from "./lifecycle.js";
export { SEATS, ROOM_SEATS, seatIdentity } from "../core/seats.js";

export { ghostFleet } from "../core/ghost-fleet.js";
