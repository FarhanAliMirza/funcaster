# The controller: what is wrong, and how we stress-test it

Status: plan, 6 November 2026. Based on a read of `public/party/phone.js`, `phone.css`, `public/controller.html`, `core/party-motion.js`, `core/racing-motion.js`, `core/motion-settings.js`, `server/party.cjs`, the existing tests, and `docs/RELEASE.md`. Nothing here has been run on a real phone. The existing automated tests cover the motion maths well but have **no test of the phone UI at all**.

The phone is the one device every player holds, and every multiplayer scenario depends on it. This plan has two halves: first what the audit found (so the tests aim at real weaknesses), then a layered test strategy with a concrete scenario catalogue, metrics, tooling, a human playtest protocol, a soak plan and release gates.

## 1. What the audit found (the test targets)

**Today there are two controllers that share no code.** The party phone (`/controller?room=CODE`, `phone.js`) is the live one. The legacy "classic" Wii-remote clone (`/classic-controller`, `controller.js`) is reachable only through the orphaned `/classic.html`. A test helper, `tests/kart-prototype/server.cjs`, still serves `controller.html` with the old `controller.js`, so that pair is probably mismatched (untested).

| # | Finding | Evidence | Why it matters |
| --- | --- | --- | --- |
| F1 | **Many touch targets are under 48 px**, including the shared primary action (about 46 px), "Play with touch instead" (about 38), "Use touch instead" (about 32), Recenter and Adjust (about 44, and about 28 in landscape wheel mode), the touch steering slider (32, 26 in landscape), driver arrows (40, 30 in landscape), the settings close (40) and checkboxes (24) | `phone.css`, `party.css` (sizes derived from CSS, not measured on a device) | Mid-air mis-presses; the no-gyro entry points are the smallest controls on the page |
| F2 | **Seat token is in `sessionStorage`**, so a closed or evicted tab gives a new seat on rescan; the old seat stays reserved until the round ends | `catalog.js:4-14`, `party.cjs:730-741` | A phone that sleeps loses its seat; four such ghosts make the fifth person retry forever |
| F3 | **A server-side disconnect is a dead end.** Removal, a duplicate-tab join and room end all call `disconnect(true)`; Socket.IO will not reconnect, so the phone shows "Reconnecting…" forever | `party.cjs:729`, `phone.js:170-177` | Looks like a bug; a duplicate tab is told nothing |
| F4 | **Recenter and Leave are unconfirmed small buttons.** Recenter mid-race sets `ready=false` and drops input for about 0.7 s; Leave drops the seat | `phone.js:199-208, 395-401, 756-772` | One stray thumb costs a race or a seat |
| F5 | **Every rotation re-calibrates** and drops input for about 0.7-0.85 s; there is no orientation lock | `phone.js:718-726` | Rotating mid-race (or a phone slipping in a hand) is a visible stall |
| F6 | **Constant ~30-33 Hz emission** even idle, no sequence number, no RTT adaptation, sent even when unchanged | `phone.js:638-684`; server floor 12 ms at `party.cjs:798` | Up to four idle phones waste battery and bandwidth; stale input can queue on a congested socket |
| F7 | **No capability handshake**: `join` carries only `{buildId, code, token}` | `phone.js:117` | The screen cannot adapt to sensor rate, gyro presence, platform, or vibration support |
| F8 | **No iOS haptic fallback**, no visual pulse, no phone-speaker click | `phone.js:871-881` | Half the phones get no feedback |
| F9 | **No safety screen, no in-app-browser detection, no iOS Settings coaching** on a permission denial | audit | First-run failures are silent or vague |
| F10 | **`user-select:none` on the whole page** may block text entry on some iOS versions (unverified) | `phone.css:5-6`, `party.css:62-65` | Drawing guesses and any future name field |
| F11 | **Wake lock is requested repeatedly** without releasing the previous lock | `phone.js:321, 342` | Minor leak; verify on long sessions |
| F12 | **A portrait-locked iPhone on a wheel game gets only the "rotate" card**; touch is reachable only via Adjust feel | `phone.js:211-215, 740-755` | A no-gyro or rotation-locked player is stuck |
| F13 | **The phone ignores `controller-profile` feedback** that the server and games still send | `phone.js:858-869` | Dead code; any profile system has to start from scratch |
| F14 | **Contrast:** white text on the seat colours Peach, Mint and Sunny is 2.65:1, 2.99:1 and 2.04:1 (computed); only Lilac passes AA (4.76:1). Black text passes on all four (3.97 to 9.27:1) | computed from the hex values | The Accelerate pedal and "Let's play" are hard to read outdoors |
| F15 | **Tiny text:** 6-8 px labels on the pedal captions, footers and eyebrows | CSS | Unreadable at arm's length |
| F16 | **Any active seat's primary action can restart Alien Attack**; Swordplay restricts this to slot 0 | `alien-attack/game.js:466-469`, `swordplay/game.js:171-174` | A shared-screen game restarts from one phone |
| F17 | **A connected phone with live input but no gas is never autopiloted** in Kart Rush; there is no DNF window, so the race can stall until the 600 s cap | `kart-rush game.js:1871` | One idle human blocks everyone |

## 2. Test strategy: five layers

| Layer | What it proves | Tools | Runs |
| --- | --- | --- | --- |
| **L1 Unit and property tests** | Motion maths and settings are correct for any input | `node --test` (exists: about 55 tests in `core/`) | Every commit |
| **L2 Protocol simulation ("fake phones")** | The relay and rooms behave under many phones, reconnects, drops, malformed and hostile traffic | `socket.io-client` scripts and a chaos proxy | Every commit (fast set) and nightly (long set) |
| **L3 Browser automation of the real phone page** | The real UI works under touch, rotation, permissions, backgrounding and viewport changes | Playwright with emulated devices (installed as a dev dependency; browsers need installing) | Every PR (smoke) and nightly (full) |
| **L4 Real-device lab** | Real sensors, haptics, wake lock, permissions, thermals, battery, ergonomics | A written device matrix and scripts | Before each release; weekly during active work |
| **L5 Human playtests and soak** | People can actually play, for an hour, without help | Facilitated sessions and a logged soak | Before each milestone |

The principle: **automate everything that can be automated (L1-L3), and reserve people and phones (L4-L5) for what only they can show.** Each layer gets thresholds in section 7 and a place in the release gate in section 9.

## 3. L2: the fake-phone harness

`tests/party/session.test.cjs` has 19 room and relay tests but could not run in the audit because `socket.io-client` was not installed (it is a dev dependency). First task: install and run it so there is a green baseline. Then extend it into a reusable harness:

- A `FakePhone` class: joins a room, holds a token, emits `ready`, streams `input` at a configurable rate with a scripted motion profile (still, slow sweep, steady steer, wild shaking, tap-storm), responds to `ping-check`, and can *sleep* (stop sending without disconnecting), *drop* (hard disconnect), *flap* (reconnect repeatedly), and *clone* (open a second tab with the same token).
- A `FakeHost` and `FakeDisplay` for the TV tab and spectators.
- A **chaos proxy** between phones and the server that adds latency, jitter, loss and bandwidth limits and can sever connections (see section 6).
- A scenario runner that scripts a whole party (four phones, a host, a display) and asserts on the state view and the result record.
- A deterministic clock hook so races between two commands are reproducible.

## 4. L3: browser automation of the phone page

- Emulate a range of phone viewports and DPRs in portrait and landscape; touch events; and `prefers-reduced-motion`.
- **Synthetic sensors:** feed `deviceorientation` and `devicemotion` events by dispatching them in the page (and, where supported, through the browser's own sensor override via the Chrome DevTools Protocol; verify before depending on it). Scripted gestures: hold still for calibration, steer left and right, sweeps at different speeds, a golf swing, a shake.
- Grant, deny and revoke the motion permission; simulate the iOS two-step prompt by stubbing `DeviceOrientationEvent.requestPermission`.
- Simulate `visibilitychange`, `pagehide`, `freeze`, network offline and online, and orientation changes mid-race.
- **Measure target sizes for real**: for every interactive element in every phone state, assert the rendered bounding box is at least 48 by 48 CSS px (primary controls at least 96) and that neighbours are at least 8 px apart. This turns F1 into a failing test that gates the redesign.
- Screenshot every phone state per seat colour and check text contrast programmatically (fails on any pair under 4.5:1 for text). This turns F14 into a test.
- Run the same scenarios on the real engines Playwright ships (Chromium, WebKit, Firefox) as a first pass at iOS Safari behaviour. WebKit in Playwright is not iOS Safari; treat it as a smoke test, not proof.

## 5. The scenario catalogue (the core of the plan)

Each scenario has an ID, the steps, the expected behaviour, how it is automated (L2, L3, L4, L5), and the finding it covers. Pass thresholds are in section 7.

### 5.1 Joining and permissions

| ID | Scenario | Expected | Layer | Covers |
| --- | --- | --- | --- | --- |
| J1 | Scan the QR with the camera app, Android and iOS | Opens in the default browser; join in under 10 s on LAN | L4, L5 | |
| J2 | Open the link inside Instagram, WhatsApp, Telegram, Chrome Custom Tabs, Samsung Internet | A clear "Open in your browser" step if motion is unavailable | L4 | F9 |
| J3 | Type the 6-character code on a phone with no camera access | Join works; wrong code gives a plain error; lowercase and look-alike characters handled | L3 | |
| J4 | Deny motion permission, then try again; iOS: deny, reload | A readable explanation and the exact Settings path; touch mode offered immediately | L3, L4 | F9, F12 |
| J5 | Grant permission but the device has no gyroscope | Falls back to touch within 5 s without a dead end | L3 | F12 |
| J6 | Join when the room is full (4 seats) | A queue or spectator option, not an endless retry | L2, L3 | F2 |
| J7 | Join with an old build (stale cache) | Told to update, and auto-reloads; cannot join the room on another build | L2, L3 | |
| J8 | Two people scan within 100 ms | Two different seats, no duplicate | L2 | |
| J9 | The same phone joins twice (two tabs) | The second tab takes over cleanly; the first is told, not left spinning | L2, L3 | F3 |
| J10 | Join over mobile data through the tunnel | Works; handshake under 3 s | L4 | |
| J11 | Join on captive-portal or client-isolated Wi-Fi | The self-test page explains why it cannot reach the screen | L4 | |
| J12 | Name entry with emoji, very long strings, markup and profanity | Trimmed, sanitised, never rendered as HTML | L2, L3 | |

### 5.2 Motion and input quality

| ID | Scenario | Expected | Layer |
| --- | --- | --- | --- |
| M1 | Calibrate while the phone is held still, flat, upright, in landscape, and lying on a table | Calibration succeeds in under 1 s, or fails with a clear prompt | L1, L3, L4 |
| M2 | Calibrate while walking or on a moving train | Rejects a moving pose; does not store a bad frame | L1, L4 |
| M3 | Hold the phone upright (the grip that breaks naive Euler mappings) and steer | Left and right still map correctly | L1, L4 |
| M4 | Left-handed grip; phone inverted; pedals mirrored | Correct mapping and layout | L3, L4 |
| M5 | Fast swing (golf, tennis, fencing) at several peak rates | Swing registers once, power scales, no double fire | L1, L3, L4 |
| M6 | Slow deliberate wave and talking-with-hands | No accidental stroke or slice (Golf needs the address step) | L3, L4 |
| M7 | Drift: leave the phone still for 10 minutes, then play | Pointer does not crawl; recentre works | L1, L4 |
| M8 | Sensor rate differences: 20, 30, 60, 100 Hz devices | The same feel; the rate is logged | L1, L4 |
| M9 | Magnetometer interference (near a speaker or laptop) | Rate-based aiming is unaffected | L4 |
| M10 | Rotate mid-race, portrait to landscape and back | Controls re-layout without stalling input more than 150 ms (today 700-850 ms) | L3, L4 |
| M11 | Wrist-only versus arm-swing play | Both work; no game requires a wide arm swing | L4, L5 |
| M12 | Touch fallback: pad drag, steering slider, hold-to-release power | Precise enough to finish a race and a golf hole | L3, L5 |

### 5.3 Latency, network and the relay

| ID | Scenario | Expected | Layer |
| --- | --- | --- | --- |
| N1 | Baseline LAN: 1, 2, 4 phones | p50 and p95 latency within thresholds (section 7) | L2, L4 |
| N2 | Added latency 50, 100, 200, 400 ms; jitter 0-80 ms | Degrades gracefully; the screen shows the seat's link quality | L2 |
| N3 | Packet loss 1%, 5%, 15% | Newest-input-wins; no queue build-up; no frozen cursor | L2 |
| N4 | Bandwidth cap 100 kbit/s | The phone drops emission rate, not frames of stale input | L2 |
| N5 | Wi-Fi to cellular handover mid-race | Reconnects within 5 s with the same seat | L4 |
| N6 | Airplane mode for 5, 15, 25 s, then back | Seat reclaimed within the grace period; the screen showed "away" | L2, L4 |
| N7 | Server restart during a lobby and during a match | A clear message; rejoin works; no ghost seats | L2 |
| N8 | Tunnel (cloudflared) with four phones for 30 minutes | No disconnect storm; latency within threshold | L4 |
| N9 | Long-polling fallback forced (block WebSocket) | Detected and reported; a self-test warning (today polling is allowed and is the documented failure mode) | L2, L3 |
| N10 | Clock skew: phone clock off by minutes | No effect on gameplay | L2 |
| N11 | Four phones plus a spectator display plus the host on one Wi-Fi with other traffic | Within thresholds | L4 |
| N12 | A congested socket: stop reading on the server side for 2 s | Stale input is discarded, not replayed in a burst | L2 |

### 5.4 Lifecycle: sleep, interruptions, tab loss

| ID | Scenario | Expected | Layer | Covers |
| --- | --- | --- | --- | --- |
| L1 | Press the power button mid-game | The screen shows "away" within 1 s; on unlock the phone resumes with a one-tap return, not a 10 s re-calibration | L4 | F3 |
| L2 | Switch to another app for 10 s, 30 s, 2 minutes | Away handling; seat kept; resume works | L3, L4 | |
| L3 | Incoming call or notification shade | Controls release (no stuck pedals) | L4 | |
| L4 | iOS discards the tab under memory pressure | Reopening the link restores the seat (needs the token in `localStorage`) | L4 | F2 |
| L5 | Browser back button, refresh and "close tab" | Back does not leave the room by accident; refresh keeps the seat | L3 | |
| L6 | Low Power Mode or Battery Saver on | Sensor rate and timers observed; warn if the rate collapses (unverified how each OS behaves) | L4 | |
| L7 | Screen auto-lock timeout | Wake lock held; re-acquired on return without leaking | L3, L4 | F11 |
| L8 | Host removes the seat while the phone is away | The phone is told on return, with a "join again" button, not an endless spinner | L2, L3 | F3 |
| L9 | Duplicate-tab takeover | The old tab says "taken over" | L3 | F3 |
| L10 | Seat reserved for a ghost, then the real player returns | Reclaimed by token; the freed ghost is not double-counted | L2 | F2 |

### 5.5 Many phones at once

| ID | Scenario | Expected | Layer |
| --- | --- | --- | --- |
| P1 | Four phones in every game, including Kart Rush split-screen | Every phone's input reaches its own seat only; no cross-talk | L2, L3 |
| P2 | Eight phones attempting to join a four-seat room | The first four seat, the rest are spectators or queued, none crash the server | L2 |
| P3 | All four press Start, Ready and Leave at once | One consistent result; no duplicate rounds | L2 |
| P4 | Four phones calibrate simultaneously | No interference | L2, L4 |
| P5 | Mixed devices: two iPhones, two Androids, one tablet | Parity of feel; per-device sensitivity saved | L4 |
| P6 | 100 simultaneous rooms (room capacity), then the 101st | A clean "busy" message; and per-IP room limits (today none) | L2 |
| P7 | One slow phone among fast ones | Does not slow the others | L2 |
| P8 | A phone spamming input at 1,000 Hz | Rate-limited; others unaffected | L2 |
| P9 | Same name on two phones; very similar colours | Distinct identity by colour, shape and number | L3 |

### 5.6 Host controls (see `host-phone-controls.md`)

| ID | Scenario | Expected | Layer |
| --- | --- | --- | --- |
| H1 | Host phone starts, pauses and returns to lobby with a four-phone room | Works; the server logs each command | L2, L3 |
| H2 | Two start commands at once (TV and phone) | One wins; the other gets a reason | L2 |
| H3 | A non-host phone sends host commands | Rejected | L2 |
| H4 | The host phone drops mid-setup | The role is held for the grace period, then offered to the next seat | L2 |
| H5 | Replayed and malformed `host.cmd` | Ignored or rejected; nothing changes | L2 |
| H6 | Hold-to-confirm: tap versus hold | A tap never kicks or ends | L3, L5 |
| H7 | The host phone in landscape with pedals down | The sheet opens only via the long-press, and pedals release | L3, L4 |

### 5.7 Input abuse and ergonomics

| ID | Scenario | Expected | Layer |
| --- | --- | --- | --- |
| A1 | Tap storm: 20 taps a second on every button | No flood, no stuck state | L3 |
| A2 | Multi-touch: three fingers, palm rejection, edge swipes | No phantom press; edge gestures do not leave the page | L3, L4 |
| A3 | Pedals: hold two at once, slide between them | Correct state; no stuck pedal after release | L3, L4 |
| A4 | Thumb reach on a 6.7" phone one-handed and on a small phone | Primary controls reachable | L5 |
| A5 | Mid-air mis-press rate (section 8, task T1) | Below threshold with the new layout | L5 |
| A6 | Pull-to-refresh, pinch zoom, text selection, long-press menus | Disabled where they hurt play; text entry still works (F10) | L3, L4 |
| A7 | Screen rotation lock on versus off | Playable both ways | L4 |
| A8 | Glare outdoors or in a dark room | Legible (contrast tests) | L4, L5 |

### 5.8 Feedback, accessibility and safety

| ID | Scenario | Expected | Layer |
| --- | --- | --- | --- |
| F1 | Haptics on Android; none on iPhone | A visual pulse and audio click on every event even without vibration | L3, L4 |
| F2 | Reduced motion, gentle effects, high contrast, large text | Honoured on the phone, not only the host screen | L3 |
| F3 | Colour-blind simulation (protanopia, deuteranopia, tritanopia) | Seats distinguishable by shape and number | L3 |
| F4 | Screen reader walk-through of join, ready and leave | Labelled in order | L3, L4 |
| F5 | First-run safety screen and break reminder | Shown once; dismissible; never blocks reconnect | L3 |
| F6 | Strap or grip test: a drop from waist height with a case | Not a software test; recorded in the safety notes | L4 |

### 5.9 Security fuzz

| ID | Scenario | Expected | Layer |
| --- | --- | --- | --- |
| S1 | Malformed, oversized and wrong-typed messages on every event | Ignored; no crash; no state change | L2 |
| S2 | Impersonate another seat's token, or another room's code | Rejected | L2 |
| S3 | Name and guess text with script and markup | Never executed or rendered as HTML | L2, L3 |
| S4 | Room-code guessing at speed | Rate-limited | L2 |
| S5 | One client creating rooms until the cap (confirmed in the audit: 100 rooms, then "busy") | Per-IP room limit | L2 |
| S6 | Four anonymous joins to one room by code (confirmed) | Room lock, auto-lock when a match starts, and join rate limits | L2 |
| S7 | A kicked player rejoining at once (confirmed) | A kick list by device token | L2 |

### 5.10 Long runs

| ID | Scenario | Expected |
| --- | --- | --- |
| R1 | One hour, four phones, rotating games (the soak) | No desync, no dropped seat, no memory growth, sensor rate stable |
| R2 | Eight hours with one host tab and idle phones | Room expiry and idle behaviour as designed; no leaks |
| R3 | 200 sequential rounds with fake phones | No leak in server memory; history cap respected |
| R4 | Repeated rotate, sleep and reconnect cycles (1,000) | No leak and no stuck state |

## 6. Tooling and how to inject faults

(Candidates; check each before adopting, since I have not verified current versions or support.)

- **A custom TCP proxy** in the repo (the earlier plan already called for one) is the most portable way to add latency, jitter, loss and bandwidth limits to WebSockets. Browser DevTools network throttling is not reliable for WebSockets.
- Dedicated tools for real-device runs: on Windows a packet-impairment tool such as Clumsy; on Linux `tc netem`; on macOS and iOS the Network Link Conditioner from Apple's developer tools; a Toxiproxy-style proxy is a cross-platform alternative.
- **Sensor injection** for browser tests by dispatching events in the page, plus the DevTools sensor override where available.
- **Android battery and thermal data** through `adb shell dumpsys` (battery and thermal services); iOS has no equivalent from the command line, so use Xcode Instruments where a Mac is available and otherwise the Battery screen in Settings plus the sensor-rate trace below.
- **A "phone black box":** every real-device run logs, once a second, the sensor rate, send rate, round-trip time, battery level where available, and visibility state to a file the tester can export (build on the existing `/self-test` page and the 3-second ping). This produces the data for thermal throttling (a falling sensor rate over time) without special hardware.

**End-to-end latency measurement (two methods).**
1. *Software:* timestamp each input on the phone, estimate the phone-to-server offset with a four-timestamp exchange, and timestamp the frame on the host that consumed it. Good for trends and regressions.
2. *Camera:* film the phone and the screen together at 240 fps (most modern phones can), perform a sharp motion, and count frames between the motion and the on-screen reaction. This is the ground truth and catches display and render latency that software misses. Do it on each release for the headline games.

## 7. Metrics and pass thresholds (starting values, to be tuned with data)

| Metric | Target | Notes |
| --- | --- | --- |
| Motion-to-screen latency, LAN | p50 under 60 ms, p95 under 100 ms | The 100 ms bar is AirConsole's published guidance; the plan's own estimate is 40-80 ms |
| Latency over the tunnel | p95 under 150 ms | The plan's estimate is 70-150 ms |
| Input rate | 60 Hz default; falls to 30 Hz on high RTT; measured sensor rate logged | Today about 30-33 Hz fixed |
| Dropped or stale-input bursts | Zero bursts after a 2 s stall | |
| Join time (scan to ready) | Median under 30 s; under 10 s when permission is already granted | First-run with permissions is slower |
| Calibration | Succeeds in under 1 s on 95% of attempts | |
| Reconnect after a 10 s outage | Seat reclaimed within 5 s on 99% of attempts | Needs the token fix |
| Seat reclaim after tab loss | 100% when the token is persistent | |
| Touch targets | 100% of controls at least 48 px (primary at least 96) | Automated |
| Text contrast | 100% of text at least 4.5:1 | Automated |
| Mis-press rate in the timed mid-air task | Under 3% with the new layout (set a baseline first) | Section 8 |
| Battery drain | Under 12% per hour of play on a mid-range phone, screen on | A starting guess; measure first |
| Sensor rate stability over an hour | Within 15% of the starting rate (thermal indicator) | |
| Server | No message loss and no crash under the fuzz and flood sets | |
| Zero stuck states | No seat stuck in "Reconnecting" more than 30 s unless the server removed it, and then it says so | F3 |

## 8. L5: the human playtest protocol

**Sessions.** At least six facilitated sessions before each milestone, each with 3-4 players and one host, run on the real stack (TV, tunnel or LAN, four phones). Include: first-timers who have never seen the product; a family group with a child and an adult; a group with a left-handed player; one player on an old, low-end Android; one player on a recent iPhone; and one session where the group is told nothing and must figure it out.

**Tasks to time and score.**
- T1 (mis-press): from a fixed grip, hit a target button ten times mid-air without looking while waving the phone; count wrong presses.
- T2 (join): from "scan this" to "I'm in and ready", with no help; record the points where people hesitate.
- T3 (recovery): lock the phone, wait, unlock; return to the game.
- T4 (host): a first-time host starts a second game and changes one setting.
- T5 (wheel): finish a race in each of touch and motion modes.
- T6 (tablet and small phone): same tasks.

**Observation sheet (per player):** device and OS; grip; handedness; hesitations (timestamps); mis-presses; confusion quotes verbatim; comfort after 10 and 30 minutes; any hand or wrist strain; any near-drop; things they tried that did not work.

**Questionnaire:** a short ease-of-use scale after each task; "which phone was yours, and how did you know?"; whether any button was ever pressed by accident; whether they would play again.

**Rules:** the facilitator never explains the controller; every observed problem is logged with a severity (blocks play, annoys, cosmetic); no more than one design change between two sessions so the effect is attributable.

## 9. CI, nightly runs and release gates

| Set | Contents | When |
| --- | --- | --- |
| **Fast** | L1 unit tests; L2 protocol simulation of join, reconnect, host and fuzz basics (under 3 minutes); L3 smoke of the phone page (renders, target-size and contrast checks) | Every commit and PR |
| **Nightly** | L2 long set (flood, flap, 200 rounds, chaos matrix); L3 full device-emulation matrix; a 1-hour fake-phone soak | Every night |
| **Release gate** | The fast and nightly sets green; the L4 device matrix signed off; the camera latency measurement recorded; the L5 sessions run with no "blocks play" findings open; the one-hour four-phone soak on real phones | Before any tag |

Failures produce artifacts: the scenario log, the server's admin log, screenshots, and the phone black-box trace.

**Device matrix (start here, adjust to what can be borrowed or bought):** a recent iPhone and one two to three years old, both on the current iOS and one iOS version back; a recent Samsung flagship; a mid-range Android (Xiaomi, Realme or Poco class, popular in India); a low-end Android with a weak gyro; one tablet; and one phone with no gyroscope or with sensors disabled if one can be found. Browsers: Safari, Chrome, Samsung Internet; and the in-app browsers of Instagram and WhatsApp.

## 10. Bug template and triage

Every finding records: scenario ID; device and OS and browser version; build id; steps; expected versus actual; the black-box trace; severity (blocks play, annoys, cosmetic); owner. Severity "blocks play" blocks the release gate. Findings F1-F17 above become the first backlog entries, each tied to a scenario that would have caught it.

## 11. Order of work

1. Install dev dependencies, run `session.test.cjs` and `network-smoke.cjs`, get a green baseline (L2).
2. Build the `FakePhone` harness and the chaos proxy; port the 19 session tests onto it.
3. Add the L3 checks for target size and contrast first; they fail today, which is exactly their job, and they gate the controller redesign in [the visual plan](visual-direction.md).
4. Fix F2, F3, F4 and F17 (seat token, dead-end disconnect, confirmations, idle autopilot) with their tests written first.
5. Add the phone black box and the camera latency method; take the first real-device baseline.
6. Run the first human sessions on the *current* controller to record a baseline, then again after the redesign.
7. Add the soak and the nightly set.

## 12. What this plan cannot do

It cannot prove iOS behaviour without real iPhones (Playwright's WebKit is a proxy), it cannot measure thermals directly on iOS, and the thresholds above are starting points chosen before any real-device data exists. The first real-device run should replace the guesses with measurements.
