# Build guide 12: nothing faked (real testnet transactions) and the in-platform Ledger

Part of the [build guide](00-README.md). Status: plan, 6 November 2026. **No code is written.** Two requirements from the owner: **(1)** make sure nothing is faked, and at least that **real testnet transactions** back every claim; **(2)** be able to **see every transaction that has happened on the platform without leaving the platform** (no outside explorer needed). This document defines what "real" means, the controls that enforce it, and the **Ledger**: an indexer plus a TV window, a public web page, a phone Activity tab and an API that show every transaction, decoded into plain words and independently verified against the chains.

## 1. Facts checked on 6 November 2026 (direct queries, read-only)

| Check | Result |
| --- | --- |
| Arc testnet liveness | **Live.** `rpc.testnet.arc.io` and `rpc.testnet.arc.network` both returned chain id 5042002 and current blocks; the latest block's timestamp equalled the wall clock; base fee 20 gwei; 7 transactions in the sampled block |
| USDC and EURC contracts | Both are Circle **FiatToken v2.2** behind proxies and both implement `receiveWithAuthorization`, `transferWithAuthorization`, `cancelAuthorization`, `authorizationState` and `permit` ([03](03-arc-guide.md) section 2) |
| Explorer API | `explorer.testnet.arc.io` serves a Blockscout-style API (`/api/v2/smart-contracts/<address>` returned verified source and ABI). **The Ledger does not depend on it** (it reads the chain by JSON-RPC); the explorer is an optional cross-check |

So real testnet transactions are **available today** on Arc, and the ENS side runs on Sepolia (live, [02](02-ens-guide.md)), Arkiv on Tiramisu ([04](04-arkiv-guide.md)).

## 2. What "not faking" means: the ten rules

| # | Rule | How it is enforced |
| --- | --- | --- |
| R1 | **Every number or hash shown to a user comes from a verified chain event or a verified result.** Nothing displayed in `on` mode may originate from a mock | Provider objects carry `kind: "real" or "mock"`; in `on` mode the module graph must not import the mock providers (a test walks the imports); the Chain window shows each provider's `kind` |
| R2 | **A transaction is "verified" only after an independent RPC read confirms its receipt** (status success, the expected logs, the expected contract) | Only the verifier function in `integrations/ledger/verify.mjs` may set `verified`; it calls `eth_getTransactionReceipt` on a **second RPC host** and compares; the relay and the UI cannot set it |
| R3 | **Provenance is visible on every row and receipt** (badges, section 3) | The same badge set in the TV windows, the phone and the web Ledger |
| R4 | **No hidden database truth**: stats, balances and the Ledger are **derived** from chain events and canonical results; the relay's files are caches | A test deletes all caches, reindexes from the deploy blocks, and requires identical numbers |
| R5 | **No bypass flags in `on` mode**: the config loader refuses any `WEB3_FAKE_*`, `SKIP_VERIFY`, or "demo" switch when `PARTNERS=on`; mock mode shows a **persistent "DEMO MODE: no chain" ribbon** and can never produce a hash | Loader tests |
| R6 | **A reality gate** before an event or a demo: `npm run web3:reality` runs the real flows against the testnets and fails on any mock | Section 6 |
| R7 | **Liveness gate**: preflight requires a fresh latest block (under 30 s old), the chain id, contract code at each configured address, token `decimals()` and EIP-712 domains matching; the result is shown in the Chain window ([08](08-config-and-ops.md) section 4) | Preflight |
| R8 | **Reproducible deployments**: contract addresses, constructor arguments, compiler and source commit recorded; **source verified on the explorer**; the Ledger shows "source verified" per contract | `docs/web3/*-deployment.md` plus a verification step in the evidence script |
| R9 | **The scripted-replay fallback is honest**: it replays **recorded real transactions** and is labelled "Replay of a recorded run (original hashes shown)"; it is never presented as live | A banner and a test |
| R10 | **Play money and testnet are always stated** (the PLAY MONEY ribbon; "testnet" on every explorer link) | UI rules ([05](05-ui-integration.md), [11](11-prediction-market-ui.md)) |

## 3. Provenance badges (used everywhere a transaction or record appears)

| Badge | Meaning |
| --- | --- |
| **● Verified** | The receipt was read from the chain by an independent RPC and matches (block number and hash shown) |
| **◐ Pending** | Sent and awaiting confirmation, or the indexer is catching up |
| **○ Local only** | In the outbox, not yet on a chain (labelled "saved locally") |
| **✖ Failed** | Reverted or dropped (with the reason) |
| **⚑ Flagged** | An integrity detector raised a flag on the item ([15](15-integrity-and-anti-cheat.md)); the item stays visible |
| **◇ Demo** | A mock-mode item; **cannot exist in `on` mode** |

## 4. The Ledger

### 4.1 What it covers (everything the platform causes)

| Chain | What is indexed | Sources |
| --- | --- | --- |
| **Arc testnet** | `ConditionalPot` and `MatchMarkets` events (every state change, bet, report, claim, refund), **USDC and EURC `Transfer` events** to or from our contracts, the relayer and the seat addresses (drips, top-ups, funding, claims), authorization use (`AuthorizationUsed`), **and any transaction that touches our contracts that our worker did not send** (shown as "external activity") | Worker receipts for immediate display; `eth_getLogs` over our addresses for completeness |
| **Ethereum Sepolia (ENS)** | The parent and `play` registry events and **every party registry and resolver discovered at runtime** (via `SubregistryUpdated` and `ProxyDeployed`, passed through the genuine-and-canonical walker of [02](02-ens-guide.md) section 8): `LabelRegistered`, `LabelUnregistered`, `ExpiryUpdated`, `EACRolesChanged`, `TextUpdated`, `ProxyDeployed` | Worker receipts plus logs |
| **Arkiv Tiramisu** | Entity create, update, extend and ownership-transfer operations by the sponsor wallet, with their transaction hashes and entity keys | Worker receipts plus `watchEntityEvents` |
| **Off-chain facts** | Each match's canonical `result` hash (kind `result`), shown beside the transactions it caused | The relay |

### 4.2 Architecture

A separate process, **`scripts/web3-indexer.mjs`** (or a module in the worker), keeps a **checkpointed** reader per chain: it reads logs for our addresses from each deployment's **deploy block** in chunks of at most 9,999 blocks (Arc caps `eth_getLogs` ranges; retry on the near-head error), keeps a **confirmation depth** (Arc has deterministic finality, so 0; Sepolia 2 to 3 blocks), and writes an **append-only ledger file** (`${WEB3_DATA_DIR}/ledger/ledger-<chain>.jsonl` plus a compact index) in which **each row stores the hash of the previous row** (a hash chain, so an edited or removed row is detectable). The relay serves the ledger through the router and a read-only socket namespace; **the relay never writes ledger rows** (only the indexer and the verifier do). `npm run web3:reindex` rebuilds everything from the deploy blocks.

**Arc-specific ingestion rules** (verified on the testnet; details in [16](16-arc-native-features.md) section 4): Arc has deterministic finality, so a returned receipt is final (no confirmation counter and no reorg handler on Arc; keep idempotent ingestion keyed on `(txHash, logIndex)`); order by **block number**, not timestamp (several blocks share one second); a USDC transfer emits **two** `Transfer` logs (6 and 18 decimals), so **filter by emitter address** and never sum the two views; show the fee in dollars from the receipt; **relayer calls wrapped in Memo carry a `memoId`, so one indexed `eth_getLogs` call returns every transaction of a pot or market** ([16](16-arc-native-features.md) section 5); the explorer API is a best-effort cross-check only.

**Row schema:**

```text
{ seq, prevHash, rowHash, chain, network, blockNumber, blockHash, ts, txHash, logIndex?,
  kind, summary, refs: { matchId?, potId?, marketId?, party?, seatName?, resultHash? },
  from, to, asset?, amount?, amountHuman?, status: confirmed | pending | failed,
  verified: { by, at, rpcHost, ok } | null, source: worker | indexer | both,
  flags: [ ... ], explorer?: url }
```

**Kinds (human-readable decoding of the ABIs):** `ens.party.open`, `ens.seat.mint`, `ens.role.grant`, `ens.role.revoke`, `ens.record.set`, `ens.party.end`; `arc.drip`, `arc.pot.create`, `arc.pot.fund`, `arc.pot.lock`, `arc.pot.settle`, `arc.pot.claim`, `arc.pot.refund`, `arc.pot.contest`; `arc.market.create`, `arc.market.bet`, `arc.market.report`, `arc.market.finalize`, `arc.market.void`, `arc.market.claim`; `arkiv.result`, `arkiv.market`, `arkiv.trophy`; `result`. The `summary` is plain text with names (the ENS name or handle, never a raw address alone): "asha put in 1.00 USDC (pot 0xab12)", "Pot paid out: asha +2.00 USDC", "Market resolved: A won; 9 of 14 predictors won", "Host role revoked from asha".

### 4.3 Completeness, coverage and the reality banner

The Ledger header always shows **coverage**: "Arc indexed to block N (head N-2) - Sepolia to block M - Arkiv to block K - parties tracked: 12 - rows: 3,412 - hash chain head 9f3a…". A **completeness check** compares the platform's own receipts with the on-chain logs over our addresses: any on-chain transaction touching our contracts that the worker did not send appears as **"external"** (a user submitting their own signed bet is legitimate; an unknown caller of an operator function would be an alert). A mismatch between two RPC hosts shows **"RPC mismatch"** instead of a verified badge. **The Ledger is itself checkable**: `GET /api/web3/ledger/head` returns the head row hash, and every **10 minutes** the indexer writes that hash to a text record on the `play` registry and to an Arkiv entity (a **transparency log**), so anyone can detect a rewritten history.

### 4.4 Surfaces

**TV: the Ledger window** (a new tool window `ledger`; the same pattern as [05](05-ui-integration.md) and [11](11-prediction-market-ui.md)):

```text
+-[ Ledger ]-------------------------------------------------------[_][O][X]+
| [Refresh] [Search: hash, name, match...]  [Export CSV]      Live o         |
| [ All ] [ Money ] [ Names ] [ Predictions ] [ Records ] [ Flagged ]        |
+--------------------------------------------+-----------------------------+
| Time     Kind        Summary         Status| Pot paid out                |
| 10:32:42 pot.claim   asha +2.00 USDC   ●   |  asha +2.00 USDC            |
| 10:32:41 pot.settle  Golf, 3 players   ●   |  Chain: Arc testnet         |
| 10:32:36 pot.lock    3 of 3 in         ●   |  Block 69,317,039 (final)   |
| 10:32:21 pot.fund    ravi 1.00 USDC    ●   |  Tx 0xef56...  [Copy]       |
| 10:31:58 ens.seat    ravi.kart-otter   ◐   |  Match 1k9...  Pot 0xab12   |
|                                            |  [Verify now] [Open in      |
|                                            |   explorer] [Match page]    |
+--------------------------------------------+-----------------------------+
| Arc 69,317,041 - Sepolia 7,214,990 - Arkiv 1,204,556 - rows 3,412 - chain 9f3a |
+----------------------------------------------------------------------------+
```

Rows are `data-nav` buttons; **Verify now** re-reads the receipt on both RPC hosts and shows the result in place; **Export CSV** saves the filtered rows. Tabs filter by kind group; **Flagged** lists integrity flags. The Results window's receipt lines and the Predictions window's Verify button link here ([05](05-ui-integration.md), [11](11-prediction-market-ui.md)).

**Web: `/ledger`** (a new public read-only page, `public/ledger.html`): the same list for anyone with a laptop (judges, auditors); filters by kind, address or ENS name, match, pot, market and date; **deep links** (`/ledger?tx=0x…`, `?match=…`, `?pot=…`, `?market=…`); a **"Verify yourself"** panel per row showing the exact `eth_getTransactionReceipt` request for any RPC and the explorer link as an optional cross-check; the same coverage header.

**Phone: the Activity tab** of the account app ([13](13-users-scenarios-and-accounts.md)): only the user's own rows (by address), in plain language ("You put in 1.00 for Golf", "You were paid 2.00"), each with its badge and a Verify tap.

**API** (public, rate-limited, cacheable): `GET /api/web3/ledger` (filters `kind`, `address`, `name`, `match`, `pot`, `market`, `since`, `cursor`, `limit`), `GET /api/web3/ledger/tx/:hash`, `GET /api/web3/ledger/head`, `GET /api/web3/ledger/coverage`, `GET /api/web3/ledger/export.csv`, and a read-only socket namespace `/ledger` for the live feed.

**Privacy:** addresses are pseudonymous keys; show the ENS name or handle first; spectator addresses are shown in short form; **no IP, device or token data is ever in the ledger**; integrity flags show the rule that fired, not the evidence about a person ([15](15-integrity-and-anti-cheat.md)).

## 5. The real transactions the platform produces

| Chain | Transactions (sender) | Per staked 3-player match with predictions (approximate) |
| --- | --- | --- |
| Sepolia (ENS) | party register (worker), seat mints (worker), role grants and revokes (worker), record writes (worker), party unregister (worker) | 8 to 12 |
| Arc | drips (relayer), pot create, funds (relayer, each carrying the player's signed authorization), lock, settle, claims, market create, bets (relayer, each carrying the spectator's authorization), reports A and B, finalize, claims | 15 to 40 depending on spectators |
| Arkiv | result, pot and market entities, trophy transfer, extensions (worker) | 3 to 6 |

So **a single demo match leaves 25 to 60 real testnet transactions**, every one decoded in the Ledger. **Signed authorizations are real too**: each bet's EIP-3009 authorization is consumed on-chain (`AuthorizationUsed` is indexed), so a bettor can prove **they** authorised it.

## 6. The reality gate: `npm run web3:reality`

A scripted end-to-end run, **on the live testnets with no mocks**, that: checks liveness; opens a party and mints seats (ENS) and verifies each name resolves; runs a pot (create, two funds with real signed authorizations, lock, cooperative settle, claims); runs a second pot to a **refund**; runs a market (create, bets from two spectator keys, reports A and B, finalize, claims) and a second market to a **void**; writes Arkiv entities and transfers a trophy; **then re-verifies every transaction by an independent RPC read**, reindexes the Ledger from scratch and checks the Ledger lists every transaction exactly once with the right decoding. Output: `docs/web3/reality-run-<date>.md` (a table of hashes, kinds and verification) and a **non-zero exit** if any step used a mock, any receipt is missing, or the reindexed ledger differs. **Run it before every rehearsal and before the submission**; the README links the latest run.

## 7. Tests

The module graph contains no mock import in `on` mode; the loader refuses bypass flags; a verified badge cannot be set by the relay (a test tries); a fake receipt injected into the outbox is never marked verified (RPC says no); reindex equals live; the hash chain detects a tampered row; the completeness check surfaces an external transaction; RPC mismatch is shown; an RPC outage shows "unverified", never "verified"; the checkpoint survives a restart; a Sepolia reorg within the confirmation depth does not duplicate rows; coverage numbers are correct; the Ledger API pagination and filters; CSV export matches the rows; the phone Activity tab shows only the user's rows; the reality run fails when one step is forced to mock.

## 8. Tasks (lane L)

| ID | Task | Depends | Hours |
| --- | --- | --- | --- |
| L0 | Spike: read our test contract's logs by `getLogs` in chunks on Arc; read a Sepolia registry's events; an Arkiv entity event; second-host verification | A2 | 3 |
| L1 | Ledger row schema, hash chain, append-only store, checkpoints, reindex command | S3 | 8 |
| L2 | Indexers for Arc (both contracts, token transfers, authorization use, external activity), ENS (discovery walker, registry and resolver events), Arkiv | L1, E1, A2 | 14 |
| L3 | Verifier (`verify.mjs`), two-host receipt check, badges, coverage and completeness, transparency-log checkpoint | L2 | 8 |
| L4 | Router and API, socket feed, CSV export, `/ledger` page | L3, S6 | 10 |
| L5 | TV Ledger window, phone Activity tab, links from Results and Predictions | L4, U1 | 10 |
| L6 | `web3:reality` script and the reality tests | L3, A4, E3 | 8 |

About **60 hours.** Tier 1 is L1, L2 (Arc only), L3, L4 and the web page (about 35 hours): that alone answers "see every transaction without another explorer".

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| RPC log range caps and flaky load-balanced RPC | Chunking at 9,999 blocks, retry with backoff, two RPC hosts |
| ENS discovery of party registries is incomplete | Genuine-and-canonical walker plus a worker-receipt cross-check; "external" shows gaps |
| Ledger size grows | JSONL segments with an index; the demo volume is small; archive old segments |
| Someone edits the ledger file | Hash chain plus the periodic transparency-log checkpoint |
| Showing too much to a casual viewer | Plain-language summaries by default; hashes and raw fields behind the details pane |
| A mock sneaks into `on` mode | The module-graph test, the loader refusals and the reality run |

## 10. Addendum (6 November review, [22](22-integration-review.md)): Ledger coverage of the new features

The Ledger's decoders (section 4.2) must also read: `SplitPayout` (cheers, cuts: **tag `cheer:<match>` and `cut:<pot>`**, with the escrow, release and refund events), `SeasonVault` (`commitRoot`, `contest`, `claim`, vest events, the refund-to-sponsor path), the Autopilot allowance (`permit`, `transferFrom`, revoke), the ERC-8004 reputation writes, and the ENS names added by [20](20-feature-expansion.md) (`legends`, `fans`, `booth`, `hall`; handle claims). Bots and Autopilot rows carry a `bot` mark; sealed replays show `verif=sealed`; a party name that has expired shows "(expired by design)". The reality gate (section 6) gains one real transaction per new contract (a cheer, a vault claim, a handle mint) so the evidence run covers them.
