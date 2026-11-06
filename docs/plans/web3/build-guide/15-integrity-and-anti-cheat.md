# Build guide 15: integrity and anti-cheat (so nobody can inflate stats or fake transactions)

Part of the [build guide](00-README.md). Status: plan, 6 November 2026. **No code is written.** This is the full cheating and fraud design: what an adversary might try, the layers that stop or expose it, the detectors with starting thresholds, what happens when one fires, and how the whole thing is itself transparent. It feeds [14](14-stats-and-leaderboards.md) (what counts), [12](12-reality-and-ledger.md) (what is real) and [10](10-prediction-market.md) (markets). Marks: **[V]** verified in a source, **[S]** secondary, **[R]** recalled or our own design. **Every threshold is a starting value: measure first** (a baseline of real phone input and real play must be collected in the rehearsals before any detector is allowed to act).

## 1. The honest limits (read first)

- **Deterministic replay proves the result follows from the input log, the seed and the engine version**; it catches server tampering and score editing, and anyone can recompute it. It **does not prove the inputs came from a human, from a phone, without assistance, or that two seats are different people** [R]. A script can emit a perfect input log, and a recorded real trace can be replayed.
- **No detector proves intent.** Everything below produces **signals**; the response tiers (section 5) keep an innocent from being shamed.
- **Friends on one network look exactly like collusion** to any pair-based detector. So private rooms are exempt from global boards ([14](14-stats-and-leaderboards.md) principle 3) and pair signals only reduce weight; they do not ban.
- **World verification is not an identity proof** (rented or sold Orb IDs have been reported [S]); it makes sybils costly, not impossible.
- The platform's own operator is a trust point (Kiosk staff, the relay's keys); section 7 limits and exposes it.

## 2. The threat model

| # | Adversary goal | Method | Layer that stops or exposes it |
| --- | --- | --- | --- |
| T1 | Inflate wins or rating | Win-trading with an alt in the same match; boosting; farming weak opponents | Ranked-room rule, pair weights, distinct-opponent minimums, gain caps, F1 to F4 |
| T2 | Inflate a score | Edit the result; forge a replay; a bot with perfect inputs; macros | Replay verification, verifier B, input forensics F5 and F6 |
| T3 | Inflate prediction profit | Opposite-side wash bets with two keys; funnel profit from a second account; late whale; self-bet | F8 to F11, caps, permits, pool-share caps |
| T4 | Fix a match for a prediction | Players throw; a friend bets | Players barred from their own market, F10, concentration alerts, void before resolution |
| T5 | Farm free play money | Many keys claiming the bankroll | Per-nullifier and per-device caps, non-transferable coins, funding-cluster merge F7 and F12 |
| T6 | Fake a transaction or a stat | A screenshot, a forged claim, a manipulated database | Ledger rows only from RPC receipts, Verify now, hash chain, transparency log, recomputable stats |
| T7 | Steal or redirect money | Front-run a signature; a malicious relayer; a reverting recipient; a compromised key | `receiveWithAuthorization`, intent-bound nonces, pull claims, key separation, no admin |
| T8 | Corrupt resolution | Compromise the reporter; bribe the verifier | Agree-or-void on a full commitment, layer C, permissionless void, independent verifier |
| T9 | Abuse the operator's power | The operator edits stats or bets with inside knowledge | Operator and staff addresses barred from betting and from boards, `ops` rows in the Ledger, hash chain |
| T10 | Griefing | Spam markets or rooms; mass-join a kiosk queue; dispute everything | Only the relay creates markets, caps per room and hour, rate limits, F15 |

## 3. The six layers

1. **Proof.** Replay verification; verifier B on the pinned commit; chain receipts verified by two RPC hosts; the Ledger's hash chain.
2. **Identity.** The account levels ([13](13-users-scenarios-and-accounts.md)); `humanId` per season from the World nullifier; funding-cluster merging; device correlation as a weak extra only.
3. **Economic limits.** Caps by level, per address and per pool; seated players barred from their own market; non-transferable play coins; the bet permit.
4. **Detection.** The detectors F1 to F17 (section 4).
5. **Response.** Three treatment tiers T0 to T2, with appeals (section 5).
6. **Transparency.** A flag log, a Ledger of flags and `ops` actions, the daily checkpoints, recomputable boards (section 8).

## 4. The detectors (inputs, rule, starting threshold, treatment)

Treatment tiers: **T0** silent, deterministic (a weight reduction or exclusion from a stat; no accusation); **T1** "under review" (neutral; a human reviews); **T2** confirmed (removal with a reason code, evidence hash and a 14-day appeal; public naming only here).

### 4.1 Rating and wins

| Code | Signal | Rule (starting threshold) | Tier |
| --- | --- | --- | --- |
| **F1 PAIR_CONC** | One opponent dominates a player's matches | At least 50 percent of the last 30 rated matches against one opponent, with at least 10 matches | T0 (the pair weight deepens) |
| **F2 WIN_TRADE** | A repeated underdog win or alternating winners in a pair | The lower-rated player wins at least 6 of the last 8 against the same opponent (expected probability under 0.3, binomial p under 0.001); or near-perfect alternation of winners across at least 8 matches | T1 |
| **F3 GAIN_CONC** | Rating gains come from one source | Over 60 percent of the last 7 days' positive rating change from one opponent | T0 |
| **F4 SANDBAG** | Lose on purpose, then climb | At least 3 consecutive results with robust z under −3.5 against the player's own median, then a gain of at least 200 Skill within 14 days | T1 |
| **F13 DUAL_SEAT** | One human on two seats of one match | Two seats in a match share a humanId or a funding parent or a device signal (a device signal alone only T0; the combination T1) | T1 |

### 4.2 Scores and inputs

| Code | Signal | Rule | Tier |
| --- | --- | --- | --- |
| **F5 SCORE_OUTLIER** | An implausible score | Robust modified z, `z_m = 0.6745·(x − median) / MAD`, with `|z_m| > 3.5` (Iglewicz and Hoaglin [V via a secondary page]; a floor on MAD) against the player's own history (at least 8 results) **and** above the population's 99.9th percentile; then an automatic **replay and input audit** | T1 |
| **F6 INPUT_TRACE** | Input that no hand produces | Touch or step interval coefficient of variation under 0.02 over at least 50 events; at least 5 percent of reactions under 120 ms to a visual or audio trigger (the sprinter literature suggests about 115 to 120 ms as a floor [S]); IMU noise floor near zero while "moving"; perfectly periodic timestamps; tilt from the gyro disagreeing with the accelerometer beyond drift; zero entropy in the input journal | T1 |
| **F14 REPLAY_MISMATCH** | The replay does not reproduce the result | Verifier B recomputes different scores or a different `winMask` | immediate: the result is `failed`, markets **void**, the match is excluded; T1 for the host |

**What the server already has:** the **input journal** (the replay itself) holds every input with its time; the phone's device report (tier, sensors, rate) is known [code: `device` event]. **Add** (small and privacy-light): per-seat, per-match **feature summaries** computed at finish (inter-input interval mean, standard deviation and coefficient of variation; reaction-time quantiles where the game defines a trigger; IMU noise floor and a periodicity score; entropy), stored in the relay for the detectors and **never published**. **Limits [R]:** all of this is spoofable by replaying a recorded real trace; it raises the cost, it does not prove humanity. **Baseline first:** the rehearsals (real phones, real people) provide the distributions; the thresholds above are tuned from them, and **no F5 or F6 flag acts until a baseline of at least 200 human matches per game exists**.

### 4.3 Predictions and money

| Code | Signal | Rule | Tier |
| --- | --- | --- | --- |
| **F7 SYBIL_FUND** | Keys share a funding source | At least 3 keys with one funding parent within 24 hours and correlated timing (connected components of the funding graph, as in airdrop sybil hunting [S]); the keys are **merged** into one cluster for caps and boards | T0 merge |
| **F8 OPP_BET_PAIR** | Two keys hedge each other to farm volume | Two addresses bet opposite sides in at least 5 markets with stake ratio 0.8 to 1.25 and a combined net under 10 percent of their volume (the pari-mutuel analogue of closed wash-trading clusters, which a Polymarket study estimated at up to about 60 percent of volume in late 2024 [V, unreviewed paper]) | T0: their volume is excluded |
| **F9 PROFIT_FUNNEL** | A loser feeds a winner | One loser (or one funding link) supplies over 50 percent of a winner's net winnings across at least 5 markets | T1 |
| **F10 SELF_BET** | A participant bets on or against their own match through a linked key | A bettor linked (same humanId, funding or device) to a seat in that match; or a participant's performance in matches with a large outside bet on the opponent is z under −3 against their baseline | T1 (market voided if before resolution) |
| **F11 LATE_WHALE** | One bettor dominates at the last moment | One bettor over 40 percent of a pool placed in the last 10 percent of the window | T0: the market is excluded from the profit board |
| **F12 FAUCET_FARM** | Claims beyond allowance | Claims beyond the per-key, per-device or per-nullifier allowance | T0 |
| **F15 DISPUTE_PATTERN** | Disputing to grief | A player disputes (does not sign) in a large share of matches against several opponents | T1 |

**Also applied as hard rules (not flags):** the permit refuses a seated player and linked keys; per-address and per-pool caps; one counted stake at most 40 percent of a pool for board purposes; no transfers of play coins between keys (the contract pays only the address that bet). A first-significant-digit (Benford) test on stake sizes is a cheap extra signal for wash volume [S: used on crypto exchange data].

### 4.4 Platform integrity (the system watching itself)

| Code | Signal | Rule | Action |
| --- | --- | --- | --- |
| **F16 ORACLE_DISAGREE** | Reporters A and B (or C) disagree | Any mismatch | The market stays open until a third report or the deadline, then **voids**; both reports are logged |
| **F17 LEDGER_GAP** | The Ledger and the chain disagree | A worker receipt with no on-chain log, an on-chain transaction touching our contracts that no worker sent ("external"), an RPC mismatch, a broken hash chain | An alert in the Chain window; "unverified" shown instead of "verified" |

## 5. Response: three tiers, and what each can touch

| Tier | Meaning | Visible to the public | Can it touch money? |
| --- | --- | --- | --- |
| **T0 silent** | A weight reduction or exclusion from a stat, by rule | No accusation; the exclusion log names **matches and markets**, not people | No |
| **T1 under review** | Shown neutrally as "unranked, under review" for the affected stat; a staff member reviews | Neutral label only | **Only by voiding an open market before it resolves** (F10, F14, F16) |
| **T2 confirmed** | Removal from the board with a reason code, an evidence hash and a **14-day appeal**; a first offence resets the rating | Public naming (reason code and evidence hash) | **Never**: resolved markets and settled pots are final by design |

**Nobody, including the operator, can change a payout or a resolved market; they can only void an open market before it resolves** (the contract allows that to the operator before close and to the verifier's veto inside the liveness window; both are logged). The effect of any flag on boards is computed by **the ruleset applied to the flag log**, so anyone can recompute a board with and without a flag.

**The review workflow (staff, in the Chain window):** a **Flags** list (code, subject commitment, evidence summary, tier, age), actions **Dismiss**, **Keep under review**, **Confirm** (T2, with a reason code and an evidence hash), **Exclude this match from boards**, and, for an open market, **Cancel the market** (void). Each action is signed with the operator key and written as an `ops` row in the Ledger and an entry in the flag log. **Appeals:** a confirmed removal shows an appeal contact and window; an appeal outcome is another flag-log entry.

## 6. Fake transactions and fake stats specifically

- **The Ledger only contains rows backed by RPC receipts or chain logs**; the relay cannot write a "verified" mark; **Verify now** re-checks on two hosts; a forged hash fails in front of the viewer ([12](12-reality-and-ledger.md)).
- **Every stat links to its inputs** (matches and transactions); the stats are recomputable ([14](14-stats-and-leaderboards.md) section 6); a stat the recompute cannot reproduce is a bug that blocks publication.
- **External activity is shown, never hidden**: if someone calls our contracts directly (legitimate or not), it appears as "external" with its decoding.
- **Arkiv is a public database where anyone can write entities with our attributes** [K]: every read runs one `createdBy` query per **trusted console** (an allowlist) and validates the payload; results are created **readonly** so a trophy's new owner cannot rewrite them; and a result from a trusted console can still be **re-verified from its Swarm replay** (the forgery tests, [04](04-arkiv-guide.md)).
- **Screenshots prove nothing**: the UI offers the exact JSON-RPC request for any hash so anyone can check it on any RPC.

## 7. The operator and the staff

Operator and relayer **addresses are on a permanent bar list**: they cannot bet and are excluded from boards; staff phones are flagged `staff` and excluded from ranked boards; **keys are separated by role and hold tiny balances** ([10](10-prediction-market.md) section 8 rule 11); operator and staff actions are `ops` rows in the hash-chained Ledger; the **transparency log** (the Ledger head and the stats checkpoint, daily, on chain, in an ENS record and in Arkiv) makes a silent rewrite of history detectable; the **verifier B runs as a separate process and key** and ideally on a different machine; the layer-C report comes from outside the infrastructure. **Residual trust, stated plainly in the README:** a Kiosk operator who controls the game host could feed inputs; verifier B proves the result follows from the inputs, not that the inputs were honest.

## 8. Transparency without shaming

The **flag log** is public in aggregate (counts by code and tier) and in detail only for **confirmed T2** items (reason code, evidence hash, effective date, appeal status); T0 and T1 appear as neutral labels on the affected board entry ("provisional", "under review") with no reason shown. The match and market **exclusions** are listed by match or market id with the rule that excluded them. The daily checkpoint covers the match log, the flag log, the ruleset hash and the board hash.

## 9. The red-team suite (`tests/web3/adversary/`)

Each scenario is a script that generates synthetic data or drives fake phones, and the test passes only if the **expected detector fires and the expected effect happens**:

| Scenario | Expected result |
| --- | --- |
| A single human plays both seats of 20 two-player matches with two keys | F13 and F1 fire; the matches are excluded from ranked stats; ratings unchanged beyond the pair weight |
| Alternating winners in a pair over 10 matches | F2 (T1) |
| A scripted bot with a constant 80 ms interval and 100 percent hit rate | F6 and F5 (T1); excluded from ranked boards |
| A player loses 3 matches badly on purpose, then wins 8 | F4 |
| Two keys bet opposite sides of 8 markets with equal stakes | F8 (volume excluded) |
| A loser key feeds a winner key across 6 markets | F9 |
| A seated player's second key bets on their own match | The permit refuses the seat; the linked key is caught by F10 (T1; the market voids if before resolution) |
| One key bets 60 percent of a pool in the last 5 percent of the window | F11 (the market excluded from the profit board) |
| 20 keys sharing a funding parent claim the bankroll | F7 merges them; F12 blocks the extra claims |
| A reporter signs a wrong `winMask` | F16: no resolution, void at the deadline |
| A fake receipt hash is injected into the outbox | Never marked verified; F17 |
| A ledger row is edited | The hash chain breaks; F17 |
| A replay is edited | Verifier B fails; F14: markets void |
| A friends' private room plays 30 matches in a row among 3 people | **No flag reaches any global board** (room boards only) |

## 10. Tasks (lane I)

| ID | Task | Depends | Hours |
| --- | --- | --- | --- |
| I1 | Detector framework, flag log (append-only, hash-chained), ruleset file, tiers | R1, L1 | 10 |
| I2 | Input feature capture at finish (summaries only) and the baseline-collection tooling for rehearsals | S2 | 8 |
| I3 | Rating detectors F1 to F4, F13 | I1, R2 | 10 |
| I4 | Score and input detectors F5, F6, F14 | I1, I2, M6 | 10 |
| I5 | Economic detectors F7 to F12, F15 | I1, M5, L2 | 14 |
| I6 | Platform detectors F16, F17 | L3, M6 | 6 |
| I7 | Response: the staff Flags panel, signed `ops` rows, effects on boards via the ruleset | I1, U1 | 12 |
| I8 | The adversary suite and the baseline analysis | all | 14 |

About **84 hours.** Tier 1 (I1, F14, F16, F17, the hard rules, and F8, F10, F11, F12) is about 40 hours; the input forensics (F5, F6) need rehearsal data and come last.

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| False positives against friends and families | Room boards exempt; T0 and T1 are neutral; thresholds tuned from baselines; appeal for T2 |
| Detectors are guesses without data | No detector acts without a baseline; thresholds live in the ruleset file |
| Adversary adapts to published thresholds | Thresholds are public by design (recomputable); the economic layer (caps, bars, per-human limits) does not depend on secrecy; detectors can be tightened by a new ruleset version |
| Privacy | No IP, device or token in any public log; feature summaries stay in the relay; publish commitments, not identities |
| Operator abuse | Section 7 |
| Over-engineering for a hackathon | Tiers: the hard rules and F14, F16, F17 and the economic flags first; the rest only if time allows |

## 12. Addendum (6 November review, [22](22-integration-review.md)): detectors for the expansion features

The features of [20](20-feature-expansion.md) add money paths and a prize, so they need detectors of their own. All are ruleset entries (public thresholds, recomputable), treated by the tiers of section 5.

| Feature | Threat | Detector and rule | Treatment |
| --- | --- | --- | --- |
| Table Cheers (F-A4) | A friend bets against a player and cheers to cover the loss, or cheers to move perception | Cheers are split equally among all seats (so they cannot favour one player); detector: a cheerer who also holds a position on the same match, cheers placed within seconds of a large one-sided bet, cheer volume above the per-match cap | T0 flag; cheers from a flagged pair refund to the sender; the market's seat exclusion stays |
| Autopilot and tipsters (F-A5, F-E6) | Bots farm predictor boards; a tipster front-runs its own followers; a bot becomes the pool | Bots are marked `bot` in the Ledger and excluded from every predictor board, prize and statistic; a tipster's published pick must precede its own bet by a fixed delay; no bot bets in a pool below the depth threshold | T1 label; excluded from boards by rule |
| Season Cup (F-A7) | Sybil ring farms ranked matches for the prize; operator or staff win it | Prize ranks use the Verified board when World verification exists, otherwise the Open board with the ranked eligibility rules (minimum matches and distinct opponents, pair weights, gain caps, account age); staff, operator, bots and flagged accounts excluded; the close protocol and challenge window make the root contestable | T2 on confirmed collusion: removed from the board, prize re-ranked at the next close, the sponsor refunded if contested |
| Challenges (F-K1) | Unsigned or replayed offers; self-taken challenges to farm rating | Signature and nonce check; the claimant cannot be the challenger or share the device group; a challenge match is rated only if the rated-eligibility rules pass | Drop and count |
| Handles and names (F-E2) | Squatting, impersonating a known name | Reserved list, confusables check (VE-10, VE-11), earned-not-typed Champion and Legend names | Refuse; held names are released to the linked key only |
| Follows (F-K3) | Follow spam, graph manipulation | Signature, per-key cap, only console-created edges are read | Drop and count |

| Creator economy ([23](23-creator-platform-and-economy.md)) | Fake plays to farm the creator pool; creators boosting their own game; self-purchase; review bombing; a hostile bundle | Pool weight = distinct humans at distinct venues, ranked-eligible plays only, creator clusters excluded, a 25% per-game cap, the challenge window; reviews only from a player with a verified play; the sandbox contains a bundle | T1 label; excluded from the pool and the charts; a hostile bundle is withdrawn and its payouts paused (at most 14 days) |

The red-team suite of section 9 gains the scenarios "table-cheer collusion", "sybil Cup ring" and "bot on the predictor board" (VX-10).
