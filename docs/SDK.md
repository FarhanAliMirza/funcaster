# Funcaster game SDK 1.0

First-party browser adapters import `/sdk/index.js`. `GameSession` provides input/action hooks, stable seats, frozen setup, feedback, scores, results, snapshots and namespaced storage. Existing adapters use the exported `GameLink` / `createChannel` compatibility surface. Rules remain pure JavaScript so the server and replay checker can run them without a browser.

## Lifecycle

`defineGame({ init, step, render, result, onSeat?, dispose? })` validates hooks. `new GameRuntime(game, {seats, seed, setup}, {hz:120, onResult})` freezes a cloned context and calls `init`. Call `start`, deliver calibrated input through `input(slot, data)`, forward seat events with `seat(slot, event)`, then call `advance(elapsedSeconds, views)` each render frame. `pause(true)` freezes stepping while allowing rendering. `finish()` emits one immutable result; `dispose()` cleans up once.

First-party fixed-step callbacks use this runtime through `GameLink.advance`, including Kart and Golf. Drawing is event-driven. GameLink disposal clears runtime, snapshot/replay timers and socket listeners; page exit disposes the adapter. Online shared games use server stepping and read-only browser rendering. The runtime itself grants no network authority.

## Complete creator bundles

Run `npm run game:create -- my-game --namespace yourname`, then `npm run game:validate -- creator-games/my-game` and `npm run game:preview -- creator-games/my-game`. The generated game includes local HTML, JS, CSS and runtime modules; its pointer/arrow-key example ends after thirty seconds and offers Play again.

Validation requires manifest v2, immutable namespaced ID, semantic version, player/view/scoring contracts and a verification tier. Every nested file is checked: no symlinks, private keys or environment files, at most 25 MB and 4096 files. The SHA-256 fingerprint covers paths and asset contents. Dependencies must be bundled locally.

The preview prints a loopback-only URL and snapshots validated files into memory. Relative scripts, CSS and assets run in an opaque-origin iframe. It permits no external network, parent/room access, nested frames, workers, forms or persistent browser storage. `/creator` remains a lightweight pasted-HTML scratchpad; use the bundle command for an actual game.

## Review and publication

The operator workflow is implemented: owned namespaces, immutable submitted versions, asset/sandbox/playability reviews, an outside-creator acceptance record, exact-hash publication, withdrawal and an audit trail. See [CREATOR-PUBLISHING.md](CREATOR-PUBLISHING.md) for commands. Public `/community/` and `/community/catalog` expose only published versions. Creator games remain casual and isolated; the first gallery supports keyboard/pointer games. There is no public write/upload endpoint and no third-party room/phone credential access.

An outside creator still needs to complete the trial before publication is enabled in the real registry. The engineering workflow can be tested with a clearly labelled disposable fixture; that is not external acceptance.

## Records

`ResultV1` and `ReplayV1` carry game/version/build, setup, seed, integer scores, outcomes, verification and canonical hashes. Server games include input journals; supported browser rules and Slice include checked logic/cursor logs. Only an agreeing replay is labelled verified; casual creator bundles do not gain verified status through review. Run `npm run replay:check -- file.json` against the archived matching build.

Snapshots are data-only and reject prototype keys. Display invites cannot submit input or results. Paired independent views receive only the approved one-seat/one-round execution grant; server-simulated shared rounds grant no score authority to a viewer. The TV remains room owner.
