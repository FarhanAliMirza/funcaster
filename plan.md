# Funcaster — implementation and release plan

Updated **6 November 2026**. Work is on `codex/arcade-launch-plan`, delivered through [PR #2](https://github.com/raihankhan-rk/funcaster/pull/2). **No merge or deployment has been performed.**

This is the current checklist. The previous scenario book and dated audits are preserved in [plan-history.md](plan-history.md); their unchecked boxes and approval-blocked notes are historical, not outstanding implementation tasks. Detailed behavior is recorded in [IMPLEMENTATION.md](docs/IMPLEMENTATION.md), with [engineering evidence](docs/RELEASE-2026-11-06.md) and the [UI review](docs/UI-REVIEW-2026-11-06.md).

## Implemented

- [x] **Walk-up flow:** one QR, room code, 1–4 phones, motion permission/onboarding, calibration, touch fallback, persistent seat identity, reconnect and rematch without rescanning.
- [x] **Catalog and setup:** all 13 games, neutral stable IDs, validated manifests, game-specific modes/options, two-human Multiplayer start gates, frozen match setup, playlists and crew rotation/brackets.
- [x] **Controller:** gentler calibrated steering, landscape wheel, Brake left / Boost centre / Accelerate right, three boosts per round with an eight-second cooldown, sensitivity preferences, hold-to-recenter/leave, pacing, skins, larger controls and mirrored pedals.
- [x] **Room lifecycle:** four active seats, waiting queue, promotion between rounds, 30-second reconnect grace, pause/forfeit/DNF/no-contest policies and explicit outcomes.
- [x] **Host-phone and kiosk controls:** approved revocable delegation, TV veto/transfer, scoped commands, PIN-protected staff controls, lock/remove, ready countdown, rotation, idle reset, event counters and persistent bounded records. These are implemented, not awaiting permission.
- [x] **Remote screens:** approved scoped per-screen QR pairing, play offers and start gates, one-view/one-round grants, replay acknowledgements, recovery/revocation/forfeit, spectator snapshots, interpolation, latency hints and wake locks.
- [x] **Online Kart/Tennis/Fencing:** server-owned shared simulation, phone input, paired views, start/recovery barriers and verified input journals. This replaces the proposed peer-lockstep dependency for shipping online play.
- [x] **Results and records:** canonical result/replay envelopes, honest verification tiers, replay checking where supported, local bests, history/export, persistent event records and standings.
- [x] **SDK and creator service:** lifecycle adapters, namespaced storage, validated complete bundles, generated template, local isolated preview, operator-owned namespace/submission/review/trial/publish/withdraw workflow and sandboxed community gallery.
- [x] **Artwork and presentation:** original kart crew/vehicles/items/course presentation, Funcaster Arcade shell, original vector/procedural art, local fonts and licenses, sound cues, icons/share art and credits. Original art supersedes the earlier Mario branding request; compatible internal URLs remain.
- [x] **UI review and corrections:** responsive lobby/setup/admin forms, isolated modal actions, landscape and compact portrait controllers, shared-game scoreboards, compact game menus, separated instruction/status rails and split-view player labels, results, remote pairing and utility screens. Coverage and limitations are listed in the UI review.
- [x] **Engineering foundations:** room/network safeguards, build handshake, pure Node certificate generation, cross-platform launcher, health checks, container/deployment preparation, automated validation and CI.

## Game implementation

| Game           | Delivered modes and behavior                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kart Rush      | 1–4 humans, optional CPU field, driver/lap choices, local split view and server-simulated online views, small-grid balancing, three boosts, first-finisher window, autopilot and replay checks.         |
| Pocket Greens  | 1–4 players, 1/3/6 holes, seeded tees/pins/wind, address/hold/release, turn clocks, ready golf, CPU skill, stroke/match/skins/closest/scramble and four-player best-ball, scorecards and replay checks. |
| Slice Dojo     | Shared Co-op/Battle and independent same-seed Race, countdown, shared lives/fatal bomb, fair swept-hit arbitration, scaling, optional helper and verified replay.                                       |
| Table Tennis   | Solo AI, human duel, co-op paddles, 7/11 with win-by-two, serve rotation, crew rotation/brackets, online server simulation and replay checks.                                                           |
| Foam Fencers   | Solo AI, human duel, sudden death, crew rotation/brackets, online server simulation and replay checks.                                                                                                  |
| Time Trial     | 1–4 independent cameras, live non-colliding ghosts, previous verified winner ghost and calibrated racing controller.                                                                                    |
| Cloud Cruise   | Independent 3D flying plus shared ring claims/time bonus and optional helper.                                                                                                                           |
| Shooting Range | Independent same-seed challenge, shared targets and tag-and-steal with optional helper and replay checks.                                                                                               |
| Alien Attack   | Independent 3D run, shared co-op/versus patrol, unique kill credit, revival pickups, optional wingman and replay checks.                                                                                |
| Drawing        | Shared free draw and private-phone draw-and-guess, themed English/Hindi/Hinglish/custom decks, aliases/filtering, guess penalties and constrained voting.                                               |
| Star Catch     | 1–4 lanes or first-to-claim pickups, common results and verified server replay.                                                                                                                         |
| Neon Drift     | 1–4 lanes, optional slipstream, boost budget, common results and verified server replay.                                                                                                                |
| Bubble Burst   | 1–4 players, optional exclusive pickups, common results and verified server replay.                                                                                                                     |

## Remaining acceptance and release work

These are **not missing feature implementations**. Physical tests were explicitly left for later by the user; hosting remains last.

- [ ] **Real phones:** iPhone Safari and Android Chrome motion permission, grip calibration, landscape directions, recentering, simultaneous pedal touches, sleep/reconnect and accessibility. Desktop touch/browser checks do not establish sensor or multitouch behavior.
- [ ] **Network and venue:** mixed Wi-Fi/cellular joins, measured end-to-end latency, delayed remote Golf viewing, one-hour four-phone thermal/performance soak and a walk-up rehearsal.
- [ ] **Outside creator trial:** a person outside the project builds/submits a bundle, the operator records actual acceptance and reviews it before publication. Synthetic test submissions do not satisfy this gate.
- [ ] **Public-source preparation:** before sharing the source with judges/publicly, revisit the retained third-party source archives and choose history cleanup or a clean distribution. They are already blocked from serving and excluded from deployment.
- [ ] **Stable HTTPS deployment — last:** user chooses hosting account/domain, then provision and publish, verify cellular QR joining and rehearse recovery. No stable endpoint is currently deployed.
- [ ] **Release:** review/approve the PR, complete the applicable acceptance tasks, explicitly authorize any backend merge, then create the launch tag. No automatic merge or release.

No further user approval is blocking the already-approved server or scoped remote-screen implementation. The only destination information needed later is the hosting account/domain.

## What is off, gated, or a later extension

| Item                                                        | Current behavior / next step                                                                                                                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remote play                                                 | Implemented, deployment opt-in (`FUNCASTER_REMOTE_VIEWS=1`) plus a per-room TV-host setting; unavailable in Kiosk mode. Spectator invitations and room ownership remain scoped; the TV must stay open. |
| Community publication                                       | Implemented operator workflow, gated by a real outside-creator trial and review. The gallery runs standalone keyboard/pointer bundles; it gives games no room credentials.                          |
| Peer lockstep                                               | Optional loopback research lab. Production online games use server simulation; a future peer-simulation switch needs cross-engine acceptance.                                                       |
| Automatic TV takeover                                       | Not implemented. Transferring room-owner authority to another browser requires a separate ownership/recovery design. This is distinct from the implemented host-phone delegation.                   |
| Eight active seats                                          | Not implemented; the product intentionally stays at four. The bounded waiting queue is available.                                                                                                   |
| Self-service public uploads / third-party party integration | Later extensions; operator registry/gallery and local SDK workflow are implemented.                                                                                                                 |
| Additional commissioned assets                              | Full 3D Mumbai prop pack, recorded music and voice acting remain optional later production work; original code/vector/procedural artwork ships now.                                                 |
| Other exploratory roadmap ideas                             | Gamepad input, offline service worker, AI drawing guesses, monetization and partner/Web3 integrations are deferred. The historical plan keeps their design notes.                                   |

## Review handoff

The PR should be reviewed against this checklist and the dated evidence, not the superseded audits. [UI review](docs/UI-REVIEW-2026-11-06.md) records the browser sizes, game states, regressions fixed and remaining real-device checks. [Release evidence](docs/RELEASE-2026-11-06.md) records automated results and the limits of local measurements.
