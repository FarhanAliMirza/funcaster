# Web3 deviations and open decisions

2026-11-06:

- The owner explicitly authorizes autonomous safe setup, overriding guide 26's blanket human-only designation for local key generation and env preparation. Login/2FA/CAPTCHA, paid activity and legal declarations still need the owner; no account or budget has been supplied.
- `plan.md` predates the branch exception. The new handoff and AGENTS exception govern Web3: only `web3/integrations`, no main merge.
- Guide 08 says MARKETS defaults off and also inherits PARTNERS. Use the conservative explicit default **off**; enabling partners does not enable wagers.
- Guide 08 lists MARKET_VERIFIER_KEY beneath worker variables but expressly excludes it from the main worker. It belongs only in `.env.verifier`.
- The owner mentioned Vercel tentatively, with no account/domain/budget finalized. Do not deploy or assume persistent relay/worker/shared-volume support. Assess the actual runtime against guide 08 before choosing staging.
- ENS candidate: `funcaster.eth` on the specified testnet, then `funcasterplay.eth` if unavailable. Both were available in the read-only check at Sepolia block 12039964. The owner subsequently registered funcaster.eth; independent ownership/expiry/role verification is in ens-evidence.md. No mainnet purchase.
- Production Arkiv work remains date-gated until Nov 5; K0 evidence only in a scratch directory beforehand.

- Mainnet parsing follows guide 08's explicit Arc override, but this build's preflight still refuses mainnet. ENS mainnet is refused entirely because the active handoff requires testnets only.
- Vercel's current [WebSocket docs](https://vercel.com/docs/functions/websockets) include Socket.IO support. The compatibility question is therefore connection lifetime, durable in-memory rooms, a separate worker and shared durable storage, not basic WebSocket support. No deployment compatibility test has run.
- The old `ARKIV_SPONSOR_KEY` alias in guide 08 is historical, not an active env variable. The names-only template uses `ARKIV_CONSOLE_KEY`.

- S3 adds a room-end cleanup hook and graceful signal drain to the minimal wiring list: these prevent retaining closed rooms and dropping queued jobs at normal shutdown. Worker leases assume a single local/shared-volume host; multi-host workers are not supported. A provider must check its external idempotency record after a post-send crash; local files alone cannot guarantee exactly-once network effects. Foundation tests simulate that crash window, not a real chain.

- S4 makes the unspecified challenge lifetime configurable (`WEB3_BIND_TTL_SECONDS`, default 60), with the specified attempt limit configurable only downward (`WEB3_BIND_MAX_PER_MINUTE`, default/max 3). The phone key persists separately from seat tokens, per guide 01 §5.1; leaving clears the seat binding, not the reusable phone key.

- S5 uses an explicit minimal profanity/reserved-label list because the repo has no existing nickname filter. Confusable non-ASCII labels and markup are rejected; NFKC and whitespace normalization are deterministic. This is not a comprehensive moderation system. The minimum 3-second attempt interval is configured as `WEB3_NAME_COOLDOWN_MS`.

- S6 `verified` is explicitly scoped to the existing **game replay** verification, with `verificationScope: game-replay` and `chainVerified: false`. No mock receipt can claim chain verification. The canonical result is returned unchanged so its hash still verifies; names, seat credentials and full addresses are never added. Results are currently bounded local memory; external persistence is a later lane.
- S6 serves the Studio console only if its actual `dist/index.html` exists. Until A7, `/pot/` returns unavailable and real pot reads return 503. The foundation does not fabricate a contract, frontend or pot state.

- Final S3 hardening uses an actual SIGKILL/restart test around a durable mock effect, not merely an in-process exception. It verifies stale lease recovery and adapter lookup; live-chain exactly-once behavior remains unverified.
- G0 read-only discovery is partial. The first Arc domain check failed in our harness because `hashDomain` lacked its EIP712Domain types; this was fixed and the failed output retained. The primary RPC then passed; the legacy endpoint returned `Request exceeds defined limit.`. No failure was treated as a pass and live features remain off.

- Setup check: the current Arkiv Hub lists Rabdi (7794095), whereas guides 04/08 specify Tiramisu (7738577). Arkiv funding instructions are held until K0 verifies network/SDK compatibility; no network substitution has been applied to production code. Official source: https://hub.arkiv.network/networks.

- ENS registration is explicitly authorized by the owner and uses only free Sepolia test tokens. Nevertheless, automatic approval review rejected broadcast twice and requires owner execution, even after an unsigned simulation and official no-monetary-value evidence. The complete commit/register script is prepared for manual execution; no alternative broadcast route was attempted. Parent resolver/subregistry remain unset until the planned bootstrap.

- ENS handoff resolved: owner completed mint/approve/commit/register. Independent read-only checks verified all receipts, ownership, expiry, expected roles and zero allowance. Public local config is updated without enabling live integrations. VE-01 is intentionally still open because child registries and their root-role checks are not built.

- G0: current Arkiv skills/Hub target SDK 1.0.0/Rabdi, but the plan pins 0.8.1/Tiramisu. Bounded public probes confirm Tiramisu still works and Rabdi rejects the 0.8.1 `contentType` selection. Keep the pinned target; do not infer the Hub faucet funds it. Matching official skills were read from a separate scratch checkout, not globally installed. No Arkiv MCP is available in this session.
- E0 local receipt watcher timed out despite an available mined receipt. The disposable-fork script now uses bounded direct receipt polling, requires successful status and never resends. Original failure retained; not generalized to live RPCs.
- Arc local native test reproduces `Cannot clear balance of empty account` on exact USDC drain; the 0.05 floor works. USDC token/native balances are two views of one balance, so a funded USDC seat cannot simultaneously have zero native USDC. The separate EURC test proves a zero-native signer can transfer gaslessly.
- Memo `eth_call` reverts on the official local Arc fork, despite deployed code; it succeeds in an unsigned live RPC simulation. The harness ABI was corrected to the verified no-return-value interface before the comparison. Plain-transfer fallback passes after the unsigned revert. Local Memo remains unavailable; no claim that a public Memo transaction/receipt is verified or that the simulator limitation is resolved. A sent/uncertain payment must never be retried through the fallback.
- Pre-event K0 scripts/evidence remain outside this repository outside this repository. Only status, limitations and repro references are recorded here. No root Arkiv dependency or production schema added. Swarm immediate retrieval proves no 1 h/24 h/7 d retention claim.
