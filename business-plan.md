# Funcaster Console: business plan

Status: working draft, 6 November 2026. This is a planning document, not a financial forecast. Every revenue figure in it is illustrative arithmetic on stated assumptions; only the cited prices and rates come from sources.

**For coding agents (Codex, Claude Code) reading this later.** This file is the commercial context for the product in this repository. It tells you *why* some features exist (persistent rooms, creator tooling, a coin-free first version, original assets) and *what not to build yet* (real-money flows, anything that converts Twitch Bits or YouTube Super Chats into currency, web3). The technical roadmap is in `plan.md` and `docs/plans/`. Where this file and `plan.md` disagree on engineering, `plan.md` wins; where they disagree on business direction, this file wins. The founder's pitch for an adjacent idea is preserved verbatim in section 1 because it is the seed of the streamer/community direction.

Source tags used below: **[P]** read at the primary source during research; **[S]** secondary source or a search summary I could not open; **[U]** unverified, or my own assumption. Treat every [S] and [U] number as something to re-check before it goes in a pitch deck. No country's law is analysed here; where a platform's own rules constrain a design, that is noted as a platform policy.

---

## 1. The seed: the founder's "Streamer Arcade" pitch

This is the pitch for an adjacent application that inspired the community direction of this product. It is a transcript of a spoken video, so its typos and repeated phrases are preserved exactly as given.

> I've always loved playing and making video games, but I think I accidentally built something way more interesting. Whenever a streamer logs off, thousands of eyeballs gone. But what if we could play game from game even when the streamer is in there? So I build this. The stream becomes an arcade. Your phone becomes your very own controller, and all you need to do is press Join. Now you can actually play together, play against each other, She has the high score, climb the leaderboard, friendship, rivalries. It's just fun, even when the streamer isn't here. But this is where it gets really interesting for the streamer, too. Remember how Arcade had coins? Well, bits and super chats become the Arcade coins. So supporting a streamer doesn't just put a message on the screen anymore. You can actually use those to play and be the part of the game. But every streamer has a completely different community. Different joke, different joke, Different means, different lords. So why should they all have the same game? They shouldn't. I can build custom games around each streamer and their community. And somewhere while building all of this, I realized, I think I accidentally built an after-party for live streams.
> The streamer goes offline, but the fun doesn't. This is Streamer Arcade. Comment the names of your favorite streamers and show it to them. Let them know we are building something new.

**What we take from it** (and what the research in sections 4-6 says about each idea):

| Idea in the pitch | Why it is good | What the research says |
| --- | --- | --- |
| "The stream becomes an arcade" | A reason for a community to come back when nobody is live | No product literally called Streamer Arcade exists [S]; the closest prior art, Stream Raiders, shut down in March 2025 (section 4) |
| "Your phone becomes your controller, press Join" | Zero-install joining, the exact thing Funcaster Console already does | Proven format (AirConsole, Jackbox): see `plan.md` section 11 |
| "Leaderboards, rivalries, friendship" | Retention mechanic that works without the streamer | Needs persistent rooms and identity; not built yet |
| "Bits and Super Chats become arcade coins" | Gives supporters something to *do* with their support | **Platform rules constrain this heavily** (section 6); live-chat events also do not exist after a broadcast ends. Start coin-free |
| "Custom games for each community" | Differentiates the product and makes each community feel owned | Fits the creator-platform plan (`plan.md` section 5g); needs templates so it is cheap per community |
| "After-party for live streams" | Strong positioning line | A hypothesis, not a measured problem: nobody has published how many viewers are lost when a streamer goes offline [U] |

---

## 2. What Funcaster Console is, and the three layers it can become

**Funcaster Console today:** a browser game console. One screen (TV or laptop) shows a lobby and games; up to four phones join with a QR code or a six-character code and become motion controllers (no app). Thirteen games, solo and multiplayer, all in the browser. Original art; a catalog, a manifest format and a result format already exist (`plan.md`, `docs/SDK.md`).

**Layer 1: the party console (exists).** Friends in a room, one screen. Revenue shape: hosts and sponsors pay; players do not.

**Layer 2: the creator platform (designed, gated).** Outside creators build games against an SDK and list them. Revenue shape: a take rate on creator sales, plus tooling. Gated on the SDK being proven by an outside creator (`plan.md` section 5g.12).

**Layer 3: the community arcade (new, from the pitch).** A persistent room per community (streamer, Discord server, college club) with a stable link and QR, leaderboards and seasons, an OBS overlay, and community-themed games. Revenue shape: community subscriptions, cosmetics, and (later, carefully) coins.

The order matters: layer 1 proves the fun, layer 3 gives it a reason to recur, layer 2 gives it supply. Revenue should follow in that order too (section 9).

---

## 3. Who pays: customer segments

| Segment | Pays for | Typical size | Notes |
| --- | --- | --- | --- |
| **Hosts** (people who run a party: friends, families, classrooms, cafes, venues) | Premium room features, more players, no branding, more games | Large, bursty | Comparable products charge about $5 a month for consumers (AirConsole's Hero at $4.99 in 2020 [S]) and about $12-25 a month for classroom and presentation tools (Mentimeter, Kahoot [S]) |
| **Communities and streamers** | A persistent branded room, overlay, custom game, moderation tools | Most channels are tiny: about 23 average viewers per Twitch channel and about 308 per YouTube Live channel in Q2 2026 (Streamlabs x Hatchet [P]) | The product has to work for a 30-person community |
| **Creators** (game makers) | Distribution, tooling, hosting | Unknown | They are paid by us through a revenue share; they may also pay for pro tooling |
| **Brands and events** | Branded games, tournaments, activations | Lumpy, high value | ETHGlobal and Devcon style events, college fests, brand activations. Sponsorship packages in the ETHGlobal ecosystem were quoted at $35,000-$50,000 in community proposals [S, dates unconfirmed] |
| **Players and viewers** | Cosmetics, coins (later), supporter perks | Many, low conversion | Fewer than 10% of Indian gamers ever paid for anything, per EY via Outlook Respawn [S] |

---

## 4. Market grounding for the community-arcade direction

### 4.1 Prior art and competitors

| Product | What it does | Monetisation | Traction | Lesson for us |
| --- | --- | --- | --- | --- |
| **Stream Raiders** (Captain.tv) | Streamer is the captain; viewers are the army in a free-to-play game | Cosmetics; revenue share to streamers (60% affiliates, 70% partners at the end) [S] | 25,000+ streamers, 1.5M+ viewers (2021 claim) [S]; about $2.47M paid to streamers over its life (company figure) [S]; **shut down March 2025** after a $10M raise (2021) | The closest prior art could not sustain itself on cosmetics plus a streamer share. Do not make streamer payout the business |
| **Crowd Control** (Warp World) | Viewers pay to trigger effects in the streamer's single-player game | Viewers buy coins (Bits, channel points, TikTok gifts, PayPal/Stripe); the platform keeps about 20% [S, TechCrunch 1 May 2023 P] | 70,000+ creators, 100+ games in 2023 [P]; 200+ games by June 2026 [S] | Proves viewers pay to affect a stream and that cross-platform coins work. Live-only and streamer-centred |
| **Jackbox + Audience Kit** | Twitch viewers join a Jackbox game without a code (Dec 2020) | Game sales | No public audience numbers | The audience is subordinate to a host with a licence; no community layer |
| **Twitch Extensions** | Overlay apps with Bits | Developer gets 20% of 1 cent per Bit, streamer 80% [S 2018; Twitch says the programme can change] | 43,000+ developer apps [P, Twitch 2024 data] | Native to Twitch but heavily policy-limited (section 6) |
| **Discord Activities** | In-app games in a Discord voice channel | Platform fee 15% on the first $1M, then 30% [S] | Discord says apps are used by over 25% of monthly users [S] | **The strongest offline-community competitor**: the always-on community space already exists. Treat Discord as an equal channel for us, not an enemy |
| **YouTube Live Playables** | 75+ minigames a creator plays on stream (Sept 2025) | Normal live monetisation | n/a | A platform-native threat; appears creator-played, not viewer-controlled [S] |
| **AirConsole** | Phones as controllers on a TV or browser | Subscription pool: 70% of revenue after store fees to a developer pool by play time [S]; the signed agreement's terms differ in detail [P] | 2022 press release: 10,000+ developers, 10M+ players [S] | The nearest format competitor. Living-room focused; no community or stream layer |
| **Streamer.bot "play with viewers", Viewergames Arcade** | DIY chat-driven and viewer-queue minigames | One-off sales, free | n/a | The long tail of do-it-yourself tools; needs a technical, online streamer |

Sources: TechCrunch (Crowd Control, 1 May 2023, https://techcrunch.com/2023/05/01/crowd-control-interactive-stream/ [P]); Stream Raiders sunset and funding (https://streamraiders.fandom.com/wiki/Sunset, https://gamesbeat.com/captain-tv-creator-stream-raiders-receives-funding-to-make-new-games/ [S]); Jackbox Audience Kit (https://www.jackboxgames.com/the-jackbox-audience-kit-twitch-extension-is-now-available/ [P]); Discord (https://gamesbeat.com/discord-opens-activities-in-app-games-and-features-to-all-developers/, https://discord.com/blog/build-where-the-world-plays [S]); YouTube Playables (https://techcrunch.com/2025/09/16/youtube-live-gets-a-major-update-introduces-dual-format-streaming-minigames-and-more/ [S]); AirConsole (https://developers.airconsole.com/revenue-page [S], https://www.airconsole.com/file/AirConsole-Developer-Distribution-Agreement-2023-08-14.pdf [P]).

### 4.2 Market size and the real shape of the audience

- Q2 2026 live-streaming hours: about 21.5 billion in total; **YouTube Live about 12.97 billion (60.3%)**; Twitch about 4.52 billion (21.0%, down 8.3% year on year); Kick about 1.34 billion (up 36.7%). Source: Streamlabs x Hatchet, published 27 Aug 2026 (https://streamlabs.com/content-hub/post/streamlabs-and-hatchet-q2-2026-live-streaming-report) [P]. Trackers disagree; pick one and stay consistent.
- Twitch had about 7.94 million channels that streamed in the quarter and about 23 viewers per channel [P]. **Most communities are small.**
- **There is no published number for how many viewers vanish when a streamer goes offline.** The pitch's premise is a hypothesis to test. The nearest datapoint is migration, not offline gaps: after DrLupo moved from Twitch to YouTube his most engaged viewers watched 22% less Twitch content and 28% left Twitch (Gamesight [S]).
- No public total exists for Bits or Super Chat volume [U].

### 4.3 India (business facts only)

- **YouTube dominates** Indian gaming creators: Techno Gamerz passed 50M subscribers in Feb 2026 [S, Outlook Respawn]. **Twitch has under 2%** of India's streaming hours (Outlook Respawn, 15 Oct 2025 [S]), so a Mumbai team should build for YouTube first.
- **Creator income is mostly brands, not fans:** brands supply over 70% of gaming creator revenue and YouTube pays about INR 20-40 per 1,000 views (EY via Outlook Respawn [S]). India had 488M gamers in 2024 (FICCI-EY); fewer than 10% ever paid; 97% play on smartphones only [S].
- **YouTube Gifts launched in India on 7 Jul 2026**: viewers buy "Jewels" and send animated gifts during live streams, with India-specific items (Vada Pav, Chai Toast, Pani Puri); creators earn "Rubies"; creators who enable Gifts lose Super Stickers on live streams (Google, https://blog.google/intl/en-in/products/platforms/a-new-way-to-connect-and-earn-with-gifts/ [P]). This is the freshest India-specific "virtual item" hook, and a reminder that platforms can ship near-neighbours of the idea.
- **Local platforms:** Rooter reported INR 82 crore FY25 revenue and a 90% creator share of gifts [S]; Loco was majority-acquired by Redwood (UAE) for $65M in Sept 2024, down from a peak valuation near $150M (TechCrunch [S]); STAN sells "Club Passes" for creator interactions [S]. I found no Indian platform with interactive minigame features, which is a gap, not proof of absence.
- Real-money gaming sponsors left the creator economy in 2025, which cut a major sponsorship pool (reported 55-60% of the gaming market) [S].

---

## 5. The product concept for the community arcade

**An always-on arcade room per community.** A stable URL and QR code. The room stays open when the streamer is offline. Games run in short rounds on a shared screen (a web page, a 24/7 channel the community owns, or simply everyone's phones). Join is a link or QR scan, a nickname, and optional Twitch / YouTube / Discord linking used only for a display name and a leaderboard identity.

What this reuses from the existing product: phone controllers, rooms, seats, the catalog, results and replay records, spectator displays. What it adds:

| Addition | Why | Notes |
| --- | --- | --- |
| **Persistent rooms** (a room that outlives the host tab) | The core of "after-party" | Today rooms live in server memory, die 120 s after the host tab leaves and after 4 h regardless (`docs/NETWORKING.md`). Needs storage and a room owner who is not a browser tab |
| **Accounts / linked identity** | Leaderboards, rivalries, moderation | Keep it optional and platform-neutral; a nickname-only path stays |
| **OBS browser-source overlay** | Puts the QR, current game and top ten on the stream | A read-only view of existing state; the existing read-only display role is the start |
| **Seasons, leaderboards, rivals** | Retention without the streamer | Weekly or monthly seasons; per-game and overall boards; "beat the person above you" |
| **Community theming and custom games** | "Different jokes, different lore" | A theming template (art, sounds, text, prompts) over three or four proven mechanics, so a community game costs hours, not weeks. This is the seed of the creator ecosystem |
| **Moderation tools** | Open rooms attract abuse | Nickname filter, mute, ban, report, room lock; minors need extra care (Twitch bars under-13s; age checks are self-declared [S]) |
| **Streamer dashboard** | Room settings, seasons, theme upload, basic stats | A small web page |
| **Chat commands** (later) | Post the leaderboard and join link | Link-only first; full integration costs OAuth review and rate-limit work |

**Coins are optional and come last.** A coin-free version (play for score and rank) avoids the platform-policy exposure in section 6 and still delivers the pitch's emotional core: friends, rivalries, a high-score table.

---

## 6. Platform rules that shape the "arcade coins" idea

These are the platforms' own rules, not legal analysis.

**Twitch.**
- The Extensions policy (https://dev.twitch.tv/docs/extensions/guidelines-and-policies [P]) allows Bits to activate experiences, unlock consumables, enrich free-to-play games and vote. It **prohibits Bits for pay-to-play access, gambling that rewards winners with items of monetary value, randomised loot boxes, sweepstakes and wagering**. Bits may not be called donations, purchases or spending in the UI. Items may not be exchanged for money. No advertising or sponsorship inside an Extension. No NFT features. Rewarding actions outside Twitch cannot be the main use case, and links to sites with similar Twitch functionality are restricted: a "scan the QR and play on your phone" flow sits close to those lines.
- The Bits Acceptable Use Policy bars selling, trading or transferring Bits for money or items of value [S, via search; the page body did not load].
- EventSub exposes `channel.cheer` and `channel.bits.use`, but not Bits spent inside Extensions, which come only through the Extension transaction event (https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/ [P]).
- **Converting Bits into your own coins is unconfirmed.** One developer-forum reply says it is not allowed and direct triggers may be fine; Crowd Control's feature list says coins can be exchanged for Bits [S]. These conflict. **Ask Twitch directly and get it in writing before relying on it.**

**YouTube.**
- Super Chat, Super Sticker and membership events are exposed through the live chat API while a stream is live; live chat is not available after the broadcast ends. Quota is 10,000 units a day by default, and extensions need a compliance audit (https://developers.google.com/youtube/v3/live/docs/liveChatMessages [P]).
- API policies cap stored data at 30 days and bar rewarding users for engaging with YouTube features such as likes and subscriptions (https://developers.google.com/youtube/terms/developer-policies [P]). I found no rule that explicitly allows or forbids "Super Chat buys arcade coins", and no documented API for the new Gifts events [U].
- There is no developer revenue share on Super Chat that I could find; a third-party app can read these events but earns nothing from them [U].

**The consequence for the pitch.** "Bits and Super Chats become arcade coins" cannot work while the streamer is offline (no chat or Super Chat events exist), and while live it runs into Twitch's pay-to-play and transfer rules. What *is* possible: community-owned coins earned by playing, supporter perks sold directly on our own site (cosmetics and entitlements, not play access sold with Bits), channel points and linked identities for display, Discord or a web room as the offline home. If real-money coin top-ups are ever added, treat them as a separate payments project; keep coins **non-redeemable** as a platform-policy principle.

---

## 7. Take-rate benchmarks (what the market charges creators)

| Platform | What it takes / what the creator keeps | Source | Tag |
| --- | --- | --- | --- |
| Steam | 30%, falling to 25% past $10M and 20% past $50M of revenue; $100 fee per product, recouped at $1,000 | https://partner.steamgames.com/doc/gettingstarted/appfee; tiers https://www.neowin.net/news/valve-introduces-new-revenue-share-tiers-for-steam-promising-bigger-cuts-for-studios/ | fee P, tiers S |
| Epic Games Store | 0% on the first $1M per product per year, then 12% (from 1 Jun 2025) | Epic news page via search | S |
| itch.io | Default 10%, seller can set 0-100%; processor adds about 2.9% + $0.30; a $10 sale nets $8.41 | https://itch.io/docs/creators/payments | P |
| Roblox | DevEx pays $0.0038 per Earned Robux (from 5 Sep 2025); about 21% of FY2024 bookings reached creators as DevEx cash-outs (my arithmetic on the 10-K: $922.8M / $4,369.1M) | https://create.roblox.com/docs/production/monetization/developer-exchange; 10-K | rate P, share S |
| Apple App Store | 30%, or 15% under the Small Business Program (under $1M a year) | https://developer.apple.com/app-store/small-business-program/ | S |
| Google Play | 15% on the first $1M a year, then 30%; subscriptions 15% | https://support.google.com/googleplay/android-developer/answer/11131145 | S |
| Discord Premium Apps | 15% on the first $1M cumulative, then 30% (from 6 Jun 2024) | https://gigazine.net/gsc_news/en/20240607-discord-monetization-terms | S |
| Twitch Extensions (Bits) | Developer 20% of 1 cent per Bit; streamer 80% | https://dev.twitch.tv/ , 2018 forum post | P / S |
| Poki | 50/50 on traffic Poki brings; 100% to you on your own traffic; web exclusivity required | https://developers.poki.com/guide/working-with-poki | P |
| CrazyGames | No published standard split; a 2026 jam gave 60% of ads and 70% of in-game purchases | third-party guide | S |
| AirConsole | Subscription revenue pooled by play time; terms in the signed agreement | https://www.airconsole.com/file/AirConsole-Developer-Distribution-Agreement-2023-08-14.pdf | P |

**Reading the table.** Distributors mostly take 10-30%. Below about 15% only itch.io and Epic's first $1M compete. A 10-15% take is credible to creators; anything above 30% needs a distribution service to justify it. Roblox shows how little of spend can reach creators (about a fifth).

**Streamer economy anchors.** Twitch Bits: 100 Bits cost $1.40 on desktop; a streamer receives $0.01 per Bit, so Twitch keeps about 29% (Streamlabs, Feb 2024 [S]; arithmetic mine). Through an Extension the developer earns $0.002 per Bit, about 14% of the desktop price; earning $1,000 as a developer needs about 500,000 Bits, or $7,000 of viewer spend (my arithmetic). Subscriptions split 50/50, with 70/30 for some partners [S]. YouTube Super Chat: 70% to the creator after taxes and app-store fees [P, https://support.google.com/youtube/answer/7288782]. StreamElements and Streamlabs tipping take no platform cut beyond card fees [P].

---

## 8. Monetisation models

All revenue arithmetic is illustrative. The conversion and audience figures in the "assumptions" column are **[U]** and are exactly what to test first.

| # | Model | Who pays | Anchor (sourced) | Illustration (assumptions are [U]) | Main risk | Fit |
| --- | --- | --- | --- | --- | --- | --- |
| a | **Host subscription**: free shared screen, paid for more players, no branding, premium games, saved rooms | Hosts, venues, classrooms | AirConsole Hero $4.99/month [S]; Kahoot 360 from about $19/month [S] | 5,000 monthly hosts x 3% convert x about $4.56 net of card fees = about $680/month; at $19, about $2,600/month | Party use is bursty; free is good enough | Core; low build cost |
| b | **Game or pack purchases** | Hosts | Jackbox Party Pack 11 at $29.99 [S] | 1,000 buyers x $10 = $10,000 gross, about $9,100 net on our own web store (Steam would take 30%) | Needs enough quality games; lumpy | Natural unit for creator sales |
| c | **Creator marketplace**, 10-15% take | Buyers; creators earn | itch.io 10% [P]; Epic 12% [S] | 100 creator games x $200/month x 10% = $2,000/month | Chicken-and-egg; payouts, tax forms and KYC overhead; moderation | The creator-platform thesis; later stage |
| d | **Non-redeemable arcade coins** bought on our own site (and earned by playing), shared with the community owner | Viewers, supporters | Crowd Control keeps about 20% [S] | 1,000 partner streamers x 4 sessions x 40 viewers x 2% pay x $3 = $9,600 gross/month; at a 20% cut = $1,920. Via an Extension and Bits the developer gets about 14%: about $1,370 | Platform rules (section 6); the pitch's weakest-grounded piece | Best streamer fit, but last |
| e | **Community custom games / white-label** (B2B2C) | Communities, brands | Crowd Control is freemium B2B2C [S] | No sourced price. Productise with templates so it is hours of work | Bespoke work does not scale | Fits "different jokes, different lore" |
| f | **Sponsorships, branded games, tournaments, events** | Brands, event organisers | ETHGlobal sponsor packages quoted at $35,000-$50,000 and a single $8,000 prize track in community proposals [S, dates unconfirmed] | One branded game for one event at an assumed $2,000-$8,000 | Sales-heavy; event-dependent | **Fastest first revenue**; keep it on the shared screen, not inside Twitch Extensions |
| g | **Ads** between games or in a portal | Advertisers | Vendor eCPMs: rewarded video about $6-15 per 1,000 for top-tier traffic, about $1-4 for India [U, vendor] | 1,000 Indian sessions earn only a few dollars | Breaks the party flow; portals want exclusivity (Poki) | Poor fit for the core product |
| h | **Cosmetics**: controller skins, avatars, themes, name colours | Players, viewers | Twitch itself recommends cosmetics for Bits [P]; Stream Raiders was a cosmetics business [S] | Same shape as (d) | Needs an audience first | Good for hosts and communities; the retro-Mumbai skins are natural products |
| i | **SDK, hosting and creator tooling** tiers | Creators | Crowd Control sells a developer plug-in [S] | No sourced price | Small market until games exist | Later |
| j | **Web3 options** (dare receipts, on-chain records, stablecoin creator payouts, tickets) | Event audiences | Twitch Extensions prohibit NFT features [P] | None | Keep entirely separate from v1; see section 11 | Later, hackathon audiences |

---

## 9. Recommended phased roadmap

**Phase 0: before any revenue (now).** Prove the fun and the return rate.
- Stay free. No ads. No coins.
- Track: sessions per host per week; phones joined per session; share of sessions with three or more players; day-7 host return; creator submissions; time from QR scan to first game.
- Smoke-test pricing with a fake checkout page; run a short willingness-to-pay survey.
- Ask Twitch support (in writing) whether a QR join flow and any Bits-linked coin pass review. Ask YouTube the same about Super Chat and Gifts.
- Get real sponsor quotes from two or three events, including India college fests.
- Interview 10 streamers and community owners (5-10 is enough to learn) *before* building the community arcade.

**Phase 1: first revenue.**
- Sponsored events and branded games first (model f): fastest cash, no payment code.
- Host subscription (a) and cosmetics (h) on our own web checkout to avoid 15-30% store cuts.
- Local-currency price tiers for India; do not rely on ads.

**Phase 2: the community arcade pilot.**
- Pilot with 10-20 communities, preferably on YouTube and Discord first for the India audience.
- Coin-free at first. Add direct, non-redeemable supporter coins on our own site only after written platform clarification, with a 20% platform cut as the reference point; test an Extension and Bits path alongside it knowing the developer share is about 14%.
- Measure viewer-to-payer conversion and revenue per stream-hour.

**Phase 3: scale.**
- Open the creator marketplace at about 10-15% with payouts (model c); sell templates and tooling (i); custom-game deals (e).
- Web3 items (j) stay separate and later.

**Assumptions to test first (most uncertain, most valuable):**
1. Viewer-to-payer conversion (assumed 2%, no source).
2. Concurrent viewers per participating stream (assumed 40; the real median is about 23 on Twitch).
3. Whether hosts pay at $5 versus $19 a month.
4. Whether Twitch and YouTube accept the join flow and any coin link.
5. Whether communities return to an offline arcade at all (the pitch's core premise).

---

## 10. Positioning, risks and metrics

**Positioning (draft).** Funcaster Console turns any community into an always-on arcade: members join from their phone with a link or QR, play together and against each other whether or not the streamer is live, and climb a leaderboard built around the community's own jokes. (Stress-test "whether or not the streamer is live" with real streamers before using it publicly.)

**Differentiation to protect:** a retro-futuristic Mumbai identity (see `docs/plans/visual-direction.md`), a phone-as-motion-controller experience, original games, and a creator platform. It competes on *feel* and *community*, not on being the first interactive-stream tool.

| Risk | Mitigation |
| --- | --- |
| The category has a recent failure (Stream Raiders) and streamer income is thin | Do not depend on streamer payout; target communities where the value is retention; validate with 5-10 creators first |
| Platform policy on Bits and Super Chats | Coin-free first; supporter coins on our own site only; written clarification; keep coins non-redeemable |
| Platform dependence and copycats (YouTube Gifts and Playables, Discord Activities) | Keep identity and rooms platform-neutral (link-based join); treat Twitch, YouTube and Discord logins as optional; ship Discord as an equal channel |
| Abuse, bots and minors | Nickname filtering, mute and ban tools, rate limits, no personal data beyond a display name, an age gate, no real-money prizes |
| Cold start: small communities cannot sustain rooms that need many players | Games that work with 2-6 players plus asynchronous leaderboards; seed a handful of creators; measure return rate per community |
| IP in creator content (a rename does not fix this; see `plan.md` section 5e) | Asset licence declarations, review before listing, takedown process, start with invited creators |
| Building the platform before the games prove it | Stage gates in `plan.md` section 5g.12 |

**Key metrics:** host return rate (day 7, day 30); players per session; sessions per community per week; offline-room sessions as a share of total (the pitch's core claim); creator games submitted and played; conversion by model; revenue per active host.

---

## 11. Web3 and the hackathon (kept separate and later)

Web3 work is deliberately deferred (`plan.md` section 5f). Where it connects to the business: dare receipts and verifiable results could become a premium feature for competitive communities; creator payouts in a stablecoin are a possible later payout rail; event partners (the same ecosystem that sponsors hackathons and conferences) are a plausible early sponsorship customer (model f). None of it is needed for phases 0-2, and Twitch Extensions prohibit NFT features. The hackathon itself is an audience and a deadline, not a business model.

---

## 12. Open questions and gaps in this research

- No data on offline viewer loss, on Bits or Super Chat volumes, or on Twitch behaviour while a channel is offline (whether Bits or channel-point redemptions work then is unconfirmed [U]).
- No India-specific price or eCPM data; no Indian creator concurrent-viewer figures.
- Primary texts not read: Steam's tier announcement, Twitch's Developer Services Agreement and Bits Acceptable Use Policy, Epic's revenue pages.
- Current AirConsole pricing and subscriber numbers; Jackbox revenue.
- Whether a YouTube Super Chat to coins flow, or any Gifts API, is permitted or available.
- "Playfield" (named in the original brief) could not be identified and is excluded.
- This document contains no legal analysis of any country's law.

---

## 13. Sources

Streamlabs x Hatchet Q2 2026 report; TechCrunch (Crowd Control, 2023; Twitch monetisation eligibility, Feb 2025; Loco, 2024; YouTube Live Playables, 2025); Twitch developer docs (Extensions guidelines and policies, EventSub types); YouTube developer docs (live chat messages, API policies, quota); Google India Gifts blog (7 Jul 2026); Outlook Respawn (India gaming and creator pieces, 2025-2026); Steam, itch.io, Roblox, Poki, Discord, Apple and Google developer pages; AirConsole developer agreement and revenue page; Jackbox store pages; the Streamer Arcade pitch transcript (section 1). Individual URLs are given inline above with their reliability tags.
