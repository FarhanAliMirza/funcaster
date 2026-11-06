# Funcaster — implementation and release plan

Updated **6 November 2026**. The owner explicitly requested PR delivery and merge into `main` on 6 November after the Funcaster OS rebuild passed software verification. The scheduled software through SH11, VP5 and HO3 is implemented and browser-checked, while physical QA2/QA3 and HO1/HO2 hosting remain pending; see [build progress, evidence, deviations and next tasks](docs/OS-BUILD-PROGRESS.md). No deployment was performed. The November 6 PR/evidence below describes the earlier console, not the status of the new desktop.

This is the current checklist. The previous scenario book and dated audits are preserved in [plan-history.md](plan-history.md); their unchecked boxes and approval-blocked notes are historical, not outstanding implementation tasks. Detailed behavior is recorded in [IMPLEMENTATION.md](docs/IMPLEMENTATION.md), with [engineering evidence](docs/RELEASE-2026-11-06.md) and the [UI review](docs/UI-REVIEW-2026-11-06.md).

## North star and direction (6 November 2026)

**Read this section first, then the document map. It is written for any person or agent who joins the project.**

### What we are building

**Funcaster Console** is a **game console that runs in a web browser**. One screen (a TV, a laptop, a projector) shows the games; **every player's phone is their controller**, using the phone's motion sensors and touch. Players scan one QR code, tap once, and play. There is **no app to install**. The shipped product has **13 games**, rooms of **up to four phones** with a waiting queue, **Solo and Multiplayer** modes, a **Party mode** (friends, a VIP phone steers) and a **Kiosk mode** (a booth that runs itself), **remote screens** for friends elsewhere, verified results, and a **creator platform** so outsiders can add games. Phones talk to a Node and Socket.IO relay; the games run in the browser on the big screen or, for some online modes, on the server.

### Why, and for whom

The first audience is **people walking up to a screen at an event, and friends in one room**: ETHGlobal Mumbai and Devcon 8 India (Mumbai, 3 to 6 November 2026) are the immediate stage, and the owner's team is on the approved Continuity track. A good result means **a stranger scans, understands, and is playing within about 20 seconds, then brings a friend**. The longer story is a platform: more games from more creators, streamers playing with viewers ([business-plan.md](business-plan.md)), and, later, partner-track features.

### Goals, in priority order

1. **Instantly playable.** One scan, one tap, no account, no install, works on iPhone and Android, with a touch fallback for every phone.
2. **Legible and controllable from the sofa.** The big screen is readable at 3 metres and **everything can be done from a phone**.
3. **Real multiplayer.** Humans-only by default, at least two humans to start a Multiplayer game, fair rules, honest drop and forfeit handling, remote friends who truly play.
4. **A distinct, charming identity.** The interface is a **Windows-XP-style desktop over a pixel-art Mumbai wallpaper**, with a mascot and a backdrop for each game. Brand: **Funcaster** (unchanged; the mascot is **Caster**, a chubby street cat). The full implementation spec is the [build specification](docs/plans/build/README.md).
5. **Honest and safe.** Verification labels are truthful, nothing leaves the room without consent, and **no third-party artwork ships that we do not have the right to use**.
6. **Open to creators.** A validated manifest, namespaced ids, a local SDK and review workflow.
7. **Ready for the hackathon tracks later**, without letting that distort the game ([plan-history.md](plan-history.md) sections 5f and 12).

### Direction change of 6 November 2026

The owner set a new direction for the experience. In order, and with the plans that carry them:

| # | Change | Plan |
| --- | --- | --- |
| D1 | **The whole console and menu become a Windows-XP-style desktop**: game icons, a small **Game Properties window** per game that holds every pre-game option, a Start menu, taskbar, tray, dialogs, balloons | [xp-console-ui.md](docs/plans/xp-console-ui.md) |
| D2 | **The dashboard is fullscreen, never scrolls, and games adapt to the screen** (a viewport contract and a test matrix) | [xp-console-ui.md](docs/plans/xp-console-ui.md) section 8 |
| D3 | **Everything is controllable from the phone** (pointer and D-pad focus navigation, text typed on the phone, every host action reachable) | [xp-console-ui.md](docs/plans/xp-console-ui.md) section 6 |
| D4 | **The phone goes fullscreen with one tap**; iPhone cannot (no web fullscreen on iPhone), so it gets the best immersive tab and an optional installed app | [phone-controller-v2.md](docs/plans/phone-controller-v2.md) section 3 |
| D5 | **A universal remote** that never changes between games (D-pad, A, B, 1, 2, minus, home, plus), looking like the original controller with our branding; games only change what the buttons mean | [phone-controller-v2.md](docs/plans/phone-controller-v2.md) section 4 |
| D6 | **Android and iPhone sensors are mapped by a capability probe** into four experience tiers | [phone-controller-v2.md](docs/plans/phone-controller-v2.md) section 7 |
| D7 | **Wallpaper**: `assets/source/wallpaper/mumbai-pixelated.png` replaces the stock wallpaper | [xp-assets-and-licensing.md](docs/plans/xp-assets-and-licensing.md) section 2.6 |
| D8 | **A mascot and a backdrop for each of the 13 games** | [xp-assets-and-licensing.md](docs/plans/xp-assets-and-licensing.md) sections 4 and 5 |
| D9 | **The name stays Funcaster and the mascot is a cat, Caster** (a chubby kaali-peeli street cat whose collar tags light up as phones join). A rename (Dabba, then Tapri) was explored on 6 November and dropped, so no identifiers change | [build/01](docs/plans/build/01-brand-and-rename.md) |
| D10 | **The previous pointer** (`core/pointer.js`, the "moving probe") is retained for the shell cursor; the phone streams raw samples while the shell is up | [build/06](docs/plans/build/06-phone-remote-and-pointer.md) section 6 |
| D11 | **Skin: Windows XP Luna blue** (grey Classic as the high-contrast option); the old dashboard stays reachable at `/?shell=classic` as the safety net | [build/02](docs/plans/build/02-theme-and-assets.md) section 1, [build/03](docs/plans/build/03-shell-architecture.md) section 17 |
| D12 | **The remote is the previous controller face with a skin change** (D-pad, A, B, 1, 2, minus, home, plus), with the "funcaster" wordmark; **the default skin is Luna blue, not white** (the white remote is an option) | [build/06](docs/plans/build/06-phone-remote-and-pointer.md) sections 2 to 4 |

**Supersedes:** the "Funcaster Arcade" neon look and the per-skin ideas in [visual-direction.md](docs/plans/visual-direction.md) (for the shell, menus and TV screens; its asset list partly stands), and **section 7 of [controller-design.md](docs/plans/controller-design.md)**, which deliberately left out a D-pad, plus and minus, home and numbered buttons. The owner reversed that decision on 6 November (recorded in [phone-controller-v2.md](docs/plans/phone-controller-v2.md) section 12). Where the earlier XP-direction documents ([xp-console-ui.md](docs/plans/xp-console-ui.md), [phone-controller-v2.md](docs/plans/phone-controller-v2.md), [xp-assets-and-licensing.md](docs/plans/xp-assets-and-licensing.md)) disagree with the [build specification](docs/plans/build/README.md), **the build specification wins**.

**Asset pack: owner decision of 6 November 2026.** The supplied `assets/source/winxp` pack is largely **Microsoft's artwork, sounds and fonts** (the real XP icons, cursors, sounds, Tahoma, Clippit, Bliss; plus a recreation of the Luna UI by NullTale). The owner decided to **use it as supplied, without further questions**, and confirmed that the licences of the supplied packs (including the ten CraftPix packs) allow free use; the exposure of Microsoft-derived material on any public address is accepted and recorded here once. Practical rules: **everything supplied is committed** under `assets/source/` (138 MB, at the owner's request so the teammate has it; the `.gitignore` whitelists `!/assets/source/` and `!/assets/os/`), the server does **not** serve `/assets/source`, and the Docker image excludes it; the build generates the shippable subset into `assets/os/`; every asset is reached through a theme manifest so swapping any of it is one line; the Windows logos and boot screens are not used. Details: [build/02](docs/plans/build/02-theme-and-assets.md).

### Guardrails (these bind every agent)

- **Solo mode is unchanged**; Multiplayer is humans-only by default and needs two humans.
- **Four active seats.** More only through a flag-guarded plan ([seats-4-to-8.md](docs/plans/seats-4-to-8.md)).
- **No web3 code now.** The partner plan exists in [docs/plans/web3/](docs/plans/web3/README.md) (reassessed 6 November: Arc, World, Arkiv, with ENS the first reserve; three partners are picked at submission). **Friend stakes (real-life betting) are a product decision of 6 November**: dares and standing are built now, the pot runs on testnet play money only and real value stays off by default and never in India without legal advice ([08](docs/plans/web3/08-stakes-product-and-legal.md)). Integrations are built 5 to 6 November, outside the game repo until then.
- **Third-party artwork:** the supplied Windows-derived pack is used by owner decision (above); no other third-party artwork, names or logos. The product says "Funcaster". The extracted Kart Rush pack stays blocked from serving.
- **Sensors need HTTPS.** Never send orientation data as volatile. Never reduce the mapping to raw Euler angles (see `CLAUDE.md`).
- **Honest labels:** verified, attested and reported-remotely are never blurred.
- **Time:** Devcon starts 6 November. Only the items marked "Event" in the plans are on the critical path; hosting is last by the owner's choice.
- **Working agreement:** commit directly to `main`; commit only when asked. The working tree uses CRLF line endings on Windows (`core.autocrlf`), so scripts that edit `plan.md` must preserve them.

### Document map

| Document | Read it for |
| --- | --- |
| **This file** | The current checklist, goals and direction |
| [docs/plans/build/README.md](docs/plans/build/README.md) | **The build specification (start here to implement):** brand, theme and assets, shell architecture, Game Properties, games and viewport, phone remote and pointer, schedule, tests and runbook |
| [docs/plans/xp-console-ui.md](docs/plans/xp-console-ui.md) | **The interface plan**: Funcaster OS, Game Properties, navigation, fullscreen, design system, build order |
| [docs/plans/phone-controller-v2.md](docs/plans/phone-controller-v2.md) | **The phone**: one-tap gate, universal remote, sensor tiers, per-game mapping |
| [docs/plans/xp-assets-and-licensing.md](docs/plans/xp-assets-and-licensing.md) | Asset briefs for later production: custom mascot art and the 13 game backdrops (its licence gate is superseded by the owner's decision above) |
| [docs/plans/remaining-games.md](docs/plans/remaining-games.md), [host-phone-controls.md](docs/plans/host-phone-controls.md), [remote-play-via-displays.md](docs/plans/remote-play-via-displays.md), [seats-4-to-8.md](docs/plans/seats-4-to-8.md), [hackathon-floor-plan.md](docs/plans/hackathon-floor-plan.md), [controller-stress-tests.md](docs/plans/controller-stress-tests.md) | The earlier plans (most are implemented; each file's status line says how far) |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md), [docs/RELEASE-2026-11-06.md](docs/RELEASE-2026-11-06.md), [docs/UI-REVIEW-2026-11-06.md](docs/UI-REVIEW-2026-11-06.md) | What is built and how it was checked |
| [docs/NETWORKING.md](docs/NETWORKING.md), [docs/SDK.md](docs/SDK.md), [docs/CREATOR-PUBLISHING.md](docs/CREATOR-PUBLISHING.md), [docs/HACKATHON.md](docs/HACKATHON.md) | Networking, SDK, creator workflow, running the booth |
| [business-plan.md](business-plan.md) | The Streamer Arcade pitch (verbatim), monetisation research |
| [plan-history.md](plan-history.md) | The old scenario book, audits and partner-track design notes |
| [README.md](README.md), [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md) | Setup, gotchas, agent rules |

---

## New workstreams (6 November 2026)

Software implementation is complete through **AS1–AS4, BR1, SV1–SV3, SH0–SH11, PH1/PH2/PH3/PH4/PH6/PH8, VP1–VP5 and HO3**. QA1 tests were added throughout. Checked boxes below mean implemented software; they do not claim physical acceptance or deployment. The 234-sample viewport matrix, shell-flow evidence, targeted corrections, formatting and combined test totals are recorded in [the progress log](docs/OS-BUILD-PROGRESS.md). HO1/HO2 stay last; QA2/QA3 remain deferred. "Event" means needed for 6 November.

- [x] **W1 Phone entry (Event):** page lock, universal Luna remote with all 13 caption/action maps and both postures, one-tap gate/capability probe, touch fallback, device diagnostics, skins and wordmark (PH1–PH4, PH8). Physical permission/sensor/multitouch acceptance is tracked under W8.
- [x] **W2 Pointer and server events (Event):** validated pointer/button/device relay, raw phone capture, retained `core/pointer.js` shell client, focus navigation, sensitivity/recentre, clipped-target protection and optional glove cursor (SV2, PH6, SH5).
- [x] **W3 Funcaster OS shell (Event):** desktop, window manager, taskbar/tray/Start, session/reclaim, Game Properties for all 13 games, loading/game/results, all utility windows, boot/who/attract/staff, Luna/Classic/Taxi skins and settings (SH0–SH8, SH10).
- [x] **W4 Assets (Event):** reproducible preparation, cleaned wallpaper, sprite/icon/cursor exports, fonts/cues, manifest/credits, measured CraftPix pets and four seat avatars (AS1–AS4). Source files remain unchanged and unserved.
- [x] **W5 Brand and current mascot:** Funcaster constants and the supplied helper as the documented stand-in (BR1, SH9). Commissioned Caster cat sheets/collar artwork stay in the later tier.
- [x] **W6 Games fit any screen (Event):** VP1–VP5 are implemented: HUD/overflow/zero-size fixes, fit/letterbox utilities, Kart party menu, pixel budgets, aspect-aware split and scaled arena/Drawing text. The 234-case matrix, six DPR stress cases and targeted final corrections pass. Real-TV acceptance remains QA3.
- [x] **W7 Mascot, sound and atmosphere:** helper engine, audio bus/cues, street pets, seat avatars, gentle-effects and Settings switches (SH9, SH11). Caster's custom art and 13 bespoke backdrops remain later-tier work.
- [ ] **W8 Hosting, devices, rehearsals (Event):** HO3 launcher is implemented and tested; the machine dry-run found no installed Chrome/Edge. HO1/HO2 hosting and trusted LAN fallback await the chosen account/domain. QA2 real phones and QA3 real-TV rehearsals/soak remain unverified, as requested. See [build07](docs/plans/build/07-schedule-tests-runbook.md).

---

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
- [x] **Artwork and presentation:** original kart crew/vehicles/items/course presentation, Funcaster Arcade shell, original vector/procedural art, local fonts and licenses, sound cues, icons/share art and credits. Original art supersedes the earlier Mario branding request; compatible internal URLs remain. **Direction change, 6 November 2026:** the "Funcaster Arcade" shell is to be replaced by the Windows-XP-style Funcaster OS desktop ([North star](#north-star-and-direction-21-october-2026)); game art and the original kart art stand.
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

These acceptance items cover both the earlier console and the implemented Funcaster OS rebuild. **Software checks and browser evidence are recorded; physical acceptance is not complete.** Physical tests were explicitly left for later by the user; hosting remains last.

- [ ] **Real phones:** iPhone Safari and Android Chrome motion permission, grip calibration, landscape directions, recentering, simultaneous pedal touches, sleep/reconnect and accessibility. Desktop touch/browser checks do not establish sensor or multitouch behavior.
- [ ] **Network and venue:** mixed Wi-Fi/cellular joins, measured end-to-end latency, delayed remote Golf viewing, one-hour four-phone thermal/performance soak and a walk-up rehearsal.
- [ ] **Outside creator trial:** a person outside the project builds/submits a bundle, the operator records actual acceptance and reviews it before publication. Synthetic test submissions do not satisfy this gate.
- [ ] **Distribution check at deployment:** the server source-directory guard is tested and `.dockerignore` excludes `assets/source`; inspect the actual deployment image during HO1. The owner approved use of the supplied assets; no new licence approval is needed.
- [ ] **Stable HTTPS deployment — last:** user chooses hosting account/domain, then provision and publish, verify cellular QR joining and rehearse recovery. No stable endpoint is currently deployed.
- [ ] **Release:** complete the build and applicable acceptance tasks, finish the authorized PR merge, then follow the freeze/deployment/tag gate. Deployment and tagging are not included in the PR merge request.

No further user approval is blocking the already-approved server or scoped remote-screen implementation. The only destination information needed later is the hosting account/domain.

## What is off, gated, or a later extension

| Item                                                        | Current behavior / next step                                                                                                                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remote play                                                 | Implemented, deployment opt-in (`FUNCASTER_REMOTE_VIEWS=1`) plus a per-room TV-host setting; unavailable in Kiosk mode. Spectator invitations and room ownership remain scoped; the TV must stay open. |
| Community publication                                       | Implemented operator workflow, gated by a real outside-creator trial and review. The gallery runs standalone keyboard/pointer bundles; it gives games no room credentials.                          |
| Peer lockstep                                               | Optional loopback research lab. Production online games use server simulation; a future peer-simulation switch needs cross-engine acceptance.                                                       |
| Active-game phone hold-A taskbar context | Not implemented: build03 §14.3 conflicts with build06 lobby/results-only pointer/button relay. Phone Home opens the party/admin sheet; TV Game menu/Home/Escape opens Pause; native mouse/taskbar context works. The gesture needs a revised active-round input contract; alternatives do not count as implementation of it. |
| Automatic TV takeover                                       | Not implemented. Transferring room-owner authority to another browser requires a separate ownership/recovery design. This is distinct from the implemented host-phone delegation.                   |
| Eight active seats                                          | Not implemented; the product intentionally stays at four. The bounded waiting queue is available.                                                                                                   |
| Self-service public uploads / third-party party integration | Later extensions; operator registry/gallery and local SDK workflow are implemented.                                                                                                                 |
| Caster art, bespoke backdrops and installable remote | Later tier per build07. The supplied helper and CraftPix animals/avatars are implemented; the standalone installable `/remote` app is not. |
| Additional commissioned assets                              | Full 3D Mumbai prop pack, recorded music and voice acting remain optional later production work; original code/vector/procedural artwork ships now.                                                 |
| Other exploratory roadmap ideas                             | Expanded gamepad gameplay (shell navigation is implemented), offline service worker, AI drawing guesses, monetization and partner/Web3 integrations are deferred. The historical plan keeps their design notes.                                   |

## Review handoff

Review the Funcaster OS rebuild against [OS build progress](docs/OS-BUILD-PROGRESS.md) and the build specification. The earlier PR evidence remains historical. [UI review](docs/UI-REVIEW-2026-11-06.md) records the browser sizes, game states, regressions fixed and remaining real-device checks. [Release evidence](docs/RELEASE-2026-11-06.md) records automated results and the limits of local measurements.
