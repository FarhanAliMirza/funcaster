# A0 / Arc evidence — partial, funded tests pending

Observed 2026-11-06 at 09:00 UTC. **Read-only discovery; no transaction, Studio app or deployment. VA-01 and VA-12 remain OPEN.**

| Read on primary `rpc.testnet.arc.io` | Observed value |
| --- | --- |
| Chain ID | 5042002 |
| Observation block | 70154566 |
| Token | USDC, version 2, 6 decimals |
| EIP-712 domain | Local hash equals `DOMAIN_SEPARATOR()` |
| Base fee | 20000000000 wei (20 gwei) |
| Fresh relayer ERC-20 balance | 0 base units |

Raw evidence: [foundation-readonly.json](spikes/foundation-readonly.json). Script and input: `scripts/spikes/foundation-readonly.cjs` and `docs/web3/spikes/discovery-input.json`. Reads use the shared public config. The script never loads a wallet or key and cannot send a transaction.

Two issues were observed:

1. Our initial domain-hash harness omitted viem's EIP712Domain types and failed with `Cannot read properties of undefined (reading 'EIP712Domain')`. This was a local harness error, not a network failure; fixed by supplying the explicit type list. [Original output](spikes/first-readonly-harness-error.json) is retained.
2. The legacy `rpc.testnet.arc.network` endpoint returned `Request exceeds defined limit.` during concurrent reads. This endpoint is not verified as a reliable fallback. Add bounded retry/backoff in the live preflight and retest before enabling it.

Reproduce with `node scripts/spikes/foundation-readonly.cjs docs/web3/spikes/discovery-input.json`. No transaction hashes exist. Next: faucet funding, EURC/Memo/Multicall3 discovery, EIP-3009 authorization and drain tests, actual fee measurements, Arc Studio login/app and the dependency-alignment gate. Do not infer live settlement or gasless funding from these reads.

## Refreshed read-only evidence — November 1

`node scripts/spikes/arc-readonly.mjs` passes all eleven checks at block **70169139**. Both RPC host families respond under sequential reads. USDC and EURC are unpaused, have six decimals and matching per-asset EIP-712 domains. Both reject a non-payee caller. Multicall3 and Memo have deployed code. The test blocklist address is blocked on USDC and not on EURC. Relayer balances are **20 test USDC, 0 EURC**. This supersedes the earlier pre-funding balance, not its historical evidence. [Raw report](spikes/arc-readonly.json).

Arc Studio authentication is complete; app creation/deployment remains pending. The rate-limited legacy endpoint is reachable in this run but its reliability is not established. The independent EIP-3009 success, receipt/gas and Memo checks run locally with Arc's own simulator; live authorization, below-fee-floor behavior, and per-product-flow VA-12 coverage remain open. [Runbook](g0-runbook.md).

## Native local simulator — November 1

[arc-native.json](spikes/arc-native.json) records successful USDC/EURC sponsored receives, replay denial, insufficient-balance denial, native USDC blocklist denial and a EURC transfer from a signer that remains at zero native balance. Signatures use chain 31337 and ephemeral keys, never the real project signers. USDC exact drain reproduces `Cannot clear balance of empty account`; 0.05 retained succeeds. EURC exact drain only simulated successfully; no live-flow guarantee follows.

Memo's unsigned local simulation reverts; the test sends no Memo transaction, then verifies the plain-transfer fallback and exact recipient balance delta. [Original failure](spikes/arc-native-memo-failure.json). After matching the deployed no-return-value ABI, the unsigned live Memo eth_call passes while the official local fork still reverts. The local simulator limitation is unresolved; actual live Memo transaction/receipt behavior remains unverified. No public Arc transaction or Studio deployment was performed.
