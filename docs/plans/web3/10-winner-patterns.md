# Web3 plan 10: what past ETHGlobal winners have in common, and what it changes here

Part of the [web3 plan](README.md). Status: research, 6 November 2026. Evidence: the 14 winning projects the owner picked from the [ETHGlobal showcase](https://ethglobal.com/showcase) (each page read in full), plus the Arc track write-ups for Cannes and HackMoney 2026 and the Cannes 2026 finalist list. **Read the caveats first; they limit what this proves.**

## 1. Caveats

- **The sample is small (14) and was selected by prize**: every project was picked because it won a World, ENS or 0G prize. So "most winners use World or ENS" proves nothing; only the *shape* of what won is informative.
- **Two events only**: ETHGlobal Tokyo 2026 and Lisbon 2026. The showcase has no filter for event, sponsor or prize (page 1 and 2 of the listing are Tokyo only).
- **No winner data was found for Arkiv, Chainlink, Hedera or Uniswap prizes**, and Arkiv appears to be new to ETHGlobal. The Arkiv, Chainlink and Hedera parts of the plan are therefore uncalibrated by this evidence.
- Team size is not stated on any page; at least one winner (Turing Swap) is written in the first person by a single builder.
- Whether a winner was a pre-existing project is stated on only one page (Novi Corpus); a showcase page showing "created at" an event does not prove it was built from nothing.

## 2. The 14 winners

| Project | Event | Prize(s) | Sponsor tech, as central pieces | What it is |
| --- | --- | --- | --- | --- |
| [Surety](https://ethglobal.com/showcase/surety-ms4gx) | Tokyo | World: Best Use of World ID for Agents | ENS (policy = subname + text records), Uniswap v4 hook, World ID | Parametric insurance for AI agents; one policy per human; claims gated by a fresh human check |
| [Tide](https://ethglobal.com/showcase/tide-b14pr) | Tokyo | ENS: Best Use of ENSv2, 3rd | ENS (strategy parameters in text records; manager agent has a role scoped to three records), 1inch Aqua, Uniswap v4, World ID re-auth | Partially active AMM; 54 tests |
| [Lortnoc Tahc](https://ethglobal.com/showcase/lortnoc-tahc-49c6e) | Tokyo | ENS: Integration into Existing Project, 2nd; World: Best IDKit Use Case ([Cont]) | ENS (a "Space" is a subname with its own PermissionedResolver, from the VerifiableFactory), World ID (IDKit 4.3) | Encrypted text hidden in public comment boxes, gated by ENS membership or a World proof |
| [Radius](https://ethglobal.com/showcase/radius-7i7d0) | Tokyo | ENS: Integration into Existing Project, 1st | ENS only (role and bandwidth tier in text records; "no separate database") | Wi-Fi access where an ENS subname is the credential |
| [ENSignv2](https://ethglobal.com/showcase/ensignv2-34544) | Lisbon | ENS: Best ENS Continuity Integration | ENS (guardians are subnames), plus Pimlico and zkEmail | Your ENS name is your wallet; social recovery |
| [VouchMe](https://ethglobal.com/showcase/vouchme-m6fwb) | Lisbon | ENS: Most Creative Use of ENS | ENS (account nested under its voucher's name; depth = trust distance), World, The Graph | Human trust network with decay |
| [Atlas](https://ethglobal.com/showcase/atlas-pmtqo) | Lisbon | ENS: Best ENS Integration for AI Agents; The Graph 2nd | ENS, 0G, The Graph | Agentic mini-apps from onchain data; 159 tests; an honest limitations list |
| [Hors](https://ethglobal.com/showcase/hors-9j0w8) | Lisbon | World: AgentKit New Use Cases, 1st | World, ENS, 0G | "CORS for AI agents": private functions shared only with agents of the same human |
| [Turing Swap](https://ethglobal.com/showcase/turing-swap-ck2y6) | Lisbon | World: AgentKit New Use Cases, 3rd | World AgentBook, 1inch Aqua/SwapVM | A DEX where verified humans pay lower fees; on World Chain mainnet |
| [Bananamesh](https://ethglobal.com/showcase/bananamesh-bpn7n) | Lisbon | World: Selfie Check Beta, 1st | World (liveness gate), Hedera HCS, x402 | Real ESP32 hardware nodes paid for verified presence |
| [Commitment Issues](https://ethglobal.com/showcase/commitment-issues-y1t2h) | Lisbon | World: Selfie Check Beta, 2nd | World (Selfie Check; the commit SHA is the signal), AgentKit | Face-ID-style human signature on git commits; "a weekend old" |
| [Novi Corpus](https://ethglobal.com/showcase/novi-corpus-0qdc8) | Lisbon | World: Identity Check Beta, Continuity, 1st | World (nullifier UNIQUE per human, AgentKit), ENS (wildcard CCIP-Read), Arc, Circle | Legal entities and treasuries for AI agents; **pre-existing base documented**; 596 tests; all flags off is byte-identical to before |
| [NpmGuard](https://ethglobal.com/showcase/npmguard-wt7wh) | Lisbon | 0G: Keep Building; World: Identity Check Beta, Continuity, 2nd | Page does not say how 0G or World were used | Package audit gate; a project of the same name was a Cannes 2026 finalist |
| [Hands Unchained](https://ethglobal.com/showcase/hands-unchained-6kdf3) | Lisbon | World 1st; 0G Best AI Product 2nd; Lisbon finalist | World (execution rights), 0G Compute (referee), Hedera (contracts, HCS) | Verified humans teleoperate real or simulated robot arms for pay; **zero-hardware simulator option** |

## 3. The patterns (with what we do about each)

**P1. The sponsor primitive is the product's rule engine, not a decoration.** ENS winners use subnames and text records *as the policy store* ("no separate database", Radius; "policy as ENS name", Surety; parameters and a role scoped to three records, Tide; guardians as subnames, ENSignv2; a resolver per Space, Lortnoc). World winners use the proof as a **gate inside an economic mechanism** (one policy per human, a quota per person, fees by human-ness, execution rights, claims). Pages state which parts are central and say what breaks without them. *We do:* in every partner plan, write the "what breaks without it" sentence: the pot refuses a seat that is not a verified human (World), the pot is the escrow (Arc), the receipts and leaderboard read from the chain (Arkiv).

**P2. Bind the human proof to the action, and step up when the stakes rise.** Commitment Issues uses the commit SHA as the World ID signal with a 60-second nonce; Surety gates each claim with a fresh check; Tide requires re-authentication for out-of-guardrail changes; Novi Corpus enforces `UNIQUE(nullifier)` so the same human under another wallet is refused (and shows that refusal live). *We do ([04](04-world-plan.md)):* verify once per profile as before, **plus a step-up Selfie Check bound to the pot id and seat when a stake is above a threshold**, and **show the repeat-human refusal on stage**.

**P3. Winners stack two or three sponsors, each load-bearing, in one coherent story.** 10 of 14 use two or more sponsors; ENS plus World together appear in six of them. Hands Unchained and Atlas use three sponsors each and are the most decorated. This fits the three-partner rule. *We do:* the three chosen partners must interlock in the demo (World gates the seat, Arc holds the money, Arkiv stores the receipt), which they do ([README](README.md) section 1). Caution: this sample cannot tell us ENS plus World is *rewarded*, only that it is common.

**P4. The demo is live, on a public testnet or mainnet, with transaction links.** Every page has a deployed URL (mostly Vercel) and a repository; several show a scripted replay or a live attack (Surety), a curl-verifiable ENS record (Lortnoc), a live sybil-gate refusal (Novi Corpus), or a real World App test end to end (Hors). *We do:* a deployed hosted instance is already a prerequisite ([02](02-integration-architecture.md) section 6); add a **scripted replay** of a full staked match as the fallback if a chain or phone fails on stage.

**P5. Depth is evidenced, and limits are admitted.** Test counts appear on four pages (135, 54, 159, 596); a "hacky bits" or limitations section appears on most (Atlas lists what does not yet work). *We do:* state test counts and an honest "what is not done" list in every partner README section ([07](07-schedule-prep-risks.md)).

**P6. Continuity winners are additive, flag-gated and prove the base is untouched.** Novi Corpus (1st, World Continuity) documents the pre-existing stack, adds a flag-gated trust layer, and states that with all flags off the backend is byte-identical to before. NpmGuard apparently came back after a Cannes finalist run and won two more prizes. *We do:* this is exactly the `PARTNERS=off` principle in [02](02-integration-architecture.md); add a test that proves **byte-identical results and hashes with partners off**, and say so in the README.

**P7. Tangible, physical or zero-install demos stand out.** Bananamesh (ESP32 hardware), Hands Unchained (robot arms, with a zero-hardware simulator so anyone can try it), Radius (real Wi-Fi shaping), Cannes' ETHastic and VEIL VPN. Phones moving a cursor on a TV, joined by QR with no install, is the same kind of demo. *We do:* open the demo with the physical interaction, and let judges join with their own phones.

**P8. The category is agents, identity and finance; games and consumer fun are rare.** None of the 14 is a game. Cannes finalists were AI agents, privacy and prediction markets; Arc's Cannes write-up says about 98% of submissions were agentic. A friends' game console is **off-trend**, which cuts both ways: little direct competition and strong demo appeal, but sponsors score the integration, so a game is judged on whether the sponsor's piece is genuinely central. *We do:* lead each partner pitch with the mechanism (a human-gated escrow whose result comes from deterministic replay), not "a game".

**P9. Settlement needs a source of truth, and ours is unusually strong.** Cannes finalist DIVE sold "an AI swarm engine verifying real-world truth for prediction markets"; Arc winners Predict It! (stake USDC on penalty kicks) and PolyPOP are prediction markets. A game result is verifiable by **deterministic replay**, a stronger oracle than an LLM swarm. *We do:* put "replay-verified result" at the centre of the Arc and Chainlink stories ([09](09-arc-pot-and-settlement-plan.md)).

## 4. What the Arc track winners show (Cannes and HackMoney 2026, not Mumbai)

Cannes "Smart Contracts with Advanced Stablecoin Logic" winners: **Onda** (micropayments to artists with an escrow for unclaimed artists) and **PayMate** (a programmable credit pool). Other Cannes winners include **Predict It!** (stake USDC before watching a penalty kick; contracts on Arc settle), **C.E.S.T.A Agent** (friends pool USDC for road trips) and **PolyPOP** (social prediction markets). HackMoney winners included an escrow-and-treasury theme and agent-per-second payments. Takeaways: **friends pooling or staking USDC is an established, winning shape on Arc**, so the pot is in the right place; **escrow alone is common**, so the differentiators must be the human gate, the replay-verified result, the refund-by-default design, and a live physical game; about 40% of Cannes entries used Circle Nanopayments and about 98% were agentic, so a non-agentic pot will stand apart from the crowd. Judging criteria stated: bounty alignment, solution quality, technical depth, creativity. Mumbai's Arc bounties differ (Studio-first), so treat this as a pattern, not a rule.

## 5. What changes in the plan

| Change | Where |
| --- | --- |
| Step-up Selfie Check bound to pot id and seat above a stake threshold; show the repeat-human refusal live | [04](04-world-plan.md), [08](08-stakes-product-and-legal.md) |
| Target World's Selfie Check and IDKit-style tracks first; keep the AgentKit ghost seat small (agent patterns are crowded, and Lisbon's AgentKit judging excluded reused patterns) | [04](04-world-plan.md) |
| "What breaks without it" sentence for every partner; test counts and a limitations list in every README section | [07](07-schedule-prep-risks.md) |
| A scripted replay of a staked match as the demo fallback | [07](07-schedule-prep-risks.md), [09](09-arc-pot-and-settlement-plan.md) |
| A test and README line proving `PARTNERS=off` gives byte-identical results | [02](02-integration-architecture.md) section 9 |
| ENS stays the first reserve: the Tokyo showcase page shows ENS in 6 of 33 entries (about 18%) and the winners are deep and well tested, so it is **crowded with a high bar**; if built, copy the winners' shape (text records as the policy store, a resolver per party, a scoped agent role, no database) | [03](03-ens-plan.md) |
| Arkiv, Chainlink, Hedera, Uniswap are **uncalibrated** by this evidence: after Arkiv publishes, look for any past Arkiv winners (ETHRome 2026 lists Arkiv bounty winners at ethrome.org/winners) before committing the third slot | [README](README.md) section 7 |

## 6. Sources

The 14 showcase pages linked in section 2; [ETHGlobal showcase](https://ethglobal.com/showcase) (pages 1 and 2, Tokyo 2026 only); [Arc: Cannes track winners](https://www.arc.io/blog/meet-the-arc-track-winners-from-ethglobal-cannes-hackathon-and-what-we-learned); [Arc: HackMoney 2026 track winners](https://www.arc.io/blog/meet-the-arc-track-winners-from-the-hackmoney-2026-hackathon-and-what-we-learned); [crypto.news on the Cannes 2026 finalists](https://crypto.news/ai-agents-privacy-and-prediction-markets-define-ethglobal-cannes-2026-finalists/). The Arc post's own percentages are internally inconsistent in places (it says 67% of winners but lists eight winners), so treat its numbers as indicative.
