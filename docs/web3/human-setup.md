# Owner setup — current resume checklist

Updated 6 November 2026 after independent ENS receipt verification. All work stays on `web3/integrations`; never merge into main. Accounts and hosting choices may come later. Keep secrets out of Git and chat.

| Step | Status | Evidence / remaining action |
| --- | --- | --- |
| Arc Studio login (A1) | DONE | Pinned CLI 1.2.2; `whoami` succeeded. Owner reports replacing the token exposed during browser inspection; no replacement secret was inspected. Studio app creation is still pending. |
| Fresh keys by role | DONE locally; backup pending | 14 separate role keys in ignored, permission-restricted files. Owner password-manager backup is still unverified. |
| Initial faucet funding | DONE for primary ENS/Arc roles | Registrar received 0.77 SepETH; Arc relayer read as 20 test USDC. ENS gas balance after registration: 0.769999999982168717 SepETH. Other role balances are not inferred funded. |
| ENS parent | DONE / independently verified | `funcaster.eth`, Sepolia 11155111, owned by `0x04b0970f4a58caa9E58C5aDBBF7eB402339264a5`, expires **6 November 2027 at 15:57:12 IST**. [Receipts and permissions](ens-evidence.md). No registration action remains. |
| `.env.relay` / `.env.worker` | DONE locally in MOCK mode | Public parent, Sepolia RPC and explorer/app settings saved. Keys remain isolated; live integrations remain disabled. Hosted origin and later contract configuration are pending. |
| Additional role / Arkiv funding | PENDING | Use `.local/web3-keys/addresses.json`; fund only roles needed by the verified flow. Tiramisu 7738577 is compatible with pinned SDK 0.8.1; Rabdi is incompatible. Console balance is zero on both. Obtain a Tiramisu faucet route before funding; relayer also needs EURC for its live EURC tests. |
| Platform apps + YouTube audit (SL17) | BLOCKED-HUMAN | Google/Twitch/Kick owner accounts; legal applicant/contact; Google project IDs; final HTTPS callback/privacy/deletion URLs; client evidence/quota estimate; owner review/submission. [Draft](operations/platform-apps.md), not submitted. |
| HTTPS staging | BLOCKED-HUMAN | Owner chooses account/domain/budget. Vercel is tentative; verify persistent relay/worker/storage requirements before choosing a deployment. [Staging notes](operations/staging.md). |

## Local credentials and tools

- Arc CLI: `.tools/arc-studio/node_modules/.bin/arc-studio`. Token stays in CLI credentials, never in a server env. For a later login only, run `login --paste` in Terminal and paste the token into its hidden prompt; `whoami` verifies access.
- Nine worker roles are in `.env.worker`; verifier signer/token only in `.env.verifier`; four spare/developer roles only in `.local/web3-keys/spares.env`. Gateway encryption key is isolated in `.env.gateway`; no platform app secrets are configured yet.
- Private files are mode 0600 and the private directory is 0700; all are ignored. The initializer refuses overwrite. Public addresses and role/file mapping are in `.local/web3-keys/addresses.json`.
- The registration checkpoint and reveal secret remain in ignored `.local/web3-keys/ens-registration-funcaster.json`. Do not copy it into public evidence. Public reports contain receipts, owner, expiry and permissions only.
- `viem@2.57.14` is pinned. Peer ranges align, but VX-08 remains open until real cross-SDK tests pass. No production Arkiv SDK/code was added.

## Free funding references

[Circle faucet](https://faucet.circle.com/) supplies free test USDC on Arc Testnet; primary relayer `0x81DdeD7eE7753791cEaF24Ab6Cb1694d1F39A008`. [Sepolia PoW faucet](https://sepolia-faucet.pk910.de/) supplies SepETH through browser work; primary registrar `0x04b0970f4a58caa9E58C5aDBBF7eB402339264a5`. [Chainlink Sepolia](https://faucets.chain.link/sepolia) is another option if eligible. Follow current faucet limits. No real funds are needed for this testnet setup.

ENS registration used **8.000021 freely minted MockUSDC**, with zero remaining allowance; no real-money purchase. The [official ENS guide](https://docs.ens.domains/ensv2/tutorial-app-developers/#getting-test-funds) describes the free-token route. The name exists on Sepolia, not mainnet.

**Arkiv funding hold:** guides 04/08 name Tiramisu (7738577), while the [current official hub](https://hub.arkiv.network/networks) lists Rabdi (7794095). K0 confirms Tiramisu still works anonymously and Rabdi rejects SDK 0.8.1 queries. Keep Tiramisu; the current Hub faucet is not evidence of a Tiramisu funding route. Production Arkiv work still starts November 5.

## What follows registration

G0 means Gate 0: verify real deployments, permissions, small test transactions, Arc authorization/drain behavior, Arkiv/Swarm storage and SDK compatibility before enabling live features. Parent registration is done; parent/play child registries, resolver and their root-role checks are not built yet. The name does not yet resolve to a game address.

The owner executed the ENS transactions after automatic approval review required a handoff. Independent RPC checks confirmed all four successful receipts, canonical blocks, owner, expiry, exact registration roles and unrelated-key denial. [Completed handoff](ens-registration-handoff.md) is history. Future broadcasts may also require owner execution under the observed restriction; no missing permission is inferred for the already authorized testnet work.

Read [progress.md](progress.md) to resume. Send only public IDs/origins or a completion status; never send tokens or private keys.
