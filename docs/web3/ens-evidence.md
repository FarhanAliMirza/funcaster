# E0 / ENS evidence — parent registered, integration checks pending

Updated 6 November 2026. **funcaster.eth is registered on Sepolia.** The owner executed the prepared script; the agent independently verified all four receipts and current registry state with read-only RPC calls at 2026-11-06T10:29:39.925Z.

| Check | Verified result |
| --- | --- |
| Chain | Sepolia, 11155111 |
| Name | funcaster.eth |
| Owner | `0x04b0970f4a58caa9E58C5aDBBF7eB402339264a5` |
| Registration | [0xfde4cb5c70062b1dda668345d593654f3402b23a225df2cf8501963d79ef0022](https://sepolia.etherscan.io/tx/0xfde4cb5c70062b1dda668345d593654f3402b23a225df2cf8501963d79ef0022) |
| Expiry | 6 November 2027, 15:57:12 IST (2027-11-01T10:27:12.000Z) |
| Payment | 8.000021 freely minted MockUSDC; no real-money purchase |
| Receipts | Mint, exact approval, commitment and registration all successful; registration had 12 confirmations at independent verification |
| Registration roles | Exact match to the pinned source bitmap; unrelated project key lacks SET_RESOLVER |
| Remaining token allowance | 0 |
| Total gas, four transactions | 0.000000000017831283 SepETH |
| Registrar balance afterward | 0.769999999982168717 SepETH |
| Resolver / subregistry | Both unset; bootstrap remains pending |

Evidence: [owner execution report](spikes/ens-registration.json), [independent verification](spikes/ens-registration-verified.json), [operator input](spikes/ens-registration-input.json), [unsigned preflight](spikes/ens-unsigned-check.json).

The deployment comes from the official [ENS deployment page](https://docs.ens.domains/learn/deployments/) and commit `07e55a056f5b6a9c90119f501bdd05714e67dddd`. Registrar: `0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3`; ETHRegistry: `0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4`. The operator checked registrar/registry/oracle links and verified the role-library and registrar-source hashes against the pinned artifact metadata. Both local service env files now set `ENS_CHAIN=sepolia` and `ENS_PARENT=funcaster.eth`; partner modes remain mock/off.

**VE-01 remains OPEN:** the parent ownership/expiry/registration-role subset passes, but guide 19 also requires `hasRootRoles` checks on the parent child registry and the `play` registry. Neither child registry exists yet. E0's resolver, child-name, grant/revoke and SDK checks now pass on a disposable local fork; their live equivalents and inclusion latency remain pending. Registration alone does not make the name resolve to an address or enable ENS in the game.

The earlier [discovery](spikes/foundation-readonly.json) recorded availability and a zero balance before funding. Automatic approval review rejected agent broadcasts twice; the owner completed the transaction handoff. No alternate agent broadcast route was used. [Handoff instructions](ens-registration-handoff.md) are retained as history, not outstanding work.

## Local E0 evidence

`node scripts/spikes/ens-fork.mjs` passes **12 checks with 16 successful local transactions**, against the pinned Sepolia deployment at block 12040400. It verifies SDK addresses and write helpers, parent/play root roles, address/text resolution, soulbound transfer/write denial, host kick/control grants and revocations, mint/escalation denial and expiry. Total local gas: 1,941,481; this includes temporary party/seat fixtures, not just bootstrap. No public transaction was sent.

[Evidence](spikes/ens-fork.json), [artifact provenance](spikes/ens-artifacts.json), [runbook](g0-runbook.md). Local-only results deliberately do not complete VE-01 or the live CAN/CANNOT transaction book.
