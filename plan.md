# Funcaster Console — Plan v4: a game menu, then multiplayer (Kart Rush, Golf and Slice Dojo first), then the ETHGlobal tracks

## Implementation status — 6 November 2026

This is the current release checklist; the detailed design/scenario book below remains a record of the larger roadmap, not a claim that every exploratory variant has passed acceptance. Work is on `codex/hackathon-party-experience`, delivered through draft PR #1. Backend changes are not merged.

- [x] Walk-up QR joining over Wi-Fi/mobile data, calibrated motion and touch fallback, reconnect identity, gentler landscape racing, Brake left / Boost center / Accelerate right, three boosts and eight-second cooldown.
- [x] All **13 games** in one shared catalog with validated mode/setup/scoring contracts, fixed match setup, two-human Multiplayer start gates and common results.
- [x] Simultaneous 2–4-player Kart Rush, individual cameras/HUDs and driver choices, configurable CPU field and disconnected-driver autopilot.
- [x] Original kart robots, vehicles, vector portraits/items, course presentation, branding and synthesized audio. **The user chose original artwork; this supersedes the earlier Mario Kart branding request.** Historical internal IDs/URLs remain compatible; extracted asset packs are blocked from public serving and excluded from deployment.
- [x] Pocket Greens turn/round rules, 1/3/6-hole tee variations, seeded optional computer golfers, hold/release shots, stroke limits, recovery and scorecards.
- [x] Slice Dojo co-op, battle and same-seed independent Race boards, fixed-step rules, bounded cursor logs and independent score checking.
- [x] Human tennis and fencing, four-player Time Trial/Cloud Cruise/Shooting Range/Alien Attack challenges, shared free drawing and private-phone draw-and-guess.
- [x] Pick two, Winner stays and three/four-player brackets; playlists and cumulative standings.
- [x] Read-only remote/hybrid/spectator display invites with player selection and synchronized snapshots. The original host remains open.
- [x] Host pause, controller preferences, phone-local profiles/bests, volume/gentle effects and `/self-test` diagnostics.
- [x] Canonical ResultV1/ReplayV1 envelopes, bounded recent records, exports, replay checking for three server games and Slice Dojo; honest attested labels for other browser results.
- [x] Shared SDK surface, namespaced storage helper, manifest validator, generated template, isolated creator preview and documented publishing gate.
- [x] Automated checks and CI, compression/minified Three.js, multi-view quality governor, container preparation, release guide and `PRE_EXISTING.md`.
- [ ] **Pending until last, at the user’s request:** choose hosting account/domain and publish the stable HTTPS demo.
- [ ] **Authority/access approval:** automatic game-host migration and designated-host phone administration. Automatic review rejected a broad authority rewrite; the implemented read-only display alternative preserves the existing boundary. See `docs/NETWORKING.md`.
- [ ] **Physical acceptance:** iOS/Android permissions and calibration, mixed mobile networks, measured input latency and a one-hour four-phone performance/thermal soak. Create the final pre-hackathon tag after acceptance.
- [ ] **External acceptance:** an outside creator builds a game with the SDK before enabling community publishing and its submission/review service.
- **Deferred:** Web3 partners, wallets, stakes and identity integrations.

Implementation choices for the hackathon build: snapshot displays instead of peer lockstep/live-ghost authority; short first-to-seven tennis; simultaneous telegraphed fencing strikes; separate same-seed shooting/space challenges; a timed shared-score Slice mode; six tee variations on the procedural golf course. The broader co-op/AI variants, gamepad support, offline service worker and formal cross-engine lockstep remain roadmap options. No measured hardware/performance or browser-independent determinism claim is made by these checkmarks. Current operation and evidence are in `docs/HACKATHON.md` and `docs/RELEASE.md`.

Updated 6 November 2026. ETHGlobal Mumbai submission deadline: **6 November 2026, 09:00 IST** ([details](https://ethglobal.com/events/mumbai/info/details)).

You are on the **Continuity track and approved**, so the work splits in two:

| Part | When | What | Time-boxed? |
| --- | --- | --- | --- |
| **A. Platform and games** | Before the hackathon | Every game has a **Solo** mode (as today, with its AI) and a **Multiplayer** mode (humans only by default, 2+ humans to start) playable on one screen, on separate screens, or both at once; fast web experience | **No** |
| **B. Track integrations** | **Later. Deferred: not being worked on now** | Arkiv, ENS, World leading; Chainlink spare; final three chosen when full briefs are out | Yes |

> **Current focus: the games and the game platform only.** The ETHGlobal partner-track (web3) integration is **deliberately deferred**. Nothing in [§5f](#5f-designing-part-a-for-the-partner-tracks) or [§12](#12-part-b-track-integrations-at-the-hackathon) is on the current work list, and nothing in Part A depends on it. Those sections are kept as a design note for when that work starts. The only shared pieces built now are the ones the games and the creator platform need anyway: stable game ids, the manifest, and the generic result and replay formats ([§5g](#5g-a-platform-for-other-peoples-games)).

**Build order within Part A**

1. **The game menu first:** one menu that lists all ten games, each tile showing what it supports (Solo, Multiplayer, player range), and that is where every match starts ([P1b](#p1b-the-game-menu-and-lobby-entry-m)). It needs no multiplayer work, so it ships immediately and grows as each game gains modes.
2. **Then multiplayer support**, in tiers:
   - **Tier 1: Kart Rush, Golf, Slice Dojo.** The games where multiplayer is the point (Slice Dojo is also the only game with multiplayer today, so it is the quickest proof of the new platform).
   - **Tier 2:** Table Tennis, Swordplay, Kart Time Trial, Island Flyover.
   - **Tier 3:** Shooting Range, Alien Attack, Sketch.

Nothing in a later tier starts until the tier before it passes its acceptance bar.

Sections: [0 Summary](#0-summary) · [1 State of the code](#1-where-the-code-is-today) · [2 Seats, screens and views](#2-seats-screens-and-views) · [3 Definition of done](#3-definition-of-done) · [4 Platform layers](#4-platform-layers-build-order) · [5 Web performance](#5-web-experience-and-performance) · [5a Controller](#5a-the-controller-the-phone) · [5b Hosting and first run](#5b-hosting-distribution-and-first-run) · [5c Safety and privacy](#5c-safety-privacy-and-content) · [5d Product details](#5d-product-details-the-first-plan-missed) · [5e Names and assets](#5e-names-assets-and-the-pre-existing-base) · [5f Partner-track readiness](#5f-designing-part-a-for-the-partner-tracks) · [5g Platform for other people's games](#5g-a-platform-for-other-peoples-games) · [6 Tier 1](#6-tier-1-kart-rush-golf-and-slice-dojo) · [7 Tier 2](#7-tier-2-kart-time-trial-island-flyover-table-tennis-swordplay) · [8 Tier 3](#8-tier-3-shooting-range-alien-attack-sketch) · [9 Testing](#9-testing-strategy) · [10 Order of work](#10-order-of-work) · [11 Evidence](#11-why-this-is-worth-building) · [12 Part B](#12-part-b-track-integrations-at-the-hackathon) · [13 Held decisions](#13-decisions-held-until-the-briefs) · [14 Risks](#14-risks) · [15 Unverified](#15-things-i-could-not-verify) · [16 Sources](#16-sources) · [17 Review log](#17-review-log-holes-found-in-this-pass-and-where-they-are-covered)

---

## 0. Summary

**Four rules that shape everything**

1. **Two modes per game: Solo and Multiplayer.** **Solo** is the game as it is today: 1 human, with its AI where it has one (Kart Rush 1 human + 7 CPU, Table Tennis vs the AI). **Multiplayer is humans only by default**: the field is exactly as many cars, paddles or players as there are humans, and it **cannot start with fewer than 2 ready humans** (AI, spectators and extra screens don't count). The player who starts the game (the **host seat**) can change the setup, for example add CPU racers; until they do, nothing but humans plays ([§2.7](#27-modes-start-rules-and-match-setup)).
2. **AI stays, as an option.** Every existing AI is kept and Solo play against it is unchanged. In Multiplayer it is an opt-in add-on from the host. Separately, a human who drops mid-match is **autopiloted for a grace period** so a race or rally doesn't stall; that is not an AI player and doesn't change the field.
3. **Players may share a screen, have their own, or both.** The model is *seats* (a player, human or AI) and *screens* (a browser tab rendering the game). A match can be all on one screen, all on separate screens, or any mix (two friends on the living-room TV, a third on a laptop in another city). Games differ in what a screen must draw for its local seats ([§2](#2-seats-screens-and-views)).
4. **Menu first, then Kart Rush, Golf and Slice Dojo.** One menu lists every game and starts every match. After it, the three Tier 1 games exercise the whole platform between them: Golf proves turns, seats, screens and online; Kart Rush proves per-player views and variable-size fields; Slice Dojo proves a real-time shared board and per-player scoring.

**How the real Mario Kart games handle different views on one screen, and what we do.** The real games split the screen: Mario Kart 8 Deluxe runs 1–2 players at 1080p/60 fps and keeps 1080p but drops to 30 fps for 3–4 players ([Nintendo Life](https://www.nintendolife.com/news/2017/03/mario_kart_8_deluxe_runs_at_60fps_in_1080p_when_docked)); a later update reports 8-player split-screen on Switch 2 with the frame rate halved for 3–4 and 8 players ([KitGuru](https://www.kitguru.net/tech-news/mustafa-mahmoud/mario-kart-8-deluxe-gets-surprise-switch-2-update-with-8-player-split-screen/), third-party analysis). The real games also support the **hybrid** case: online, two players can share one console ([How-To Geek](https://www.howtogeek.com/306445/how-to-play-mario-kart-with-your-friends-on-the-nintendo-switch-online-and-in-person/)), and in Mario Kart World online play is 2–24 players with up to two per console ([Nintendo support](https://en-americas-support.nintendo.com/app/answers/detail/a_id/68610)). So: **one view per *local human seat* on each screen** (split-screen layout), remote humans appear in the world as other karts, and a screen with no local seat shows a director camera. Our code isn't ready for this today: the camera rig, HUD, shadows and post-processing all assume one player ([§1](#1-where-the-code-is-today)), so Kart Rush needs a deliberate refactor ([§6.2](#62-kart-rush)).

**Code facts that shape the plan** (details in [§1](#1-where-the-code-is-today))

- Only Slice Dojo takes more than one phone today; `createChannel` keeps one pointer and drops the slot ([core/channel.js:31-40](core/channel.js#L31-L40)).
- Kart Rush: one camera, one full-window post-processing chain (4× MSAA half-float target, GTAO, bloom), HUD built on global DOM ids, `race.player` hard-wired in 11 places in `game.js`, and `Race` takes one `character` and one input. But its `Race` is **pure, seeded and fixed-step (120 Hz)**, which makes online play plausible.
- Golf: one `Hole`, one ball, one player; but its physics are pure and deterministic, so a stroke can be replayed identically on every screen.
- The relay is global and a disconnect frees the seat immediately; assets are 98 MB (a 55 MB course); the static server doesn't compress ([§5](#5-web-experience-and-performance)).

**What the full review added** (the complete list is in [§17](#17-review-log-holes-found-in-this-pass-and-where-they-are-covered))

- **The controller** gets its own section and a redesign ([§5a](#5a-the-controller-the-phone)). It is a copy of the Wii Remote today, with a layout that doesn't suit multiplayer: weak identity, one layout for every game, any phone's B ends the game for everyone, a reconnect loses the seat, small buttons, and no way to play without a gyro.
- **Hosting and first run** ([§5b](#5b-hosting-distribution-and-first-run)): the QR can point at the wrong adapter, the certificate needs OpenSSL, auto-open is macOS-only, and nothing guards against stale builds.
- **Safety, privacy and content** ([§5c](#5c-safety-privacy-and-content)): phone-supplied text must never reach `innerHTML`, a swung phone needs the safety treatment the Wii strap taught Nintendo, and Part B publishes data publicly.
- **Missing product pieces** ([§5d](#5d-product-details-the-first-plan-missed)): settings, onboarding, profiles, groups larger than two, a party mode, pause semantics, and changes between matches.
- **Names and assets** ([§5e](#5e-names-assets-and-the-pre-existing-base)): Funcaster Console and the new game names, and the fact that the Kart Rush pack is Nintendo's own models, audio and UI, which a rename does not change.

- **Partner-track readiness (deferred, kept as a note for later)** ([§5f](#5f-designing-part-a-for-the-partner-tracks)): Part A ships interfaces and mock providers for identity, naming, randomness, records, signing, settlement and consent, fixes the result and replay formats, stable game ids and canonical hashing, and keeps every partner feature optional and non-blocking, so the integrations at the event are a new layer on a clean base.
- **A platform for other people's games** ([§5g](#5g-a-platform-for-other-peoples-games)): games get a validated manifest, namespaced immutable ids with a version and a bundle hash, generic scoring and stats, honest verification tiers (verifiable, attested, casual), and later a sandbox, a validator and a registry. The contracts are fixed now; the SDK is extracted from the three Tier 1 games before anything outside is allowed in.

**Open items (held, not decided):** the pot, and the World fallback ([§13](#13-decisions-held-until-the-briefs)). **Deferred:** all partner-track (web3) work, including the lobby's Ranked and Dare options, until the game side is done.

---

## 1. Where the code is today

The test baseline needs `npm ci`: `node_modules` is missing in this checkout, so the Kart Rush tests that import `three` fail with `ERR_MODULE_NOT_FOUND`. That is a missing install, not a bug.

| Game | Renderer | Players | Rules shape | AI today | Seeded? | Fixed step? | Multiplayer readiness |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Kart Rush** | WebGL | 1 human + 7 CPU | `Race` | CPU racers (`cpuInput`) | yes | **yes, 120 Hz** | One `character`, one input; single-camera game code |
| **Golf** | WebGL | 1 | `Hole` (one par 4) | none | none needed | no | One ball; pure deterministic physics |
| Kart Time Trial | WebGL | 1 | `Race` (3 laps) | none | n/a | no | Single car |
| Island Flyover | WebGL | 1 | `Flight` (20 points) | none | n/a | no | Single plane |
| Table Tennis | WebGL | 1 vs AI | `Rally` | **AI paddle** | `rng` | no | Asymmetric (`player`/`ai`) |
| Swordplay | WebGL | 1 vs AI | `Duel` | **AI fencer** | `rng` | no | AI-shaped rules |
| Slice Dojo | WebGL | up to 4 | shared lives, per-slot players | none | crits only; spawns use `Math.random` | no | Already multi-slot |
| Shooting Range | Canvas 2D | 1 | `Range` | none | `rng` | no | Single crosshair |
| Alien Attack | WebGL | 1 | `Patrol` | aliens only | yes (`mulberry32`) | no | Single ship |
| Sketch | Canvas 2D | 1 | `Sketch` | none | none | no | Single pen |

### 1.1 Kart Rush internals that decide the split-screen work

From [games/mario-kart/game.js](games/mario-kart/game.js) (1,546 lines) and [logic.js](games/mario-kart/logic.js):

| Piece | Today | Consequence for multiple views |
| --- | --- | --- |
| Camera | One `PerspectiveCamera`; ~100 lines of rig logic (chase pose, flight/landing blends, finish orbit, clearance against scenery, FOV kick) keyed to `race.player` and module-level state (`unconstrainedEye`, `cameraAim`, `cameraUp`, `landingCamera`, `lastFlightCamera`, `sceneryOffset`) ([game.js:1032-1115](games/mario-kart/game.js#L1032-L1115)) | Extract into a `ChaseCamera` class, one instance per local seat |
| Render | `EffectComposer` over a **window-sized 4× MSAA half-float target** with a `RenderPass`, **GTAO (8 samples)**, **bloom** and an output pass ([game.js:133-168](games/mario-kart/game.js#L133-L168)); one `composer.render()` per frame ([:1161](games/mario-kart/game.js#L1161)) | Each view needs its own camera pass and post chain at viewport size; AO/bloom/shadows are the costs to tier |
| Shadows | One directional light with a 2048² shadow map, repositioned each frame to follow the player; 5 spotlights repositioned by the player's track position ([game.js:1117-1156](games/mario-kart/game.js#L1117-L1156)) | The shadow pass re-renders per view (each view needs the light at *its* player) |
| HUD | DOM overlay addressed by global ids (`#coins`, `#lap`, `#position`, `#item-icon`, `#speed-lines`) ([game.js:1170-1179](games/mario-kart/game.js#L1170-L1179)) | Must become a per-view component (class-based, instantiated per viewport) |
| Race model | `Race({ seed, character, laps })`; `racers[0]` is the human; `this.player` used throughout; `update(dt, input)` takes one input; start-boost logic reads `this.player` ([logic.js:141-226](games/mario-kart/logic.js#L141-L226)) | Generalise to `humans: [{ seat, character }]`, per-racer input map, `racerOf(seat)` |
| CPU / auto-drive | `race.cpuInput(racer)` already drives any racer ([game.js:1505-1516](games/mario-kart/game.js#L1505-L1516)) | A ready-made **autopilot** for a dropped human (not a CPU racer: the field stays humans-only) |
| Audio | One engine; one `KartAudio` | Per-seat engine loops at reduced gain, panned per viewport; one music bed |
| Rival visibility | Hides a rival if the camera enters its body ([game.js:1147-1155](games/mario-kart/game.js#L1147-L1155)) | Evaluate per view |

### 1.2 Golf internals

[games/golf/logic.js](games/golf/logic.js): `Hole` holds one ball, `strokes`, `aimOffset`, `club`; `strike(power)` launches; `update(now, dt)` steps pure physics from [games/shared/ball.js](games/shared/ball.js) over a deterministic `terrainHeight(x, z)`; one fixed `HOLE`, `TEE`, `PAR = 4`; club auto-picked by distance. No rng, no AI, no turns, no course. This is the right size to be the first multiplayer proving ground.

### 1.3 Other facts

- The server tags every orientation packet with a server-assigned `slot` ([server.js:189-191](server.js#L189-L191)); per-slot feedback already works.
- `inputs: Map<slot, Pointer>` in Slice Dojo ([games/fruit-ninja/game.js:841-856](games/fruit-ninja/game.js#L841-L856)) is the pattern to lift into `createChannel`; only slot 0's sensitivity is persisted.
- **Which games take more than one phone today:** only Slice Dojo (`game.json` `players: 4`) and the launcher itself ([public/menu.js:570-600](public/menu.js#L570-L600) gives every phone its own pointer and hand). **Kart Rush receives the slot but throws away every phone except slot 0** (`if (slot !== 0) return;`, [game.js:370-381](games/mario-kart/game.js#L370-L381)); every other game goes through `createChannel`, which ignores the slot. Slice Dojo's multiplayer is local, co-op, one screen, with unit tests ([logic.test.mjs:183-243](games/fruit-ninja/logic.test.mjs#L183-L243)) but no lobby, modes, results screen per player or rematch.
- **The menu lists only 5 of the 10 games.** [public/menu.js](public/menu.js) is a console-channel-style Three.js grid (12 tiles per page, paginated) that fetches `/api/games`, draws each tile from `game.json` (emoji, title, tagline) and, on a press, zooms the tile and navigates the whole page to the game ([menu.js:745-930](public/menu.js#L745-L930)). `server.js` filters out `hidden: true`, and **Golf, Table Tennis, Swordplay, Kart Time Trial and Island Flyover are all `hidden: true`**, so they exist but can't be reached from the menu. The menu is also driven by virtual phone cursors, not a mouse, so ordinary HTML buttons can't be hovered or clicked by a phone pointer.
- `game.json` has `players: 1` (Slice Dojo `4`); the launcher can't express modes or ranges.
- The phone shows only `P1`..`P4` ([public/controller.js:138-141](public/controller.js#L138-L141)) and can emit up to ~166 Hz (`MIN_EMIT_MS = 6`, `flush()` called from both handlers, [:210-241](public/controller.js#L210-L241)).
- Kart Rush's assets are labelled "Nintendo source conversions" in [assets/mario-kart/manifest.json](assets/mario-kart/manifest.json).

---

## 2. Seats, screens and views

### 2.1 Vocabulary

- **Seat:** one player slot. Controller type is `human` (a phone) or `ai`. A seat has a colour, number, name, and a **home screen**.
- **Screen:** a browser tab running the game and rendering views. One screen hosts 0–4 local human seats (my proposed cap; the real console games cap at 4 per console).
- **Match:** a set of screens and seats sharing a room, a seed, a mode and a rules instance.
- **Mode:** **Solo** (1 human, game's own AI as today) or **Multiplayer** (2+ humans, AI off by default). Declared per game in `game.json`.
- **Host seat:** the human who created the room (transfers to the next human if they leave the lobby). Only the host seat edits the match setup and holds match-level powers (start, pause, end, kick).
- **Authority screen:** a different thing from the host seat. It is the screen whose browser runs the authoritative simulation for shared-board games (the room's first screen, migrating to the lowest remaining screen id if it drops). The host seat is a *person*; the authority screen is a *tab*, and they can be on different screens.
- **Match setup:** the options the host picks before starting; frozen at start ([§2.7](#27-modes-start-rules-and-match-setup)).
- **AI is a controller type, not a feature of the rules.** Rules classes never know whether a seat is human or AI.

### 2.2 The scenarios

| # | Scenario | Example | What a screen draws |
| --- | --- | --- | --- |
| T1 | **One screen, N local seats** | Four friends on the living-room TV | Shared-view games: one view. Per-player-view games: N split-screen views |
| T2 | **N screens, one seat each** | Four friends in four cities | One full-screen view per screen; other players appear in the world |
| T3 | **Hybrid** | Two on the TV, one on a laptop elsewhere, one on a tablet | Each screen draws views for *its own* local seats only |
| T4 | **Spectator screen** (0 local seats) | A second TV, or a friend watching | A director/leader camera, or the shared board |
| T5 | **AI in the mix** | Solo vs AI (default in Solo); in Multiplayer only if the host adds AI (e.g. 2 humans + 2 CPU) | AI seats are drawn like any other racer/paddle/player; they need no view |
| T6 | **Controller-only seat** | Sketch guessers on phones only | No view; the phone shows the prompt/keyboard |

Nintendo's precedent for T3: online play with two players sharing a console, and for Mario Golf: Super Rush, the simultaneous "Speed Golf" mode is available only in two-player split-screen or online; with four people in one room they must take turns ([ComicBook](https://comicbook.com/gaming/news/mario-golf-super-rush-nintendo-switch-local-multiplayer-restrictions/)). Standard Golf is turn-based and you can pass one controller ([Inverse](https://www.inverse.com/gaming/mario-golf-super-rush-local-online-multiplayer-how-to)). **So the rule we adopt: a game offers a mode only if the topology can show it.** The lobby greys out modes that the current seat/screen layout can't render, and says why.

### 2.3 View policy per game

Each game declares one policy; the platform does the rest.

| Policy | Meaning | Games |
| --- | --- | --- |
| **Shared view** | One camera shows the whole board for everyone. Topology only changes which seats are local. No split-screen. | Table Tennis, Swordplay (arena camera), Golf (shot camera on the active player), Slice Dojo, Shooting Range, Alien Attack co-op, Sketch |
| **Per-player view** | Each local human seat needs its own camera. A screen with `k` local humans draws `k` views. | Kart Rush, Kart, Island Flyover, Alien Attack in race mode |
| **Per-seat private info** | The screen is shared, but a seat needs private data on its phone. | Sketch prompts, Golf "your turn" |

**View count on a screen = number of local *human* seats** for per-player-view games (AI seats and remote humans need no local view; they appear as karts or ghosts in the world). 0 local seats means a director camera; 1 means full screen; 2–4 uses a layout.

### 2.4 Layout rules (per-player-view games)

- 1 view: full; 2 views: split in two (side by side or stacked, chosen by screen aspect with a toggle; playtest both); 3: 2+1 or 2×2 with the fourth cell used for course map/standings (design choice); 4: 2×2. Cap at 4 local views.
- Each viewport has its own camera (aspect and FOV adjusted to the viewport), its own HUD instance, and a border in the seat's colour matching its phone.
- **HUD as a container-scaled component**: render each HUD inside its viewport's container and size it with CSS container units, so one HUD works at any viewport size. (Today's HUD uses global ids.)
- Quality tier chosen from view count and measured frame time ([§5.3](#53-multi-view-cost-model)).

### 2.5 How the netcode generalises across topologies

The cleanest approach is one that doesn't care which topology it is in:

| Game type | Approach | Why topology doesn't matter |
| --- | --- | --- |
| Shared-view real-time (Table Tennis etc.) | Host screen runs the sim; other screens receive snapshots | Seats are just input sources; local or remote makes no difference to the sim |
| Turn-based (Golf) | Replicate *events* (a stroke), simulate the flight deterministically on every screen, authoritative resting position reconciles | A screen draws the same shot camera whether the striker is local or remote |
| Per-player-view racing, light | **Live ghosts:** each screen sims its own local seats and streams their poses; others appear as non-colliding ghosts | Local seats on one screen collide normally (one sim); remote ones are ghosts |
| Per-player-view racing, full | **Deterministic lockstep:** every screen runs the same seeded fixed-step `Race` and exchanges only inputs; a screen draws views for its local seats | Topology = which seats' inputs are local vs received |

### 2.6 Relay and lobby changes this implies

- Messages are **room-scoped**; the room holds `screens[]` and `seats[]`, and each seat has a `screenId`.
- **Each screen shows its own QR.** "Scan the QR on the screen you're sitting at" binds a phone to that screen, which makes hybrid play natural without a settings menu. A remote friend opens the room link on their own laptop (it becomes a new screen) and scans *its* QR with their phone.
- Orientation from a phone goes to its seat's screen; in lockstep modes it also goes to the other screens as an input message.
- The lobby lists screens and seats, shows who is on which screen, shows the **mode** (Solo or Multiplayer) and the **Start gate** ([§2.7](#27-modes-start-rules-and-match-setup)), lets the host seat edit the match setup (including adding AI), and greys out modes the topology can't show.
- **Host seat controls match settings** when seats share a console, as Nintendo does ("most settings are only adjustable by player 1", [Nintendo support](https://en-americas-support.nintendo.com/app/answers/detail/a_id/68610)).
- A screen that disconnects: its human seats follow the drop policy in [§2.7](#27-modes-start-rules-and-match-setup) (autopilot or pause for a grace period, then forfeit or DNF).
- A seat can move to another screen only in the lobby; mid-match it reattaches to its own.

### 2.7 Modes, start rules and match setup

**Two modes per game.** `game.json` declares them (schema in [P3](#p3-match-framework-ai-controllers-and-fixed-step-m)).

| | **Solo** | **Multiplayer** |
| --- | --- | --- |
| Humans | exactly 1 | `minHumans` (default **2**) up to the game's max |
| Field | The game as it is today, with its own AI | **Exactly the humans, by default.** Cars/paddles/players = number of humans |
| AI | Game default (Kart Rush 7 CPU, Table Tennis AI, Swordplay AI) | **Off** unless the host adds it |
| Purpose | Practice, play alone; behaviour pinned by golden tests | Play with others |

**Start gate (Multiplayer).** The Start button is disabled until **at least `minHumans` human seats are seated and ready**. What does *not* count toward the minimum: AI seats, spectator screens, screens with no phone, and unready seats. The disabled button says why ("Waiting for another player: scan the QR on a screen"). Two humans on the same screen count; two humans on two screens count. A room with one human can only start Solo; if a second human joins, the lobby offers to switch to Multiplayer and resets the setup to Multiplayer defaults (a Solo game already running isn't interrupted).

**Match setup.** Chosen by the host seat in the lobby, with sensible defaults per mode; frozen at start; recorded in `match.finish` so results can be audited (setup changes fairness, e.g. items on/off).

| Option | Games | Multiplayer default | Choices |
| --- | --- | --- | --- |
| **AI/CPU field** | Kart Rush | **None** (grid = humans) | None · Fixed count (up to the free grid slots) · Fill to 8 |
| CPU skill | Kart Rush | Normal | Easy · Normal · Hard (only matters if CPUs are added) |
| **AI rivals** | Golf, Kart Time Trial, Island Flyover, Shooting Range, Slice Dojo, Alien Attack | None | None · 1–3 at a skill level |
| **AI side** | Table Tennis | None (human vs human) | *Co-op vs AI*: both humans on one side against the AI |
| Laps / course / items | Kart Rush | 3 laps · default course · items on | 1 or 3 laps · course · items off (fair time-attack) |
| Holes / mode | Golf | 3 holes · stroke play | 3/6/9 · stroke, match, skins, closest-to-pin, scramble |
| Drop policy | all | Autopilot, then DNF/forfeit | Autopilot · Pause for everyone (Golf default) |
| **Ranked** *(added later, with the partner tracks; when added it is shown disabled with a reason, never hidden)* | all | Off | On, only if partners are enabled and every human is verified; otherwise disabled with the reason ([§5f.4](#5f4-the-result-and-signing-lifecycle)) |
| **Dare terms** (a forfeit) *(added later, same rule: visible, disabled with a reason)* | all | Off | A forfeit from presets or short free text, signed before the match; disabled until partners are on ([§13](#13-decisions-held-until-the-briefs)) |

**Defaults are mode-dependent:** switching Solo ↔ Multiplayer in the lobby resets the setup to that mode's defaults.

**Seats that never ready up.** The host can remove a seat or send a "ready?" nudge; an optional ready timer (off by default) removes a seat that hasn't readied after a minute. A removed seat can rejoin the lobby but not the running match. The host seat moving between screens or leaving the room hands the host powers to the next human in seat order.

**If a human drops mid-match** (30 s grace, seat kept; the phone can rejoin within it):

| Game type | During the grace period | After it |
| --- | --- | --- |
| Races (Kart Rush, Kart, Flyover) | The kart is **autopiloted** (Kart Rush's existing `cpuInput`) so nobody waits; the seat is marked `autopiloted` | The seat is DNF and excluded from standings; the kart keeps driving to the end |
| Turn-based (Golf) | Turn paused for everyone (Golf default; host can choose auto-shot instead) | Turn skipped or auto-shot; a seat that doesn't return is DNF in stroke play, forfeits in match play (scenarios E9, E12 in [§6.1.4](#614-scenario-book)) |
| Head-to-head (Table Tennis, Swordplay) | Play pauses | Forfeit |
| Shared board (Slice Dojo, Shooting Range, Alien Attack, Sketch) | The seat idles; the others continue | The seat is removed from scoring |

**If the match falls below `minHumans` while running** (for example 2 humans, one leaves for good): after the grace period it ends with status `abandoned` for the missing seat. Head-to-head games award the remaining human a forfeit win; races keep the results of everyone who finished; **ranked or staked outcomes in Part B are only issued for matches that started with and completed with the minimum humans**, so a walkover can't be farmed. An in-progress Multiplayer match never silently turns into Solo.

**Late joiners** watch as spectators and get a seat in the next match; seats are never added mid-match.

### 2.8 AI seats

AI is opt-in in Multiplayer ([§2.7](#27-modes-start-rules-and-match-setup)) and the default in Solo where the game already has one.

| Game | Solo default (today) | Multiplayer default | Host can add |
| --- | --- | --- | --- |
| Kart Rush | 1 human + 7 CPU | Humans only, grid = number of humans | CPU racers: fixed count or fill to 8; skill level |
| Table Tennis | Human vs the AI | Human vs human, no AI | **Co-op vs AI** (2 humans on one side) |
| Swordplay | Human vs the AI fencer | Human vs human (alternating-initiative rules), no AI | n/a |
| Golf | Round alone against par | Humans only | **AI golfers** (Rookie, Club, Pro; aim and power error from a seeded rng) |
| Shooting Range | Alone | Humans only | Bot crosshair as a pace-setter |
| Slice Dojo | Alone | Humans only | Bot blade |
| Alien Attack | Alone vs aliens | Humans only | AI wingman |
| Kart Time Trial, Island Flyover | Alone | Humans only | Pace bots that follow the route (also usable as ghosts) |
| Sketch | Free draw | Humans only (draw-and-guess needs a drawer and at least one guesser) | AI guesser (stretch) |

**Regression guarantee:** Solo play against the existing AI must behave identically after the changes. Pin it with golden tests (seeded runs recorded before the refactor, replayed after).

### 2.9 Support matrix: every game against every situation

What each game offers in each situation once its multiplayer ships. ✓ = supported; "later" = designed but gated behind a spike; ✗ = deliberately not offered (the lobby says why). "Pattern" is from [P4](#p4-online-play-l).

| Game | Solo | One screen (T1) | Separate screens (T2) | Hybrid (T3) | Spectator screen | Pattern |
| --- | --- | --- | --- | --- | --- | --- |
| **Kart Rush** | ✓ 1 + 7 CPU | ✓ split-screen, 2–4 views | ✓ live ghosts; later lockstep (items hit) | ✓ live ghosts; later lockstep | ✓ director camera | per-player view |
| **Golf** | ✓ vs par | ✓ turns | ✓ turns | ✓ turns, ready golf | ✓ shot camera and leaderboard | B (turns) |
| **Slice Dojo** | ✓ | ✓ Co-op, Battle, Race (split) | ✓ Race | ✓ Race | ✓ board or leaderboard | A (shared board) and per-player (Race) |
| **Table Tennis** | ✓ vs AI | ✓ 1v1, Co-op vs AI, rotation | ✗ (tight timing; later lockstep) | ✓ the two players on one screen, the rest watching | ✓ snapshots | D (head-to-head) |
| **Swordplay** | ✓ vs AI | ✓ 1v1, rotation | ✗ (later lockstep) | ✓ as Table Tennis | ✓ snapshots | D |
| **Kart Time Trial** | ✓ | ✓ split-screen | ✓ live ghosts | ✓ | ✓ | C (race the seed) |
| **Island Flyover** | ✓ | ✓ split-screen | ✓ live ghosts | ✓ | ✓ | C |
| **Shooting Range** | ✓ | ✓ free-for-all | ✓ race the seed | ✓ race the seed | ✓ | A and C |
| **Alien Attack** | ✓ | ✓ co-op, versus | ✓ race (ghosts) | ✓ race | ✓ | A and C |
| **Sketch** | ✓ free draw | ✓ draw and guess (guess on phones) | ✓ | ✓ | ✓ | A (private info) |

**How to read the gaps:** Table Tennis and Swordplay across two separate screens is not offered because a remote screen sees the board about 150 ms late ([P4](#p4-online-play-l)); two friends in different places can't play them until the lockstep spike passes. Groups larger than two use rotation ([§5d D4](#5d-product-details-the-first-plan-missed)).

---

## 3. Definition of done

A game is "completely working" when every box ticks.

**Per game**

- [ ] Works in every topology it supports (T1, T2, T3, and T4/T5/T6 where they apply); the lobby greys out the rest with a reason.
- [ ] Declares a **Solo** and a **Multiplayer** mode. Solo-versus-AI behaviour is unchanged (golden tests).
- [ ] **Multiplayer cannot start with fewer than `minHumans` (default 2) ready humans**; AI, spectators and extra screens don't count; the disabled Start button says why.
- [ ] **Multiplayer defaults to humans only** (field size = number of humans); the host seat can add AI from the match setup; setup is frozen at start and recorded in `match.finish`.
- [ ] Works with any human/AI mix the host sets up, including a field smaller than the game's usual size (see Kart Rush, [§6.2](#62-kart-rush)).
- [ ] Drop policy and below-minimum handling follow [§2.7](#27-modes-start-rules-and-match-setup); a Multiplayer match never silently becomes Solo.
- [ ] 2–4 local seats, each phone a distinct colour and number, every pointer independent.
- [ ] Join and leave mid-session; a phone that sleeps and returns keeps its seat and score (30 s grace); a dropped seat is autopiloted or paused, per game.
- [ ] Lobby → countdown → play → results → **rematch** without rescanning.
- [ ] Scoreboard and per-player results; one `match.finish` event with scores, seed and log.
- [ ] Seeded and replayable where fairness matters ([P5](#p5-determinism-and-replay-m)).
- [ ] Mouse/keyboard fallback for desk testing still works.
- [ ] Declares its **controller profile** ([§5a.6](#5a6-controls-per-game)); binds no global action (home, restart) to any single seat's A or B; has a how-to-play card.
- [ ] `game.json` declares seat range, modes, and view policy.
- [ ] Unit tests for the multiplayer rules; a simulated-phones end-to-end test per topology ([§9](#9-testing-strategy)).
- [ ] Meets its performance budget ([§5.4](#54-budgets-my-targets)).

**Platform**

- [ ] Public HTTPS with a real certificate; works from cellular.
- [ ] Input latency under 100 ms on LAN ([AirConsole's published bar](https://developers.airconsole.com/best-practices-for-web-games-on-airconsole)); measured.
- [ ] A one-hour four-phone session with no desync, dropped seat or thermal throttle on the host.
- [ ] Tested on real iPhone Safari, mid-range Android Chrome, and a low-end Android.
- [ ] **Controller v2** ([§5a](#5a-the-controller-the-phone)): seat colour, number and shape visible from three metres; a reload or sleep reclaims the same seat; every tappable control at least 48 px; a safe path for a phone with no working gyro; match-level actions (start, pause, quit, rematch, kick) are host-only or a vote, never any phone.
- [ ] **First run works on Windows, macOS and Linux** ([§5b](#5b-hosting-distribution-and-first-run)): the QR carries an address the phone can reach, the certificate doesn't depend on OpenSSL, the self-test page passes, and a remote screen gets a "Click to start" gate.
- [ ] **Build handshake:** a screen or phone on an old build is told to update and can't join a room on a different build.
- [ ] **Safety and content** ([§5c](#5c-safety-privacy-and-content)): safety screen shown once, reduced-effects and gentle modes work, and player text is never written with `innerHTML`.
- [ ] **Nothing Nintendo-derived or third-party-branded in anything public** ([§5e](#5e-names-assets-and-the-pre-existing-base)); the MIT notice is retained and `PRE_EXISTING.md` exists.
- [ ] **Deferred (partner tracks, later; not part of the current definition of done): partner-track readiness** ([§5f](#5f-designing-part-a-for-the-partner-tracks)): the seven integration contracts exist with mock or no-op defaults; `PARTNERS=off`, `mock` and `on` all work; `ResultV1`, `ReplayV1`, stable `gameId`s and the canonical encoding are fixed; results go through an outbox and never block play; Part A's `package.json` has no chain, ENS, Arkiv or World dependency.
- [ ] **Every match ends in a `ResultV1`** (completed or abandoned) with an honest `verification` status ([§5g.7](#5g7-verification-tiers)): `verified` when the game is `verifiable` and the Node checker replays it and agrees, `attested`, `unverified` or `failed` otherwise, whether or not any partner is enabled.
- [ ] **Creator-platform foundations** ([§5g](#5g-a-platform-for-other-peoples-games)): every first-party game has a validated manifest v2, a namespaced immutable `gameId`, declared scoring, stats and verification tier, and scoped storage keys; no game imports platform internals once the SDK is frozen.

---

## 4. Platform layers (build order)

Sizes are relative: **S** days, **M** about a week, **L** multiple weeks, for one engineer.

### P0. Foundations (S)

- `npm ci`; get `npm run test:unit` green; add CI.
- Make sure the repo has history so a `pre-hackathon` baseline tag is easy (Continuity requires separating pre-existing from new work).
- **Simulated-phone harness:** a Node script using `socket.io-client` that registers as a controller and streams scripted orientation and button events at 60 Hz. Also drive it from Playwright (already a devDependency) for browser end-to-end tests.
- **Network-impairment proxy** for tests (delay, jitter, loss on the WebSocket). DevTools throttling doesn't reliably affect WebSockets, so write a small TCP proxy.
- **Two cheap spikes that inform the Tier 1 designs:**
  - **S1, dual-view cost:** hack the current Kart Rush to render the scene twice per frame into two scissored viewports (no HUD, no refactor) and measure frame time and `renderer.info` on your weakest laptop. This tells you which quality tier two and four views need *before* committing to the refactor.
  - **S2, golf flight replication:** run the same `strike()` through `Hole.update` in two engines (Node and Chrome) with identical state, and compare resting positions over many strokes. This tells you whether "send the stroke, simulate everywhere" works or whether you need an authoritative end state.

### P1. Rooms, seats, screens and lobby (M)

- Rooms with `?room=CODE` (6 unambiguous characters), room-scoped events, and the screens/seats model from [§2.6](#26-relay-and-lobby-changes-this-implies).
- **Stable seats:** each phone has a player token; disconnect starts a ~30 s grace timer instead of freeing the slot; reconnect reclaims the same seat.
- Seat identity on the lobby screen and, large, on the phone (name, colour, number, ready).
- **Hardening:** restrict CORS to the app origin, cap `maxHttpBufferSize`, validate payloads, rate-limit per socket, accept `feedback` only from a room's screens, one `register` per socket, expire idle rooms.
- Launcher lobby flow: game → **Solo or Multiplayer** (modes greyed by topology) → seat the humans → host seat sets the match setup (defaults per mode, AI off in Multiplayer) → humans ready up → **Start enabled only when ready humans ≥ `minHumans`** → countdown ([§2.7](#27-modes-start-rules-and-match-setup)).

### P1b. The game menu and lobby entry (M)

One menu where players pick from all ten games, and where every match starts. It builds on the existing channel-style launcher rather than replacing it. The first part (listing every game) needs no multiplayer work and ships first.

**Step 1: list every game (S, no multiplayer needed).**

| Change | Detail |
| --- | --- |
| Show all ten games | Remove `hidden: true` from Golf, Table Tennis, Swordplay, Kart Time Trial and Island Flyover and give every game an `order` (below). Ten tiles fill 10 of the 12 slots on page 1; the other two stay empty wells. The menu already paginates at 12 per page, so more games just add a page |
| Order | Kart Rush, Golf, Slice Dojo first (Tier 1), then Table Tennis, Swordplay, Kart Time Trial, Island Flyover, then Shooting Range, Alien Attack, Sketch |
| Data-driven tiles | Each tile is drawn from `game.json`. Add the `modes` field from [P3](#p3-match-framework-ai-controllers-and-fixed-step-m) and have the tile show **mode chips** (Solo; Multiplayer with its player range, e.g. "2–4 players"). A game with no `modes` yet shows just Solo, derived from `players`, so a tile never promises multiplayer the game doesn't have. As each game gains Multiplayer, its tile gains the chip with no menu change |
| `/api/games` | Returns `modes` so the menu doesn't need to hard-code anything |
| A "preview" marker | Games that are listed but not yet polished get a small badge, so listing all ten doesn't oversell the unfinished ones |

**Step 2: the match starts here (needs rooms and seats, P1).**

```
Pick a game (tile) ─▶ Solo / Multiplayer ─▶ Lobby (seats, screens, setup) ─▶ Start gate ─▶ zoom ─▶ game page
                                                                  ▲                                   │
                                                                  └──── rematch / back to menu ◀──────┘
```

- **Pick:** a pointer on the TV selects the tile, as today. In a room only the **host seat's** press launches; other cursors stay visible and can browse (this stops several cursors fighting over one launch).
- **Mode:** the sheet offers Solo or Multiplayer. Multiplayer is greyed with a reason when the room can't support it: "needs 2 players" (fewer than `minHumans` seated), "2 players max" (more than `maxHumans`), or "needs players on one screen" (topology can't show it) ([§2.2](#22-the-scenarios)).
- **Fit hint on tiles:** when people are already seated, tiles that can't take everyone say why ("2 players at a time"). For two-player games with 3 or more people seated (Table Tennis, Swordplay) the tile does not just dim: it offers **Pick two**, **Winner stays** or **Bracket**, with the others spectating on their phones ([§5d D4](#5d-product-details-the-first-plan-missed)). A game whose *maximum* is below the group and has no rotation option dims with the reason.
- **Lobby:** seats grouped by screen, each with its colour and number; every screen's own QR ([§2.6](#26-relay-and-lobby-changes-this-implies)); the match setup; ready states; the Start gate ([§2.7](#27-modes-start-rules-and-match-setup)).
- **Setup is done on the host's phone, not with the TV pointer.** The menu's cursors are drawn objects, not a mouse, so ordinary HTML buttons can't be hovered or clicked by a phone pointer. A touch form on the host phone (CPU count, holes, laps, modes) is simpler and better than building pointer-operated forms, and the TV mirrors the choices read-only. The TV pointer is only needed to pick the game.
- **Launch:** the existing zoom-to-full animation, then navigation to `/games/<slug>/` with the room and mode.
- **The room must outlive the page.** The menu launches a game with `window.location.href = …`, which drops the page's socket. So the room, the seats, the host seat and the match setup live on the **relay** (and `sessionStorage` for the screen's own id), and the game page re-registers as the same screen and receives the lobby state. Phones stay connected throughout.
- **Coming back:** the game's B/home action and the results screen's "Back to menu" return to the menu **inside the same room** (seats, host and screens intact), showing the lobby state rather than a fresh menu. Rematch skips the menu entirely.
- **No phones, no problem:** with zero phones the menu still works with the mouse and keyboard as today, and launches Solo.
- **Partner hooks (deferred, later)** ([§5f.5](#5f5-where-part-b-appears-in-the-part-a-ui)): a **History** panel (my results and head-to-head records) and the room name beside the room code, both hidden unless partners are on. The lobby setup carries the Ranked and Dare options, disabled until then.
- **Registry-ready:** the menu reads manifests, not folders. First-party games come from disk now; later the same code reads dev-mode and registry sources and shows a publisher and a Dev or Community badge ([§5g.9](#5g9-the-catalogue-from-a-folder-scan-to-a-registry)).

**Acceptance (menu):**

- [ ] All ten games are listed, in the order above, with the right chips (only the games whose `game.json` declares Multiplayer show it).
- [ ] With one phone, picking any game launches Solo exactly as today.
- [ ] With 3 phones seated, Table Tennis and Swordplay are dimmed with the reason; the others are not.
- [ ] Only the host seat's press launches in a room; a second seat's press does nothing but is visible.
- [ ] A match launched from the lobby arrives at the game page with its room, seats and setup; going back to the menu keeps the room.
- [ ] Setup edits on the host's phone appear on the TV; a non-host phone can't change them.
- [ ] The menu still works with no phones connected.

### P2. Per-seat input and the controller page (M)

The controller redesign in [§5a](#5a-the-controller-the-phone) is part of this layer: identity, device-token seats, profiles, scoped commands, touch targets, fallbacks, the capability handshake and the versioned message schema.

- `createChannel({ players })` returns `pointers[slot]`; keep `channel.pointer` as slot 0 so single-player games are untouched.
- **Per-seat calibration and sensitivity**, persisted **on the phone** against its device token and sent at join (not in the screen's storage), with a per-player recentre step.
- **Scoped commands:** A and B are seat-local; start, pause, quit, rematch and kick are host-only or a vote. Remove the global `goHome` on any seat's B ([core/channel.js:41-42](core/channel.js#L41-L42)).
- **Per-mode phone UI:** kart wheel (exists), Golf "your turn" and aim, Kart Rush character picker, Sketch text/prompt panel.
- **Pacing:** cap emission at ~60 Hz (30 Hz on high RTT), one flush per interval rather than per handler, a sequence number, and latest-wins (skip a frame if the socket is backed up).

### P3. Match framework, AI controllers and fixed step (M)

- `core/match.js`: `lobby → countdown → playing → paused → results → rematch`; scoreboard; disconnect handling; rematch vote.
- **Start gate and match config:** the match refuses to leave `lobby` unless ready humans ≥ the mode's `minHumans`; the host seat's setup is validated against the mode, frozen at start, and written into `match.finish`. Switching Solo ↔ Multiplayer resets to that mode's defaults. Below-minimum and drop handling per [§2.7](#27-modes-start-rules-and-match-setup).
- **Seat controllers:** `{ type: 'human' | 'ai' | 'autopilot', poll(state) → input }`; autopilot on drop and handback on reconnect; AI seats exist only if the setup added them.
- **Fixed-step runner** (`core/loop.js`), decoupled from `requestAnimationFrame`, matching Kart Rush's `FIXED_DT`.
- `match.finish` builds a **`ResultV1`** (unique `matchId`, stable `gameId`, the frozen setup, the seed, per-seat scores and stats, the log hash, a `verification` status) and returns it to the match: the results screen, per-game bests, and History use it. **Handing it to partner services (consent, signing, records) is deferred** ([§5f](#5f-designing-part-a-for-the-partner-tracks)); the result is built the same way either way.
- `game.json`: each mode declares `kind: 'solo' | 'multiplayer'`, `minHumans`, `maxHumans`, `aiDefault`, `aiOptions`, `options` (the match-setup fields and defaults), `pattern`, `view`, `topologies`. For example Kart Rush: `solo` (1 human, 7 CPU default) and `multiplayer` (`minHumans: 2`, `maxHumans: 8`, `aiDefault: none`, CPU field option).
- **Game module interface:** the SDK contract ([§5g.5](#5g5-the-game-sdk-contract)) is extracted from the three Tier 1 games here; until it is frozen, games keep their current structure. The manifest v2 ([§5g.3](#5g3-game-manifest-v2)) supersedes plain `game.json`.

### P4. Online play (L)

Patterns:

| Pattern | How it works |
| --- | --- |
| **A. Shared board** | One sim on the host screen; phones are pointers |
| **B. Turns** | Replicate events; simulate deterministically everywhere; authoritative reconcile |
| **C. Live ghosts / race the seed** | Same seed; each screen sims its local seats and streams poses; others are ghosts |
| **D. Head-to-head real-time** | Two seats, one sim, tight timing |
| **E. Deterministic lockstep** | Every screen runs the same seeded fixed-step sim and exchanges only inputs; state hashes detect desync |

- **Transport:** Socket.IO, **WebSocket only** on the client so the polling fallback can't silently drop the orientation stream. WebSocket is TCP, so a lost packet stalls everything behind it; the fix is latest-wins pacing (P2), not a new protocol. WebTransport is Baseline with Safari 26.4 per a secondary source ([Utsubo](https://www.utsubo.com/blog/frontier-web-apis-2026-production-ready)) but needs an HTTP/3 server; unreliable WebRTC channels also avoid head-of-line blocking ([Gaffer on Games](https://gafferongames.com/post/why_cant_i_send_udp_packets_from_a_browser/), [Rune](https://developers.rune.ai/blog/webrtc-vs-websockets-for-multiplayer-games)) but phones on cellular often need TURN (Cloudflare: $0.05/GB after 1,000 GB free, [pricing](https://developers.cloudflare.com/realtime/sfu/pricing)). Keep a `transport` seam; revisit only if measurement demands.
- **Clock sync:** turn `ping-probe`/`pong-probe` ([server.js:177-178](server.js#L177-L178)) into a four-timestamp offset per phone (median of ~8, prefer lowest RTT). Judge an input at its phone timestamp mapped to host time. This makes simultaneous-input arbitration fair.
- **Remote spectators:** snapshots at 20 Hz, interpolated; Gaffer's rule is to buffer enough to survive two lost snapshots, about 3× the interval ([source](https://gafferongames.com/post/snapshot_interpolation/)), roughly 150 ms at 20 Hz. Fine for watching, wrong for playing, so remote *players* get B, C or E.
- **Public access:** a Cloudflare quick tunnel gives a real HTTPS URL with no VPS ([docs](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)); the docs don't state WebSocket support for quick tunnels and note a 200 in-flight request limit and no uptime guarantee, so **test with a WebSocket echo first**. If you rent a server, measure from real Jio and Airtel connections; one community report says Fly.io's Mumbai region isn't reliably reached from Indian ISPs ([thread](https://community.fly.io/t/anyone-using-fly-io-from-india-sri-lanka-pakistan-regions-beware-of-poor-routing/18072)), anecdotal.

**Latency budget (my estimate, to be measured with `probeLatency`)**

| Stage | LAN | Tunnel |
| --- | --- | --- |
| Sensor → JS event | ~8–16 ms | same |
| Network to host | 3–10 ms | 30–80 ms |
| Relay hop | ~1 ms | ~1 ms |
| Host frame wait + render + display | ~25–50 ms | same |
| **Total** | **~40–80 ms** | **~70–150 ms** |

So tight real-time (D) is LAN-first, and remote players get turn-based, ghost or lockstep play.

### P5. Determinism and replay (M)

- Route **all gameplay randomness** through an injected seeded generator (Slice Dojo spawns first; check each `game.js` for gameplay randomness outside `logic.js`; particles are fine).
- **Use the standard `ReplayV1` format** ([§5f.3](#5f3-data-that-must-be-fixed-now)) with a per-game verifier in a registry.
- **Log at the logic boundary** (calls into `logic.js` with arguments, plus the seed), not raw IMU.
- **Node verifier** that replays a log headlessly and checks the score; **golden replays** in CI. The same recordings pin the solo-vs-AI regression guarantee.
- **Limit, stated plainly:** `Math.sin`/`cos`/`pow` aren't guaranteed bit-identical across JS engines. V8-to-V8 is fine; a Safari host may drift. Quantise logged state and compare with a tolerance, and put a state hash in lockstep play.
- Prove-human is not prove-hand: nothing here stops a script feeding fake IMU data. Replay catches logic-level cheating; the rest is social.

---

## 5. Web experience and performance

### 5.1 Measured baseline (what exists)

| Item | Finding |
| --- | --- |
| `assets/` | 98 MB total; `stadium-source.glb` 55.6 MB (loaded when that course is chosen, [games/mario-kart/game.js:177](games/mario-kart/game.js#L177)); eight character `.glb` at 1.4–3.9 MB each |
| Audio | 90 `.wav` (13 MB) + 14 `.ogg` (12 MB) |
| Server | Express static, **no compression**, `Cache-Control: no-cache` on everything ([server.js:34-42](server.js#L34-L42)) |
| Three.js | Served from `node_modules` ([server.js:40-41](server.js#L40-L41)); `^0.185.1`; I couldn't inspect the build (no `node_modules` here) |
| Protocol | HTTPS on HTTP/1.1; plain ES modules, no bundler |
| Kart Rush render | pixel ratio ≤ 1.6, PCF shadows, window-sized 4× MSAA half-float target, GTAO 8 samples, bloom ([game.js:76-168](games/mario-kart/game.js#L76-L168)) |
| Phone | 28 KB controller JS; sensor emit up to ~166 Hz |

First task: capture the missing half per game (bytes transferred, time to first interactive frame, steady-state frame time, `renderer.info` draw calls and triangles) with Playwright and a Chrome trace on the weakest hardware you have.

### 5.2 Load weight

| Action | Why |
| --- | --- |
| Brotli/gzip static files (precompress, middleware, or let the tunnel do it) | Free, several-fold on text |
| Serve minified Three.js at a stable URL (check `build/` after `npm ci`) | Smaller parse and download |
| **glTF optimisation** with [glTF-Transform](https://gltf-transform.dev/): meshopt or Draco geometry, texture resize, **KTX2/Basis** | Models are the bulk of the weight; the 55 MB course is the headline |
| LODs and a lighter course | A remote player on mobile data can't take 55 MB before racing |
| Audio: `.wav` → Opus/OGG, lazy-load per game, sprite the small sounds | 90 loose files is also 90 requests |
| Caching: content-hash large assets, serve `immutable`; keep `no-cache` for HTML/JS in development | Today every load revalidates everything |
| Service worker precache per game | Instant second load |
| Progressive load with a real progress UI, playable-first order | Perceived speed |
| HTTP/2 or HTTP/3 via a front proxy or tunnel (Express doesn't speak HTTP/2 natively) | Many module requests suffer on HTTP/1.1 |

### 5.3 Multi-view cost model

Three.js multi-view uses one renderer with `setViewport`/`setScissor` per view ([manual](https://threejs.org/manual/en/multiple-scenes.html)). The cost model (general principle from [PlayCanvas docs](https://developer.playcanvas.com/user-manual/graphics/cameras/multiple-cameras/) plus the code in [§1.1](#11-kart-rush-internals-that-decide-the-split-screen-work); three.js numbers not measured):

| Cost | Behaviour with N views |
| --- | --- |
| **Draw calls and CPU** | ×N (each view re-draws the scene; scissor saves pixels, not draw calls) |
| **Shadow pass** | ×N, because the shadow light must follow each view's player; at 2048² this is the biggest multiplier |
| **Pixel fill** | Roughly constant (N views each cover 1/N of the screen) |
| **Post-processing** | Fixed overhead ×N; pixel-bound parts roughly constant if each chain runs at viewport size |
| **Render targets** | Extra cost; avoid unless a per-view chain needs them |

This matches why the console games hold resolution and drop frame rate with 3–4 players (CPU/geometry bound). **Proposed quality tiers for Kart Rush (to be validated by spike S1):**

| Views | Tier |
| --- | --- |
| 1 | Today's pipeline |
| 2 | Shadow 1536², AO samples reduced or off on both views, bloom kept; target 60 fps, floor 30 |
| 3–4 | Shadow 1024², **AO off**, bloom half-res, MSAA 2×, pixel ratio ≤ 1.0, rival LOD; accept 30 fps (the console precedent), floor 30 |

Plus a **frame-time governor** that drops a tier when the 95th-percentile frame time exceeds budget and raises it again when there is headroom. In a hybrid match each screen picks its tier from *its own* view count.

### 5.4 Budgets (my targets)

| Metric | Target |
| --- | --- |
| Golf / Table Tennis / Swordplay first playable | ≤ 3 MB transferred, ≤ 3 s on 20 Mbit / 100 ms |
| Kart Rush first playable | ≤ 25 MB transferred (compressed), progressive, with a loading UI |
| Host frame time, 2 local phones | 60 fps; ≥ 30 floor |
| Kart Rush, 4 views | ≥ 30 fps on an integrated GPU |
| Light games, 4 views | ≥ 30 fps on an integrated GPU |
| Input latency, LAN | < 100 ms (target 40–80) |
| Phone emission | ≤ 60 Hz default, ≤ 30 Hz on high RTT |
| One-hour, four-phone session | No desync, no dropped seat |

### 5.5 WebGPU

Supported in the major engines now (Safari 26 and iOS 26, Firefox on Windows since 2025; sources disagree on macOS/Linux) and Three's `WebGPURenderer` falls back to WebGL 2 ([Khronos](https://www.khronos.org/developers/linkto/webgl-and-webgpu-sigg26), [Three.js manual](https://threejs.org/manual/en/webgpurenderer.html)). **Not on the critical path, and a reason to wait for multi-view:** a three.js forum report (r184) says the WebGPU `RenderPipeline` ignores viewport and scissor, which breaks the split-screen approach above ([thread](https://discourse.threejs.org/t/renderpipeline-does-not-support-split-screen-multiple-viewports-with-webgpu-backend/92444)). Don't migrate Kart Rush while split-screen depends on scissor viewports.

---

## 5a. The controller (the phone)

The phone is the one piece of hardware every player touches, and every multiplayer scenario in this plan depends on it: who you are, whose turn it is, what you can press, whether you are still connected. I read [public/controller.html](public/controller.html), [public/controller.js](public/controller.js), [core/pointer.js](core/pointer.js) and [core/calibration.js](core/calibration.js) against the plan's scenarios.

### 5a.1 What it is today

| Area | Today |
| --- | --- |
| Face | A skeuomorphic copy of a Nintendo Wii Remote: power button, brand mark, D-pad, A, B, −/⌂/+, 1/2, speaker grille and four player LEDs ([controller.html body](public/controller.html)). The Wii Remote has exactly this button set and four player LEDs ([Wikipedia](https://en.wikipedia.org/wiki/Wii_Remote)) |
| Buttons | A = select, B = back, ⌂ also sends B (back to the menu), −/+ = pointer speed ×1.12, 1 = recentre, 2 = status sheet. The D-pad does nothing outside kart "wheel mode" ([controller.js:441-452](public/controller.js#L441-L452)) |
| Sensing | DeviceOrientation (and the absolute variant on Android), DeviceMotion rotation rate, a Generic Sensor fallback after a 1.5 s watchdog, plain-language diagnostics for HTTPS, permission and silent-sensor failures ([controller.js:252-387](public/controller.js#L252-L387)) |
| Sending | The newest sample, up to ~166 Hz (`MIN_EMIT_MS = 6`), flushed from both the orientation and the motion handlers ([controller.js:210-241](public/controller.js#L210-L241)) |
| Pointer | **Rate-based and grip-agnostic**: cursor velocity follows angular velocity; the gyro axis convention is *learned* per device, never assumed ([core/pointer.js](core/pointer.js) header). Calibration measures the player's actual grip ([core/calibration.js](core/calibration.js) header) |
| Where calibration lives | In the **screen's** browser storage, scoped to the server's boot id (`openwii.calibration.v1`), and only slot 0's sensitivity is saved |
| Feedback | `navigator.vibrate` (Android), a small WebAudio synth for click/swoosh/thud, a speaker-grille animation |
| Identity | `P1`–`P4` text inside the hidden status sheet and four small LEDs that blink while pairing ([controller.js:109-146](public/controller.js#L109-L146)) |
| Profiles | One lease: `controller-profile: wheel` (2.5 s, renewed) rotates the layout and streams held buttons every 150 ms ([controller.js:456-541](public/controller.js#L456-L541)) |
| Seat on reconnect | The page re-registers on every connect and takes whatever slot is free ([controller.js:118-122](public/controller.js#L118-L122)) |
| Misc | Wake lock, fullscreen + portrait lock (Android only), `touchmove` blocked on the whole document |

### 5a.2 What is good and stays

The grip-agnostic, learned-axis pointer (the hardest part, and it works); send-the-freshest-sample pacing; the capability probe and honest diagnostics; sending on `pointerdown` rather than `click`; the wake lock; the profile-lease idea (a game asks the phone to change shape and the lease expires if the game vanishes); haptics plus phone-speaker feedback.

### 5a.3 Problems for our use case

| # | Problem | Evidence | Why it bites |
| --- | --- | --- | --- |
| 1 | **Identity is too weak.** The player number is hidden in a sheet and shown by four tiny LEDs | [controller.html](public/controller.html), [controller.js:109-146](public/controller.js#L109-L146) | Four identical phones on a table; a player can't tell which is theirs, or whether it is their turn |
| 2 | **One layout for every game.** Most buttons (D-pad, 1, 2, ±) do nothing in most games, there are no per-game labels, and only kart has its own profile | [controller.js:440-452](public/controller.js#L440-L452) | Golf needs Address and Your-turn; the lobby needs Ready and a setup form; Sketch needs a keyboard |
| 3 | **Any phone's B or ⌂ sends the whole room back to the menu.** `createChannel` runs `goHome` on any B, ignoring the slot | [core/channel.js:41-42](core/channel.js#L41-L42), [controller.js:444](public/controller.js#L444) | One player's accidental tap ends everyone's game. The same applies to A restarting a game in Golf and Slice Dojo |
| 4 | **Seat is not stable.** Reconnect gets a new slot; the old one is freed instantly | [server.js:139-152](server.js#L139-L152) | A phone that sleeps loses its seat and score |
| 5 | **`touchmove` is prevented on the whole page** | [controller.js:654](public/controller.js#L654) | Breaks scrolling and typing in the setup form, name entry and Sketch guesses |
| 6 | **Touch targets are small.** A is 64–96 px but B is 38–46 px tall, the −/+ pills 34–42, the 1/2 buttons 34–46, power 30–38, D-pad cells about 29–44 px, and all shrink further on short screens (A 50, pills 28, D-pad cells about 22) | [controller.html CSS](public/controller.html) | Apple's guidance is 44 pt and Google's 48 dp ([Google](https://support.google.com/accessibility/android/answer/7101858), Apple figure from secondary sources); WCAG 2.2's floor is 24 CSS px ([Deque](https://dequeuniversity.com/rules/axe/4.8/target-size)). While waving a phone in the air, undersized buttons mean mis-presses |
| 7 | **Calibration and sensitivity live on the screen, not the phone** | [core/calibration.js](core/calibration.js) | With several phones and several screens (remote, hybrid) preferences collide or reset; they should travel with the phone |
| 8 | **No capability handshake.** The screen can't know a phone's sensor rate, whether it has a gyro, its platform, whether it can vibrate, or its handedness | [server.js:154-173](server.js#L154-L173) | Can't adapt pacing, controls or help |
| 9 | **No way to play without a working gyro** | [controller.js:344-387](public/controller.js#L344-L387) | A phone with no gyro, a denied permission or a motion-limited player simply can't play |
| 10 | **Backgrounding is silent.** When a phone locks or the player switches app, sensors stop, but the seat looks alive for 5–15 s (`pingTimeout`) and the blade or kart freezes | [server.js:107-113](server.js#L107-L113), [controller.js:536](public/controller.js#L536) | Looks like a lag bug; nobody is told |
| 11 | **iPhone feedback is missing.** `navigator.vibrate` is not available in Safari | [controller.js:41](public/controller.js#L41) | Half the phones get no haptics |
| 12 | **Emission up to ~166 Hz from every phone** | [controller.js:210](public/controller.js#L210) | Wasteful across four phones, a tunnel, or on battery |
| 13 | **It is a copy of someone else's hardware.** Layout, button set, LEDs, "HOME", and the old brand | [controller.html](public/controller.html) | A branding and trade-dress risk, and it carries design baggage that doesn't fit a phone ([§5e](#5e-names-assets-and-the-pre-existing-base)) |
| 14 | **No safety guidance.** Nothing about grip, strap, space or breaks | n/a | See the real-world lesson below |
| 15 | **Orientation lock only works on Android** (fullscreen + `orientation.lock`); on iOS the layout can flip mid-game | [controller.js:396-405](public/controller.js#L396-L405) | Wheel mode compensates in CSS; other modes don't |
| 16 | **Joining is QR only.** No typed code, no name, no colour, no profile | [controller.html gate](public/controller.html) | Fails when the camera can't scan; every player is "P2" |

### 5a.4 What the real world teaches

| Reference | Lesson for us |
| --- | --- |
| **Wii Remote** ([Wikipedia](https://en.wikipedia.org/wiki/Wii_Remote)) | Four LEDs show the player number, and pressing a button flashes battery level. Rumble and a small speaker put feedback in the hand. The B button is shaped as a trigger. **The wrist strap**: Nintendo's first straps broke under heavy use, so it replaced them with a thicker one, offered free replacements, moved to a lock-clip design in August 2007, and shipped a silicone jacket from October 2007. Games show safety warnings. *Lessons: identity must be visible on the controller; feedback in the hand; a controller thrown across a room is a design failure, so safety is part of the design.* |
| **Jackbox** ([how to play](https://www.jackboxgames.com/how-to-play)) | No install; one URL and a short room code; **the first player to connect is the VIP who starts the game**; you type a nickname that then appears on the shared screen, which confirms the join; refreshing the page reconnects (that last point is from a secondary source). *Lessons: a typed-code fallback, a host seat that starts the match, name confirmation on the shared screen, reconnect by reload.* |
| **AirConsole** ([best practices](https://developers.airconsole.com/best-practices-for-web-games-on-airconsole)) | Input latency under 100 ms; timestamp controller messages for anything time-sensitive; test under 20 Mbit / 100 ms throttling. *Lessons: a latency budget and message timestamps, which this plan already uses.* |
| **Touch-target guidance** | 44 pt (Apple), 48 dp with 8 dp spacing (Google), 24 CSS px minimum (WCAG 2.2 AA). *Lesson: nothing tappable under 48 px on the phone, with spacing; primary controls much larger.* |
| **Phone haptics on the web** ([azukiazusa](https://azukiazusa.dev/en/blog/ios-safari-web-haptics), [WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=285120)) | Safari still has no Vibration API. A workaround using a `<input type=checkbox switch>` is reported to give haptics from iOS 17.4–18 onward, but one source says a later iOS patch may have broken script-triggered haptics. *Lesson: treat iPhone haptics as a bonus and always give a visual and audio cue.* |

### 5a.5 The redesign

**Principles:** (1) the phone is a **shell that changes by context**, not one fixed remote; (2) identity first; (3) big targets and few buttons; (4) every control has a non-motion alternative; (5) match-level actions are never one accidental tap away; (6) the phone fails visibly and recovers by itself.

**Contexts (profiles).** The existing profile lease becomes a proper system. A screen or the lobby selects the profile for a seat; the lease still expires if the game disappears.

| Profile | When | The phone shows | The phone sends |
| --- | --- | --- | --- |
| **Join** | Before a seat | Typed-code entry (QR is the fast path), name, colour and shape, motion-permission coaching, capability check | `join { room, name, colour, caps }` |
| **Lobby** | In the lobby | Full-bleed seat colour, big number and name, **Ready**, connection quality, Leave (hold to confirm) | `ready`, `leave` |
| **Host lobby** | The host seat | Everything above plus the match setup form, add or remove AI, remove a seat, Start (disabled with the reason) | setup edits, `start` |
| **Pointer** | Menu, Slice Dojo, Shooting Range, Sketch drawing, Golf aiming | Seat colour frame, a large A, a smaller B, a recentre control | pose stream, `button` events |
| **Wheel** | Kart Rush, Kart Time Trial | Landscape layout with large gas, brake, drift and item buttons reachable by both thumbs; steering by tilt | pose, held buttons |
| **Swing** | Golf, Table Tennis, Swordplay | **Address** (hold), power readout, "your turn" card | pose, address down and up |
| **Flight** | Island Flyover, Alien Attack | Tilt steering, fire button | pose, buttons |
| **Keyboard** | Sketch guesses, names, forfeit text | A native text field (touch scrolling enabled in this profile) | `text` |
| **Watch** | Not your turn, spectating | Whose turn, countdown, standings, quick reactions | reactions |
| **Results** | Match end | Rank, rematch vote, leave | votes |
| **Sign** *(later, with the partner tracks; not built now)* | Match end, when a partner signer is on | A plain summary of the result, a Sign button, and two consent switches (publish my score, publish my replay; both off by default) | `sign.response`, `consent.set` |
| **Away** | Phone hidden, locked or disconnected | A large "tap to come back" with seat-held countdown | `resume` |

**Layout rules.** Every tappable control is at least 48 px with 8 px spacing; the primary control (A) is at least 96 px. Secondary actions live behind one menu sheet; **Leave and Home need a hold** (about 800 ms). The −/+/1/2 cluster leaves the main face: sensitivity, handedness and recentre move to the settings sheet, with recentre also on a long-press of A.

**Scoped commands (fixes problem 3).** A and B are **seat-local**: confirm and back inside that seat's own UI. **Start, pause, quit to menu, rematch and kick are match-level** and are host-only or a vote, never any phone. The channel layer no longer has a global `goHome` on any B.

**Identity.** The whole phone is the seat's colour (border and glow), with a large number, the name, and a **shape** (circle, triangle, square, diamond) so colour is never the only cue. The same colour and shape mark that seat's cursor, kart, blade or ball on the screen. The LED row can stay as decoration.

**Stable seat.** The phone keeps a device token. A reconnect, or a page reload, reclaims the same seat (Jackbox-style reconnect by reload) within the 30 s grace ([P1](#p1-rooms-seats-screens-and-lobby-m)).

**Preferences travel with the phone.** Sensitivity, handedness, invert options and calibration are stored on the phone against the device token and sent at join; any screen applies them. A screen never keeps per-seat preferences.

**Capability handshake** at join: `{ platform, sensorHz, gyro, accelerometer, vibration, touch, screenSize, orientation, locale }`. The screen uses it to pick pacing, fallback modes and which help to show.

**Fallbacks and accessibility** (every control has a non-motion path):

| Need | Fallback |
| --- | --- |
| No gyro, permission denied, or limited motion | **Touchpad pointer** (drag to move the cursor, tap for A); on-screen steering for the wheel profile; a drag-back-and-release for Golf power; a touch paddle for Table Tennis |
| Left-handed or one-handed | Mirror the layout; reachable-thumb placement; no two-handed requirement in any profile |
| Colour-blind | Colour plus shape plus number, always |
| Low vision | Large-text mode, high contrast; `aria-label`s (the buttons already have them) |
| Motion sensitivity | Reduced-motion setting turns off the decorative "lean" parallax ([controller.js:625-650](public/controller.js#L625-L650)) |
| Hearing | Every audio cue also has a visual cue |
| Vibration off or unsupported | Visual pulse and phone-speaker click |

**Feedback.** Haptic patterns are defined per event (hit, miss, your turn, countdown tick). Android uses `vibrate`; iPhone gets the visual pulse and a phone-speaker click, plus the switch-checkbox haptic as an optional bonus (test on the current iOS; treat as unreliable). A full-screen colour pulse is the guaranteed cue.

**Connection experience.**

- A small always-visible connection-quality indicator from round-trip time.
- A **Reconnecting** overlay shows "your seat is held for 30 s" with a countdown; on return the phone resumes by itself.
- When the page is hidden or the phone locks, the phone goes to the **Away** profile and tells the screen, so the seat shows "away" at once instead of freezing for 5–15 s.
- Wake lock is held, and re-requested when the page becomes visible again (it already is).

**Joining.** Scan the QR, or type the 6-character code at `/join`. Name is prefilled from the phone's profile. In-app browsers (Instagram, WhatsApp) get an "Open in Safari or Chrome" step. Motion permission comes with coaching: on iOS, the exact Settings path if it was denied. "Add to Home Screen" is worth testing for a full-screen, chrome-free controller; I have not verified that it improves orientation lock.

**Pacing.** 60 Hz by default (30 Hz on high round-trip time), one flush per interval rather than one per event handler, and the Generic Sensor request lowered from 120 Hz to 60 ([controller.js:312](public/controller.js#L312)).

**Safety** ([§5c](#5c-safety-privacy-and-content)): a first-run screen, "gentle" swing thresholds, break reminders.

**Message protocol.** Replace the ad-hoc `command` strings with a small versioned schema: `{ v, seq, type, … }` with `caps`, `join`, `profile.set`, `input.pose`, `input.button`, `input.text`, `ui.event`, `resume`, plus, **later and not built now**, the partner-track messages `identity.begin`, `identity.complete`, `sign.request`, `sign.response` and `consent.set` ([§5f.5](#5f5-where-part-b-appears-in-the-part-a-ui)). The Join profile also gets a skippable identity step and a "claim your name" field, and the Lobby shows a verified badge, all hidden unless partners are on. Sequence numbers make pacing, drop and resync handling uniform across all games.

### 5a.6 Controls per game

| Game | Profile | Buttons | Motion | Extra phone UI |
| --- | --- | --- | --- | --- |
| Menu | Pointer | A select, B back | Point | Host lobby form |
| Kart Rush | Wheel | Gas, brake, drift, item | Tilt steers | Character picker in the lobby |
| Golf | Swing + Pointer | **Hold A to address**, B back | Pointer aims; swing strikes | Your-turn card, wind and distance |
| Slice Dojo | Pointer | A ready | Swing slices | Own score, ready |
| Table Tennis | Swing | A serve | Pointer positions; swing adds pace | Side and score |
| Swordplay | Swing | A block hold (optional) | Blade angle; swing strikes | Role (attack or defend) |
| Kart Time Trial | Wheel | Gas, brake, drift | Tilt steers | Lap and ghost info |
| Island Flyover | Flight | Boost (optional) | Tilt steers | Ring count |
| Shooting Range | Pointer | A fire | Point | Own score |
| Alien Attack | Flight | A fire | Tilt steers | Lives |
| Sketch | Pointer + Keyboard | A draw; guess field | Point | Private prompt, guess box, colours |

### 5a.7 How the controller is tested

A **device matrix** (current and previous iPhone, mid and low-end Android, one tablet, one phone without a gyro if available); sensor rate and permission-flow logs per model; in-app browsers; battery drain over 30 minutes of play; a mis-press rate during a timed mid-air task before and after the new layout; a "can I tell which phone is mine from three metres" check; a reconnect test (lock the phone, switch app, toggle airplane mode); and a left-handed and one-handed pass.

---

## 5b. Hosting, distribution and first run

"Anyone can join from their phone" only holds if starting a game is easy too. Today it is not.

### 5b.1 Who runs the relay

| Option | Who it suits | Notes |
| --- | --- | --- |
| **Local relay** (today: `npm start` on the screen's computer) | Same room, developers | Needs Node, OpenSSL and a firewall exception; offline-capable |
| **Local relay plus a tunnel** | Same room plus a few remote friends | Public HTTPS from the host's machine; the host's computer is the single point of failure ([§4 P4](#p4-online-play-l)) |
| **Hosted relay** (the same code deployed to a server) | Everyone; judges; friends who can't run Node | Rooms live on the server; the games are served as static files; the host just opens a URL. Needs the Nintendo-derived assets replaced before it can be public ([§5e](#5e-names-assets-and-the-pre-existing-base)) |
| **Desktop app** (packaged host) | Later | Only if a hosted relay isn't enough |

**Plan:** keep local mode for offline play and make the relay deployable as a hosted service from the same code. Remote and hybrid play, and judging, should not depend on one person's laptop and home network.

### 5b.2 Local-mode failures found in the code

| # | Problem | Where | Fix |
| --- | --- | --- | --- |
| 1 | **The QR encodes the first non-internal IPv4 address.** On machines with a VPN, WSL, Hyper-V or Docker adapters that is often not the Wi-Fi address the phone can reach | [server.js:90-91](server.js#L90-L91), [scripts/gen-cert.js:21-28](scripts/gen-cert.js#L21-L28) | Prefer the interface with the default route and private ranges, skip virtual adapters, list the other candidates with a switcher on the QR card, and add a **self-test page** ("Can my phone reach this computer?") |
| 2 | **The certificate needs `openssl` on the PATH**; without it the server silently falls back to plain HTTP, and sensors then fail | [scripts/gen-cert.js:68-75](scripts/gen-cert.js#L68-L75) | Generate the certificate in pure JavaScript (a small dependency) so first run doesn't depend on OpenSSL |
| 3 | **Auto-open and the autoplay flag are macOS-only** (`process.platform === 'darwin'`) | [server.js:248-253](server.js#L248-L253) | Open the browser on Windows and Linux too, and add a "Click to start" gate that unlocks audio on any screen |
| 4 | **The public URL is fixed to the LAN address** | [server.js:91](server.js#L91) | A `PUBLIC_URL` setting, so tunnel and hosted modes put the real URL in the QR |
| 5 | **Windows firewall and Wi-Fi client isolation** are only described in the README | [README.md](README.md) | The self-test page detects and explains both |
| 6 | **iOS Safari and WebSockets to a self-signed certificate** | n/a | Unverified; test on real iPhones. A hosted relay with a real certificate removes the question |

### 5b.3 Version handshake

The service worker and `immutable` caching proposed in [§5.2](#52-load-weight) can serve stale code, and lockstep play needs every screen on identical code. Every screen and phone sends a **build id** when it registers. The relay refuses a mismatch with "update needed", and the client reloads. A room is pinned to one build id.

### 5b.4 Screen capability gate

Before a device becomes a screen, check WebGL 2, hardware acceleration, available memory and a quick frame-time benchmark. A device that fails can still be a controller or a spectator, and says so plainly. Document the supported browsers and versions.

### 5b.5 Screen start gate

Browsers require a gesture to start audio, enter fullscreen and take a wake lock, and a remote friend's laptop will not have the launch flag the macOS host gets. Every screen starts with one "Click to start" step that unlocks audio, requests fullscreen and holds a **Screen Wake Lock** so the display doesn't sleep. If the screen's tab is hidden, it shows a pause overlay and tells the room, because a hidden tab throttles animation and would freeze every player on it. Also: hide the cursor, respect TV overscan with a safe area, and handle high-DPI scaling and multiple monitors.

### 5b.6 Capacity and abuse (hosted relay)

Per-IP limits on room creation, a cap on rooms and on seats per room, idle-room expiry, payload and rate limits ([P1](#p1-rooms-seats-screens-and-lobby-m)), a health endpoint and basic logs. **Find the capacity by measuring:** one room of 8 phones is about 480 orientation messages a second through the relay, so use the fake-phone harness ([P0](#p0-foundations-s)) to load many rooms at once and record where one Node process runs out of CPU or memory, and size the host from that.

### 5b.7 Failure states

Every failure gets a plain-language screen and a "copy diagnostics" button: relay unreachable, WebGL context lost (the GPU reset; rebuild the renderer), out of memory, unsupported browser, certificate or HTTPS problems, wrong build, room full, room not found, seat taken.

---

## 5c. Safety, privacy and content

### 5c.1 Physical safety

Swinging a phone is a hardware risk, and the Wii Remote's history shows it: its first wrist straps broke, so Nintendo replaced them, offered free replacements, moved to a lock-clip design and shipped a silicone jacket ([Wikipedia](https://en.wikipedia.org/wiki/Wii_Remote)). A phone is more expensive and more breakable.

- **First-run safety screen:** clear a play area, hold the phone firmly (a case or phone grip; a wrist loop where one exists), don't throw it, take breaks. Shown once, and again from settings.
- **Design for the wrist, not the arm.** The existing input uses angular rate, not arm travel, and thresholds are modest (Golf arms at 130 deg/s over 22 degrees of travel, [game.js:98](games/golf/game.js#L98)). Keep it that way: no game may *require* a wide arm swing.
- **Gentle mode:** a per-seat setting that scales swing thresholds down for children and players with limited range.
- **Break reminder** after about an hour of continuous play (my number), dismissible.
- **Photosensitivity:** the racer has bloom, speed lines and flashing effects ([game.js:154-160](games/mario-kart/game.js#L154-L160)). Add a **reduced-effects** setting that removes flashing and strobing, and avoid more than three flashes per second by default.
- **Volume:** a one-time loudness note and a master volume on the screen and the phone.

### 5c.2 Security and content

| Risk | Where | Mitigation |
| --- | --- | --- |
| **Cross-site scripting from player-supplied text.** Names, forfeit text and Sketch guesses will arrive from phones, and the games build HUDs and overlays with `innerHTML` (for example [game.js:1068-1080](games/fruit-ninja/game.js#L1068-L1080), [game.js:1041-1044](games/fruit-ninja/game.js#L1041-L1044), [games/golf/game.js:148-150](games/golf/game.js#L148-L150)) | Every screen | **Rule: phone text is only ever written with `textContent`.** The relay also trims it, limits its length and strips control characters. A lint check forbids `innerHTML` with variables in game code |
| Abusive names, forfeits and guesses | Lobby, Sketch, dares | A word filter on names and forfeit text; host can **remove a seat**; names re-entered after a kick are blocked for the room |
| Room code guessing | Public relay | 6 unambiguous characters plus rate limits on joins; the host can **lock** the room; rooms lock automatically once a match starts (late joiners spectate) |
| Spoofed seat or command | Relay | Seat comes from the socket, never from the message; commands are validated against the seat's current profile |
| Phone-sent `feedback` or match-level commands | [server.js:209-215](server.js#L209-L215) | Only a room's screens may send feedback; match-level commands are host-only ([§5a.5](#5a5-the-redesign)) |
| Hot wallet abuse in Part B | Relay's sponsor key | Writes only for matches that started and finished with the minimum humans, per-room and per-IP write caps, a small float in the wallet |

### 5c.3 Privacy

- **What exists:** motion samples stream phone → relay → screen and are not stored. The relay sees IP addresses and room activity. Nothing records them today; keep it that way unless a replay is requested.
- **What Part B changes:** Arkiv entities are public and replicated, so anything written is effectively public until it expires, and ENS names are public too. Therefore:
  - nicknames only, never real names; no email, no device ids;
  - **scores and a hash by default; a full replay only with the players' explicit opt-in** at result signing. Replays contain the player's motion stream, which is behavioural data;
  - each player consents to what is published before it is written, and can say no (the match still counts locally);
  - the device token that keeps a seat is random and never leaves the relay and the phone.
- **Retention:** the relay deletes a room's state when the room expires; logs are kept short; diagnostics export is opt-in and local.
- **A public, hosted version needs the basics:** a short privacy notice (what is collected: nickname, room activity, IP at the relay), terms of use, and a contact for takedowns. Children may play, so the design collects nothing personal: nicknames only, no accounts, no email.
- **Phone storage can disappear.** The phone's profile and device token live in browser storage, which can throw in private browsing and which iOS can clear for sites that haven't been used for a while (I have not verified the exact rule). Wrap every storage call, fall back to memory, treat a lost token as a new seat, and let a player re-enter their name; Part B's session key has the same limit, so it is hackathon-grade and not a place to hold value.

---

## 5d. Product details the first plan missed

| # | Area | What is needed |
| --- | --- | --- |
| D1 | **Settings** (screen and phone) | Master, music and effects volume; reduced effects; UI scale and TV safe area; quality override (the governor can be forced); sensitivity, handedness and gentle mode per seat; show diagnostics; reset room. A 10-foot UI rule: nothing a player must read from the sofa is small (my rule of thumb: nothing under about 24 px at 1080p) |
| D2 | **First-run onboarding and how-to-play** | A short flow on first launch (safety, grip, calibration); a one-card "how to play" per game with a grip diagram, shown in the lobby; calibration help; a practice mode that doesn't end |
| D3 | **Player profiles** | Name, colour, shape and optional avatar stored on the phone; per-game best scores stored per mode and per player; sent at join. Part B maps this to an ENS name and a World proof later |
| D4 | **Groups bigger than a game's player limit** | Table Tennis and Swordplay are two-player. With 3 or more people seated the menu should not simply dim them: offer **Pick two**, **Winner stays** (the loser rotates out for the next in the queue) and a small **Bracket**, with the others spectating on their phones in the Watch profile ([P1b](#p1b-the-game-menu-and-lobby-entry-m)) |
| D5 | **Party mode (a series)** | A playlist of several games with cumulative points across them, with the final standings and an optional forfeit for last place (the S0 stake in [§13](#13-decisions-held-until-the-briefs)). This is how a console is actually used on a party night |
| D6 | **Pause semantics** | One screen: the host seat pauses everything. Race and Race-style modes with separate boards (remote): a pause is local, not global. Lockstep: pause needs all screens to agree. Turn-based: pause for everyone. Defined per pattern, shown to players |
| D7 | **Between matches** | Swap seats, change driver or colour, leave, join (late joiners get in here), host transfer, change setup. Today a game ends and everything restarts |
| D8 | **Other inputs as seats** | A gamepad or a keyboard and mouse as a seat, through the same seat-input abstraction. Useful for accessibility, for testing, and for a player without a usable phone. Stretch |
| D9 | **Spectators** | Watch-only phones with reactions ("🔥", "😂") shown on the screen; a big-screen audience view. Reactions are rate-limited and text-free |
| D10 | **Diagnostics** | A hidden panel with round-trip time, frame time, sensor rate, build id, room state and a "copy diagnostics" button; opt-in, local |
| D11 | **Localisation** | All UI strings in one table so languages can be added; right-to-left and Indian languages are possible later |
| D12 | **Documentation** | A README rewrite for the new name and setup, a player guide, a troubleshooting page linked from the QR card, and a pre-existing-work document ([§5e](#5e-names-assets-and-the-pre-existing-base)) |
| D13 | **Releases** | A version and changelog, a way to roll back, and feature flags so modes can ship behind a "preview" badge |

---

## 5e. Names, assets and the pre-existing base

### 5e.1 Names

**Platform: Funcaster Console.** Only the things that need the new name carry it: the controller's brand mark and page title, the menu button and title, the server banner, every page title and the docs. **Games do not get a "Chonk" prefix.**

| Today | Now | Why |
| --- | --- | --- |
| OpenWii | **Funcaster Console** (shown on the controller as "Funcaster") | Your decision. "Wii" is Nintendo's trademark |
| Mario Kart | **Kart Rush** | Nintendo's title and trademark |
| Fruit Ninja | **Slice Dojo** | Another company's title |
| Swordplay, Island Flyover | **unchanged** | I recall these as activity names in a Nintendo sports game, but I haven't verified that and they are ordinary descriptive words. Change them if a check says so |
| Kart Time Trial, Table Tennis, Golf, Shooting Range, Alien Attack, Sketch | **unchanged** | Generic, descriptive names |

Kart Rush and Slice Dojo are working names chosen only to remove the two third-party titles; they are cheap to change (the `game.json` title, the page title and a few strings). None of this is a trademark clearance. A quick web search found no game or software mark for "Funcaster Console", "Kart Rush" or "Slice Dojo" (I searched the Caster-prefixed names earlier; the only nearby hit was a registered "CHEEKY CHONKS" mark for plush toys, [GleanMark](https://gleanmark.com/trademark/uspto-79398099), a different class but worth knowing if you ever make merchandise). A proper search of USPTO, EUIPO, WIPO and the Indian register should happen before any name goes on something public. The in-game words that belong to the original (character names, item names such as mushroom, shells and star) are tied to the Nintendo-derived pack and are replaced with it (workstream R, below).

### 5e.2 Assets: renaming does not fix this

The Kart Rush pack is not original and not merely "assets from an open-source project". Its own provenance records and [assets/mario-kart/README.md](assets/mario-kart/README.md) say:

- the **eight characters, the kart, the tyres and the "Mario Kart Stadium" course** are Nintendo Mario Kart 8 models obtained through The Models Resource;
- the **music, sound effects and voices** are Nintendo game recordings obtained through The Sounds Resource and KHInsider;
- the **UI lettering and portraits** come from an extracted game UI sheet, and the **stadium TV artwork** from the game's source animation frames;
- the README states these "are not original … artwork", are "not covered by … MIT software license", and that "attribution does not grant redistribution rights or imply endorsement by Nintendo".

So a new title does not change what is on screen or what a recording of it contains. **For anything public (a public repository or its history, a hosted site, the demo video, the ETHGlobal submission and showcase) the Nintendo-derived content has to be replaced.** I am not a lawyer; this is the straightforward reading of the project's own notes.

**Replacement workstream (Tier 1, before anything is public):**

| Replace | With | Side benefit |
| --- | --- | --- |
| 8 characters, kart, tyres | An original "Funcaster" cast and kart, built for the web (low-poly, compressed) | Each model is currently 1.4–3.9 MB |
| The stadium course (55.6 MB) | An original course designed for the web, a few MB with LODs | Fixes the biggest load-weight problem ([§5.2](#52-load-weight)) |
| Music, SFX, voices | Original or properly licensed audio; the procedural synth already in the code is a fallback | Drops 90 loose `.wav` files |
| UI lettering, portraits, item art, item and cup names | Original art and wording | |
| Controller and menu look | An original Funcaster design ([§5a](#5a-the-controller-the-phone)) | The menu has a Wii-channel look with a clock bar and an "OpenWii button" ([menu.js:975](public/menu.js#L975)) |

Until replaced, keep the Nintendo pack **local and untracked**, never deploy it, never record it. Check what has already been committed: if those files were ever pushed to the public repository, they remain in its history. Slice Dojo's art is drawn from code and its sounds are synthesised, which is good, but the "brush-lettered score UI" and dojo look were built from a reference video ([games/fruit-ninja/SPEC.md](games/fruit-ninja/SPEC.md)), so audit them for originality as part of the rename.

### 5e.3 The pre-existing base

Funcaster Console grows out of a pre-existing open-source base whose assets and some of whose code we reuse and are changing extensively. This plan deliberately doesn't name it. Two obligations still apply, and neither is a plan item to skip:

1. **The MIT licence** requires the original copyright and permission notice to stay with copies or substantial portions of the software. Keep the `LICENSE` file and notices in the repository even after the rename; the rename should not strip them.
2. **ETHGlobal's Continuity rules** require clearly documenting pre-existing work and showing what is new ([rules](https://ethglobal.com/events/mumbai/info/details)). The submission needs a `PRE_EXISTING.md` listing what is reused. That document is where the base is named.

### 5e.4 Rename pass (first stage done)

**Done, and checked:** the full unit suite passes (223 of 223 once dependencies are installed), the browser modules parse, and the running server shows the new names in its banner, the menu title and the game list.

| Changed | Where |
| --- | --- |
| Controller: page title "Remote — Funcaster Console", brand mark "Funcaster", kart steering guide "KART RUSH · Hold sideways" | [public/controller.html](public/controller.html) |
| Menu: page title, the bar button text and its hover label | [public/index.html](public/index.html), [public/menu.js](public/menu.js) |
| Server banner and header comment | [server.js](server.js) |
| All ten game page titles now end "— Funcaster Console" | `games/*/index.html` |
| **Kart Rush** (was Mario Kart): menu title and tagline, page title, stadium and cup labels, in-world signage text, the intro logo (a plain text placeholder replaces the old logotype until original art exists) | `games/mario-kart/` |
| **Slice Dojo** (was Fruit Ninja): menu title and page title | `games/fruit-ninja/` |
| README, CLAUDE.md, AGENTS.md: new name, no upstream clone URL, a neutral note that the project builds on an earlier open-source one | root |
| A test helper that patches the controller guide text | [tests/kart-prototype/server.cjs](tests/kart-prototype/server.cjs) |

**Deliberately not changed** (invisible to players and not needed): the saved-settings keys `openwii.*` (renaming them would reset everyone's saved calibration unless migrated), the `window.__openwii` debug hooks, the certificate subject, the Chrome profile folder name, `package.json` and `LICENSE` (kept as the MIT licence requires), game folder names and `/games/<slug>/` URLs, code comments, per-game developer docs, and the Nintendo-derived names and assets (workstream R).

**Remaining, optional:** folder and URL renames with redirects, and a one-time migration of the settings keys, if you want the internals to match. Listing the five hidden games in the menu is a separate task (M0a).

---

## 5f. Designing Part A for the partner tracks

> **Status: deferred.** Partner-track (web3) work is not being done now; this section is a design note for when it starts. **What is built now from it** is only what the games and the creator platform need anyway: stable game ids, `ResultV1` and the `ReplayV1` envelope, integer scores and times, a `matchId`, and the Node verifier ([§5g.6](#5g6-scoring-stats-and-results-for-any-game)). **Everything else here waits:** the seven integration contracts and their mock providers, the `PARTNERS` switch, the outbox, the sponsor-wallet service, signing and consent, the Sign and identity screens on the phone, and the History panel. Nothing else in the plan depends on them.

The ETHGlobal partner integrations (Arkiv, ENS, World, Chainlink, and whichever others the briefs make worthwhile) are built **at the hackathon**. Part A therefore has to leave exact, boring places for them to plug into, without containing any of them. This section is the contract between the two. [§12](#12-part-b-track-integrations-at-the-hackathon) describes the integrations themselves.

### 5f.1 Principles

1. **Web3 is additive and optional.** Every game works from start to finish with no wallet, no chain and no internet beyond the relay. A match with no partners enabled is a complete product.
2. **Part A ships interfaces and mock providers only.** No chain SDKs, keys, contracts or partner API calls before the event. That keeps the base clean, keeps the Continuity story honest (the partner work is visibly new), and makes the boundary one folder.
3. **Never block play on a partner.** Chain and partner calls are asynchronous, queued and retried; a slow or dead provider changes a label on the results screen, never a game.
4. **Design for capabilities, not partners.** Most briefs are unpublished. The hooks are *identity, naming, randomness, records, signing, settlement*; any partner that fits one costs hours, not days.
5. **The result is the product; the chain is a sink and a source.** Results and replays are defined and verified in Part A; Part B only stores and reads them.
6. **Consent first.** Nothing leaves the room without the players' say-so ([§5c.3](#5c3-privacy)).
7. **One folder for event work.** Everything written at the event lands under `integrations/<partner>/`, so the diff against the baseline is the answer to "what is new".

### 5f.2 The integration contracts

A small registry (`core/integrations.js`) holds the active provider for each capability. Part A registers a default (a mock or a no-op) for every one. A build flag `PARTNERS=off | mock | on` chooses the mode: **off** hides the partner surfaces (History, badges, signing, the seed line) but **the lobby still shows Ranked and Dare terms, disabled with a reason** (a settled decision: they are never hidden), **mock** enables everything with local providers (practice receipts, dare nights, offline demos), **on** uses the real providers.

| Capability | Contract | Part A default | Part B provider (candidate) |
| --- | --- | --- | --- |
| **Identity** | `verify(seat, context) → { verified, level, subject, nullifier? }` · `sessionKey(seat) → address` | `GuestIdentity`: `verified: false`, a random per-phone key | World proof of human, the phone's session key |
| **Naming** | `roomName(roomId)` · `displayName(seat)` · `claim(seat, handle)` · `resolve(name)` | The 6-character room code; the nickname | ENS subnames, text records |
| **Randomness** | `seed(roomId, context) → { value, source, proof? }` | `LocalSeed`: relay randomness, `source: "local"` | Chainlink VRF (`source: "vrf"`), commit-reveal fallback |
| **Records** | `putResult(result)` · `putReplay(replay)` · `query(filter)` | `LocalRecords`: a JSON store on the relay with the same schemas | Arkiv entities |
| **Signing** | `request(seat, typedData) → signature` | `NoSigner`: results are `unsigned` | Session-key EIP-712 signatures |
| **Settlement** | `open(dare)` · `settle(result)` | None (held decision, [§13](#13-decisions-held-until-the-briefs)) | A stake or pot module, only if chosen |
| **Consent** | `get(seat) → { publishScore, publishReplay }` | Both off | Same, shown on the phone at signing |

Where the hooks are called: **lobby** (identity on join, naming for the room, ranked and dare options), **match start** (randomness), **match end** (build the result, collect consent, collect signatures, put the record), **menu** (records query for a history panel), **controller** (the sign and consent profile).

### 5f.3 Data that must be fixed now

These are hard to change once something is published, so Part A defines them.

| Item | Rule |
| --- | --- |
| **Stable `gameId`** | **`namespace:slug`**, immutable and never reused, independent of the display name and the folder. First-party games are `funcaster:kart-race`, `funcaster:golf`, `funcaster:fruit-slice` and so on. Defined in full, with versions and bundle hashes, in [§5g.4](#5g4-game-ids-versions-and-bundle-hashes), which supersedes any flat list. Don't use today's folder slugs; two of them are third-party names |
| **Other ids** | `roomId`, `matchId` (relay-generated, unique, time-sortable), `seatId` (room-scoped), `playerId` (hash of the phone's device token), `buildId`. `playerId` is not a wallet address |
| **`ResultV1`** | `{ v, matchId, roomId, gameId, gameVersion, bundleHash, mode, buildId, setup (the frozen match setup), seed: { value, source }, startedAt, endedAt, status: completed or abandoned, verification: verified, attested, unverified or failed, seats: [{ seatId, playerId, handle, controller: human, ai or autopilot, verified, address?, ensName?, score, rank, stats }], winners, logHash, replayRef? }`. Per-seat `score` and `stats` are validated against the game's manifest ([§5g.6](#5g6-scoring-stats-and-results-for-any-game)) |
| **`ReplayV1`** | An **envelope** `{ v, gameId, gameVersion, bundleHash, seed, setup, step, payloadFormat, payload }`. The envelope, compression and chunking belong to the platform; the payload and the verifier that reads it belong to the game, and a third-party verifier runs in a sandbox ([§5g.6](#5g6-scoring-stats-and-results-for-any-game), [§5g.7](#5g7-verification-tiers)). This is the log format of [P5](#p5-determinism-and-replay-m) |
| **Canonical encoding** | Signed and hashed payloads use one deterministic encoding (JSON Canonicalization, RFC 8785, or deterministic CBOR; the choice is made once). Scores and times are **integers**, never floats; timestamps come from the relay, not phones. Without this, two screens can hash the same result differently and every signature fails |
| **Hash algorithm** | Stored in the payload (`alg`) so it can change; the default is decided at the event |
| **Versioning** | Every schema carries `v`; changes are additive |
| **Visibility tags** | Each field is marked `public` or `local-only`. The motion stream and device token are local-only; scores, handles and the hash can be public |
| **Size budgets** | `ResultV1` under 8 KiB; a replay is compressed and chunked to fit Arkiv's 128 KiB per entity ([§12](#12-part-b-track-integrations-at-the-hackathon)) |

### 5f.4 The result and signing lifecycle

```
playing -> finished -> consent -> awaitingSignatures (60 s) -+-> agreed ----+
                                                              +-> disputed --+
                                       (guests, no signer) ---+-> unsigned --+-> queued -> submitted -> confirmed | failed (retry)
```

- **Guests and AI never block.** A match with guests or no signer ends `unsigned` and still shows its result; AI and autopiloted seats don't sign and are flagged in the result.
- **Every phone signs the same thing.** The phone shows a plain-language rendering of the canonical payload ("Kart Rush, 3 laps: you finished 2nd of 4"), and signs its hash. If any human refuses, or two screens disagree on the result, it is `disputed` and nothing ranked is issued.
- **Ranked** requires the setup to have asked for it, every human seat verified, and the match to have started and completed with the minimum humans ([§2.7](#27-modes-start-rules-and-match-setup)). An `abandoned` match submits nothing ranked.
- **Idempotent:** the record is keyed by `matchId`; a duplicate submit is a no-op.

### 5f.5 Where Part B appears in the Part A UI

The **Ranked** and **Dare terms** options in the lobby are **always visible**: when partners are off they are disabled with a plain reason ("needs partner services, not enabled in this build"). That is a decision, not a placeholder to hide later. The other surfaces below are absent when `PARTNERS` is `off` and appear when it is `mock` or `on`.

| Surface | Placeholder |
| --- | --- |
| **Controller, Join** | An identity step (a "Verify" button) and a "claim your name" field, both skippable; the guest path is always the default |
| **Controller, Lobby** | A verified badge and the display name next to the seat |
| **Controller, Sign** (new profile) | The sign-request card (the plain summary and a Sign button), and two consent switches: *publish my score* and *publish my replay* (off by default) |
| **Controller protocol** | `identity.begin`, `identity.complete`, `sign.request`, `sign.response`, `consent.set` |
| **Menu** | A **History** panel (my results, head-to-head records) from `Records.query`; the room name beside the room code |
| **Lobby and setup** | **Ranked** and **Dare terms** options, always visible and disabled with the reason until providers are on; a seed line (when `mock` or `on`) |
| **Results screen** | A receipt link and QR, a per-seat signed tick, and a "saved locally" or "published" state |
| **Screen** | Verification badges beside seat names; the seed banner |

### 5f.6 Degraded and offline modes

| Situation | Behaviour |
| --- | --- |
| `PARTNERS=off` | No partner surfaces (History, verified badges, signing, the seed line). The lobby still shows **Ranked** and **Dare terms**, disabled with the reason. The product is otherwise exactly Part A |
| `PARTNERS=mock` | The UI is visible and local providers answer: practice receipts for dare nights, and a demo that works without internet |
| Identity provider down | Everyone plays as a guest; ranked is disabled with the reason |
| Naming down | The room code and nicknames are shown |
| Randomness down or slow | A local seed marked `source: local` (or commit-reveal) after a timeout, shown on the result |
| Records down | The result is kept in an **outbox** (on the authority screen and the relay), retried with backoff, and shown as "saved locally" until it goes through |
| No internet at all (a LAN-only venue) | Falls back to `mock` automatically and says so; nothing about play changes |

### 5f.7 Infrastructure to plan now

- A **sponsor-wallet service as a separate module or process** from the realtime relay, reading from the outbox queue, so chain latency or failure can never touch a room.
- Secrets only in the environment, never in the repository or the client; a kill switch that disables all writes; per-room and per-IP write caps; a small float in the wallet with a low-balance alert ([§5c.2](#5c2-security-and-content)).
- World verification needs the relay to reach the internet and expose server endpoints (the signing of `rp_context` and the proof verification); the signing key stays server-side. That means the **hosted relay** ([§5b.1](#5b1-who-runs-the-relay)) with a real public URL, because phones on cellular and any partner callback can't reach a laptop on a LAN.
- RPC providers with a fallback; no PII in logs.

### 5f.8 What each possible partner needs from Part A

Briefs are unpublished, so this covers likely partners and unlikely ones alike.

| Partner (status) | Hook | Needs from Part A | New at the event |
| --- | --- | --- | --- |
| **Arkiv** (leading) | Records | `ResultV1`, `ReplayV1`, `matchId`, canonical hashing, the outbox, the History panel | The Arkiv provider, entities and queries, the receipt page |
| **ENS** (leading) | Naming | The room-name and `displayName` hooks used everywhere names appear, the claim field, text-record fields (`record`, `receipt`) | Offchain subnames, live resolution, text records |
| **World** (leading) | Identity | The join step, the verified badge, a per-room uniqueness table, device token ↔ session key, guest vs ranked | The proof flow, server verification, the nullifier table |
| **Chainlink** (spare) | Randomness | The seed hook and lobby seed line, seeded deterministic games ([P5](#p5-determinism-and-replay-m)), the fallback | The VRF contract and listener (a CRE workflow only if the brief asks) |
| **Ethereum Foundation** (watch) | Signing, accounts | The `Signer` abstraction and a phone-held key that holds no value | Session-key or account-abstraction logic |
| **Arc or other stablecoin partner** (held) | Settlement | The `Settlement` hook at `match.finish`, dare terms, the abandon and walkover rules | Contracts and escrow flows, only if the pot decision is made |
| **0G, Hedera and similar** (not planned) | Records, storage | `Records` can fan out to more than one sink; replays go through a pluggable `ReplayStore` | A provider, if a brief makes it worthwhile |
| **1inch, Uniswap, Definitive** (not planned) | none | A DeFi trading product has no natural hook in a game | n/a |

### 5f.9 Repository layout and Continuity hygiene

- Part A adds `core/integrations.js` (the registry and the mock providers), `docs/integrations.md` (the contracts above), and an empty `integrations/` with a README. These interface and mock files are pre-existing work and are listed as such in `PRE_EXISTING.md`.
- **No partner dependency in Part A's `package.json`** (no chain, ENS, Arkiv or World packages). Adding them is the event's first commit.
- At the event: provider code under `integrations/<partner>/`, small commits throughout, a `.env.example`, the AI-use record ([§12.1](#121-event-day-plan-submission-and-demo)).

### 5f.10 How it is tested

One **contract test suite** per capability, run against the mock provider now and the real provider later, so a provider either passes or doesn't. Plus: canonical-encoding vectors that must hash identically in Node and in Chrome; the signing state machine (agreed, disputed, unsigned, abandoned); idempotent resubmission; fault injection (a provider that times out or errors) proving gameplay never stalls; offline mode; ranked eligibility (minimum humans, all verified); and consent defaults.

### 5f.11 Questions the briefs will answer

Does a partner require an on-chain contract or is an offchain integration enough; which chain or testnet; whether World wants a mini app rather than a normal web page; whether ENS wants onchain names or accepts offchain subnames; Arkiv's testnet and SDK version; whether the Ethereum Foundation wants account abstraction; and whether a stake or pot is wanted at all. The signing payload carries a `chainId` taken from configuration, so none of these answers changes Part A.

---

## 5g. A platform for other people's games

The goal is that, later, outside creators can build games for Funcaster Console and list them next to ours. That is mostly a question of *contracts*: what a game declares, what the platform gives it, how its results are identified and checked, and how untrusted code is kept away from everyone else. Most of those contracts are cheap to define now and expensive to change after anything is published, so this section fixes them early. The big pieces (sandboxing, a registry, submissions) come later, in stages, after our own games have proved the shape.

### 5g.1 What this means, and what it does not

| In scope eventually | Not in scope now |
| --- | --- |
| A written **manifest** every game ships; a **game SDK** that hides rooms, seats, netcode and input; **namespaced ids**; generic **results and replays**; **verification tiers**; a **sandbox** for third-party code; a **validator** and creator template; a **registry** with review | A marketplace, payments, revenue share, ratings, or a creator portal. None of them is needed to make the contracts right |

**Rule of three.** The SDK is extracted from the three Tier 1 games (Kart Rush, Golf, Slice Dojo), which are deliberately different (per-player views, turns, a shared real-time board). It is frozen as version 1 only after all three run on it. Building a registry or a marketplace before the contract has survived three real games would be guessing.

### 5g.2 What already helps, and what is in the way

Read from the repository:

| Helps | In the way |
| --- | --- |
| Every game already splits a **pure `logic.js`** (no DOM, tested in Node) from a renderer `game.js` | Games **import platform internals directly** (`core/channel.js`, `core/splash.js`, `core/gesture.js`, `core/orientation.js`, `core/calibration.js`), so there is no stable public API and any change to `core/` can break a game |
| `game.json` plus **automatic discovery** from the `games/` folder ([server.js:51-76](server.js#L51-L76)) | The game's id is its **folder name**, and `game.json` is optional and unvalidated |
| Seeded, fixed-step-capable logic is already the shape verification needs | Two games (Slice Dojo and Kart Rush) **talk to the relay's socket directly** via `GameLink`, bypassing any seat or room abstraction |
| The controller already has a profile lease, a seed of the "platform draws the phone UI" idea | Games **share one origin** with the menu and each other, and read and write **un-namespaced `localStorage` keys** (`openwii.chargeInvert2` is shared by two games; `fn.best` is not scoped) |
| | **No CSP and no sandbox**: a game can read other games' storage, call the relay, or navigate the page |
| | Verification would be an ad hoc script per game |

### 5g.3 Game manifest v2

Every game, first-party or not, ships a manifest. It extends today's `game.json` (existing fields keep working) and is validated.

| Field | Purpose |
| --- | --- |
| `id`, `version`, `sdk` | The namespaced id ([§5g.4](#5g4-game-ids-versions-and-bundle-hashes)), the game's own semantic version, and the SDK version it targets |
| `title`, `tagline`, `icon`, `publisher` | Display only; none of them is an identifier. `publisher` is an opaque string now so it can later be a verified identity |
| `modes[]` | As already planned: `kind` solo or multiplayer, `minHumans`, `maxHumans`, `aiDefault`, `aiOptions`, `options` (a declared schema for the match setup), `pattern` (A to E), `view` (shared or per-player), `topologies` |
| `scoring` | The primary score: `{ key, direction: higher or lower, unit: points, ms, strokes, …, integer: true }`, tie-breaks, and how ranks are decided (by score, by elimination, by team) |
| `statsSchema` | The game's extra per-seat stats as a small typed schema (integers, enums, short strings, size caps), so History and leaderboards work for any game without knowing it |
| `determinism` | The verification tier: `verifiable`, `attested` or `casual` ([§5g.7](#5g7-verification-tiers)) |
| `entry`, `verifier` | The game bundle's entry point and, for verifiable games, the verifier module |
| `profiles` | Which controller profiles it uses (pointer, wheel, swing, flight, keyboard, watch) and any declarative phone cards ([§5g.8](#5g8-running-untrusted-games-safely)) |
| `budgets` | Declared size, memory and frame-time targets, checked by the validator against the platform limits ([§5.4](#54-budgets-my-targets)) |
| `assets` | A declaration of each bundled asset's licence and origin, so IP problems like the one in [§5e.2](#5e2-assets-renaming-does-not-fix-this) are caught at listing time |
| `rating` | Content rating and any flashing-effects declaration ([§5c.1](#5c1-physical-safety)) |

### 5g.4 Game ids, versions and bundle hashes

This **supersedes the flat id list** in [§5f.3](#5f3-data-that-must-be-fixed-now).

- **`gameId` is `namespace:slug`**, for example `funcaster:kart-race`. The slug is `[a-z0-9-]`, 3 to 40 characters. The namespace `funcaster` is reserved for first-party games. A creator gets a namespace when they register; initially an opaque identifier, later possibly a verified name. **Ids are immutable and never reused**, even after a game is withdrawn.
- **Three separate things identify a build:** `gameId` (which game), `gameVersion` (the creator's semantic version) and **`bundleHash`** (a content hash over every file in the bundle). Results and replays record all three. A replay is verified against the exact bundle that produced it.
- **Rooms pin the bundle.** The build handshake ([§5b.3](#5b3-version-handshake)) extends to the game: every screen in a match must run the same `bundleHash`, which lockstep play needs anyway.
- The first-party list is `funcaster:kart-race`, `funcaster:golf`, `funcaster:fruit-slice`, `funcaster:table-tennis`, `funcaster:swordplay`, `funcaster:kart-time-trial`, `funcaster:island-flyover`, `funcaster:shooting-range`, `funcaster:alien-attack` and `funcaster:sketch`. They are neutral on purpose: Kart Rush and Slice Dojo are working display names that may change again, and renames never touch the id.

### 5g.5 The game SDK contract

The SDK is the only thing a game imports. It replaces direct use of `core/*`, the socket and `localStorage`.

**What a game provides:** a manifest, and a module that implements the lifecycle for its declared pattern. Illustrative only; the real shape comes out of the three Tier 1 games:

```js
export default defineGame({
  init(ctx) {},            // ctx: seats, seed, setup, screen, assets (everything the match was configured with)
  step(dt, inputs) {},     // fixed step; pure when the game is 'verifiable'
  render(views) {},        // the game draws into the views it is given (one per local seat for per-player-view games)
  result() {},             // { scores, stats } as declared in the manifest
  onSeat(seat, event) {},  // join, leave, away, autopilot
  verify(replay) {},       // only for 'verifiable' games
});
```

**What the platform provides:**

| Area | Provided |
| --- | --- |
| Rooms, seats, screens, lobby, start gate, rematch | All of [§2](#2-seats-screens-and-views); the game never sees sockets |
| Input | Per-seat `pointers`, wheel and button state, text, with calibration and sensitivity applied ([§5a](#5a-the-controller-the-phone)) |
| Time | A fixed-step runner and the match clock |
| Randomness | The seeded generator and the seed |
| Netcode | The declared pattern's plumbing (shared board, turns, race the seed, head-to-head, lockstep), with the game supplying `step`, snapshot and apply |
| Views | Viewports for per-player-view games ([§2.4](#24-layout-rules-per-player-view-games)) |
| Phone feedback | A catalogue (haptic patterns, cards, flashes), not arbitrary code |
| Results | `result()` goes into a `ResultV1` and the partner contracts ([§5f](#5f-designing-part-a-for-the-partner-tracks)) |
| Storage | A scoped key-value store per game and mode, for bests and settings |
| Audio | Audio unlock and master volume from the shell |

**Dogfooding.** The ten first-party games become the SDK's first users. The shape is already close: `logic.js` is the `step`, `game.js` is the `render`. The work is moving each game's calls from `core/*`, the socket and `localStorage` onto the SDK.

### 5g.6 Scoring, stats and results for any game

`ResultV1` ([§5f.3](#5f3-data-that-must-be-fixed-now)) is generic. It gains `gameVersion`, `bundleHash` and a `verification` field; per-seat `score` and `stats` are validated against the manifest's `scoring` and `statsSchema`, and rejected if they don't conform. Because the platform knows the score's direction, unit and tie-breaks, it can build **History, per-game leaderboards and head-to-head records for a game it has never seen**, and the partner records ([§5f](#5f-designing-part-a-for-the-partner-tracks)) are keyed by `gameId` and need no per-game code.

`ReplayV1` becomes an **envelope**: `{ v, gameId, gameVersion, bundleHash, seed, setup, step, payloadFormat, payload }`. The envelope, the compression and the chunking are the platform's; `payloadFormat` and `payload` belong to the game, and its verifier is the only thing that reads them.

### 5g.7 Verification tiers

A game declares how checkable it is. Every match still produces a `ResultV1`; the tier decides what its `verification` field can say.

| Tier | What the game provides | What a result can be |
| --- | --- | --- |
| **`verifiable`** | Deterministic, seeded, fixed-step logic and a `verify(replay)` | `verified` (the checker replayed it and agrees) or `failed`. Eligible for ranked results |
| **`attested`** | No replay, but the result is signed by every human seat | `attested`. Eligible for ranked results only where the players opt in, and always labelled |
| **`casual`** | Nothing | `unverified`. Never ranked, never staked |

Our games: Kart Rush, Golf, Slice Dojo, Table Tennis, Swordplay, Time Trial, Island Flyover and Shooting Range aim for `verifiable`; Alien Attack is `verifiable` once its logic is fixed-step; Sketch is `attested` or `casual` (a drawing game can't be replayed for a score). This replaces the earlier "every match is verifiable" with something true for any game: **every match produces a result and an honest verification status.**

**Running a verifier.** A first-party verifier is trusted and runs in Node. A third-party verifier is untrusted code: the platform runs it in an isolated worker or VM with CPU and memory limits and a time cap, feeding it only the replay, and treats a crash or timeout as `failed`.

### 5g.8 Running untrusted games safely

Today everything shares one origin ([§5g.2](#5g2-what-already-helps-and-what-is-in-the-way)); a third-party game must not.

- **Isolation.** A third-party game runs inside a **sandboxed iframe** (`sandbox="allow-scripts"`, no `allow-same-origin`) served from a **separate, cookieless origin**. It cannot read the shell's storage, other games' data or the relay, and cannot navigate the page.
- **A message bridge.** The shell owns the sockets, seats, storage, audio unlock and fullscreen. The game talks to it through a typed `postMessage` API, which is the SDK. Seat input arrives as messages (the cost at 60 Hz for 8 seats is small, but it is on the list to measure).
- **Strict CSP:** scripts and assets only from the game's own bundle, `connect-src 'none'`, so a game can neither exfiltrate data nor call out. Assets load by relative path from the declared bundle.
- **Phones never run third-party code.** A game picks from the platform's controller profiles and may add **declarative cards** (labels, buttons, a text field, described in the manifest and rendered by the platform). No arbitrary script runs on a player's phone, where it would have access to motion sensors.
- **Limits** from `budgets`: bundle size, memory, frame time, no workers beyond a cap, enforced by the validator before listing and by the shell at runtime (a frozen game is terminated, and the room is told).
- **Permissions.** A game gets only seats, input, time, audio, scoped storage and the result channel. No camera, microphone, location, clipboard or network.

### 5g.9 The catalogue: from a folder scan to a registry

| Source | How it loads | Menu treatment |
| --- | --- | --- |
| **First-party** | Today's `games/` folder, with the manifest | No badge |
| **Dev mode (sideloaded)** | A creator points the platform at a local folder or URL; loaded sandboxed with a visible "unreviewed" warning | "Dev" badge, only visible to the person who loaded it |
| **Registry (later)** | A published index of reviewed manifests; bundles served from a CDN | "Community" badge, publisher name, filters |

The menu is already data-driven from `game.json` ([§P1b](#p1b-the-game-menu-and-lobby-entry-m)), so it only needs to read manifests from more than one source. The relay's `listGames()` becomes a **registry client** with the folder scan as its first source.

### 5g.10 Creator tooling and documentation

- **A template game** (a small, complete example, for instance a stripped-down Table Tennis) created with one command, with the manifest, a pure `logic`, a renderer and a verifier.
- **A local simulator:** fake seats, switchable topology (one screen, separate, hybrid), latency and drop injection. This is the same harness as [P0](#p0-foundations-s), so building it for ourselves builds it for creators.
- **A validator** (`validate`) that checks: the manifest against its schema; budgets; that two runs of `step` with the same seed and inputs give identical results (the determinism check); that a recorded replay round-trips through `verify`; that scoring and stats conform; that no forbidden API is used; asset licence declarations; and basic accessibility (controller labels, colour not the only cue).
- **Documentation:** a manifest reference, the SDK reference, a tutorial that turns the template into a real game, a guide to the verification tiers, and a policy page.

### 5g.11 Publishing, review and policy (later)

Submit a bundle and manifest; automated checks (the validator, a malware and obfuscation scan, size and frame-time budgets); human review against a short policy (content, IP declaration, safety including flashing effects, no misleading names); a listing with a pinned version. Versions are immutable once published; a new version is a new `bundleHash`; a bad one is withdrawn and rooms already running it finish on the pinned bundle. A takedown process and a contact for rights holders. **Unlisted** mode lets a creator share a link to an unreviewed game, clearly labelled. None of this is built before the contracts exist.

### 5g.12 How it is staged

| Stage | What | Gate |
| --- | --- | --- |
| **Now (M2c)** | Manifest v2, namespaced ids, generic `ResultV1` and `ReplayV1` envelope, scoring and stats declarations, verification tiers, scoped storage keys; all ten first-party games get manifests | Cheap, and the part that is costly to change later |
| **SDK-1** | Extract the SDK contract from the three Tier 1 games; they run on it; freeze v1 | After all three Tier 1 games pass their acceptance bars (M7) |
| **SDK-2** | Dev-mode sideloading, the sandboxed iframe host, the verifier sandbox, the validator, the template and the docs | After SDK-1 |
| **SDK-3** | The registry, submissions, review, publishing and unlisted mode | After SDK-2 has been used by at least one outside creator |

Rough sizes (my estimates): M2c S–M, SDK-1 L, SDK-2 L, SDK-3 L.

### 5g.13 How this connects to the partner tracks

- Records are keyed by namespaced `gameId` with `gameVersion` and `bundleHash`, so any game's results are queryable and replays verifiable against the right bundle.
- `publisher` is opaque now. Later it can be a verified identity or an ENS name, which also lets a creator's namespace be an ENS-owned name; that is a future option and not part of the event plan.
- A registry could eventually be stored on a partner network, and verifier results could be attested on chain. Both are possibilities, not commitments, and neither changes anything defined here.

### 5g.14 Risks specific to a creator platform

Third-party code security (the sandbox is the answer, and it needs real review before the first outside game); a breaking SDK change (semantic versioning, an N-1 support window, a compatibility test suite); moderation and IP load (the validator's licence declarations and a review policy, and starting with unlisted and invited creators); someone squatting ids (immutable namespaced ids, registration required); a slow or abusive game (budgets enforced at runtime); results from a game that cheats (the verification tier is always shown, and `casual` and `attested` never rank by default); and **building the platform before the games** (the rule of three and the stage gates).

---

## 6. Tier 1: Kart Rush, Golf and Slice Dojo

### 6.1 Golf

**Why first:** smallest game, turn-based so it is topology-agnostic, and it exercises seats, screens, AI, lobby, rematch and online without needing split-screen. It is the platform's proving ground.

**Target features**

- **Course:** N holes (e.g. 3, 6, 9), each seeded (hole position, terrain parameters, par 3/4/5) so rounds are reproducible. Keep `Hole` as the per-ball simulation; add `Course` (hole definitions) and `Round` (seats, turn manager, scorecard).
- **Turn order by real golf rules:** the ball farthest from the hole plays first; the lowest score on the previous hole has the honour on the next tee ([USGA](https://www.usga.org/content/usga/home-page/rules-hub/topics/order-of-play-ready-golf.html)). Add **ready golf** as an option: if the player who is away isn't ready, another may go, which keeps remote and hybrid rounds moving (the USGA encourages it for pace).
- **Modes:** stroke play, match play, skins, closest-to-the-pin, long drive; **team scramble** where a team is a screen, which suits hybrid rooms. **Speed Golf** (everyone plays at once) only where the topology can show it: all-remote, or at most two local seats in split-screen, following Super Rush's own restriction.
- **AI golfers:** skill levels (Rookie, Club, Pro) that perturb aim offset and power with a seeded rng and call the existing `strike(power)` with `pickClub`; pacing delay and names so they feel like players. **Opt-in:** Solo default is a round alone against par, Multiplayer default is humans only; the host can add 1–3 rivals from the match setup ([§2.7](#27-modes-start-rules-and-match-setup)).
- Scorecard overlay between holes; stroke cap; seeded wind per hole (optional).
- **Phone UX:** a "your turn" card (vibration where supported, plus visual/audio since iOS may lack vibration), aim and swing for the active player, a quiet "watching" state for the others, wind and distance readouts.

**View per scenario** (shared-view policy)

| Topology | What happens |
| --- | --- |
| T1 one screen | One shot camera on the active player; other phones show "watching" |
| T2 all remote | Every screen draws the same shot camera for the active player, including when the striker is remote |
| T3 hybrid | Same as above; the hybrid needs no special view logic |
| T4 spectator | Same shot camera, plus a leaderboard layout |
| AI turn | Shot camera plays the AI's stroke with a short "thinking" delay |

**Netcode (pattern B):** send one small `stroke` event `{ seat, hole, club, power, aimOffset, t, seq }`; every screen simulates the flight from the synchronised ball state using the same pure physics. **Spike S2** decides whether that is enough or whether the striker's screen publishes the authoritative resting position (`settled { ball }`) that others snap or ease to. Either way the traffic is a few messages per stroke, so latency of a second is invisible.

**Tests:** turn order incl. ties and ready golf, multi-ball state, seeded holes, AI skill distributions (seeded), scorecard maths, solo behaviour unchanged (golden), two-engine flight agreement (S2).

**Acceptance:** four humans play nine holes in T1, T2 and T3 with no AI; a second round with two humans plus two AI rivals works; Multiplayer refuses to start with one human; a phone that sleeps mid-round keeps its seat; a dropped player's turn is paused or skipped per the host's setting. The full pass bar is the scenario book below: every row marked **M3** or **M7** must pass.

#### 6.1.1 Gaps in today's Golf that the scenarios expose

Read from [games/golf/game.js](games/golf/game.js), [logic.js](games/golf/logic.js), [games/shared/ball.js](games/shared/ball.js) and [core/gesture.js](core/gesture.js):

| # | Gap | Where | Why it matters with more than one player |
| --- | --- | --- | --- |
| 1 | **Any detected swing strikes instantly** while the state is `aim` (no address step) | [game.js:106-115](games/golf/game.js#L106-L115) | A practice swing, a wave while talking, or the wrong phone fires a stroke |
| 2 | **Aim is read from the pointer every frame until the strike**, and a swing moves the phone, so the aim at detection is not the aim before the swing | [game.js:176](games/golf/game.js#L176) | Shots drift left or right of where the player lined up; unfair when others watch |
| 3 | **No out-of-bounds.** `terrainHeight` is defined everywhere and the mesh is only 170×330 m, so a ball can roll off the course forever | [game.js:35-38](games/golf/game.js#L35-L38), [logic.js:20](games/golf/logic.js#L20) | One lost ball can stall every player's turn |
| 4 | **No flight or settle timeout** | [logic.js:88-115](games/golf/logic.js#L88-L115) | A ball that never meets the settle condition freezes the round |
| 5 | **No stroke cap** | `strokes` just increments | A struggling player holds the table indefinitely |
| 6 | **Variable-step physics**: `dt = min(frame time, 1/20)`, Euler integration | [game.js:169](games/golf/game.js#L169), [ball.js:11-20](games/shared/ball.js#L11-L20) | The same stroke gives different trajectories at different frame rates, so two screens won't agree unless the step is fixed |
| 7 | **One ball, one camera, no round/hole/turn concept**; `startRound` resets by editing `hole` fields | [game.js:118-125](games/golf/game.js#L118-L125) | Needs `Round`, per-seat balls, a camera director |
| 8 | **Physics only distinguishes green from not-green**; the fairway/rough colours are cosmetic | [logic.js:92-97](games/golf/logic.js#L92-L97), [game.js:56-58](games/golf/game.js#L56-L58) | Fine for now; rough/bunker/water are later polish |
| 9 | One fixed hole (`HOLE`, `TEE`, `PAR = 4`) | [logic.js:13-17](games/golf/logic.js#L13-L17) | Needs a seeded `Course` |

Each gap maps to scenario rows below (C2, C5, D1, D2, D4, E3, and the round/camera rows).

#### 6.1.2 Round and turn state machines

```
ROUND   lobby ─start gate─▶ hole N: tee ─▶ playing ─▶ holeResults ─▶ (hole N+1 … ) ─▶ roundResults ─▶ rematch | end
                                   │
TURN    waiting(seat) ─▶ addressing(A held) ─▶ flight ─▶ settled ─▶ resolve ─▶ next turn
            │                │                                      │
            ├─ timeout ───▶ auto-shot (flagged) ─────────────────────┤
            ├─ disconnect ─▶ paused ≤30 s ─▶ skip ───────────────────┤
            │                                   settled kinds: rest · holed · out of bounds (+1, replay) · cap (pick up)
```

`TurnManager.next()` is a pure function of the state: balls still in play, their distances to the hole, the previous hole's scores, the seat order and the options. That makes it exhaustively testable.

#### 6.1.3 Messages (room-scoped, over the relay)

| Message | From → to | Content |
| --- | --- | --- |
| `golf:turn` | authority → all | `{ hole, seat, seq, deadline? }` |
| `golf:address` | active phone → screens | `{ seat, on }` (A held) |
| `golf:aim` | active phone → screens | `{ seat, aimOffset }` at ~10 Hz so everyone sees the arrow |
| `golf:stroke` | active phone → authority | `{ seat, hole, seq, power, aimOffset, tPhone }` (aim latched at swing onset) |
| `golf:settled` | authority → all | `{ seat, hole, seq, ball, result: rest \| holed \| oob \| cap, strokes }` |
| `golf:state` | authority → all / on join | Full snapshot: balls, strokes, scores, turn, options, seed, `seq` |

**Authority** is the host screen; if it drops, the lowest remaining screen id takes over (turn-based state at each rest is identical on every screen, so migration is trivial). The relay stays a switchboard but keeps the **latest `golf:state` blob per room** so a reloaded or new screen can resume. This is a small, deliberate exception to "the relay holds no game state"; the blob is opaque to the relay.

#### 6.1.4 Scenario book

**When** column: **M3** = must pass at the local Golf milestone, **M7** = must pass at the online milestone, **later** = polish after both.

**A. Who is playing where**

| ID | Situation | What happens | When |
| --- | --- | --- | --- |
| A1 | 2–4 humans on one screen (T1) | One shared shot camera; only the active seat's phone is live; the others show "watching" | M3 |
| A2 | All remote, one human per screen (T2) | Same camera on every screen; stroke goes phone → authority → everyone | M7 |
| A3 | Hybrid: 2 on the TV, 1 on a laptop (T3) | Identical to A2 from each screen's view; ready golf defaults on | M7 |
| A4 | Spectator screen joins mid-round (T4) | Receives `golf:state`, shows shot camera and leaderboard; may leave any time | M7 |
| A5 | Solo: 1 human | A round alone against par; no AI unless added; no turn timer | M3 |
| A6 | Solo with AI rivals added | Rivals take turns by the same rules | M3 |
| A7 | Multiplayer with AI rivals added (2 humans + 2 AI) | AI seats take turns in order; they don't count toward the 2-human minimum | M3 |
| A8 | One human tries Multiplayer | Start disabled with the reason | M3 |
| A9 | Late joiner mid-round | Spectates until the next round. Optional host setting: join between holes, missed holes scored par + 2 and marked "joined late" | M7 |
| A10 | More than 8 total seats | Cap of 8 seats (humans + AI) so the scorecard and turn queue stay readable | M3 |

**B. Turn order and pacing**

| ID | Situation | What happens | When |
| --- | --- | --- | --- |
| B1 | Normal play | After each stroke the **ball farthest from the hole** plays next | M3 |
| B2 | Tee-off order | Hole 1: seat order (host first), or a seeded draw if the host picks it. Later holes: the **lowest score on the previous hole** has the honour; ties keep the previous order | M3 |
| B3 | Two balls at the same distance (within 0.5 m) | The seat that played earlier last goes first, then seat order | M3 |
| B4 | A player has holed out | Skipped; their phone shows "watching" and their running score; the rest continue | M3 |
| B5 | Active player is idle (turn timer) | Default **off when all seats are local**, **45 s when any seat is remote**, warning at 30 s on the phone and screen. At expiry a Rookie AI plays an **auto-shot**, flagged `auto`, no penalty. Three auto-shots in a row mark the seat "away" and its turns auto-play until it swings; the host can remove it | M3 (timer) |
| B6 | Ready golf | Off when all seats are local; **on when any seat is remote**. If the player who is away hasn't addressed the ball within 20 s and another seat is ready (A held), that seat may play. The skipped player keeps their place in the next order calculation | M7 |
| B7 | Speed Golf (everyone at once) | Offered only if the topology can show it: all-remote, or at most 2 local seats in split-screen. Each player has their own ball and view (per-player-view policy for this mode). The hole ends when everyone has holed or hit the cap; points by finish order | later |

**C. The stroke itself**

| ID | Situation | What happens | When |
| --- | --- | --- | --- |
| C1 | A non-active phone swings | Ignored by the relay and the authority (seat must equal the turn's seat; slot is server-assigned); that phone shows "Not your turn" | M3 |
| C2 | Practice swing or waving | A stroke registers **only while the player is addressing the ball (A held)**. Practice swings are free; the phone says "Hold A to line up" | M3 |
| C3 | Swing during flight or settling | Ignored (state gate) | M3 |
| C4 | Duplicate stroke (resend, double detection) | `seq` makes it idempotent; the second is dropped | M3 |
| C5 | Aim moves during the swing | **Latch the aim at swing onset** (when the detector arms) and send that value, not the aim at completion | M3 |
| C6 | Out-of-range payload (power or aim) | Reject and log: power must be in [0.12, 1], aim within ±0.35 rad (the pointer maps to (x − 0.5) × 0.7) | M3 |
| C7 | Very weak swing | Below detector thresholds: no stroke. At or above: existing minimum power 0.12 | M3 |
| C8 | Phone drops between address and swing | Treated as a disconnect (E9) | M3 |
| C9 | Left-handed or odd grip | Existing calibration plus per-seat recentre | M3 |

**D. Rules and course**

| ID | Situation | What happens | When |
| --- | --- | --- | --- |
| D1 | Ball rests out of bounds | **+1 stroke and replay from the previous spot** (stroke and distance); host can choose "drop where it left the course". Bounds come from the course polygon (`Course.inBounds`); banner "Out of bounds +1" | M3 |
| D2 | Ball never settles | Hard timeout (20 s of flight and roll): force-settle at the current ground position, or treat as out of bounds if outside the course | M3 |
| D3 | Hole in one | Celebration; the hole ends for that seat | M3 |
| D4 | Stroke cap reached | Pick up at the cap (default par + 4), scored as the cap; banner "Pick up" | M3 |
| D5 | Ball ends on top of another ball | No ball-ball collision; both stay; offset markers drawn | M3 |
| D6 | Wind | Per-hole vector from the round seed, same for every seat, shown on the active phone | later |
| D7 | Stroke-play tie | Co-winners by default; host option: sudden-death hole (course cycles from hole 1, seed + n) or count-back (best last hole, then the one before) | M3 |
| D8 | Match play | Exactly 2 humans (or 2v2 as teams); win/halve each hole; ends early when the lead exceeds holes left; tied after the last hole goes to sudden death. Greyed out for other counts, with the reason | later |
| D9 | Skins | A tied hole carries its skin to the next; skins left after the last hole are discarded (host option: split). Skins are points, not money | later |
| D10 | Closest-to-the-pin | One shot each from the same spot; ranked by distance; order by seat | later |
| D11 | Team scramble | Teams assigned by the host (in hybrid, one team per screen); each member strikes from the same spot, the closest ball is auto-picked (captain can override) and all play on from there; unequal team sizes allowed, no handicap by default | later |
| D12 | Uneven skill | Per-seat assist level (narrower aim cone, power forgiveness) and optional stroke handicap; default off | later |
| D13 | Rough, bunker, water | `surfaceAt(x, z)` gives friction, power and penalty per surface; water is +1 and a drop. Multiplayer doesn't depend on it | later |

**E. Network and screens**

| ID | Situation | What happens | When |
| --- | --- | --- | --- |
| E1 | High phone latency | Doesn't affect correctness (turn-based); the stroke carries the phone timestamp for logs | M7 |
| E2 | A remote screen gets the stroke late | It simulates from the stroke event; on `golf:settled` it eases to the authority's position; a difference over 2 m cuts instead | M7 |
| E3 | Different frame rates or engines → different trajectories | **Fixed-step flight** (P3) so identical inputs give identical results; the authority's `settled` always wins; spike S2 measures how often screens disagree | M3 (fixed step) / M7 |
| E4 | Authority screen disconnects or reloads | Authority migrates to the lowest remaining screen id; state at the last rest is the same everywhere; a mid-flight stroke is re-simulated from its event | M7 |
| E5 | A screen tab is hidden (browser throttles animation) | Simulation catches up with a capped step loop; on return it jumps to the authoritative state | M7 |
| E6 | Relay restarts or every screen drops | The authority keeps `golf:state` in `localStorage` and the relay in memory; on reconnect "Resume round?" restores it; phones rejoin by token | M7 |
| E7 | Lost, duplicated or out-of-order messages | Room-level `seq`; a gap triggers a full `golf:state`; applying is idempotent | M7 |
| E8 | A screen tab reloads while hosting 2 local seats | Seats keep their tokens; phones reconnect; the screen receives `golf:state` | M7 |
| E9 | Phone disconnects on its turn | Pause up to 30 s (default for Golf); on reconnect it resumes; after the grace period the turn is skipped, or auto-shot if the host chose that | M3 (local) / M7 |
| E10 | Phone disconnects while its ball is in flight | The ball is unaffected; the result is recorded; the phone catches up on return | M3 |
| E11 | The same seat opened on two phones | Last connection wins; the old one is told "taken over" | M3 |
| E12 | A seat forfeits (grace expired, left) | Stroke play: DNF, removed from the ranking, history kept; skins: no future skins; match play: forfeit | M3 |
| E13 | Humans fall below the minimum | `abandoned` per [§2.7](#27-modes-start-rules-and-match-setup); the remaining human may finish the round for fun; no ranked result | M3 |

**F. Views**

| ID | Situation | What happens | When |
| --- | --- | --- | --- |
| F1 | Turn passes between far-apart balls | Camera arcs to the next ball in ≤ 1.2 s; cuts if over 150 m; a banner in the seat's colour names the player | M3 |
| F2 | Another player's shot | Everyone watches the follow camera; the aim arrow is visible from `golf:aim` | M3 |
| F3 | Hole-out | Hole camera, then the scorecard slides in | M3 |
| F4 | Overview | A top-down strip of the hole with every ball and its distance, plus a leaderboard panel (the spectator layout) | M3 |
| F5 | Phone display | Active seat: distance, club, wind, aim, power. Others: whose turn, countdown, standings | M3 |
| F6 | Speed Golf views | One viewport per local seat (at most 2) or one per remote screen | later |

**G. AI golfers**

| ID | Situation | What happens | When |
| --- | --- | --- | --- |
| G1 | An AI's turn | The **authority** decides (not every screen): thinks 1.5–3 s, animates the aim, then emits a normal `golf:stroke`, so every screen treats it exactly like a human stroke | M3 |
| G2 | Skill levels | Rookie, Club, Pro are aim and power error widths drawn from a seeded rng keyed by (seed, hole, stroke number), so reruns are reproducible | M3 |
| G3 | AI and ready golf | The AI becomes "ready" after its thinking delay; it never blocks a human | M7 |
| G4 | AI plays for an idle human | Rookie skill, flagged `auto` (B5) | M3 |
| G5 | AI as a scramble teammate | Allowed; AI seats never count toward the 2-human minimum | later |

**H. Round lifecycle**

| ID | Situation | What happens | When |
| --- | --- | --- | --- |
| H1 | Host leaves the lobby | Host seat passes to the next human; the setup is unchanged | M3 |
| H2 | Host seat leaves mid-round | Setup stays frozen; pause and end-vote powers pass on | M3 |
| H3 | Rematch | Same players, new seed by default, or "replay this course" | M3 |
| H4 | End the round early | Host seat or a majority vote; results as they stand, unfinished holes unscored | M3 |
| H5 | Pause | Host seat; automatic on a disconnect (E9) | M3 |
| H6 | Switch Solo ↔ Multiplayer in the lobby | Resets the setup to that mode's defaults | M3 |

**I. Fairness**

| ID | Situation | What happens | When |
| --- | --- | --- | --- |
| I1 | A phone sends a stroke for another seat | Rejected: the relay checks the socket's server-assigned seat | M3 |
| I2 | Fabricated power or aim | Validated and clamped (C6); implausible values logged | M3 |
| I3 | The authority screen misreports a result | Every round writes a stroke log; the Node verifier replays all strokes and checks the scores ([P5](#p5-determinism-and-replay-m)); signing comes in Part B | M7 |
| I4 | The host picks a favourable seed | The seed is drawn by the relay (Chainlink VRF later); the host can't type one | M7 |

**Defaults by topology**

| Setting | All seats on one screen | Any remote seat (T2, T3) |
| --- | --- | --- |
| Turn timer | Off | 45 s (warning at 30 s) |
| Ready golf | Off | On |
| Drop policy | Pause up to 30 s, then skip | Same |
| Authority | The one screen | The host screen, migrating on loss |
| Join mid-round | Spectate only | Spectate only (host can allow between holes) |

#### 6.1.5 Pieces to build

`Course` (seeded holes, bounds, par, wind), `Round` (hole loop, scores, options), `TurnManager` (pure next-turn function), `Scorecard`, `GolfAI` (skill model), `GolfNet` (the messages above, `seq`, resync), a multi-ball renderer with a **camera director** (follow, arc, hole cam, overview strip), and the phone UI (address button, your-turn card, watching state, wind). `Hole` stays as the per-ball simulation, switched to a fixed step.

#### 6.1.6 How the scenarios are tested

- **`TurnManager` tables:** every B and D row as a small state-in, next-seat-out test.
- **Liveness fuzz:** random sequences of strokes, timeouts, disconnects, out-of-bounds and caps against a seeded round; from every reachable state there must be a legal next turn or the round must be over (nothing can deadlock).
- **Protocol tests** through the delay proxy: dropped, duplicated and reordered messages (E7), authority migration (E4), reload (E8).
- **Two-engine agreement** (S2): the same stroke in Node and Chrome at a fixed step; record how often resting positions differ and by how much, which sets the E2 snap threshold.
- **End to end** per topology with fake phones: A1, A2, A3, A4, E9, E10.
- **Solo golden:** a seeded solo round behaves as before the refactor, apart from the deliberate changes (address step, out of bounds, cap).

### 6.2 Kart Rush

**Today:** one human plus 7 CPU on a single camera ([§1.1](#11-kart-rush-internals-that-decide-the-split-screen-work)). The simulation is the best asset (pure, seeded, fixed-step); the presentation is the work.

**Two modes:**

| | **Solo** | **Multiplayer** |
| --- | --- | --- |
| Humans | 1 | 2 to 8; **cannot start with 1** |
| Cars on the grid | **8** (1 human + 7 CPU), exactly as today. Host may choose fewer CPUs (0 CPUs is a time trial) | **= number of humans** (2 humans means a 2-kart race). Host may add CPUs |
| CPU option | Fixed count 0–7 (default 7) | **None (default)** · Fixed count (up to the free grid slots) · Fill to 8 |
| Start grid | Existing grid, human at the back | Compact grid of N; order by seat on the first race, reversed previous finish on rematches (host can switch to random) |

**What in the current code assumes 8 racers or one human, and must change.** I read these in [logic.js](games/mario-kart/logic.js) and [game.js](games/mario-kart/game.js); the first three would otherwise break a humans-only race.

| Assumption | Where | Change |
| --- | --- | --- |
| **Racer 0 is the only human**: `auto = r.id !== 0 \|\| r.finishTime !== null` decides who is driven by `cpuInput` | [logic.js:235](games/mario-kart/logic.js#L235) | Per-racer controller: `human(seat)`, `cpu`, `autopilot`. A racer that has finished stays on autopilot, as today |
| **The race ends when exactly 8 racers have finished**, and the "finishing" phase starts when *the* player finishes | [logic.js:245-255](games/mario-kart/logic.js#L245-L255) | End when **all racers have finished or been DNF'd**. "Finishing" starts when the **first human** finishes; the other humans then get a finish window (my proposal: 30 s, host-adjustable) before remaining karts are DNF'd and results show. With no CPUs this is just "all humans done or timed out". Without this fix a humans-only race never ends |
| **Grid places the human at slot 7**, CPUs ahead of them | [logic.js:94-97](games/mario-kart/logic.js#L94-L97) | `gridSlot(i, N)` compact for N racers; Solo keeps the existing layout so golden tests stay valid |
| **Item odds assume 8 positions**: `rear = (position - 1) / 7` | [logic.js:77-80](games/mario-kart/logic.js#L77-L80) | `rear = (position - 1) / (N - 1)` so last place always gets the catch-up items; guard `N = 1` (time trial) |
| **CPU rubber-banding is relative to the one human**: `gap = this.player.progress - r.progress` | [logic.js:354-356](games/mario-kart/logic.js#L354-L356) | Relative to the average progress of connected humans; irrelevant when there are no CPUs |
| **`makeRacer` start-boost, `lastInput`, `gasDownAt` read `this.player`** | [logic.js:206-226](games/mario-kart/logic.js#L206-L226) | Per-racer |
| **UI strings say "8 RACERS"** | [index.html:86](games/mario-kart/index.html#L86), [game.js:503](games/mario-kart/game.js#L503) | Show the real grid size |
| Collisions already loop over `racers.length` | [logic.js:607-638](games/mario-kart/logic.js#L607-L638) | No change needed |
| Results table is built from `race.standings` | [game.js:1239-1253](games/mario-kart/game.js#L1239-L1253) | Already size-agnostic |

Small fields need their own tests: a **2-kart race** has no CPU traffic to make it feel busy and 1st vs last is a single position gap, so check item pacing and that the race ends correctly for N = 2, 3, 5, 8.

**The refactor, in order (each step behaviour-preserving until step 4):**

1. **Extract `ChaseCamera`** from [game.js:1032-1115](games/mario-kart/game.js#L1032-L1115) with its state as instance fields; **extract `RaceHud`** as a class-based component and `RaceAudio` per-seat hooks. Add a **screenshot regression test** (fixed seed, fixed frame) so the single-view look doesn't change.
2. **Generalise `Race`** ([logic.js:141](games/mario-kart/logic.js#L141)) to `humans: [{ seat, character }]` plus `cpus: n` (**default 0 in Multiplayer, 7 in Solo**), with `racerOf(seat)`, a per-racer controller and input map, per-racer start-boost state, a variable grid size N, and the end-of-race, grid, item-odds and rubber-band changes in the table above. Keep the single-human constructor path working. Re-run the existing Kart Rush tests plus golden replays of a seeded solo race.
3. **Multi-view renderer:** a `ViewLayout` (§2.4) and a render loop that, per view, swaps view-specific state (camera, shadow light position, spotlights, rival visibility, fog) then renders into that viewport with its own post chain at viewport size. Shared module `core/multiview.js` so Kart and Island Flyover reuse it.
4. **Quality tiers and governor** from [§5.3](#53-multi-view-cost-model), tuned using S1 data.
5. **Per-seat character select** on the phones (the intro today is a single DOM picker, [game.js:472-503](games/mario-kart/game.js#L472-L503)); TV shows a grid with each player's marker; the host seat sets laps.
6. **Items and per-view HUD:** each human has its own item slot and roulette; `speed-lines`, position, lap and coins per view; the results table and finish orbit run per view (today's `setViewOffset` finish framing, [game.js:1114](games/mario-kart/game.js#L1114), applies per camera).
7. **Audio:** one music bed; each local human's engine loop at reduced gain, panned by viewport; per-phone rumble.

**View per scenario**

| Topology | What each screen draws |
| --- | --- |
| T1, k humans on one TV | k split-screen views (cap 4); **no CPUs by default** (host can add) |
| T2, all remote | One full-screen view each; other humans are karts/ghosts in the world |
| T3, hybrid | Each screen draws views for *its* local humans only; a screen with 2 local humans runs the 2-view tier, a screen with 1 runs the full tier |
| T4 spectator | A director camera (leader follow with cuts) |
| Human drops | The kart is **autopiloted** (`cpuInput`) for the 30 s grace period; the human retakes it on reconnect at a safe moment; after the grace period the seat is DNF and the kart drives on ([§2.7](#27-modes-start-rules-and-match-setup)) |

**Online tiers (build in order; pick via decision gate):**

- **MK-1 Local split-screen** (T1): steps 1–7 above. No netcode.
- **MK-2 Live-ghost online** (T2, T3): each screen runs its own `Race` with the same seed for its local humans; remote humans are non-colliding ghosts streamed at 10–20 Hz; CPUs identical via the seed; items don't hit remote humans in this tier. Local humans on the same screen collide normally.
- **MK-3 Deterministic lockstep** (T2, T3, items work between humans): every screen runs the same fixed-step seeded `Race` and exchanges inputs with a small input delay (~100 ms, hidden by the rolling start); state hashes every N ticks detect desync; V8-only hosts avoid cross-engine drift. **Gate:** spike only after P4/P5 are solid and a two-Chrome-client test stays in sync for a full race. Alternative: run `Race` on the relay in Node and stream snapshots with client-side prediction; evaluate in the same spike.

**Player counts.** Today the game is 1 human plus 7 CPU: `Race` builds exactly 8 racers from the 8 characters in `CHARACTERS` ([logic.js:141-155](games/mario-kart/logic.js#L141-L155)). That 8 is the ceiling until the roster grows. In Multiplayer the grid is exactly the humans unless the host adds CPUs, so **6 humans means a 6-kart race**.

| Limit | Value | Why |
| --- | --- | --- |
| Humans to start Multiplayer | **at least 2** | Start gate ([§2.7](#27-modes-start-rules-and-match-setup)); a single human can only start Solo |
| Total racers per race | **2 to 8** in Multiplayer (humans + any CPUs the host added); 1 to 8 in Solo | `Race` has 8 racers and 8 character models. Two humans can't pick the same driver unless you add colour variants |
| Total humans per race | **up to 8** (then no room for CPUs) | Same 8 racers |
| Humans per screen | **up to 4** | The real games cap local play at 4 per console; 4 views is also about what an integrated GPU can draw. **Spike S1 may lower this to 2** |
| Screens per match | up to 8 (one human each) | Bounded by total humans |
| Humans on the same screen, online | up to 4 | Nintendo caps this at 2 per console online; we can raise it because each screen only draws its own local views |
| Beyond 8 | Not planned | Would need more characters or variants (asset weight) and a bigger `Race`. The real games reach 12 online (Mario Kart 8 Deluxe) and 24 (Mario Kart World) |

Online tier also limits the *kind* of play: MK-2 (live ghosts) lets everyone race but remote humans can't hit each other; MK-3 (lockstep) allows full interaction up to the same 8.

**Situation by situation** (the scenarios from [§2.2](#22-the-scenarios)):

| Situation | Setup | What each screen draws | How it runs | If something goes wrong |
| --- | --- | --- | --- | --- |
| **T1: everyone on one screen** (4 friends, one TV) | One screen shows its QR; four phones scan it and take seats | 2×2 split-screen, one view per human, seat-coloured borders; a 4-kart grid (no CPUs unless the host adds them) | One `Race`, all inputs local, no network; quality tier from view count | A phone drops → its kart is autopiloted for 30 s, then DNF; it can rejoin within the grace period and retake the kart at a safe moment |
| **T2: everyone on their own screen** (4 friends, 4 cities) | Host opens the room, shares the link; each friend opens it on their own laptop (a new screen) and scans *that screen's* QR with their phone | One full-screen view each; the other humans are karts in the world | MK-2: each screen runs its own `Race`, streams its pose, others are non-colliding ghosts. MK-3 (if the gate passes): lockstep, items hit across screens | A screen drops → its human seats are autopiloted for the grace period, then DNF. Under lockstep a late peer stalls everyone, so after a timeout all screens switch that seat to autopilot on the same tick |
| **T3: hybrid** (2 on the TV, 1 laptop, 1 tablet) | Each screen shows its own QR; each phone scans the screen it is next to | TV: two-view split. Laptop and tablet: full screen each | MK-2: the two on the TV collide normally (one `Race` for local seats); the laptop and tablet racers are ghosts. MK-3: everyone collides | Each screen picks its own quality tier from *its* view count, so a weak tablet doesn't drag the TV down. The host seat controls settings, as Nintendo does for shared consoles |
| **T4: spectator screen** (a second TV, a friend watching) | Opens the room link, no phone | Director camera: follows the leader with cuts | Receives snapshots; no sim of its own in MK-2 | Free to join or leave at any time |
| **T5: CPUs in the mix** | **Solo:** 1 human + 7 CPU as today. **Multiplayer: no CPUs by default**, so 6 humans race as a 6-kart grid. The host seat can change the **CPU field** setting: *None* (default), *Fixed* (choose a count up to the free slots, e.g. 6 humans + 2 CPUs), or *Fill to 8*. (Nintendo's Mario Kart World fills local multiplayer with CPU drivers up to its total ([Nintendo support](https://en-americas-support.nintendo.com/app/answers/detail/a_id/68610)); we deliberately default to humans only.) | Nothing extra: CPUs are drawn like any kart | Existing `cpuInput`, seeded so every screen sees the same CPUs | Solo with 7 CPUs is exactly today's game, pinned by golden tests |
| **One human tries to start Multiplayer** | Lobby has one ready human | n/a | **Start is disabled**: "Waiting for another player: scan the QR on a screen". A lone human can start Solo instead | n/a |
| **Falls below 2 humans mid-race** | One of two humans leaves for good | n/a | After the grace period the leaver is DNF; the remaining human finishes the race; the match is `abandoned` and issues no ranked result ([§2.7](#27-modes-start-rules-and-match-setup)) | Never silently becomes Solo |
| **Late join / leave** | A new phone joins during a race | Waits as a spectator, gets a seat next race | n/a | Seats are only added between races |

Two rules make this tractable: **rendering is per screen and the simulation never depends on it** (the fixed 120 Hz step keeps running regardless of frame rate), and **a seat is just an input source** (local phone, remote phone, or AI), so the same `Race` code serves every situation.

**Tests:** N-human `Race` determinism (seeded golden); **grid sizes 2, 3, 5 and 8 end correctly** (the 8-finisher rule gone); start boost per human; finish order with humans only and with mixed humans/CPU; first-human-finishes window and DNF; item odds normalised for small N, including N = 1 and 2; compact grid and rematch order; Solo (1 human + 7 CPU) identical to the pre-refactor golden race; Start gate refuses 1 human in Multiplayer; layout rects for 1–4 views; screenshot regression for the single view; state-hash agreement (MK-3).

**Acceptance:** MK-1 four humans on one TV at ≥30 fps as a 4-kart grid, then again with CPUs added by the host; Multiplayer refuses to start with one human and Solo still starts; 6 humans race as a 6-kart grid with no CPUs; a dropped phone's kart is autopiloted then DNF; MK-2 two remote humans plus a local pair race with ghosts across a tunnel; MK-3 a full race with zero hash mismatches and consistent item hits.

### 6.3 Slice Dojo

**Why Tier 1:** it is the only game with multiplayer today, so it is the fastest proof that the new platform (lobby, start gate, seats, results, rematch) works with a real-time shared board. Its rules (`FruitNinja` in [logic.js](games/fruit-ninja/logic.js)) are pure and already keep a `players: Map<slot, …>` with a trail, cursor, score and combo per seat.

#### 6.3.1 Gaps in today's Slice Dojo that multiplayer exposes

Read from [logic.js](games/fruit-ninja/logic.js) and [game.js](games/fruit-ninja/game.js):

| # | Gap | Where | Why it matters |
| --- | --- | --- | --- |
| 1 | **All gameplay randomness is `Math.random()`**: fruit kind, x, rise, spin, burst size, bomb roll. Only the critical-hit roll uses the injectable `rng` | [logic.js:36](games/fruit-ninja/logic.js#L36), [:133-145](games/fruit-ninja/logic.js#L133-L145), [:210-212](games/fruit-ninja/logic.js#L210-L212) | Two boards can't get the same fruit; results can't be replayed |
| 2 | **When two blades touch the same fruit in one frame, the lower slot wins**: the loop breaks at the first active blade in `Map` order | [logic.js:240-250](games/fruit-ninja/logic.js#L240-L250) | Slot 0 is quietly favoured; should be earliest phone timestamp |
| 3 | **A bomb ends the game for everyone**, and misses cost a shared pool of 3 lives | [logic.js:254-266](games/fruit-ninja/logic.js#L254-L266), [:288-294](games/fruit-ninja/logic.js#L288-L294) | Fine for co-op; unusable for a competition (one player's mistake eliminates the rest) |
| 4 | **Difficulty doesn't depend on player count** (spawn interval 780 → 260 ms, bursts of up to 4) | [logic.js:197-203](games/fruit-ninja/logic.js#L197-L203) | Four blades on one fruit stream is easier than one |
| 5 | **The game starts when the page loads and any seat's A press restarts it** | [game.js:1087-1095](games/fruit-ninja/game.js#L1087-L1095), [:1231](games/fruit-ninja/game.js#L1231) | No start gate, no host, no countdown |
| 6 | **Results are one combined score** with a single `localStorage` best; per-player scores only show on the in-game scoreboard while more than one phone is connected | [game.js:1037-1045](games/fruit-ninja/game.js#L1037-L1045), [:1060-1080](games/fruit-ninja/game.js#L1060-L1080) | No per-player results screen, no winner, nothing for `match.finish` |
| 7 | **Field width follows the window aspect** (`w = FIELD_H × aspect`) and fruit are spawned across `w` | [logic.js:42](games/fruit-ninja/logic.js#L42), [:134](games/fruit-ninja/logic.js#L134) | Boards on a wide TV and a narrow laptop get different fruit even with one seed |
| 8 | **Variable-step physics** (`update(now, dt)` from the render loop) | [logic.js:205-235](games/fruit-ninja/logic.js#L205-L235) | Same seed gives slightly different flights at different frame rates |
| 9 | **Only slot 0's sensitivity is saved**; the others reset every session | [game.js:850-852](games/fruit-ninja/game.js#L850-L852) | A faster-tuned blade is an unfair edge in a competition |
| 10 | Good already: a blade that stops sending updates for 200 ms is dropped, so a sleeping phone leaves no ghost blade | [logic.js:229](games/fruit-ninja/logic.js#L229) | Keep this |

#### 6.3.2 Modes

Declared in `game.json`; Multiplayer needs 2+ humans and is humans-only by default.

| Mode | Rules | View policy | Where it works |
| --- | --- | --- | --- |
| **Solo** | Today's game: 3 lives, bombs end the run | Shared view | One screen |
| **Co-op** (Multiplayer) | Today's shared-lives game for 2–4: one shared pool, shared score plus per-player contribution; difficulty scales with seat count (my starting point: spawn rate × (1 + 0.4 × (N − 1)), to be tuned by playtest) | Shared view (one board) | **All seats on one screen** |
| **Battle** (Multiplayer) | **Timed round** (60 s default, 90 s option) on one shared board. Per-player score; a bomb costs **only the slicer** 10 points (the existing `BOMB_PENALTY`); misses are free; highest score wins, ties broken by best combo | Shared view (one board) | **All seats on one screen** |
| **Race** (Multiplayer) | **One board per seat**, same seed, same fixed 16:9 field, timed round with Battle's bomb rule. Local seats on a screen split it into boards; remote seats play on their own screens; ranked by score. Fair because everyone gets the same fruit | **Per-player view** (reuses `core/multiview.js`) | Any topology: T1 split-screen, T2, T3 |

The lobby greys out Co-op and Battle when seats are on more than one screen ("needs everyone on one screen") and always offers Race. Real-time slicing on a shared board can't tolerate the delay of remote players (a remote screen sees the board about 150 ms late), which is why remote players get Race, not a shared board. Battle follows the model of Fruit Ninja's own timed Arcade mode (recalled, not verified in this session).

#### 6.3.3 Scenario book

**When:** **M3a** = local Slice Dojo milestone, **M7** = online/Race milestone, **later** = polish.

**A. Who is playing where**

| ID | Situation | What happens | When |
| --- | --- | --- | --- |
| A1 | Solo | Today's game unchanged (golden-tested), with the new results screen | M3a |
| A2 | 2–4 humans, one screen, Co-op | Shared lives and board; each blade its own colour; team score with each player's contribution | M3a |
| A3 | 2–4 humans, one screen, Battle | Timed; per-player scores; winner at 0:00 | M3a |
| A4 | 2–4 humans, one screen, Race | Screen splits into one board per seat (cap 4), same seed | M7 |
| A5 | All remote, Race (T2) | Each screen runs its own board; live scoreboard from the others at ~4 Hz | M7 |
| A6 | Hybrid, Race (T3) | TV splits into boards for its seats; laptop shows one board; one ranking across all seats | M7 |
| A7 | Co-op or Battle with seats on two screens | Greyed out in the lobby with the reason; Race is offered instead | M3a |
| A8 | One human tries Multiplayer | Start disabled with the reason | M3a |
| A9 | Spectator screen | Snapshots at ~20 Hz of a board, or a leaderboard in Race | M7 |
| A10 | Host adds a bot blade (opt-in) | A seeded bot slices with a human-like delay and miss rate by skill level; it doesn't count toward the 2-human minimum | later |

**B. Slicing fairness**

| ID | Situation | What happens | When |
| --- | --- | --- | --- |
| B1 | Two blades hit the same fruit in one frame | **Earliest phone timestamp** (mapped to host time) wins; on an exact tie the winner alternates by fruit id so slot 0 isn't always favoured. One fruit never scores twice | M3a |
| B2 | A phone sleeps or drops mid-swing | Existing 200 ms staleness guard removes the blade; the seat idles | M3a |
| B3 | Different phone sensitivities | Sensitivity is saved **per phone** (by device token, not slot) and shown on the lobby; Battle and Race can optionally lock a shared sensitivity | M3a |
| B4 | A faster blade in Race | Same fruit for all, so skill decides, not luck | M7 |
| B5 | Combo attribution | Per player (exists); the shared banner shows whoever extended a streak last | M3a |

**C. Rules and scoring**

| ID | Situation | What happens | When |
| --- | --- | --- | --- |
| C1 | Bomb in Co-op | Fatal for the team, as today (host option: cost 10 points instead) | M3a |
| C2 | Bomb in Battle or Race | −10 for the slicer only; their combo resets; the round continues | M3a |
| C3 | A fruit falls uncaught in Co-op | A shared life is lost | M3a |
| C4 | A fruit falls uncaught in Battle or Race | Nobody is penalised | M3a |
| C5 | Time runs out | Round ends at 0:00 on the host's clock (Race: each board on the shared start time); everyone sees the same final scores | M3a |
| C6 | Tie for first | Co-winners; the tiebreak shown is best combo | M3a |
| C7 | Difficulty with more players | Spawn rate scales with seat count in Co-op (starting formula above), lighter in Battle; tuned by playtest | M3a |

**D. Round flow**

| ID | Situation | What happens | When |
| --- | --- | --- | --- |
| D1 | Starting | No auto-start at page load. Host-only Start after the gate, then a 3-2-1 countdown | M3a |
| D2 | Results | Per-player rank, score, fruit sliced, best combo, bombs hit; winner banner; Co-op shows team score and each contribution; `match.finish` emitted | M3a |
| D3 | Best scores | Stored per mode (not one shared key) | M3a |
| D4 | Rematch | Same seats, new seed by default (host can keep the seed); no menu round-trip | M3a |
| D5 | Back to menu | Returns to the menu inside the same room ([P1b](#p1b-the-game-menu-and-lobby-entry-m)) | M3a |
| D6 | Late joiner | Spectates until the next round | M3a |

**E. Drops and leaves**

| ID | Situation | What happens | When |
| --- | --- | --- | --- |
| E1 | A phone drops mid-round (Battle, Race) | Grace period 30 s; the seat idles and keeps its score; if it returns it resumes | M3a |
| E2 | A phone drops mid-round (Co-op) | Seat idles; the team continues | M3a |
| E3 | The grace period expires | The seat is marked "left"; in Battle or Race it is ranked below everyone who finished | M3a |
| E4 | Humans fall below 2 | `abandoned` per [§2.7](#27-modes-start-rules-and-match-setup); no ranked result | M3a |
| E5 | A screen drops in Race | Its seats idle and are marked left after the grace period | M7 |

**F. Network and determinism**

| ID | Situation | What happens | When |
| --- | --- | --- | --- |
| F1 | Race start sync | The relay sets the start time; each screen counts down against its own clock offset to the relay; each board's fruit schedule is relative to its own start, so a few ms of skew is fair | M7 |
| F2 | Different screen aspect ratios | **Fixed 16:9 logical field** in Race (letterboxed), so every board spawns identical fruit; Co-op and Battle keep today's aspect-following field | M3a (field) / M7 |
| F3 | Different frame rates | **Fixed-step** simulation (P3) so one seed gives one result | M3a |
| F4 | Final scores | Each screen sends its score and log; the Node verifier replays seeded spawns and the logged cursor stream and confirms the score ([P5](#p5-determinism-and-replay-m)) | M7 |
| F5 | Lost or late score updates | The live scoreboard is advisory; final scores come from the logs | M7 |

**G. Fairness limit:** nothing stops a script from driving a blade perfectly. A slice-speed cap and plausibility checks on the cursor path catch crude bots; the rest is social.

#### 6.3.4 Pieces to build and how they are tested

- **Rules:** seeded `rng` through every spawn and roll; per-player lives/bomb/score rules by mode; earliest-timestamp cut arbitration; seat-count scaling; timed rounds; fixed step; fixed 16:9 field in Race.
- **Round flow:** start gate, host-only start, countdown, results with per-player stats, per-mode bests, rematch, back to menu.
- **Race:** per-seat boards via `core/multiview.js`, live scoreboard, start sync, log and verifier.
- **Tests:** seeded spawn sequence reproduces; same seed on two fixed-step runs gives identical scores; B1 arbitration including exact ties; Co-op and Battle bomb/miss rules per mode; timed end and tie-break; below-minimum handling; Solo golden (a seeded solo run matches the pre-refactor result apart from the deliberate changes); Race boards with different aspect ratios spawn identical fruit.
- **Acceptance:** Solo unchanged; 2 to 4 phones play Co-op and Battle on one screen to a per-player results screen and rematch; Multiplayer refuses to start with one human; Race runs as split-screen on one screen, across two remote screens, and across a TV plus a laptop; the verifier confirms a Race score.

---

## 7. Tier 2: Kart Time Trial, Island Flyover, Table Tennis, Swordplay

### 7.1 Kart Time Trial and Island Flyover (per-player view)

Reuse `core/multiview.js` and the seat/screen model from Kart Rush; both scenes are small, so four views should be cheap (verify). Modes: **Solo** as today; **Multiplayer** (2+ humans, humans only by default, same start gate and match setup as Kart Rush): **split-screen race** (T1), **live-ghost race** (T2/T3), best-lap **ghost from a stored log**; pace-bot seats are an opt-in from the host; same topology behaviour as Kart Rush. Island Flyover: same course, first to collect all 20 points or most in the time limit.

### 7.2 Table Tennis (AI kept; shared view)

- `Rally` generalises from `player`/`ai` to two **sides**, each `controller: 'human' | 'ai'`. **Side B with `ai` runs the existing AI code unchanged**, so **Solo (1 human vs AI) is exactly today's game** (golden-tested).
- **Multiplayer** (needs 2 humans; no AI by default): **human vs human**. The host can pick **Co-op vs AI** (two humans on one side against the AI, party-game style); doubles (4 humans) is a stretch. A human who drops: play pauses for the grace period, then the match is forfeit (it is below the 2-human minimum).
- Real rules: serve alternates every two points; first to 11, win by 2; optional serve-must-bounce-first.
- **Camera:** a three-quarter broadcast camera from the side and above so neither human faces a tiny far paddle; mirror each pointer's mapping to its side. Playtest behind-the-end versus side-on. Shared-view policy, so the same camera on every screen.
- A hit is judged at the phone timestamp mapped to host time (clock sync). Remote *players* are LAN-first; remote spectators use snapshots.

**Acceptance:** solo vs AI unchanged; two phones play to 11 win-by-2; reconnect mid-rally keeps the seat; 60 fps host.

### 7.3 Swordplay (AI kept; shared view)

- **Solo** (human vs AI) is **today's duel, untouched** (telegraph, strike, block by blade geometry).
- **Multiplayer** (2 humans, no AI) needs different rules, because the AI state machine can't be a human: **alternating initiative**. One player attacks for a fixed window while the other defends, then they swap. The attacker swings along an angle; the defender blocks if the blade is within `BLOCK_TOLERANCE` of perpendicular at the moment of impact (the existing geometry), otherwise the attacker scores. Alternating roles hides latency because the defender holds a pose rather than reacting. First to 3.
- Optional later: free-fight with a stamina meter (LAN only).
- A human who drops: play pauses for the grace period, then the match is forfeit (below the 2-human minimum).

**Acceptance:** Solo vs AI unchanged; Multiplayer refuses to start with one human; two phones duel to 3 with no hit decided by network jitter.

---

## 8. Tier 3: Shooting Range, Alien Attack, Sketch

All shared-view (Sketch also per-seat private info; Alien Attack's race mode is per-player view). Slice Dojo moved to Tier 1 ([§6.3](#63-slice-dojo)). Each has a **Solo** mode as today (Sketch: free draw) and a **Multiplayer** mode that needs 2+ humans and is humans-only by default; the AI column below is an opt-in the host can add ([§2.7](#27-modes-start-rules-and-match-setup)).

| Game | Multiplayer modes | AI seat (opt-in) | Key work |
| --- | --- | --- | --- |
| **Shooting Range** | **Free-for-all** on shared targets with timestamp arbitration; race-the-seed (same sequence per screen); steal mode | Bot crosshair | Per-slot crosshairs; arbitration needs clock sync |
| **Alien Attack** | **Co-op** (`ships[]` share forward `z` and the alien stream, revive pickup), **Versus** (kill-credit), **race** (per-player view, live ghosts) | AI wingman | `Patrol` with `ships[]`; race mode uses the per-player-view policy and `core/multiview.js` |
| **Sketch** | **Draw-and-guess**: rotating drawer gets a private prompt on their phone; others guess on phone keyboards; faster guesses score more | AI guesser (stretch) | Phone text/prompt panel; stroke stream to remote screens; the best fully-remote party game (small data, no latency sensitivity) |

**Acceptance (each):** Multiplayer refuses to start with one human; works in T1, T2, T3 where applicable; humans-only by default and with host-added AI; reconnect keeps the seat; deterministic with a seed; replay verifies.

---

## 9. Testing strategy

| Layer | What | How |
| --- | --- | --- |
| Rules | Multiplayer logic per game, AI behaviours | `node --test` on `logic.js`, seeded; **golden replays** of solo-vs-AI recorded *before* each refactor |
| Relay | Rooms, seats, screens, reconnect, hardening | Node tests with `socket.io-client` fake phones |
| Topologies | T1, T2, T3 per game | Fake phones bound to different screens; assert the right views, scores, ghosts |
| Phones | Pacing, latest-wins, sequence handling | Simulated phones at 60/30 Hz |
| Network | Delay, jitter, loss | TCP delay proxy |
| Views | Layout rects for 1–4 views; single-view look unchanged | Unit tests on `ViewLayout`; Playwright screenshot regression |
| End to end | 2–4 virtual controllers driving a real game tab | Playwright |
| Determinism | Replay, flight agreement, lockstep hashes | Verifier in CI; two-engine tests |
| Performance | Frame time, draw calls, load bytes per view count | Playwright trace plus `renderer.info`; fail on budget regression |
| Real devices | iPhone Safari, mid and low-end Android Chrome | Written checklist per release; log `link.rate` per model |
| Humans | "Dare nights" | Join time, rematch rate, confusion points |

---

## 10. Order of work

Dependency order; parallelise by stream. The four-week calendar to the event is tight for everything; the order below puts the Tier 1 games on the critical path and everything else behind them.

| Stream | Work |
| --- | --- |
| **Menu** | P1b step 1 (list all ten games, mode chips) → step 2 (mode sheet, lobby, host setup on the phone, room survives navigation) |
| **Netcode/server** | P0 harness → P1 rooms/seats/screens → P4 transport, clock sync, snapshots, tunnel → P5 replay |
| **Input/controller** | P2 per-seat pointers, calibration, per-mode phone UI, pacing |
| **Kart Rush** | Spike S1 → refactor steps 1–2 → multi-view → tiers → online tiers |
| **Golf** | Course/Round/AI golfers → local → online |
| **Slice Dojo** | Seeded rules, modes, results and start gate → local → Race (split-screen and online) |
| **Performance/assets** | §5.1 baseline → compression, Three.js min, glTF/KTX2, audio, service worker, governor (can start immediately; needs no game changes) |
| **Tier 2 and Tier 3** | Only after the Tier 1 games pass their acceptance bars |

| # | Milestone | Depends on |
| --- | --- | --- |
| M0 | Green baseline, fake-phone harness, perf baseline, spikes S1 and S2 | none |
| **M0a** | **Menu step 1:** all ten games listed in the agreed order with mode chips and "preview" badges; `game.json` `modes` read by `/api/games`; Solo launches unchanged ([P1b](#p1b-the-game-menu-and-lobby-entry-m)) | none (can start now) |
| **M0b** | **Rename pass (code), first stage done:** the platform name on the controller, menu, server, titles and docs, plus the Kart Rush and Slice Dojo titles ([§5e.4](#5e4-rename-pass-first-stage-done)). Remaining and optional: folder and URL renames with redirects, settings-key migration | none |
| **M1a** | **Hosting and first run:** cross-platform browser launch, a sensible LAN address with a self-test page, a pure-JS certificate, `PUBLIC_URL`, build handshake, screen start gate and capability check, plain-language failure screens, hosted-relay deployment ([§5b](#5b-hosting-distribution-and-first-run)) | M0 |
| M1 | Rooms, stable seats, **screens**, per-screen QR, lobby; fake phones on two screens; **menu step 2** (mode sheet, host-only launch, setup on the host's phone, room survives page navigation, back to menu keeps the room) | M0, M0a |
| M2 | Per-seat input, match framework (**mode, start gate, match setup, drop policy**), fixed-step runner, seat controllers (human, AI, autopilot) | M1 |
| **M2a** | **Controller v2:** seat colour, number and shape; device-token seats; profiles (join, lobby, host lobby, pointer, wheel, swing, flight, keyboard, watch, results, away); scoped commands; 48 px targets; touch and gamepad fallbacks; capability handshake; versioned messages; safety screen ([§5a](#5a-the-controller-the-phone)) | M1 |
| ~~M2b~~ | **Deferred (partner tracks, later): the partner-track seams** (integration registry and the seven contracts with mock and no-op providers, `PARTNERS` flag, canonical encoding with test vectors, the outbox, contract tests, placeholder UI) ([§5f](#5f-designing-part-a-for-the-partner-tracks)). Not on the current work list | none |
| **M2c** | **Manifest v2 and stable ids:** a validated manifest for all ten games (namespaced `gameId`, scoring, stats, verification tier, modes), `/api/games` serving manifests, scoped storage keys, the generic `ResultV1` and `ReplayV1` envelope ([§5g.3](#5g3-game-manifest-v2), [§5g.4](#5g4-game-ids-versions-and-bundle-hashes), [§5g.6](#5g6-scoring-stats-and-results-for-any-game)) | M0a, M2 |
| M3 | **Golf local:** Course/Round, `TurnManager`, address step, out-of-bounds, stroke cap, fixed-step flight, camera director, AI golfers, scorecard (T1); all scenario rows marked M3 in [§6.1.4](#614-scenario-book) pass | M2, M2a, S2 |
| **M3a** | **Slice Dojo local:** seeded rules, fixed step, Solo/Co-op/Battle modes, start gate and host-only start, per-player results and per-mode bests, earliest-timestamp cut arbitration, per-phone sensitivity, rematch (T1); all scenario rows marked M3a in [§6.3.3](#633-scenario-book) pass | M2, M2a |
| M4 | **Kart Rush refactor:** `ChaseCamera`/`RaceHud`/audio extracted, `Race` generalised, regression tests green | M0 |
| M5 | **Kart Rush MK-1:** multi-view, per-seat character select, tiers, **N-kart grid (humans only by default), CPU-field option, 2-human start gate**, autopilot on drop (T1) | M2, M2a, M4, S1 |
| **R** | **Original Kart Rush pack:** replace the Nintendo-derived characters, kart, course, music, effects, voices, UI and item art and names; the new course is built for the web (a few MB) ([§5e.2](#5e2-assets-renaming-does-not-fix-this)). **Required before anything public** | M4 (can start there) |
| M6 | Online foundations: tunnel, clock sync, screen binding, snapshots | M1, M2 |
| M7 | **Golf online** (T2, T3, ready golf, hybrid); **Kart Rush MK-2** live ghosts (T2, T3); **Slice Dojo Race** (split-screen via `core/multiview.js`, T2, T3, verifier); every scenario row marked M7 passes. **Tier 1 acceptance bar for all three games** | M3, M3a, M5, M6 |
| **M7a** | **Party and polish:** settings, onboarding and how-to-play cards, player profiles, pause semantics, changes between matches, spectator reactions ([§5d](#5d-product-details-the-first-plan-missed) D1–D3, D6, D7, D9) | M2a, M3a |
| M8 | **Tier 2** (starts only after M7): Table Tennis; Swordplay; Kart Time Trial and Island Flyover on `core/multiview.js` | M7 |
| **M8a** | **Groups larger than two and series:** Pick two, Winner stays and Bracket for the two-player games; party-mode playlists with cumulative points ([§5d](#5d-product-details-the-first-plan-missed) D4, D5) | M8 |
| **SDK-1** | **Extract and freeze the game SDK** from the three Tier 1 games; they run on it and stop importing `core/*`, the socket and `localStorage` directly ([§5g.5](#5g5-the-game-sdk-contract)) | M7 |
| **SDK-2** | **Creator foundations:** dev-mode sideloading, the sandboxed iframe host with its message bridge and CSP, the verifier sandbox, the validator, the template game and the docs ([§5g.8](#5g8-running-untrusted-games-safely), [§5g.10](#5g10-creator-tooling-and-documentation)) | SDK-1 |
| **SDK-3** | **Registry and publishing:** the registry client, submissions, review, versioned publishing, unlisted mode ([§5g.9](#5g9-the-catalogue-from-a-folder-scan-to-a-registry), [§5g.11](#5g11-publishing-review-and-policy-later)). Starts only after at least one outside creator has used SDK-2 | SDK-2 |
| M9 | **Tier 3** (starts only after M8): Shooting Range, Alien Attack, Sketch | M8 |
| M10 | Kart Rush MK-3 lockstep spike and decision | M7, P5 |
| W | Web weight and performance workstream (compression, glTF, audio, caching, service worker, governor) | runs alongside from M0 |
| M11 | `pre-hackathon` baseline tagged; **R complete**; `PRE_EXISTING.md` written; names cleared. *(Partner-track seams frozen and tested against mocks is deferred with M2b.)* | all in scope |

**Rough sizes** (my estimates; **S** a few days, **M** about a week, **L** several weeks, for one engineer): M0 S · M0a S · M0b S–M · M1 M · M1a M · M2 M · M2a M–L · M2b M · M2c S–M · M3 M · M3a M · M4 M · M5 L · R L (content work: models, a course, audio, UI) · M6 M · M7 L · M7a M · M8 L · M8a M · M9 L · M10 M · W L · SDK-1 L · SDK-2 L · SDK-3 L · M11 S. The sum is well over a month for one person, so the order above decides what survives a short calendar: the menu, Controller v2, hosting and first run, then the three Tier 1 games, then R before anything is shown publicly.

The menu (M0a) needs nothing else and goes first. After M1/M2 land, three engineers can run Golf (M3, M7), Slice Dojo (M3a, M7) and Kart Rush (M4, M5, M7) in parallel; M4 needs only M0, and Slice Dojo Race at M7 needs `core/multiview.js` from Kart Rush's M5. If there are fewer people, do them in the order Slice Dojo, Golf, Kart Rush for quick wins, or Kart Rush first if its split-screen risk is the thing to retire early.

---

## 11. Why this is worth building

Strength: **A** primary/official, **B** secondary or dated, **C** commissioned or promotional.

| Claim | Evidence | Str. |
| --- | --- | --- |
| Phone-as-controller on a shared screen is a proven mass format | AirConsole: 7M+ players, 190+ countries, 4,500+ developers, average 65 min with 3 people at one screen, +500% usage early in the pandemic (company release, Sept 2020; [source](https://www.airconsole.com/games/airconsole-takes-on-nintendo-switch-and-ps4-by-bringing-console-games-to-the-web)) | B |
| At far larger scale, and works remotely | Jackbox: Party Pack series "joined … over 826 million times since December 2022" (company, May 2026; sessions not people; [release](https://indigo-pearl.prezly.com/the-party-returns-to-tens-of-millions-of-players-jackbox-games-announces-the-jackbox-party-pack-12)); playerbase 100M to 200M in 2020 ([Wikipedia](https://en.wikipedia.org/wiki/The_Jackbox_Party_Pack), [DualShockers/Bloomberg](https://www.dualshockers.com/jackbox-games-200-million-players-bloomberg-report/)) | A/B |
| Mixed local-and-online play is a normal expectation for flagship party games | Mario Kart 8 Deluxe: two local players can play online from one console ([How-To Geek](https://www.howtogeek.com/306445/how-to-play-mario-kart-with-your-friends-on-the-nintendo-switch-online-and-in-person/)); Mario Kart World online 2–24 players, up to two per console ([Nintendo](https://en-americas-support.nintendo.com/app/answers/detail/a_id/68610)) | A |
| Betting with friends is mainstream and stable | Pew: 15% of US adults bet with friends or family in the prior year, the most common way, in 2022 and 2025 ([2022](https://www.pewresearch.org/short-reads/2022/09/14/as-more-states-legalize-the-practice-19-of-u-s-adults-say-they-have-bet-money-on-sports-in-the-past-year/), [2025](https://www.pewresearch.org/short-reads/2025/10/02/americans-increasingly-see-legal-sports-betting-as-a-bad-thing-for-society-and-sports/)) | A (US) |
| Betting is social | Entain: 55% of 2,000 Britons say betting and gaming are social ([coverage](https://igamingfuture.com/entain-study-shows-brits-see-gambling-as-highly-social/)) | C |
| Friends track bets badly | Puntaa (2015): spreadsheets, Messenger, bank transfers ([article](https://direct.businessnewsaustralia.com/articles/app-cashes-in-on--punting-peers-.html)) | B |
| Play-money friend-bet apps exist | iBETcha ([Dealroom](https://app.dealroom.co/companies/ibetcha)); YouBetMe ([WeWork](https://www.wework.com/ideas/?p=12042)) | B |
| Stakes change behaviour | stickK: 5,024 weight-loss contracts, average loss 7.7% with an anti-charity stake vs 3.4% with none ([APHA abstract](https://aphanew.confex.com/apha/142am/webprogram/Paper305254.html)); observational, self-reported | B |
| P2P wager join UX is understood | FairWins: QR or four-word code ([docs](https://docs.fairwins.app/system-overview/how-it-works/)) | B |
| Web3 gaming draws attention | DappRadar, Oct 2025: 16M daily active wallets, gaming 27.9% of dapp activity ([Cointelegraph](https://cointelegraph.com/news/web3-gaming-defi-activity-october)); wallets are not players; no retention data found | B |

**Not shown by any source:** demand for web3 plus phone controllers plus friends as a combination. Don't cite the Kutt survey ([article](https://profluence.com/kutt-raises-over-1-million-in-funding-a-booming-social-betting-platform/)); a social-betting company commissioned it.

**Cheap validation during Part A:** run two "dare nights" as soon as Golf local (M3) works. Measure time from QR scan to first stroke (target median under 60 s), rematch requests (target half or more), and confusion points, especially around which screen to scan in a hybrid room. My thresholds, not benchmarks.

---

## 12. Part B: track integrations (at the hackathon)

> **Deferred: not being worked on now.** Kept as a plan for later. When the game side is done and the partner briefs are out, start from [§5f](#5f-designing-part-a-for-the-partner-tracks), then this section.

**Leading picks: Arkiv, ENS, World. Chainlink is the spare.** Final three chosen when full briefs are out; nothing here is committed. You can select up to three partners (multiple tracks of one partner count once) ([rules](https://ethglobal.com/events/mumbai/info/details)). Today 10 of 12 sponsors still say "details coming soon" ([prizes](https://ethglobal.com/events/mumbai/prizes)).

**What Continuity implies.** Sibling-event briefs, as a hint only ([New York 2026](https://ethglobal.com/events/newyork2026/prizes)): World's Continuity track wanted a "concrete plan for what will ship during the hackathon"; ENS's wanted you to "clearly state what ENS feature was built during the hackathon" and required **no hard-coded values**; Chainlink required the integration to **cause an on-chain state change**. So Part A is the documented pre-existing base, and the track work is visibly new.

**Seams Part A leaves ready**

The contracts, data formats, lifecycle and placeholder UI are specified in [§5f](#5f-designing-part-a-for-the-partner-tracks); this table is the short version.

| Seam | Part A provides | Part B plugs in |
| --- | --- | --- |
| Player identity | `playerId`, handle, colour per seat | Session key, World proof, ENS name |
| Room name | 6-char room code, per-screen QR | ENS subname resolving to the room |
| Seed source | Local seeded RNG per match (Golf course, Kart Rush race) | Chainlink VRF seed (spare) |
| Result sink | `match.finish({ scores, winner, seed, log })` | Arkiv Result and Replay entities, signed by players |
| Replay | Log format and Node verifier | Replay stored on Arkiv |
| Guest vs ranked | Guests play anything | Verified players get ranked results, only for matches that started and finished with the minimum humans ([§2.7](#27-modes-start-rules-and-match-setup)) |
| Result idempotence | A unique `matchId` on every `match.finish` | The Arkiv Result is keyed by `matchId`; the relay drops a duplicate post |
| Consent and privacy | Opt-in prompt on each phone at result signing | Scores and hash by default; the replay only with the players' explicit opt-in; nicknames only ([§5c.3](#5c3-privacy)) |
| Sponsor wallet | Relay-held key, per-room and per-IP write caps | Writes only for completed matches with the minimum humans ([§5c.2](#5c2-security-and-content)) |
| Settlement | The `Settlement` hook at `match.finish` and the abandon and walkover rules | A stake or pot module, only if the held decision is made ([§13](#13-decisions-held-until-the-briefs)) |

**Arkiv.** Entities carry a payload (≤128 KiB), typed attributes, an expiry in 2-second blocks, and system attributes `$owner`, `$creator`, `$expiresAt`; queries are boolean expressions returning newest first, 200 per page; only the owner can update or transfer, and `changeOwnership()` exists ([fundamentals](https://docs.arkiv.network/start-here/fundamentals/), [SDK docs](https://arkiv.dev.golem.network/docs/sdk)). Package `@arkiv-network/sdk`; faucet at `hub.arkiv.network/faucet`. The docs name the testnet inconsistently (Mendoza, Kaolin, Tiramisu); pin an SDK version and re-check on day one.

| Entity | Expiry | Attributes | Payload |
| --- | --- | --- | --- |
| Lobby | 2 h | `app`, `type=lobby`, `room`, `game`, `status` | Join URL, seats, screens, mode |
| Result | long-lived | `app`, `type=result`, `game`, `room`, players, `winner`, `playedAt` | Scores, log hash, signatures |
| Replay | 30 days | `app`, `type=replay`, `matchId` | Compressed log, game version |

A relay-held sponsor wallet pays GLM; both player addresses are attributes so "my results" is a query. Stretch: `changeOwnership()` to each player. A 3-minute two-phone match at 60 Hz is roughly 170 KB raw; delta-encode and gzip or chunk. Golf and lockstep Kart Rush logs are far smaller (events and inputs, not samples). Never block gameplay on a write.

**ENS.** Parent name on a testnet; many cheap subnames via **offchain CCIP-Read subnames**, which resolve like onchain names including text records but don't appear as NFTs ([ENS docs](https://docs.ens.domains/web/subdomains); named providers: Namespace, and the open-source `gskril/ens-offchain-registrar`; testnet support per provider unconfirmed). **Room name:** `lucky-otter.play.<parent>.eth` resolves to the room URL. **Player names:** claimed at first join by a signed message; text records for head-to-head record and the latest receipt. Resolve live in the UI; don't mint during a match.

**World.** IDKit 4.x: the server signs `rp_context` (never on the client), the phone completes the proof, the server forwards the result unchanged to `POST https://developer.world.org/api/v4/verify/{rp_id}`, checks `success` and `environment`, then stores the nullifier under a unique `(nullifier, action)` constraint because the portal doesn't check reuse ([docs](https://docs.world.org/world-id/idkit/integrate)). Use one action and enforce per-room uniqueness with a `(room, nullifier)` constraint; bind the signal to `hash(room ‖ sessionAddress)`; reject `staging` proofs in production mode. **Identity gap:** World gives a nullifier, not an address, so the phone generates a session keypair (viem) in IndexedDB that the proof's signal binds to; a sponsor wallet pays all fees. **Check early:** Orb access in India; Worldcoin paused Orb verification there in December 2023 ([TechCrunch](https://techcrunch.com/2023/12/20/worldcoin-is-no-longer-offering-orb-verification-in-india-brazil-and-france)) and I found no report of resumption. Held per your note; the guest/ranked split means the games work regardless.

**Chainlink (spare).** VRF v2.5 on Base Sepolia (min. confirmations 0, native-token payment) or Sepolia (3) ([networks](https://docs.chain.link/vrf/v2-5/supported-networks)); Mumbai isn't listed (Polygon's testnet is Amoy). One small `RoomSeed` contract stores `seedOf[roomId]` and emits `SeedSet`, a real on-chain state change. The seed (Golf course, Kart Rush race seed) is fetched in the lobby, never mid-play; fulfilment latency isn't documented, so promise no number and fall back to commit-reveal after ~20 s.

### 12.1 Event-day plan, submission and demo

An earlier version of this plan had these; they were dropped in a rewrite and are restored here.

**Before the event (Part B prep, not Part A):** a World developer app and signing key; Arkiv faucet funds and the SDK version pinned; an ENS testnet parent and a confirmed offchain-subname provider; a funded VRF subscription on Base Sepolia; a hosted relay already running ([§5b](#5b-hosting-distribution-and-first-run)); the briefs re-read the week of the event. Prototype each integration in a **scratch repo, not the game repo**, so the event commits are visibly the new work.

**What is built at the event** (my estimates for one engineer each): Arkiv Dare, Result and Replay entities, queries and the receipt page, 6–8 h; ENS offchain subnames, live resolve and text records, 4–6 h; World gate with server verification and the nullifier table, 4–6 h; Chainlink `RoomSeed` contract and relay listener, 4–6 h; demo, video and write-up, 6 h. Everything in Part A is the documented pre-existing base.

**Submission rules** (from the [details page](https://ethglobal.com/events/mumbai/info/details)):

- Up to **three partner prizes**; a partner's several tracks count as one. Select them on the submission form with a short note on how each is used.
- **Continuity:** document pre-existing work versus new work (`PRE_EXISTING.md`); the git history must show the event's commits clearly. Commit in small steps throughout; a single large commit can disqualify.
- **AI use must be documented** (where and how, specific files), AI should assist rather than build the whole project, and any spec or prompt files are included in the repo.
- **Demo video:** 2–4 minutes, at least 720p, recorded on a computer (not a phone), a person speaking, no text-to-speech or AI voice, no sped-up footage, no music standing in for narration, introduction under about 20 seconds, no more than four bullet points per slide. It is optional but encouraged.
- **Finalist judging** (optional): 7 minutes, 4 for the demo and 3 for questions. Criteria: technicality, originality, practicality, usability, wow factor.
- **Deadline: 6 November 2026, 09:00 IST; late submissions are not accepted.** Stop building about 90 minutes before, at 07:30.
- Confirm the start time, team size and presence rules; the details page doesn't state them ([§15](#15-things-i-could-not-verify)).

**Demo script (under four minutes):**

1. The menu on the big screen with the QR and the room name; one sentence: *phones are the controllers, and every match leaves a receipt you own.*
2. Two phones scan; one verifies with World (on the staging simulator, labelled, if no Orb is reachable), the other joins as a guest; the guest badge shows.
3. Both sign the dare ("loser buys chai"); the VRF seed appears on every screen.
4. Play a short match of the flashiest finished Tier 1 game: Kart Rush split-screen if the original pack ([R](#10-order-of-work)) is done, otherwise Golf or Slice Dojo.
5. Both phones sign the result; open the receipt page; resolve the ENS name live; run the replay verifier in a terminal and show it agree.
6. A third phone on cellular joins a Race (the remote path).
7. Say what is new and what is pre-existing, in one sentence.

---

## 13. Decisions held until the briefs

| Decision | Status | What's ready either way |
| --- | --- | --- |
| Final three partners | Arkiv, ENS, World leading | Seams in [§12](#12-part-b-track-integrations-at-the-hackathon) |
| A pot / stakes | Held | `match.finish` is the only settlement hook; a stake module attaches there without touching games. Ladder below |
| World fallback if no Orb is reachable | Held | Guest/ranked split; staging simulator; Chainlink spare |
| Ethereum Foundation ($15,000) | Watch the brief | Session-key story fits the phone-held key |

**Stakes ladder, for when you decide.** S0: a forfeit (free text or presets) signed before the match and stored with the Result. S1: standing (rating, streak, head-to-head) computed from results. S2: a real-value pot via a contract. S0 and S1 give the betting feel without a money flow; S2 is a separate module on the same hook. A shareable receipt page ("asha.<parent>.eth beat ravi.<parent>.eth by 2 strokes at Golf; forfeit: chai") is the output either way. In Golf, a **team scramble where a team is a screen** and **skins** are natural homes for stakes.

---

## 14. Risks

| Risk | Response |
| --- | --- |
| Kart Rush split-screen can't hold frame rate | Spike S1 first; quality tiers and governor; cap local seats at 2 if needed; ship MK-2 online instead |
| Camera/HUD refactor changes the single-player look | Screenshot regression and golden seeded-race tests before each step |
| Generalising `Race` regresses solo play | Keep the single-human constructor; golden replays |
| Golf flight differs across engines | Spike S2; authoritative resting position reconciles |
| Table Tennis/Swordplay changes regress Solo vs AI | AI code untouched for AI-controlled sides; golden tests |
| **Kart Rush assumes 8 racers and one human** (race-end rule, grid, item odds, rubber-banding); a humans-only race could never end | The §6.2 table lists each assumption with its fix; tests for grid sizes 2, 3, 5, 8 |
| A 2-kart race feels flat without CPU traffic | Playtest item pacing at N = 2; host can add CPUs; consider closer item boxes for small grids |
| Multiplayer abandoned by walkover (one human leaves, the other "wins") | Match flagged `abandoned`; no ranked or staked result unless it started and finished with the minimum humans |
| Players confused why Start is disabled | The button states the reason and the next action ("scan the QR on a screen") |
| Per-screen QR confuses people in hybrid rooms | Big on-screen label "Scan to play on THIS screen"; dare-night observation |
| MK-3 lockstep desyncs across engines | Decision gate; V8-only hosts; state hashes; fall back to MK-2 |
| Quick tunnel doesn't carry WebSockets reliably | Test early; named tunnel; VPS |
| Real-time D games laggy over a tunnel | LAN-first; remote players get turn-based, ghost or lockstep |
| iPhone has no haptics | Visual and audio feedback beside vibration |
| In-app browsers block motion sensors | Detect and show "Open in Safari/Chrome"; test on devices |
| Asset optimisation breaks visuals | Compare screenshots per model; keep originals; repeatable script |
| Public relay abused | P1 hardening before anything is exposed |
| Scope: ten games, several modes, many topologies | Tier order; topology matrix tested per game; modes greyed rather than half-built |
| **Nintendo-derived models, music, voices and UI** ship in the Kart Rush pack, and a rename doesn't change that | Workstream **R**: replace them with original assets before anything is public; keep the old pack local and untracked; check whether any of it was ever committed to the public repository ([§5e.2](#5e2-assets-renaming-does-not-fix-this)) |
| The controller and menu look like Nintendo hardware and menu | Original Funcaster design ([§5a](#5a-the-controller-the-phone), [§5e.2](#5e2-assets-renaming-does-not-fix-this)) |
| Names are used before clearance | Formal trademark search (USPTO, EUIPO, WIPO, India) before the name goes on anything public ([§5e.1](#5e1-names)) |
| MIT notice stripped in the rename, or pre-existing work undocumented | Keep `LICENSE` and notices; write `PRE_EXISTING.md`; rename pass checklist ([§5e.3](#5e3-the-pre-existing-base)) |
| A phone's B or Home ends the game for the whole room | Scoped commands; match-level actions host-only or a vote ([§5a.5](#5a5-the-redesign)) |
| A phone sleeps and loses its seat | Device-token seats with a 30 s grace period ([§5a.5](#5a5-the-redesign)) |
| QR code points at the wrong network adapter, or no OpenSSL, so sensors never work | Interface selection, self-test page, pure-JS certificate ([§5b.2](#5b2-local-mode-failures-found-in-the-code)) |
| Stale cached build on one screen breaks a shared match | Build handshake ([§5b.3](#5b3-version-handshake)) |
| Player-supplied text injected into a screen (XSS) | `textContent` only, server-side trimming, lint rule ([§5c.2](#5c2-security-and-content)) |
| A player's phone is damaged by a swing | Safety screen, wrist-not-arm design, gentle mode ([§5c.1](#5c1-physical-safety)) |
| A remote screen's browser blocks audio, fullscreen or sleeps the display | Start gate, wake lock, visibility pause ([§5b.5](#5b5-screen-start-gate)) |
| A group of 3+ can't play a two-player game | Pick two, Winner stays, Bracket ([§5d D4](#5d-product-details-the-first-plan-missed)) |
| A partner brief fits none of the planned hooks | Hooks are capabilities (identity, naming, randomness, records, signing, settlement), not partners; the table in [§5f.8](#5f8-what-each-possible-partner-needs-from-part-a) covers the unlikely ones too |
| A result schema or id scheme has to change after something is published | Stable `gameId`, versioned schemas (additive only), canonical encoding and a stored hash algorithm, all fixed in Part A ([§5f.3](#5f3-data-that-must-be-fixed-now)) |
| Partner code or dependencies appear before the event and weaken the Continuity story | Interfaces and mocks only in Part A; no partner packages; event code under `integrations/` ([§5f.9](#5f9-repository-layout-and-continuity-hygiene)) |
| A chain or partner outage stalls a game or loses a result | Outbox, async calls, mock fallback, kill switch; gameplay never waits on a provider ([§5f.6](#5f6-degraded-and-offline-modes)) |
| The venue has no internet, or a LAN-only host cannot reach World or the chain | Falls back to `mock` automatically and says so; the hosted relay is the path for real integrations ([§5f.7](#5f7-infrastructure-to-plan-now)) |
| Two screens hash a result differently, so every signature fails | One canonical encoding, integer scores and times, relay timestamps, cross-engine test vectors ([§5f.3](#5f3-data-that-must-be-fixed-now)) |
| A third-party game steals data, calls out, or breaks the page | Sandboxed iframe on a separate cookieless origin, strict CSP with no network, a typed message bridge, no third-party code on phones ([§5g.8](#5g8-running-untrusted-games-safely)) |
| A breaking change to the SDK strands outside creators | Semantic versioning, an N-1 support window, a compatibility test suite, and freezing v1 only after three real games run on it ([§5g.1](#5g1-what-this-means-and-what-it-does-not)) |
| The platform is built before the games prove its shape | The rule of three and the stage gates (SDK-1 after Tier 1, SDK-2 after SDK-1, SDK-3 only once an outside creator exists) ([§5g.12](#5g12-how-it-is-staged)) |
| A third-party game reports fake results | The verification tier is always shown; `casual` and `attested` games are never ranked by default; third-party verifiers run in a sandbox ([§5g.7](#5g7-verification-tiers)) |
| IP problems arrive with third-party content (the Kart Rush pack shows how easily they happen) | Asset licence declarations in the manifest, review before listing, a takedown process, and starting with invited creators ([§5g.3](#5g3-game-manifest-v2), [§5g.11](#5g11-publishing-review-and-policy-later)) |
| Ids are squatted or reused | Immutable namespaced ids, registration for namespaces, ids never reused after withdrawal ([§5g.4](#5g4-game-ids-versions-and-bundle-hashes)) |
| Briefs published late and don't fit | Part A is independent of any partner; swap the third pick |

---

## 15. Things I could not verify

- **Real-game split-screen layout details:** I found frame-rate/resolution behaviour (30 fps for 3–4 players on Switch, per Nintendo Life) and player-count rules, but not the exact 2-player orientation or what the fourth quadrant shows in a 3-player game. Treat the layout rules in [§2.4](#24-layout-rules-per-player-view-games) as my design to playtest, not a copy of Nintendo's.
- **Switch 2 8-player figures** come from a third-party report (KitGuru), not Nintendo.
- **Race-end rule:** I did not verify how the real Mario Kart ends a race after the first finisher. The "first human finishes, others get a 30 s window" rule in [§6.2](#62-kart-rush) is my proposal.
- **Humans-only by default is our decision, not Nintendo's:** Mario Kart World fills local multiplayer with CPU drivers ([Nintendo support](https://en-americas-support.nintendo.com/app/answers/detail/a_id/68610)); we deliberately differ.
- **Small-grid feel:** whether a 2- or 3-kart Kart Rush race plays well is untested; the item-odds and item-box changes are proposals to playtest.
- **Mario Golf: Super Rush's turn-order rule** wasn't in the sources I read; the farthest-first and honour rules are from golf's own rules (USGA).
- **Hackathon start date, venue, team size, presence requirements:** not on the rules page; the ETHGlobal event page returned HTTP 500. Devcon 8 is 3–6 November at Jio World Centre ([source](https://cryptobriefing.com/devcon-8-mumbai-november-2026/)).
- **Vendored Three.js build size and `.min` presence:** `node_modules` is missing here.
- **Real frame times, draw calls and load times:** I read code and file sizes but did not run the games. Spike S1 and the §5.1 capture are the first tasks. The cost multipliers in [§5.3](#53-multi-view-cost-model) are reasoning from the code plus general guidance, not measurements, and the tier settings are proposals.
- **Test totals:** the unit suite needs `npm ci` for a true baseline.
- **iOS Vibration API**, in-app browser behaviour, and real sensor rates on your phone models.
- **Quick-tunnel WebSocket support:** the docs are silent.
- **World:** Orb availability in India in 2026; per-room dynamic actions; whether the World App deep link works from an arbitrary mobile browser on both OSes. **ENS:** testnet support per offchain provider. **Arkiv:** testnet name/chain ID and min/max expiry.
- **Cross-engine float determinism** is a known limitation I did not test.
- **Controller review:** I read the code but did not run the controller on devices, so the button-size findings come from the CSS values (clamped px ranges), not measurements on a real phone. Apple's 44 pt figure is from secondary sources.
- **iPhone haptics workaround:** sources disagree on which iOS versions it works on and whether script-triggered haptics still work; test on the current iOS.
- **"Add to Home Screen" and orientation lock:** I have not verified that it improves either.
- **Whether iOS Safari accepts WebSockets to a self-signed certificate** reliably: untested.
- **Whether Windows machines have OpenSSL:** I inferred the risk from the code (it shells out to `openssl` and falls back to HTTP); I did not test a clean Windows install.
- **Trademark status of the new names:** only a quick web search, no register search; **not** a clearance.
- **The "Swordplay" and "Island Flyover" names** being third-party activity names is my recollection, not something I checked.
- **Whether Nintendo-derived assets are in the public repository's history:** I can only see this checkout, which isn't a git repository here.
- **Jackbox reconnect-by-reload** comes from a secondary source.
- **Which hooks the partner briefs will actually need** (on-chain contract or offchain, which chain, mini app or web page, onchain or offchain ENS names, Arkiv SDK version, account abstraction, a pot): unknown until the briefs are published ([§5f.11](#5f11-questions-the-briefs-will-answer)).
- **The canonical encoding choice** (RFC 8785 JSON versus deterministic CBOR) and the default hash are deliberately left to be decided once, early; the plan only requires that there be exactly one.
- **The SDK shape** in [§5g.5](#5g5-the-game-sdk-contract) is illustrative; the real one is extracted from Kart Rush, Golf and Slice Dojo.
- **Sandbox side effects, untested:** whether delivering 60 Hz input for up to 8 seats over `postMessage` adds noticeable latency; whether a strict CSP and a cookieless separate origin work for WebGL, audio and fullscreen inside a sandboxed iframe on iOS Safari; and that `sandbox` without `allow-same-origin` removes `localStorage` inside the game (the SDK's scoped storage is meant to replace it).
- All **latency, size-target, tier and effort figures** are my estimates or targets.

---

## 16. Sources

**ETHGlobal**
- [Mumbai prizes](https://ethglobal.com/events/mumbai/prizes); [Mumbai rules and judging](https://ethglobal.com/events/mumbai/info/details); [New York 2026 prizes](https://ethglobal.com/events/newyork2026/prizes); [Devcon 8 Mumbai](https://cryptobriefing.com/devcon-8-mumbai-november-2026/).

**How the real games handle multiple players and views**
- Mario Kart 8 Deluxe: [Nintendo Life, 1080p/60 and the 3–4 player drop](https://www.nintendolife.com/news/2017/03/mario_kart_8_deluxe_runs_at_60fps_in_1080p_when_docked); [KitGuru, 8-player split-screen update](https://www.kitguru.net/tech-news/mustafa-mahmoud/mario-kart-8-deluxe-gets-surprise-switch-2-update-with-8-player-split-screen/); [How-To Geek, online and two-per-console play](https://www.howtogeek.com/306445/how-to-play-mario-kart-with-your-friends-on-the-nintendo-switch-online-and-in-person/); [Nintendo, local wireless](https://www.nintendo.co.uk/Support/Nintendo-Switch/How-to-Use-the-Local-Wireless-Play-Feature-of-Mario-Kart-8-Deluxe-1515604.html).
- Mario Kart World: [Nintendo support, multiplayer setup](https://en-americas-support.nintendo.com/app/answers/detail/a_id/68610).
- Mario Golf: Super Rush: [Inverse, local and online multiplayer](https://www.inverse.com/gaming/mario-golf-super-rush-local-online-multiplayer-how-to); [ComicBook, local restrictions](https://comicbook.com/gaming/news/mario-golf-super-rush-nintendo-switch-local-multiplayer-restrictions/).
- Golf order of play and ready golf: [USGA](https://www.usga.org/content/usga/home-page/rules-hub/topics/order-of-play-ready-golf.html).

**Demand evidence**
- [AirConsole, Sept 2020](https://www.airconsole.com/games/airconsole-takes-on-nintendo-switch-and-ps4-by-bringing-console-games-to-the-web); [AirConsole best practices](https://developers.airconsole.com/best-practices-for-web-games-on-airconsole); [AirConsole FAQ](https://developers2.airconsole.com/faq-help).
- [Jackbox Party Pack 12 release](https://indigo-pearl.prezly.com/the-party-returns-to-tens-of-millions-of-players-jackbox-games-announces-the-jackbox-party-pack-12); [Wikipedia](https://en.wikipedia.org/wiki/The_Jackbox_Party_Pack); [DualShockers](https://www.dualshockers.com/jackbox-games-200-million-players-bloomberg-report/).
- [Pew 2022](https://www.pewresearch.org/short-reads/2022/09/14/as-more-states-legalize-the-practice-19-of-u-s-adults-say-they-have-bet-money-on-sports-in-the-past-year/); [Pew 2025](https://www.pewresearch.org/short-reads/2025/10/02/americans-increasingly-see-legal-sports-betting-as-a-bad-thing-for-society-and-sports/); [Entain](https://igamingfuture.com/entain-study-shows-brits-see-gambling-as-highly-social/); [Puntaa](https://direct.businessnewsaustralia.com/articles/app-cashes-in-on--punting-peers-.html); [iBETcha](https://app.dealroom.co/companies/ibetcha); [FairWins](https://docs.fairwins.app/system-overview/how-it-works/); [stickK APHA abstract](https://aphanew.confex.com/apha/142am/webprogram/Paper305254.html); [DappRadar via Cointelegraph](https://cointelegraph.com/news/web3-gaming-defi-activity-october).

**Netcode and rendering**
- Gaffer on Games: [snapshot interpolation](https://gafferongames.com/post/snapshot_interpolation/), [UDP from a browser](https://gafferongames.com/post/why_cant_i_send_udp_packets_from_a_browser/).
- [Rune: WebRTC vs WebSockets](https://developers.rune.ai/blog/webrtc-vs-websockets-for-multiplayer-games); [Utsubo: frontier web APIs 2026](https://www.utsubo.com/blog/frontier-web-apis-2026-production-ready).
- [Cloudflare TURN/SFU pricing](https://developers.cloudflare.com/realtime/sfu/pricing); [Cloudflare quick tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/); [Fly.io regions](https://fly.io/docs/reference/regions); [Fly India routing thread](https://community.fly.io/t/anyone-using-fly-io-from-india-sri-lanka-pakistan-regions-beware-of-poor-routing/18072).
- Multi-view rendering: [Three.js manual, multiple scenes and viewports](https://threejs.org/manual/en/multiple-scenes.html); [PlayCanvas multiple cameras](https://developer.playcanvas.com/user-manual/graphics/cameras/multiple-cameras/); [Three.js forum: WebGPU RenderPipeline and split-screen](https://discourse.threejs.org/t/renderpipeline-does-not-support-split-screen-multiple-viewports-with-webgpu-backend/92444).
- [Khronos WebGL/WebGPU status](https://www.khronos.org/developers/linkto/webgl-and-webgpu-sigg26); [Three.js WebGPURenderer](https://threejs.org/manual/en/webgpurenderer.html); [glTF-Transform](https://gltf-transform.dev/).
- [MDN DeviceMotionEvent.interval](https://developer.mozilla.org/docs/Web/API/DeviceMotionEvent/interval); [w3c/sensors#98](https://github.com/w3c/sensors/issues/98); [WebKit bug 145814](https://bugs.webkit.org/show_bug.cgi?id=145814).

**Web3 docs**
- [World ID overview](https://docs.world.org/world-id/overview); [IDKit integration](https://docs.world.org/world-id/idkit/integrate); [World Orb India pause, 2023](https://techcrunch.com/2023/12/20/worldcoin-is-no-longer-offering-orb-verification-in-india-brazil-and-france).
- [Arkiv fundamentals](https://docs.arkiv.network/start-here/fundamentals/); [Arkiv SDK docs](https://arkiv.dev.golem.network/docs/sdk); [ENS subnames](https://docs.ens.domains/web/subdomains); [Chainlink VRF v2.5 networks](https://docs.chain.link/vrf/v2-5/supported-networks).

---

## 17. Review log: holes found in this pass and where they are covered

A second, systematic pass over the whole plan, the controller code, the server and the repository, asking "what situation has this not considered?". Everything below was missing or wrong in the previous version and is now covered.

**Controller and input**

| # | Hole | Covered in |
| --- | --- | --- |
| C1 | Seat identity too weak for several identical phones | [§5a.5](#5a5-the-redesign) Identity |
| C2 | One layout for every game; no lobby, setup, turn, text or away contexts | [§5a.5](#5a5-the-redesign) Contexts, [§5a.6](#5a6-controls-per-game) |
| C3 | Any phone's B or Home sends the whole room to the menu; any A restarts | [§5a.3](#5a3-problems-for-our-use-case) #3, [§5a.5](#5a5-the-redesign) Scoped commands, [P2](#p2-per-seat-input-and-the-controller-page-m) |
| C4 | A reconnect or reload loses the seat | [§5a.5](#5a5-the-redesign) Stable seat, [P1](#p1-rooms-seats-screens-and-lobby-m) |
| C5 | `touchmove` blocked on the whole page, so no forms or typing | [§5a.3](#5a3-problems-for-our-use-case) #5, Keyboard profile |
| C6 | Touch targets below 44–48 px | [§5a.3](#5a3-problems-for-our-use-case) #6, layout rules |
| C7 | Calibration and sensitivity stored on the screen, collide across seats and screens | [§5a.5](#5a5-the-redesign) Preferences travel with the phone |
| C8 | No capability handshake | [§5a.5](#5a5-the-redesign) |
| C9 | No path for a phone with no gyro, a denied permission or limited motion | [§5a.5](#5a5-the-redesign) Fallbacks |
| C10 | Backgrounding is silent for 5–15 s | [§5a.5](#5a5-the-redesign) Connection experience |
| C11 | No iPhone haptics | [§5a.4](#5a4-what-the-real-world-teaches), [§5a.5](#5a5-the-redesign) Feedback |
| C12 | Emission up to ~166 Hz per phone | [§5a.5](#5a5-the-redesign) Pacing, [P2](#p2-per-seat-input-and-the-controller-page-m) |
| C13 | The face copies Nintendo hardware | [§5a](#5a-the-controller-the-phone), [§5e.2](#5e2-assets-renaming-does-not-fix-this) |
| C14 | No safety guidance | [§5c.1](#5c1-physical-safety) |
| C15 | Orientation lock only on Android | [§5a.3](#5a3-problems-for-our-use-case) #15 |
| C16 | QR-only joining, no name or typed code | [§5a.5](#5a5-the-redesign) Joining |
| C17 | Phone storage can throw or be cleared | [§5c.3](#5c3-privacy) |

**Hosting and first run**

| # | Hole | Covered in |
| --- | --- | --- |
| H1 | The QR encodes the first network adapter, often the wrong one | [§5b.2](#5b2-local-mode-failures-found-in-the-code) #1 |
| H2 | The certificate needs OpenSSL; without it sensors silently fail | [§5b.2](#5b2-local-mode-failures-found-in-the-code) #2 |
| H3 | Browser auto-open and the autoplay flag are macOS-only | [§5b.2](#5b2-local-mode-failures-found-in-the-code) #3, [§5b.5](#5b5-screen-start-gate) |
| H4 | The QR URL is fixed to the LAN address | [§5b.2](#5b2-local-mode-failures-found-in-the-code) #4 |
| H5 | Firewall and Wi-Fi client isolation only in the README | [§5b.2](#5b2-local-mode-failures-found-in-the-code) #5 |
| H6 | A stale cached build on one screen breaks a shared or lockstep match | [§5b.3](#5b3-version-handshake) |
| H7 | A screen that can't render is not detected | [§5b.4](#5b4-screen-capability-gate) |
| H8 | Remote screens block audio and fullscreen; hidden tabs freeze everyone | [§5b.5](#5b5-screen-start-gate) |
| H9 | A public relay has no capacity numbers or abuse limits | [§5b.6](#5b6-capacity-and-abuse-hosted-relay) |
| H10 | No plain-language failure states | [§5b.7](#5b7-failure-states) |
| H11 | The host has to run Node; no hosted option | [§5b.1](#5b1-who-runs-the-relay) |

**Safety, security, privacy**

| # | Hole | Covered in |
| --- | --- | --- |
| S1 | Phone text reaching `innerHTML` (XSS) | [§5c.2](#5c2-security-and-content) |
| S2 | No moderation, kick or room lock | [§5c.2](#5c2-security-and-content), [§2.7](#27-modes-start-rules-and-match-setup) |
| S3 | Room codes guessable on a public relay | [§5c.2](#5c2-security-and-content) |
| S4 | The relay's sponsor wallet can be drained by spam | [§5c.2](#5c2-security-and-content), [§12](#12-part-b-track-integrations-at-the-hackathon) seams |
| S5 | Part B publishes player data publicly; replays are behavioural data | [§5c.3](#5c3-privacy), [§12](#12-part-b-track-integrations-at-the-hackathon) seams |
| S6 | Photosensitivity | [§5c.1](#5c1-physical-safety) |
| S7 | No notices for a public site | [§5c.3](#5c3-privacy) |

**Product**

| # | Hole | Covered in |
| --- | --- | --- |
| P1 | No settings, accessibility or TV-readable UI rules | [§5d](#5d-product-details-the-first-plan-missed) D1 |
| P2 | No onboarding, how-to-play or practice | D2 |
| P3 | No player profiles | D3 |
| P4 | Groups larger than a two-player game's limit just get a dimmed tile | D4, [P1b](#p1b-the-game-menu-and-lobby-entry-m) |
| P5 | No party mode or series | D5 |
| P6 | Pause behaviour undefined across topologies | D6 |
| P7 | Nothing between matches (swap seats, change setup) | D7 |
| P8 | Only phones as inputs | D8 |
| P9 | Spectators have nothing to do | D9 |
| P10 | No diagnostics, localisation, docs or release process | D10–D13 |
| P11 | Seats that never ready up | [§2.7](#27-modes-start-rules-and-match-setup) |
| P12 | "Host" meant two things (a person and a tab) | [§2.1](#21-vocabulary) |
| P13 | No single view of what each game supports in each situation | [§2.9](#29-support-matrix-every-game-against-every-situation) |

**Names, assets and obligations**

| # | Hole | Covered in |
| --- | --- | --- |
| N1 | Platform and game names | [§5e.1](#5e1-names) |
| N2 | The Kart Rush pack is Nintendo's models, audio and UI; a rename doesn't change it | [§5e.2](#5e2-assets-renaming-does-not-fix-this), workstream **R** |
| N3 | The menu and controller look like Nintendo's | [§5e.2](#5e2-assets-renaming-does-not-fix-this) |
| N4 | The MIT notice and ETHGlobal's pre-existing-work rule still apply | [§5e.3](#5e3-the-pre-existing-base) |
| N5 | Names used without a register search | [§5e.1](#5e1-names) |
| N6 | The rename touches saved-settings keys, debug hooks, folders and docs | [§5e.4](#5e4-rename-pass-first-stage-done), M0b (first stage done) |

**The plan itself**

| # | Hole | Covered in |
| --- | --- | --- |
| X1 | The event-day plan and demo script had been dropped in an earlier rewrite | [§12.1](#121-event-day-plan-submission-and-demo) |
| X2 | ETHGlobal's AI-use documentation and commit-history rules had been dropped | [§12.1](#121-event-day-plan-submission-and-demo) |
| X3 | No effort sizes | [§10](#10-order-of-work) |
| X4 | New work (controller, hosting, assets, rename) had no milestones or dependencies | [§10](#10-order-of-work) M0b, M1a, M2a, M7a, M8a, R |
| X5 | No pre-event preparation for Part B | [§12.1](#121-event-day-plan-submission-and-demo) |

**Partner tracks (this pass)**

| # | Hole | Covered in |
| --- | --- | --- |
| T1 | Part B was described as a list of integrations, with no contract Part A must meet | [§5f.2](#5f2-the-integration-contracts) |
| T2 | Records would have been keyed by display name or folder slug, which the renames change | [§5f.3](#5f3-data-that-must-be-fixed-now) stable `gameId` |
| T3 | No canonical encoding, so signatures and hashes could disagree across screens | [§5f.3](#5f3-data-that-must-be-fixed-now) |
| T4 | No result lifecycle: guests, AI, disputes, abandoned matches and duplicate submits | [§5f.4](#5f4-the-result-and-signing-lifecycle) |
| T5 | No place in the controller, menu, lobby or results screen for identity, naming, signing and consent | [§5f.5](#5f5-where-part-b-appears-in-the-part-a-ui), [§5a.5](#5a5-the-redesign) |
| T6 | Partner features could stall play or fail offline | [§5f.6](#5f6-degraded-and-offline-modes) |
| T7 | The chain-writing service sat inside the realtime relay; World needs a public server with internet | [§5f.7](#5f7-infrastructure-to-plan-now) |
| T8 | Unpublished briefs: hooks were tied to named partners | [§5f.8](#5f8-what-each-possible-partner-needs-from-part-a) |
| T9 | The Continuity boundary was not defined in the repository | [§5f.9](#5f9-repository-layout-and-continuity-hygiene) |
| T10 | No tests for providers, canonical hashing or outages | [§5f.10](#5f10-how-it-is-tested) |

**Creator platform (this pass)**

| # | Hole | Covered in |
| --- | --- | --- |
| G1 | A game's id was its folder name, and `game.json` was optional and unvalidated | [§5g.3](#5g3-game-manifest-v2), [§5g.4](#5g4-game-ids-versions-and-bundle-hashes) |
| G2 | The flat id list would have blocked outside games; no version or code hash on results | [§5g.4](#5g4-game-ids-versions-and-bundle-hashes) |
| G3 | Games import platform internals and the socket directly; no stable public API | [§5g.2](#5g2-what-already-helps-and-what-is-in-the-way), [§5g.5](#5g5-the-game-sdk-contract) |
| G4 | Results and replays assumed we knew each game; no generic scoring or stats | [§5g.6](#5g6-scoring-stats-and-results-for-any-game) |
| G5 | "Every match is verifiable" is untrue for games that cannot be replayed | [§5g.7](#5g7-verification-tiers) |
| G6 | One origin, shared un-namespaced storage, no CSP or sandbox | [§5g.8](#5g8-running-untrusted-games-safely) |
| G7 | Game discovery was a folder scan | [§5g.9](#5g9-the-catalogue-from-a-folder-scan-to-a-registry) |
| G8 | No creator tooling, docs, review or policy, and no staging | [§5g.10](#5g10-creator-tooling-and-documentation), [§5g.11](#5g11-publishing-review-and-policy-later), [§5g.12](#5g12-how-it-is-staged) |

**Checked and found sound:** the Part A / Part B split under Continuity; seats and screens as the model for every topology; pure, seeded, fixed-step-capable game logic as the base for replay and lockstep; humans-only multiplayer with an opt-in AI field and a 2-human start gate; the Golf, Kart Rush and Slice Dojo scenario books.
