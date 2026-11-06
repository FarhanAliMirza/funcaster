# Funcaster game SDK 1.0

First-party browser adapters import `/sdk/index.js`. `GameSession` provides input and action hooks, stable seats, frozen match setup, addressed feedback, partial scores, one final result, snapshots, and per-game local storage. Legacy adapters use the exported `GameLink` / `createChannel` compatibility surface. Rules classes remain pure JavaScript.

Run `npm run game:create -- my-game`, then `npm run game:validate -- creator-games/my-game`. Copy the generated HTML into `/creator` to test in an opaque-origin iframe. The sandbox has no network, storage, forms, popups, same-origin access or game credentials. This is an offline development preview, not permission to run creator code in a live room.

Manifests require version 2, an immutable namespaced ID, semantic version, Solo and Multiplayer limits, view policy, scoring and verification tier. The catalogue and bundled manifests must agree. Namespace ownership, human review, asset provenance and browser performance must be reviewed before publication. Community publishing stays off until an outside creator completes the documented workflow. The registry records this gate.

`ResultV1` carries the game/version/build hash, setup, seed, ranked scores, status, verification and canonical SHA-256 hashes. The three server games include actual per-step input replays; Slice Dojo includes its seeded cursor/update log, checked independently in Node. Only an agreeing replay receives `verified`. Other browser-authoritative games remain `attested`. Export a round from its results screen and run `npm run replay:check -- file.json`. Attestation is not evidence of independently verified play.

Snapshots contain data only, preserve existing rule prototypes on receipt, and reject prototype keys. Read-only display tokens cannot submit inputs, results, game feedback, or snapshots. The host remains the authority; automatic transfer of authority is not enabled.
