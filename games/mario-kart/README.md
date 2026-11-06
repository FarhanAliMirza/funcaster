# Kart Rush

A phone-steered party racer with eight original robot drivers: Comet, Pip, Nova, Ziggy, Skye, Ember, Pebble and Orbit. The legacy folder URL remains compatible; the active game uses original procedural vehicles, course presentation, vector portraits and synthesized sound.

Start the main party from the repository root with `npm run share`. Every phone picks a driver, confirms, and holds **Accelerate** on the right. Tilt gently left/right in landscape. **Brake** is left and **Boost** is center, with three uses and an eight-second cooldown. Items activate automatically in party mode. The host chooses one or three laps and optional CPU racers. Solo defaults to seven CPU opponents; multiplayer defaults to the human field only.

Two to four human karts share the same race and receive independent chase cameras/HUDs. Display invites can follow a chosen driver or group. A disconnected driver is auto-driven without changing the field. The host tab must remain open.

For standalone keyboard play: arrows steer, Z accelerates, X brakes, Shift drifts, Space uses an item, Enter confirms, R recenters and Escape pauses. Historical extracted asset fixtures are not loaded by the public renderer; see [PRE_EXISTING.md](../../PRE_EXISTING.md).

The pure race rules have a seeded fixed 120 Hz step. Multiplayer regression tests cover separate human inputs, boost limits, finish order and render-rate independence. The shared display tier lowers expensive effects when more cameras are active. Physical low-end-device frame rate and sensor feel still require rehearsal.
