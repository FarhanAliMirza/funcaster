# Build guide 13: the users, the controller as the account, and how each scenario works

Part of the [build guide](00-README.md). Status: plan, 6 November 2026. **No code is written.** The TV exists to **show** the game; most people will hold only their phone. So the **phone is the account**: it authenticates the person, holds their play coins, signs everything that is theirs, and is where a seated player stakes and where anyone predicts. This document names the kinds of users, defines the account and the identity levels, makes the controller the account's home, then walks through the scenarios one by one. It updates [10](10-prediction-market.md) and [11](11-prediction-market-ui.md): **the spectator `/predict` page becomes the Predict tab of the account app**.

## 1. The kinds of users

| # | User | What they are | Main device | Typical goal |
| --- | --- | --- | --- | --- |
| U1 | **Host** | Runs a party: owns the TV or laptop, creates the room | TV shell plus their phone | Get friends playing in 20 seconds; start and manage matches |
| U2 | **Player (seated)** | Holds a seat and plays | Controller (phone) | Play, win, stake with friends, see stats |
| U3 | **Queue player** | Waiting for a seat in a Kiosk or full room | Phone | Pass the time; predict on the current match |
| U4 | **Spectator** | Not playing: a friend on the sofa, a booth passer-by | Phone only | Watch and predict; no commitment |
| U5 | **Walk-up solo player** | A Kiosk visitor playing alone | Controller | Beat the line and the leaderboard |
| U6 | **Remote friend** | In another place, watching (a later feature) | Phone or laptop | Predict and cheer |
| U7 | **Operator or staff** | Runs a booth with the staff PIN | TV shell, a staff phone | Keep it running; handle issues; review flags |
| U8 | **Judge, auditor, press** | Wants to verify the claims | Laptop | Check every transaction, replay and number |
| U9 | **Creator** | Publishes a game | Laptop | Distribution; later, markets and stats for their game |
| U10 | **Sponsor** | Funds a bonus or a prize pool | Dashboard | Add a bonus to markets or a season prize |
| U11 | **Adversary** | Tries to cheat, farm or fix | Anything | Inflate stats, steal, fix outcomes ([15](15-integrity-and-anti-cheat.md)) |

## 2. The account and the identity levels

**An account is the phone's key.** It is created silently on first use, lives in the browser, signs every EIP-712 message, owns the seat's ENS name, receives payouts and is the owner of trophies. Levels, each unlocking more:

| Level | How you get it | You can | Limits |
| --- | --- | --- | --- |
| **L0 Viewer** | Nothing (no key) | Watch the TV, browse the Ledger and the public leaderboards | Read only |
| **L1 Guest** | Open the controller or the account app (silent key, starting bankroll) | Play, stake in a pot, predict, see your own history | Small caps; stats are **provisional** (shown, but not eligible for the main boards, [14](14-stats-and-leaderboards.md)) |
| **L2 Verified human** | One tap **Verify I'm a person** (World Selfie Check, once) | Everything in L1 plus **higher caps** (about 5x), **eligibility for the ranked and predictor leaderboards**, proposing pots, account recovery on a new phone | One account per human (nullifier) |
| **L3 Named** | Choose a persistent handle; optional ENS hall-of-fame name (`asha.players.<parent>.eth`) | A name on boards and receipts that survives parties | Names are moderated |
| **Staff** | Staff PIN on the TV or a staff phone | Chain and Ledger windows with host-only detail, flag review, cancel markets **before** close | Cannot change payouts or resolved markets |

This **supersedes rule 2 of the stakes plan** ([08](../08-stakes-product-and-legal.md): every staked seat must be verified): the requirement is now configuration, `STAKES_MIN_LEVEL` (default **L1** at play-money events so a booth is frictionless; set **L2** to enforce humans-only pots). **Leaderboard and ranking eligibility always needs L2** ([14](14-stats-and-leaderboards.md)). Caps scale with level ([08](08-config-and-ops.md): `MARKET_MAX_PER_ADDRESS` and the pot stake presets have an L1 and an L2 value).

**Decision (6 November, owner): World is not being built now; L2 is implemented minimally as a booth attestation.** The World design in this section stays in the repository as the **later upgrade path** and is not a task. What is built: a **booth-verified L2** (task X2b). The player taps **Verify me at the booth**, which shows a short code and a QR; a staff phone (the staff PIN of [05](05-ui-integration.md)) scans it, looks at the person, and signs `Attest(address, level=2, venue, expiresAt)` with the **staff key**; the relay records the attestation (an Arkiv `badge` entity owned by the player, and a Ledger row with the badge `verif=booth`). Honest labels everywhere: **"Verified at the booth"**, never "verified human". It grants what L2 grants (ranked and predictor eligibility, higher caps, proposing pots, the Cup's ranks) but **recovery by World is not available**: lost-phone recovery is **device linking only** (a staff-assisted re-attestation at a booth is the fallback, which moves the stats by the old address through `AccountMoved` after a staff-signed confirmation). Limits stated plainly: one staff signature is one person's judgement, so each staff key has a per-day cap, attestations are venue-scoped and expire (for example 30 days), and the **booth-verified board** is a different board from a future World-verified board. The relay reads the level from the attestation, so replacing the attester with World later changes one verifier, not the account model.

**Authentication** is possession of the key: relay endpoints that need to know who you are (bankroll claims, permits, per-human caps, linking a device) use a short **signed challenge** (an EIP-712 `Auth(nonce, expiresAt)`, valid for minutes, replay-protected), never cookies or passwords. **Device linking:** the old phone shows a QR whose URL **fragment** carries a random one-time secret (fragments are never sent to a server); the old phone encrypts its key with that secret and puts the ciphertext on the relay for 2 minutes; the new phone scans, fetches and decrypts locally; the old phone confirms. **Recovery** (lost phone, L2 only): on the new phone **Recover my account** runs the World verification; the same human produces the same nullifier for our account action, the relay checks it against the one it holds, the new phone generates a fresh key, the relay records an `AccountMoved(old, new)` link in the Ledger and in Arkiv, and **stats and names follow the person**; play coins on the old key are lost (play money, stated plainly). Security basics: a strict content-security policy and no third-party scripts on the account pages (a stolen key is play money, but treat it as real); an optional passkey wrap of the stored key is a later tier.

## 3. The controller is the account's home

Today's controller (`controller.html`, a fixed-position remote that locks scrolling) stays exactly what it is during play. **It gains a menu button, "My Funcaster", that opens the account app** in a bottom sheet (a `<dialog>`, lazily imported, so the baseline controller is unchanged); the **same account app also runs as a standalone page at `/me`** for people with no seat (spectators), sharing the same key and storage (same origin). One codebase, two mount points, **three layouts** (phone, tablet, and a wide laptop layout with keyboard control for spectators at a desk; see the addendum of [11](11-prediction-market-ui.md) and the situations of [17](17-situations-and-edge-cases.md)).

| Tab | Content | Needs |
| --- | --- | --- |
| **Predict** | The market carousel, slip and My Predictions of [11](11-prediction-market-ui.md) (the page formerly called `/predict`) | L1 |
| **Wallet** | Play-coin balances **per asset (USDC and EURC)**, the refill rule, **Verify I'm a person**, **Use on another phone**, **Recover**, key notice and reset | L1 |
| **Activity** | My transactions from the Ledger in plain words, each with a badge and a Verify tap ([12](12-reality-and-ledger.md)) | L1 |
| **Stats** | My wins, ratings, predictor stats, achievements, head-to-head and rank ([14](14-stats-and-leaderboards.md)) | L1 (provisional) / L2 |
| **Profile** | Handle, ENS name, verification, my trophies, privacy switches (publish my name, publish replays) | L1 |

**Principles:** (1) **every money action is initiated and confirmed on the person's own phone** (accept a stake, place a prediction, claim, link a device); the TV never initiates a money action for a person and shows only aggregates and QR codes; (2) **a seated player's money moves through the controller**: the stake **terms card** appears there (and **any seated player can propose a pot**, not only the host: tap **Propose a pot**, choose amount, rule and asset; the others get the card and accept or decline; the host can still set it in Game Properties); (3) **a player cannot predict on their own match** (they are barred, because the players control the result; the legitimate way to back yourself is the pot, where every seat stakes equally and signs the same placing), **but a player can predict on other matches** (another TV, the next match, a match they are queued behind) from the same sheet; (4) during `playing` the sheet is **view-only** (no money actions, to avoid distraction and pocket taps) and opens fully in the lobby and results phases; (5) the **motion-permission rule is untouched**: nothing in the account flows may run inside or before the `#enable` tap handler ([05](05-ui-integration.md) section 4.1).

## 4. Capability matrix (who can do what, where)

| Action | L0 | L1 | L2 | Host | Staff | Where |
| --- | --- | --- | --- | --- | --- | --- |
| Watch a match on the TV | yes | yes | yes | yes | yes | TV |
| Browse leaderboards, the Ledger and the Predictions list | yes | yes | yes | yes | yes | TV windows, `/ledger`, `/me` |
| Play (seated) | | yes | yes | yes | | Controller |
| Stake in a pot | | yes (small cap) | yes (large cap) | yes | | Controller |
| Propose a pot | | host only by default | yes | yes | | Controller |
| Predict on a match | | yes (small cap) | yes (large cap) | yes | | `/me` or the controller sheet |
| Predict on a match you are seated in | no | no | no | no | no | barred |
| Appear on ranked and predictor boards | | no (provisional) | yes | yes (if L2) | | Boards |
| Start, pause, kick | | | | yes (or the delegated host) | yes | Shell or the host phone |
| Cancel a market before close | | | | yes (lineup change) | yes | Shell |
| Review integrity flags | | | | | yes | Chain and Ledger windows |
| Change a payout or a resolved market | nobody | | | | | impossible by design |

## 5. Scenarios

Each scenario lists the situation, the steps (who sees what, what is signed, which transactions the platform sends) and the edge cases. "Silent" means the key signs with no prompt; "worker tx" means a transaction the worker sends and pays for. Everything is **play money on testnets**.

### S1. Friends' night in: three players, a pot, no spectators

1. The host opens the TV shell; the room is created; the party name (`kart-otter-7k.play.<parent>.eth`) appears after about 12 to 25 s (worker txs, async). The QR shows.
2. Three friends scan the QR on their controllers; each enters or confirms a nickname; **silent** key creation and bind; a **starting bankroll** arrives in the background (worker tx); seat names are minted (worker txs).
3. The host picks Star Catch and sets **Stakes: 1.00 USDC, winner takes all** (or any seated player taps **Propose a pot** on their controller).
4. Each controller shows the **terms card**; one tap **Put in my stake** (two silent signatures); worker txs: create, fund x3; the pot **locks**; Start enables.
5. They play; the phones are remotes.
6. Result: each phone shows "Agreeing in 5…" and signs silently; worker txs: settle, claims x3; the Results window shows the receipt; the Ledger shows about 12 rows.
7. Stats update (provisional for L1 guests; ranked if L2).

*Edge cases:* one friend declines or has too little: the host sees why and can play without a pot; a friend's phone sleeps during funding: the funding deadline (180 s) continues, then the attempt cancels and nobody loses anything; a friend taps Dispute: the oracle path runs (section S11).

### S2. The same night: a fourth friend watches and predicts

1. The fourth friend is on the sofa with a phone: they scan the **Spectators QR** in the Invite window (or open `/me`), see the **Predict** tab with the room's match listed once the lineup locks.
2. They pick a seat (A, B or C), tap a chip, tap **Predict**: 3 taps, one silent signature, one worker tx (the bet).
3. Betting closes at the on-chain close; the match starts; at the result they get the result card and are paid automatically (worker txs: reports A and B, finalize, claim).
4. The three players see "1 person is predicting, pool 0.25" in the Players window footer.

*Edge cases:* the friend then **joins as a player in the next match**: allowed (the new lineup has a new market from which they are barred); the friend has no starting bankroll left: the refill rule or a staff top-up.

### S3. Booth: a solo walk-up player and the crowd predicting

1. A visitor scans the Kiosk QR and joins solo; the Kiosk **locks the lineup** and creates a **Beat-the-line** market (the line comes from the leaderboard median) with a 60 s window; the **odds board** on the TV shows it.
2. Passers-by scan the board's QR and predict "Beats 240" or "Falls short".
3. The player cannot predict on their own market (barred); they play; the result is replay-verified; reports A and B agree; winners are paid.
4. The player's score may enter the **Top scores** board (verified tier game, solo: ranked only if L2).

*Edge cases:* the player leaves before the start: the market **voids** and everyone is refunded; the player forfeits mid-match: the market voids (forfeit rule); nobody predicts: the market voids at close (one-sided).

### S4. Booth: a passer-by who only wants to predict

1. The visitor scans the QR on the TV board or on a poster; `/me` opens; a one-time card "Predict who wins. Play coins only. [Start]".
2. Silent key; starting bankroll (1.00) arrives; the carousel shows the next match; they predict in 3 taps.
3. They watch the TV; the result card appears; **My Predictions** and the **Activity** tab show the rows with badges; the Top predictors board shows their rank if L2.

*Edge cases:* storage blocked (private browsing): a "this session only" banner; they run out of coins: the refill rule (once a day under 0.10) or ask staff.

### S5. Kiosk queue: a player waiting for a seat

1. The visitor joins, the Kiosk is full: they are in the **queue** ("You are 3rd"). Their controller shows the queue position and the **My Funcaster** button.
2. They open **Predict** and predict on the current match (allowed: they are not seated in it).
3. They are promoted into the next lineup; **that** match's market is created after the lineup lock, and they are **barred** from it (the permit refuses them); earlier predictions stand.

*Edge cases:* a seat leaves during a betting window and the queue player is promoted: the market voids and a new window opens (their old prediction on the voided market is refunded).

### S6. A group of guests (nobody verified)

Everyone plays as L1. A pot works within the L1 caps (or is disabled if `STAKES_MIN_LEVEL=L2`, with the reason shown). Their results appear in **provisional** stats; nothing they do reaches the main boards until they verify (one tap, any time; **history before verifying counts retroactively** only for matches whose results and bindings are on record).

### S7. A player verifies and gets a name

1. In **My Funcaster, Wallet**, tap **Verify I'm a person**; a World Selfie Check (once).
2. The level becomes L2; caps rise; the profile shows "Verified"; the player may claim a persistent handle and an ENS hall-of-fame name (worker tx).
3. Their provisional history is re-evaluated for eligibility.

*Edge cases:* the verification is unavailable (the service is down or not offered in the region): the account stays L1 and the UI says why; a second account from the same human is refused (nullifier).

### S8. A phone dies or reloads mid-match

1. The phone's key persists in the browser; the seat token resumes the seat (existing reconnect logic).
2. **If it returns within the existing 30 s disconnect rule**, the player continues; the pot and markets are untouched.
3. **If not**, the seat forfeits (the existing rule): a staked match is `abandoned`: **refund**; markets **void**.

*Edge cases:* the phone sleeps while a stake request is open: the request expires with its deadline and nothing is charged; the key was cleared (private tab closed): a new identity (play money), the old seat name expires with the party.

### S9. The same person on a new phone

**Link:** the old phone **Use on another phone** shows the QR; the new phone scans; the key moves (section 2). **Recover (L2):** verify on the new phone; the account follows. Stats, handle and trophies are the same; the old phone's coins are not.

### S10. The host's TV crashes mid-pot or mid-market

Controllers show "Waiting for the host…" then, after the settle deadline, the pot is **refundable by anyone** (the worker also triggers it when it can); markets **void** after `resolveDeadline` (anyone can trigger). Players see "Refunded: the match did not finish". Nothing is stuck and the platform never held the money.

### S11. A player disputes the result

1. The countdown banner shows the placing; the player taps **Dispute** (they do not sign `Settle`).
2. After 60 s without all signatures the oracle path runs: reporter A proposes, verifier B re-runs the replay and agrees or the pot contests; the **challenge window** (120 s) lets any seat contest.
3. A contest **refunds everyone**; the match remains on record, flagged "disputed"; repeated disputes by one player against several opponents are a signal ([15](15-integrity-and-anti-cheat.md)).

### S12. A judge or auditor verifies everything

1. Opens `/ledger` on a laptop: the coverage header, the hash chain head and the rows.
2. For any row: **Verify now** (two RPC hosts), the exact JSON-RPC request, the explorer link; for any match: the result hash, **`npm run replay:check`** on the saved `{result, replay}` (or the verifier's output), and the pot or market state read straight from the chain.
3. Reads the **reality run** report and the evidence book; checks the transparency-log checkpoints on the `play` registry and in Arkiv.

### S13. An adversary tries to cheat (mapped to [15](15-integrity-and-anti-cheat.md))

| Attempt | What happens |
| --- | --- |
| **Win-trading**: one human plays both seats of a two-seat match with two phones | Same device or network signal, same nullifier for both accounts or an unverified pair: the match is **flagged** and **excluded from ranked stats**; the pot is unaffected (it only moves the person's own money between their two keys) |
| **A bot plays** | Input-entropy and timing detectors flag it; the replay still verifies (the game ran correctly) but the result is **excluded from ranked boards** pending review |
| **Throwing a match for a friend who predicted** | Predictors are barred from their own match; concentration and funding-cluster alerts fire; a flag **voids the market before resolution** (void only) |
| **Faucet and bankroll farming** | One refill per nullifier per day and per device; non-transferable coins; farmed accounts are L1 and ineligible for boards |
| **Showing a fake transaction** (a screenshot or a forged claim) | The Ledger shows only rows backed by RPC receipts; **Verify now** fails for a fake hash |
| **The operator edits stats** | The Ledger hash chain and the transparency-log checkpoints expose a rewrite; stats are recomputable from public data |
| **A host forges a replay** | Verifier B re-runs the replay on the pinned commit; a mismatch makes the market void and the result `failed` |
| **A relayer withholds a bet** | Anyone may submit the signed bet; two relayers; the authorization expires and costs nothing |

### S14. The operator at a booth

The operator uses the staff PIN. They keep the TV on; the **Chain** window shows health and balances (host-only detail); they review **flags** (a list with the rule, the match and the action taken) and can **cancel a market before it closes** (a lineup problem) or mark a match "excluded from boards"; **they cannot change a payout or a resolved market** (it is not possible in the contracts). Staff actions are written to the Ledger as `ops` rows signed by the operator key.

### S15. A creator's game

A **casual-tier** (unverified) game gets no markets and no ranked stats (the result cannot be recomputed); a **verified-tier** game ([10](10-prediction-market.md) section 3.1) can have markets and boards once its replay verifier exists. The creator sees play counts and the game's record table.

### S16. A euro room

The host (or any proposer) picks **EURC** for the pot or the markets (Game Properties, or the propose card); the Wallet shows both balances; amounts show "play euros"; each pot or market names one asset and never mixes; boards are per asset with an asset-neutral **ROI** ranking across assets ([14](14-stats-and-leaderboards.md); [16](16-arc-native-features.md)).

### S17. A venue with no internet

`PARTNERS=mock` runs automatically with the **DEMO MODE** ribbon: names, pots and markets work locally; **no hashes exist**, **no ledger rows are written** and **mock results are never counted** in boards or stats. When the connection returns the platform switches back; nothing from the mock period is replayed on chain.

### S18. A chain or service is down

| Down | Players see | Spectators see | The platform does |
| --- | --- | --- | --- |
| ENS (Sepolia) | Nicknames; "host power is server-checked right now" | The same | Keeps playing; stakes use bound addresses |
| Arc | Stakes disabled with the reason; a funded pot can be refunded | Predictions disabled ("paused; play continues") | Keeps playing; resolves nothing it cannot prove |
| Arkiv | Local leaderboard | Local board | Outbox; Ledger keeps indexing the others |
| The worker | "Saved locally" labels | The same | Outbox grows; Ledger shows pending |
| The indexer | Results and balances still read straight from the chain | Ledger "stale" banner | Reindex on recovery |

### S19. A spectator out of coins

The refill rule gives 1.00 when the balance is under 0.10, once a day per device and per nullifier; otherwise "You're out of play coins for today. Ask staff for a top-up, or come back tomorrow." A staff **top-up** (host-only button in the Chain window, capped and written to the Ledger as an `ops` row) exists for demos.

## 6. Who sees what, where

| Surface | Viewer | Player | Spectator | Host and staff | Auditor |
| --- | --- | --- | --- | --- | --- |
| TV: game and windows (Players, Invite, Results) | yes | yes | yes | yes | |
| TV: Predictions, Leaderboard, Ledger, Chain (aggregates and public rows) | yes | yes | yes | yes (more detail for staff) | |
| Kiosk odds board | yes | yes | yes | yes | |
| Controller: Play | | yes | | yes | |
| My Funcaster (Predict, Wallet, Activity, Stats, Profile) | | yes | yes | yes | |
| `/me` standalone | | | yes | | |
| `/ledger` | yes | yes | yes | yes | yes |
| Flags and ops | | | | staff | read-only summary |

## 7. Tasks (lane X: accounts)

| ID | Task | Depends | Hours |
| --- | --- | --- | --- |
| X1 | Account app skeleton (`public/me/`): tabs, key, auth challenge, mounts as `/me` and as the controller's bottom sheet | S4 | 14 |
| X2 | Identity levels: L1 caps, level-scaled caps, `STAKES_MIN_LEVEL`; **L2 as the booth attestation** (staff-signed, expiring, venue-scoped; World is a later upgrade and not built) | X1 | 8 (the World flow is removed from this task) |
| X3 | Device linking (QR with fragment secret, encrypted handoff) and L2 recovery with `AccountMoved` | X1, X2 | 12 |
| X4 | Controller integration: the My Funcaster button, view-only during `playing`, **Propose a pot**, queue view | X1 | 8 |
| X5 | Activity, Wallet (per asset), Profile tabs | X1, L4 | 10 |
| X6 | Scenario tests S1 to S19 as Playwright flows with fake phones | all | 14 |

About **66 hours**; Predict ([11](11-prediction-market-ui.md)) and Stats ([14](14-stats-and-leaderboards.md)) tabs are in their own lanes.
