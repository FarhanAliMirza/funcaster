# Going beyond four seats: execution plan

Status: plan, 6 November 2026. Read-only analysis of the code; nothing was run or measured, and byte counts and frame costs below are estimates. **Owner decision (6 November):** stay at 4 seats, and move toward 8 only if it does not disrupt the working solutions. This plan is built to satisfy that: every stage is flag-guarded, keeps 4-seat behaviour identical, and can be rolled back by one switch.

Abbreviations: `P` = `server/party.cjs`, `PE` = `server/party-engine.cjs`, `H` = `public/party/host.js`, `D` = `public/party/display.js`.

## 1. Recommendation

- **Stay at 4** unless there is a concrete 5-8 person need. Today's behaviour works.
- **If going ahead,** do Stage 0 and Stage 1 first. They change nothing visible and can ship alone.
- **First raises:** Drawing, then Slice Dojo co-op/battle, then the Star Catch family.
- **Never raise:** Kart Rush, Alien Attack, Time Trial, Cloud Cruise (they cost one WebGL scene or iframe per seat).
- **Table Tennis and Foam Fencers** stay 2-player matches; more seats only means a queue.
- **For the hackathon:** Kiosk mode already gives a crowd a "next up" queue without more seats. Eight seats is **not** on the hackathon-critical path.

## 2. The key structural finding

There are two seat identities, and games only see one.

- **Room slot (0-3):** the index in `room.players` (P:383). It sets colour and name (P:26-27, 70-71, 100-101, 766-767) and is used for standings (P:195), sketch scores and `room.active`.
- **Active index (0..n-1):** `classicEmit` sends `slot: index` (P:135) and `presence.slots[i].slot` is `i` (P:99). So Kart Rush, Golf and Slice Dojo already see compact indices, which is why most game code has no hard "4".
- Only the drawing flow mixes the two: `SketchRound` is built from room slots (P:328) while presence exposes an index (P:94).
- Independent-view games run one single-player iframe per seat, each seeing `slot:0` (P:135, `host.js:227-248`); their game code needs no change, only host and display layout and iframe cost.

## 3. Inventory of "4" assumptions

| Where | Assumes | Breaks at 5-8 | Fix |
| --- | --- | --- | --- |
| P:26-27, `public/party/catalog.js:2-3` | 4 colours and names, duplicated | `COLORS[4]` undefined in `view`, `join`, `presence` | One shared `core/seats.js` with 8 entries; the first four identical to today's |
| P:383 `Array(4)` | Room holds 4 phones | Join answers `full` (P:739-744) | `capFor(room)`, not `Array(4)` |
| P:741-743; `session.test.cjs:59` | "Four players are in" text; 5th join returns `full` | Wrong message at a higher cap | Template the number; test stays valid at cap 4 |
| P:261 `(slot-first+4)%4`, P:713 `%4` | Next-player rotation | Slots 4-7 collapse onto 0-3 | Modulus `SEAT_MAX`, skip empty slots |
| P:195-196 `5 - rank` | Points 4,3,2,1 | Ranks 5-8 all score 1 | `max(4,n)+1-rank` (identical for n≤4) |
| P:214-221 bracket | Field of 3 or 4 | 5-8 jumps to "final" with wrong seats | Generalise, or hide bracket when more than 4 are ready |
| P:827 `s<4` (pick pair) | Pick-pair seats | Pair 4-7 rejected | `s < SEAT_MAX` |
| P:322, P:67 `CLASSICS[...]\|\|4` | Active cap = manifest `maxPlayers` or 4 | Non-classic games ignore a raised cap | Read from the manifest `seats` field |
| P:988-995 practice auto-add | Adds every ready phone, no cap | A server game would take 8 regardless of cap; `createRound` throws (PE:17) | Add `room.active.length < matchSetup().maxHumans` |
| P:337-342 timers | Fixed: drawing 180 s, golf 480 s, kart 600 s | Drawing takes N×33 s (`sketch-round.cjs:76-77`): 8 players is 264 s, cut off at 180 s; 8 golfers on 3 holes will not fit 480 s | Make `seconds` a function of N and holes |
| P:415, 438 | 8 displays, 32 viewers | Budget thin with 8 independent views | Keep limits, measure |
| PE:17-19 | `slots.length>4`, `s>3` | `createRound` throws; replay verification (`records.cjs:62`) throws too | `SEAT_MAX` |
| `slice-replay.cjs:55` | `setCursor` slot `<4` | Replay marked invalid | `< SEAT_MAX` |
| `catalog.js:216,222,249` | `max` is 2 or 4 | Manifest has no seat field | Per-game `seats`, default 4 |
| `catalog.js:300` | `validateManifest`: `maxHumans > 4` is an error | Rejects a raised game; `platform.test.mjs:21` requires `[]` for all games | Allow up to 8 only where `seats` is declared |
| `catalog.js:327` | Golf CPU cap fixed at 4 | 6 humans + 4 CPU = 10, `GolfRound` throws (`round.js:14-18`) | `min(4, 8-humans)` |
| `catalog.js:327`, `mario-kart/logic.js:179` | Kart CPU = `8 - humans` | Already self-consistent | None |
| `catalog.js:66,81,96,254`; `game.json` "1-4 players" | Display text | Misleading | Derive from `seats` |
| `core/viewports.js:2-3` | `count>4` throws | Kart Rush crashes with 5+ humans (`multiview.js:35`) | **Keep Kart Rush at 4** |
| `core/net.js:104` | `localSeats` filter `n<4` | A display watching seat 5+ shows nothing | `< SEAT_MAX` |
| `mario-kart/game.js:405,415` | Drops `slot>3` | Seat 5+ inputs dropped | Only if Kart Rush is raised (it will not be) |
| `mario-kart/multiview.js:5,57` | `colors[seat%4]` | Duplicate colours | Shared table |
| **`golf/game.js:155`** | CPU golfers use `slot: 4+i` | **Collides with human active indices 4-7.** A CPU's `play-status` feedback goes to `room.active[4]`, a real phone (P:668-675) | CPU ids ≥ 100; filter by `!p.ai` (also `golf/game.js:185`) |
| `drawing/game.js:29` | `colors[slot%4]` | Pens repeat | Shared table |
| `public/party/render.js:2,94,96` | `palettes[p.slot]` | Undefined fill, blank or black lanes | 8 tints |
| `render.js:85-86` | Equal-width lanes | 8 lanes of 240 px at 1080p: narrow | Optional 2×4 layout |
| H:257 `length:4`, H:268 `/ 4` | Crew slots and counter | Only 4 shown | `seatCap` from state |
| `party.css:381` `repeat(4,1fr)`, :907 | 4 columns | Overflow | `auto-fit` |
| `public/index.html:49,79,115` | "1-4 players", "0 / 4", "4 racers" | Text only | Template |
| H:217-221, D:43-46, P:16-24 | `INDEPENDENT` list copied in 3 places | Drift risk | Catalog flag `view:"independent"` |
| `party.css:1368-1375`, `screen.html:36-41` | Grid for `data-views` 1-4 | 5+ iframes stack in one column | Add 5-9 rules |
| H:243-246 | Badge position assumes 2 columns | Mislabelled tiles | Compute from the grid |
| D:80, `screen.html:71-78` | Hard-coded seat options | Cannot watch seat 5+ | Build from `state.active.length` |
| Tests: `session.test.cjs`, `engine.test.cjs:10`, `network-smoke.cjs`, `platform.test.mjs:42`, `mario-kart/multiplayer.test.mjs:9-17` | Encode "4" | These are the guardrails | Keep green at the default; add 8-seat tests alongside |
| `server.js:255` `MAX_PLAYERS=4`, `public/menu.js:518` | Legacy single-screen path | Separate from the party engine | **Out of scope; do not touch** |

## 4. Interactions that matter

1. **Golf CPU ids** collide silently with human indices (above). Fix in Stage 0.
2. **Golf length:** farthest-first order (`round.js:159-166`) makes 8 golfers on 6 holes very long. Cap holes at 3 when more than 4 humans.
3. **Drawing:** server logic is size-agnostic (a 3-player test exists); the 180 s timer is the blocker.
4. **Standings** are cumulative per room slot (P:192-196); names are looked up by room slot (H:147).
5. **Replay cost:** `room.replay` stores inputs for every player (P:999-1010); 8 players roughly doubles it (not measured). The 24 MB history cap (P:187-191) means fewer stored matches. `makeResult` hashes and re-simulates on finish.
6. **Rotation:** winner-stays generalises (P:225-230); bracket and pick do not.
7. **Phones 5-8 while the current game is capped at 4** must wait with identity intact. Today's 5th phone is told "full". The start logic already handles extras for classics (`eligible.slice(0, max)`, P:321-323). This is the same need as Kiosk's "next up" queue (host plan H6).
8. **Auto-start** needs every connected phone ready (P:966-972); one idle phone of 8 blocks it. The host's Start still works. Kiosk mode must change this rule.
9. **Late join** in Slice Dojo is already bounded by `match.maxHumans` (P:777-785).

## 5. Per game: can it exceed 4?

| Game | Pattern | Verdict | Cost and notes |
| --- | --- | --- | --- |
| Drawing (guess and free) | Turn-based, shared canvas | **Best candidate** (docs already target 4-8, remaining-games.md) | Timer, pen palette, standings; low risk |
| Slice Dojo co-op/battle | Shared board, N blades (`getPlayer` is lazy, `logic.js:98`) | **Good, second** | Replay slot bound; tints from presence (`game.js:1129-1138`); blade clutter is a UX question. The `race` variant uses independent boards: keep ≤4 |
| Star Catch, Neon Drift, Bubble Burst | Server-simulated parallel lanes | **Good, third** | Lanes narrow; snapshot size linear in N (section 8); verification stays valid |
| Golf | Turn-based, shared scene | **Medium** | Long waits; CPU ids, timer, holes ≤3 at 5+ |
| Table Tennis, Foam Fencers | 2 players, others queue | **Match stays at 2** | Needs queue and "who's next" UI; low priority |
| Shooting Range | Independent 2D canvas | **Medium** | 5-9 iframe tiles each with a socket; tiles small |
| Alien Attack, Time Trial, Cloud Cruise | Independent three.js iframes | **Keep at 4** | 5-8 WebGL contexts in one laptop tab |
| Kart Rush | Split-screen, N scene passes | **Keep at 4 permanently** | `Race` supports 8 humans (`logic.js:166`) but `viewports()` throws above 4, and 8 scene passes per frame is the real cost |

**Rank by value divided by risk:** Drawing > Slice Dojo co-op > Star Catch family > Golf (≤3 holes) > Table Tennis queue > Shooting Range.

## 6. The staged, flag-guarded plan

**Design.** `SEAT_MAX = 8` as a code constant and a runtime flag `PARTY_SEAT_LIMIT` (env, **default 4**).

- Optional manifest field `seats` (default 4). Today's `maxHumans` becomes `min(seats, 8)` for multiplayer.
- A room's join cap: `capFor(room) = flag ? max(4, gameById(room.game).seats) : 4`.
- Seated players are never kicked when the host switches game; the cap only gates new joins.
- With the flag unset, nothing can reach 5.

### Stage 0: decouple, no behaviour change (about 250 changed lines, 1-2 days)

- New `core/seats.js` with 8 entries (name, colour, shape, text colour); the first 4 identical to today's constants. Replace the copies in P:26-27, public `catalog.js:2-3`, `multiview.js:5`, `drawing/game.js:29`, `render.js:2`.
- Replace the literals in the table with `SEAT_MAX`: PE:17-19, `slice-replay.cjs:55`, P:261, P:713, P:827, `net.js:104`, P:195.
- Golf CPU ids become 100+i; filter by `!ai`.
- Practice-join cap (P:988).
- Catalog flag `view:"independent"` replaces the three copied lists.
- `Array(4)` stays, driven by a constant `ROOM_SEATS = 4`.

Tests to add: a **golden test** (a 4-player join-and-ready flow where `view(room)` JSON is byte-identical to a fixture captured before the change); Golf with 4 humans and 4 CPU unchanged in results and turn order; `5-rank` equivalence for n≤4. **Must not break:** `npm run check`, the existing 5th-join `full` assertion. **Rollback:** revert the commit.

### Stage 1: the cap becomes a manifest field (about 150 lines, 1 day)

- `seats` in `catalog.js`, `game.json` and `validateManifest` (allow >4 only if declared).
- `capFor(room)` and a templated "full" text; the players array sized to `SEAT_MAX`.
- Host crew UI from state (`seatCap`, counter, `auto-fit` grid); display seat options from `state.active.length`; `data-views` 5-9 CSS.
- Flag stays off by default.

Tests: flag on, no game raised: 5th join still `full`; flag off with a raised manifest: still 4; all 13 games pass `validateManifest`. **Must not break:** the fourth-phone flows, reconnect identity, `room.players.filter(Boolean).length === 4`. **Rollback:** unset the flag.

### Stage 2: raise Drawing to 8 (about 100 lines, 1-2 days)

- Timer 35 s × N for guess mode (P:340); free draw unchanged. Pen palette from the shared table. `seats: 8` in the manifest.

Tests: SketchRound with 8 players on a mocked clock finishes before the timer; standings with 8 ranks; an 8-phone session test (joins, ready, start, `room.active.length` is 8, a guess scores). **Must not break:** the 3-player sketch test, free draw. **Rollback:** `seats` back to 4.

### Stage 3: Slice Dojo co-op/battle, then the Star Catch family (about 200 lines each)

- Slice replay seat bound; replay and verification tests with 6 and 8 boards. Server games get 8 palette tints; **cap snapshot precision (section 8) before raising.** Slice Dojo `race` keeps a per-variant cap of 4.

Tests: `verifySlice` with 8 cursors; `createRound` with 8 players over 3600 ticks; `engine.test.cjs` extended to 8. **Rollback:** manifest.

### Stage 4: rotation and queue (Table Tennis, Foam Fencers)

Generalise bracket to single elimination up to 8 or hide it above 4; queue UI on host and phone; standings for non-playing seats. (Shared with Kiosk's "next up".)

### Stage 5: Golf (≤3 holes at 5+) and Shooting Range (3×3 view grid)

### Stage 6: soak and device test

A launch gate, not a code stage.

## 7. UI for 5-8 seats

- **Colours (proposal, not user-tested).** Keep today's four. Add Sky `#2f9be0`, Berry `#d6457f`, Slate `#4b5873`, Lime `#9acb2e`. Black text passes on all but Slate, which needs white (7.14:1). Seat colours on paper (`#faf8f1`) are only 1.8-2.9:1 for Peach, Mint, Sunny, Sky and Lime, so colour alone is not enough: every seat needs a **shape and a number**. Each entry therefore needs a text-colour field. These should be reconciled with the Mumbai palette in [visual-direction.md](visual-direction.md) before building.
- **Shapes.** [controller-design.md](controller-design.md) defines circle, triangle, square, diamond and says extra seats get further pairs; add star, hexagon, plus and pentagon for 5-8.
- **Host.** Crew grid 4×2 on desktop (`party.css:381`); the results dialog (a 480 px column of 13 px rows, `party.css:735-775`) needs a compact variant; scoreboard pills (`party.css:660`) need wrapping.
- **Display.** Seat select built dynamically; tile layout for 5-9 views.
- **Phone.** Identity comes from the server colour and name (`phone.js:133-135`); only the "full" wording changes.

## 8. Performance and network (computed from code, not measured)

- **Phone input:** about 33 messages/s per phone (`phone.js:674`); 8 phones is about 267/s inbound; the server floor is 12 ms (P:798).
- **Classic relay:** `relayClassic` runs at 30 Hz (P:938-966, 138-166): one `orientation` per active seat per screen; 240 messages/s to the host at 8 seats versus 120 at 4.
- **State broadcast:** every 12 ticks (about 2.5/s) to every socket; under about 3 KB.
- **Server-sim frames:** `snapshot(round)` sends every player's objects (PE:169-176) 30 times a second to the host and each display (P:1011-1013). Estimate 1-2 KB per player per frame, about 15 KB per frame at 8 players, about 0.45 MB/s per receiver; with host plus 8 displays about 4 MB/s egress (about 32 Mbit/s), uncomfortable on shared Wi-Fi. **Mitigation:** round to 3 decimals and drop `age` and `dwell` (cuts well over half), or send per-lane deltas.
- **Snapshot relay (classic):** each screen can post about 15 snapshots/s of up to 250 KB (P:455-475); the server `JSON.stringify`s each to check its length even with no viewers; 8 independent views is up to 120/s.
- **Match finish:** `room.history.reduce(JSON.stringify)` (P:183-186) and `hash(replay)` run synchronously on the single Node thread; an 8-player replay could stall the tick for tens of milliseconds.
- **Host page:** 8 independent iframes means 8 sockets and 8 WebGL contexts; many consumer routers degrade around 8-10 simultaneous low-latency streams.

**What to measure first:** server event-loop lag p99 with 8 simulated phones in Star Catch and Slice Dojo; frame bytes and egress with host plus 8 displays; `finish()` duration with a full replay; host frame time in Drawing, Slice Dojo and independent games at 4, 6 and 8 tiles; phone latency p95 at 8 phones on venue Wi-Fi ([controller-stress-tests.md](controller-stress-tests.md) N1-N11, P2).

## 9. Acceptance for any raised game

1. All existing tests green at the default cap.
2. The 4-player golden-view test unchanged.
3. An 8-phone scripted session completes a full round with correct standings.
4. A real 8-phone, 15-minute soak with no seat loss and event-loop p99 lag under 20 ms.
5. An 8-person seat-identification check by shape and colour at 3 m.

## 10. Do not

- Raise Kart Rush, Alien Attack, Time Trial or Cloud Cruise.
- Change `viewports()` semantics for counts 1-4.
- Renumber existing seat colours.
- Touch `server.js` or `menu.js` (legacy path).
- Kick seated phones when the cap shrinks.
- Enable the flag in the public demo before the soak.

## 11. Could not verify

- Nothing was run; test statuses come from reading tests. Frame rates, GPU load, Wi-Fi behaviour and server lag at 5-8 seats are unmeasured.
- That `require("../core/catalog.js")` loads under the project's Node (it already works at P:12, so `core/seats.js` should too).
- The `logic.js` of kart, island-flyover, alien-attack and shooting-range were not read in full; the `slot:0` convention was taken from their `game.js`.
- `view.maxPlayers` (P:67) looked unused on the client; only `maxPlayers` was searched.
