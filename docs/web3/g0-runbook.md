# G0 repeatable checks

These scripts collect evidence; they do not enable live providers. Run from the repository root on `web3/integrations`. No application dependency, game, motion or bundleHash source changes are needed.

## ENS local fork (E0)

```sh
npm install --prefix .tools/g0 --no-save --package-lock=false @foundry-rs/anvil@1.7.1 @ensdomains/ensjs@5.2.7 viem@2.57.14
node scripts/spikes/prepare-ens-tools.mjs
node scripts/spikes/ens-fork.mjs
```

Pinned artifacts and their source digests: `spikes/ens-artifacts.json`. The script forks Sepolia block 12040400, starts Anvil on an ephemeral **127.0.0.1** port with **chain 31337**, and impersonates public addresses only inside that process. It refuses any other host/chain/client before mutations. It never loads env files or real keys, and terminates its child when done. Evidence: `spikes/ens-fork.json`.

It tests bootstrap, SDK-generated calls, root roles, Universal Resolver reads, soulbound seat denial, host kick/control grants and revocation, role-escalation denial and expiry. Gas is local-fork gas, not live latency or a complete day budget. The live parent still has no subregistry/resolver. This does not complete VE-01.

The first run hit `WaitForTransactionReceiptTimeoutError` even though a direct local RPC receipt was available. The spike now uses bounded direct receipt polling, checks `status=success`, and does not resend. Original failure: `spikes/ens-fork-first-timeout.json`. This is not evidence that public-network receipt polling is broken.

## Arc public reads (A0)

```sh
node scripts/spikes/arc-readonly.mjs
```

Inputs: `spikes/arc-readonly-input.json`. Evidence: `spikes/arc-readonly.json`. Checks both public RPC families, USDC/EURC domains and decimals, paused/blocklisted state, relayer balances, payee-only authorization guards, Memo/Multicall3 code and an unsigned live Memo eth_call. Reads and simulations only. A successful guard check does not prove a successful authorization transaction.

## Arc native local fork (A0 / VA-12 subset)

Install [official Arc Foundry](https://docs.arc.io/arc/tutorials/install-arc-foundry) **v0.8.0-2** for the host platform into `.tools/arc-foundry/`, with its Anvil binary named `anvil`. The Apple Silicon archive SHA-256 verified in this session is `90e3eefbf7dd80652fd283a7562e9263301a48797bc2224cc21a3964e2d5db87`; verify the corresponding official digest for another platform. On this Mac the binary needed Homebrew `libusb` 1.0.30.

```sh
node scripts/spikes/arc-native.mjs
```

Forks the current Arc testnet block into localhost chain 31337 using `--network arc`. Real role keys are never read. Signature keys are ephemeral and their EIP-712 domain is **31337**, not Arc testnet. Balances, token minting and role impersonation exist only in the local simulator.

Tests: sponsored USDC/EURC authorizations, replay and insufficient-balance rejection, a retained 0.05 floor, exact-drain behavior, EURC with zero native balance, native blocklist and Memo/plain-transfer behavior. A fallback is attempted only after a conclusive **unsigned simulation revert**, never after a sent or uncertain payment. Evidence: `spikes/arc-native.json`; original Memo failure is retained separately. The corrected Memo ABI has no return value. Its unsigned live eth_call passes while this local simulator reverts; the cause remains open. No production adapter exists yet.

VA-12 still requires these invariants in every future product flow and a live reality run. VA-01 still needs funded live authorization and the Studio app/deployment checks.

## Arkiv and Swarm (K0, outside this repository)

Scratch lives outside this repository. Its README and `arkiv/friction.md` contain exact repro steps and evidence. K1 onward starts November 5. No production Arkiv SDK or query code was added here.

- Tiramisu + SDK 0.8.1 works for a bounded anonymous creator-scoped query; Rabdi rejects its query shape. Retain Tiramisu.
- A single viem 2.57.14 satisfies both installed SDKs in scratch. The minimal anonymous-reader browser probe is 113,800 bytes gzip. It is not the Hall or the full worker; VX-08 remains open for cross-write and final bundles.
- Five synthetic public Swarm uploads immediately round-trip by SHA-256. Repeat `node swarm-retention.mjs --read-only` after 1 hour, 24 hours and 7 days. Do not re-upload before a retention measurement. There is no scheduled monitor.
- No postage purchase or durability claim. Continue with the planned content-addressed keeper fallback when implementing K-lane; actual keeper behavior remains unbuilt.
