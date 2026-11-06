# Web3 implementation progress

Updated 2026-11-06. Base: `main` at `404abb1`. Working branch: **web3/integrations**. Never merge into main. The Sepolia parent is registered; live game integration and hosted deployment remain incomplete.

Read this first when resuming. Follow [master prompt](../plans/web3/build-guide/26-codex-master-prompt-and-handoff.md), gate order and [verification log](verification-log.md). Account/hosting actions are in [human-setup.md](human-setup.md); the owner explicitly deferred them on 6 November. [Deviations](deviations.md) records conflicts and resolutions.

| Task | Status | Commit | Evidence | Open items |
| --- | --- | --- | --- | --- |
| S0 | DONE | ae5dffb | baseline-check.txt, PRE_EXISTING.md, .env.example | None |
| S1 | DONE | 53dc99e | tests/web3/config.test.mjs; s1-check.txt | Live preflight deliberately reports UNVERIFIED; no chain claims |
| S2 | DONE | c4475a9 | tests/party/web3-parity.test.cjs; s2-check.txt | Off/mock/on fake-worker round trip passes; live adapters remain off |
| S3 | DONE | 379bc65 | tests/web3/outbox.test.mjs; worker-process.test.mjs; s3-check.txt | Mock providers only; real adapter lookup must close post-send crash window |
| S4 | DONE | f64655a | tests/party/web3-identity.test.cjs; signer.test.mjs; s4-check.txt; browser evidence below | Physical phones pending |
| S5 | DONE | 8a07baf | tests/party/web3-names.test.cjs; s5-check.txt | Human-facing name entry is U7; on-chain handles are later lanes |
| S6 | DONE | 08a6293 | tests/web3/router.test.mjs; s6-check.txt | Pot console unavailable until Studio A7; live pot reads explicitly 503 |
| E0 / A0, G0 | PARTIAL | 5a7f85a | ens-evidence.md; arc-evidence.md; spikes/foundation-readonly.json | ENS ownership verified; local fork bootstrap/permissions/expiry pass. Arc public reads and native authorization/floor tests pass with a local plain-transfer fallback for Memo. Live G0 gates remain open; see g0-runbook.md |
| K0 | PARTIAL / FUNDING PENDING | 5a7f85a (evidence index) | g0-runbook.md; separate scratch evidence | Anonymous Tiramisu read and immediate Swarm round trips pass; Rabdi/SDK 0.8.1 mismatch reproduced. Funded entity/limit/expiry/cost tests and retention remain |
| ENS parent setup | DONE | See git log | ens-evidence.md; spikes/ens-registration-verified.json | Resolver/subregistry are a separate bootstrap task; live ENS stays disabled |
| A1 login | DONE | See git log | human-setup.md | whoami succeeded; Studio app creation remains pending |
| SL17 | BLOCKED-HUMAN | — | operations/platform-apps.md | Accounts, applicant identity, HTTPS callback origin, legal submission |
| HTTPS staging | BLOCKED-HUMAN | — | human-setup.md | Hosting destination/domain/budget; Vercel tentative |
| K1 onward | DATE-GATED | — | guide 26 rule 13 | Starts Nov 5; no production Arkiv code before then |

Packet 1 complete: 617 tests pass (313 unit, 114 party, 168 OS, 22 Web3), plus the browser phone gate and formatting. Final logs: [check](foundation-check.txt), [format](foundation-format.txt), [browser](foundation-browser.txt). Next: Packet 2 / G0 scratch and funded spikes; the primary ENS/Arc read-only subset is recorded. Golden fixtures were captured directly from `404abb1` before relay hooks were added. No task is marked live/verified using a mock.

## Browser evidence — 6 November

`node tests/os/web3-foundation.e2e.mjs` passed with Chromium, the real phone page and 320×568, 390×844, 844×390 viewports. Off mode fetched no signer and created no key; mock mode bound its session identity and reached touch-ready without errors or page overflow. Queue promotion also binds the early challenge after seat assignment; the regression passes. Desktop and phone screenshots were visually inspected. Local evidence: `.local/os-evidence/web3-off-2026-11-06T09-05-35-703Z/` and `.local/os-evidence/web3-mock-2026-11-06T09-05-42-768Z/`. Signer: **26,169 bytes gzip**, byte-equal to source build. No new UI control was added; U-lane screens remain pending. Physical sensor permission/motion/multitouch and hosted HTTPS are unverified.

## Handoff boundary

S0–S6 are a mock foundation, not the full Web3 product. The owner completed faucet funding and the Sepolia ENS parent registration; all four registration-flow receipts are independently verified. Platform apps/audits, contract deployments and HTTPS staging remain pending. Local role keys and env files remain ignored; registrar funding (0.77 SepETH), relayer funding (20 test USDC) and Arc Studio authentication are now verified. Other balances and backups are not inferred complete. Live partner adapters and all later packets remain disabled/unimplemented. Review delivery is a draft PR only; never merge this branch into main.

Deviations: see [deviations.md](deviations.md), including separate verifier secrets, MARKETS default-off, explicit game-replay verification scope, and Vercel runtime assessment. No new owner decision is needed for the foundation.

## ENS parent completed — 6 November

`funcaster.eth` belongs to the project registrar on Sepolia through **6 November 2027 at 15:57:12 IST**. Independent RPC verification passes for the four transaction receipts, canonical blocks, owner, expiry, exact registration roles, unrelated-key denial and zero remaining token allowance. See [ens-evidence.md](ens-evidence.md). The owner executed the signing steps after automatic approval review required the handoff.

Public ENS parent/network fields are saved in `.env.relay` and `.env.worker`; the secret values and partner modes are preserved. No live feature was enabled. Next: the remaining Packet 2/G0 checks, including the parent/play registry bootstrap and root-role verification, Arc funded spikes, Arkiv network discovery in scratch and SDK compatibility. New broadcasts remain owner-executed under the observed approval restriction.

Latest software checks: **619 tests pass** (313 unit, 114 party, 168 OS, 24 Web3) and formatting passes, from the registration preparation. This follow-up changes only evidence/docs and local public config; role-specific config validation and the independent chain checks pass. No game, relay or phone UI code changed. Logs: `ens-registration-check.txt`, `ens-registration-format.txt`.

## G0 autonomous follow-up — 6 November

- Main fetched; no new main commits to merge. Work remains on `web3/integrations`.
- E0 local fork passes: SDK address alignment, parent/play/party bootstrap, root roles, soulbound seat resolution, denied seat transfer/write, scoped host grants/revokes, forbidden host mint/escalation and expiry. `scripts/spikes/ens-fork.mjs` writes `spikes/ens-fork.json`. This is local simulation, not live VE-01 completion. No private key is loaded.
- A0 read subset passes for USDC and EURC domains/decimals, payee-only guard and code at Multicall3/Memo. Both RPC host families responded in this sequential run. Relayer: 20 test USDC, 0 EURC. `spikes/arc-readonly.json`.
- K0 scratch is `/Users/raihankhan/Documents/Projects/funcaster-arkiv-k0`. Tiramisu (7738577) works anonymously with SDK 0.8.1. Rabdi (7794095) rejects that SDK's `contentType` query option. Retain the specified Tiramisu configuration; do not silently upgrade or switch. Console balances are zero on both.
- Swarm accepted 1 KB, 100 KB, 1 MB, 5 MB synthetic bytes and an SVG; immediate downloads match SHA-256. Longer retention checks are pending. No actual player data uploaded.
- Official Arc simulator passes local sponsored USDC/EURC authorizations, replay/insufficient-balance denial, blocklist denial and EURC zero-native transfer. A fresh USDC account rejects exact drain with `Cannot clear balance of empty account`; retaining 0.05 succeeds. Memo succeeds in unsigned live eth_call but reverts locally; a plain transfer succeeds after that unsigned local failure. No failed/uncertain sent payment is retried. VA-01/VA-12 remain open for live transactions and future product flows.

Latest regression: **620 tests pass** (313 unit, 114 party, 168 OS, 25 Web3), including parity and the localhost/chain/client guard. Formatting passes. Logs: `g0-check.txt`, `g0-format.txt`. All spike outputs explicitly distinguish public reads, local simulation and unverified live behavior. No game, core, SDK, relay or phone UI changes; no UI inspection is claimed for this tooling-only chunk.

Next: complete the remaining G0 funded/live checks and prepare the owner-executed bootstrap/Studio handoffs. K0 writes need a verified Tiramisu funding route; long-duration Swarm observations need elapsed time. Platform accounts and HTTPS staging stay deferred. No new decision is needed for the work completed here.
