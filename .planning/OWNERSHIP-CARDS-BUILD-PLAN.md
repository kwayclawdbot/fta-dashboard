# CHEAT CODE OWNERSHIP CARDS — Build Plan v1
**2026-07-26 · physical collectible layer over long-term ownership**

## Locked decisions (from concept session)
1. **Card = title, not bearer instrument.** The app is the registry, the brokerage is the vault, the card is the artifact. A card never carries or redeems shares.
2. **Model A first (pointer + verification).** Cards bind to positions in the user's own linked brokerage (SnapTrade). Custodial "Model B" (atomic card+share transfer via partner custodian, Stockpile-style) is a later architecture; all serials/provenance designed custody-agnostic so Model A cards survive an upgrade.
3. **Digital twin ships before any plastic.** Physical NFC is a later phase gated on digital engagement.
4. **Two value layers, kept separate:** investment value (live position math) vs collectible identity (series/edition/serial/age/provenance). Ownership Score never ranks by returns.
5. **State machine before UI:** `DRAFT → ACTIVE → IN_TRANSFER → ACTIVE(new holder)` and `ACTIVE → SEAL_BROKEN → RETIRED`. Provenance is an append-only log. "The tap is the truth."
6. **Hold-side gamification only.** Milestones celebrate holding age, diversification, series completion, gifting. Nothing celebrates or triggers on a trade. (Robinhood-confetti lesson.)
7. **Compliance separations:** card purchase (merch) and share purchase (brokerage) are never one checkout; recipient KYC is mandatory in every transfer flow; no return promises anywhere in copy.
8. **The card is a LIVING COLLECTIBLE, not a brokerage position wearing a skin.** *(2026-07-26, Kway)* The digital card itself — not the attributes panel around it — is the product. The card face renders live state (asset art, denomination, current value, growth-since-issue) and visually accumulates history: ISSUED → 100 DAYS HELD → 1 YEAR HOLDER → +25% MILESTONE → LEGACY HOLDER as evolving borders/badges/finishes on the object. Denomination never changes; the visual history only accumulates. One object carrying six identities — asset (per-asset art), ownership (denomination), market state (live value), history (growth since issue), collectible (series/edition/serial/rarity), holder story (owned since / gifted by / milestones). Every card state must be screenshot-worthy; the share image is just the card. `design_state` in card_snapshots is the infrastructure — every snapshot re-renders the card exactly as it looked in that era.

## Where it lives
- **App:** fta-dashboard (Cheat Code Club) — new sidecar section, additive only (per additive-build pattern; zero changes to existing Kai/Club production paths).
- **DB:** Club Supabase (`zvkercqohmmeyofycbgr`), new tables only.
- **Brokerage data:** SnapTrade (connections + positions + activities). Same backbone as Kai Mobile spec.
- **Quotes:** Polygon (already licensed) for live/EOD prices; EOD close is fine for v1 card values, live quote on card-open is a polish item.
- **Public scan pages:** unauthenticated Next.js route `/c/[serial]` in the same app.
- **Build method:** Opus build agents per phase, Fable orchestrates + verifies (Playwright on live URL before any "done").

---

## Phase 0 — Digital Collection MVP (the shelf) — ~1 week of agent lanes
Goal: a Club member with a linked brokerage sees their positions as cards and it *feels* different from a brokerage list. No physical, no transfers, no scarcity.

> **2026-07-26 build-time finding:** fta-dashboard has NO SnapTrade integration and `SNAPTRADE_CONSUMER_KEY` is still owner-pending (same blocker as the trading-bot roadmap). Phase 0 therefore ships **manual-first minting** (user self-reports symbol/qty/avg price/date; card values still live via Polygon) behind a `PositionProvider` abstraction (`src/lib/ownership/types.ts` — shared contract, backend lane owns it). SnapTradeProvider slots in when keys land, enabling verified mints + automatic SEAL_BROKEN detection. Manual cards: seal status is self-reported ("I sold some/all") until then — cards show a subtle "self-reported" vs "verified" mark so provenance stays honest.

Build:
1. **Schema v1** (see Data Model): `ownership_cards`, `card_events`, `card_snapshots`.
2. **Mint flow (digital):** user picks a position (or lot) from SnapTrade → "mint card" → card row created with acquisition basis frozen (quantity, avg price, original value, acquired_at from brokerage data; manual entry fallback when lot data is missing).
3. **Collection page** (`/collection`): visual shelf, one designed card per asset — swipeable, Apple-Wallet energy, per-asset art direction (start with a template system: asset color/logo/series frame; 10 hand-tuned designs for the S&P mega-caps + BTC + VOO, generic-but-good fallback for everything else).
4. **The Living Card component (THE build; everything else orbits it):** an animated card object (CSS/WebGL-lite — tilt/parallax/foil on interaction, respects reduced-motion) whose FACE renders live state: asset art + `NVDA · 10 SHARES` + current value + `+36.8% SINCE ISSUE`. Visual evolution system driven by milestone state: border/badge/finish upgrades for hold-age tiers (ISSUED → 100 DAYS → 1 YEAR → LEGACY HOLDER) and value milestones (+25 / +50 / +100 clubs) — accumulating, never regressing, denomination immutable. This component is THE design lane deliverable (loads design-taste skills + brand register); the detail view is the card plus a thin attributes/value panel below it, not a dashboard with a card thumbnail. Same component renders: collection shelf, detail view, public scan page, share images, and historical snapshots (via `design_state`).
5. **Nightly sync job:** Supabase cron/edge function — refresh position state per card from SnapTrade, EOD price from Polygon, detect quantity changes → status transitions + `card_events`.
6. **Milestones engine v1:** computed in the sync job — hold-age milestones (30d/100d/365d/1000d), value milestones recorded as events (+25/+50/+100%) with card visual upgrades (border/badge states). Milestone = permanent event + snapshot, never a push to trade.
7. **Timeline tab:** renders `card_events` (activated, milestones, dividends from SnapTrade activities, snapshots).
8. **Card Snapshots:** auto-capture at issue + each milestone + yearly anniversary: values AND design state (badges/border era) stored as JSON; renderable later exactly as it looked.

Definition of done: 3 real linked accounts minting cards; sync flips a card to SEAL_BROKEN within 24h of a real partial sale; Playwright-verified on the live URL.

> **PHASE 0: BUILT + VERIFIED LOCALLY 2026-07-26** (NOT deployed, NOT committed — preview gate). Migration 178 applied to Club Supabase; RPCs mint_card / report_seal_broken / retire_card / record_card_milestone / public_card_view live; routes under /api/ownership/*; LivingCard + /collection pages done; real MSFT mint E2E-verified in browser (card CC-S01-000007 on QA user cardtest@cheatcode-qa.dev). One integration fix applied (mint payload missing assetType). Pending deploy steps: commit+push, vercel.json cron entry `/api/ownership/cron` 0 8 * * *, CRON_SECRET env, run cron once to light up seeded tiers.

## Phase 1 — Provenance + Transfer ceremony (digital gifting) — ~1 week
Goal: the emotional killer feature — gift a card+position inside the family, correctly.

1. **State machine hardening:** `IN_TRANSFER` lock, revert-on-timeout, all transitions written to `card_events` (append-only, no updates/deletes — enforce with RLS + trigger).
2. **Gift flow v1 (intra-Club, manual rails):** sender initiates → recipient (Club member; kid = parent-supervised profile) accepts → **shares move over brokerage rails** (v1 reality: instructions + confirmation screens around the family's own brokerage gifting/UTMA process; the app verifies completion via SnapTrade position appearing in recipient's connection before re-binding the card). Full automation of ACAT/gift transfers is Model-B territory — do not fake it.
3. **Provenance display:** "Gifted by Dad · Aug 6 2026 · original value $1,420" persists on the card forever.
4. **Share-image generator:** OG-image route producing the social frames ("I'VE OWNED NVIDIA FOR 1,000 DAYS", "MY DAUGHTER'S FIRST STOCK") — no account data, watermarked serial.
5. **Ownership Score v1:** unique cards, weighted hold-age, diversification count, gifting events, learning achievements (bridge to existing XP system — lessons completed feed the score). Displayed on Collection page. Never return-ranked.

> **PHASE 1: BUILT + VERIFIED LOCALLY 2026-07-26** (NOT deployed, NOT committed). Migration 179 applied (card_transfers + initiate/accept/decline/cancel/expire RPCs; kid rule maps to live `role='child'`); gift jsonb render-cache on ownership_cards (event log stays source of truth); transfer/transfers/accept/decline/cancel/score routes live; expire wired into cron. UI: GiftDialog (3-stage honest ceremony), GiftRevealDialog (unwrap), GiftsWaiting strip, heirloom gift line on LivingCard face + in_transfer ribbon/lock, GiftProvenanceBlock, OwnershipScore header, ShareDialog + next/og route (?t=days|gift). Full browser E2E verified: cardtest → cardtest2 real AAPL gift (CC-S01-000009: activated→transfer_out→transfer_in→gifted, self_reported), score header renders, both OG templates generate. Known cosmetics: reveal-dialog card shows "AWAITING PRICE" (summary carries no basis — by design), share-preview img can lag on cold og compile. QA users: cardtest/cardtest2@cheatcode-qa.dev (CardTest!2026x).

> **2026-07-26 STRATEGIC FORK (Kway decision: "bitcoin for now"):** The DIGITAL collection stays multi-asset (stocks/ETFs/BTC — built, ties to the education brand and the "brands you live in" gift moment). The PHYSICAL line goes **Bitcoin-first**. Why: BTC is a commodity, not a security — so pre-loaded physical products are legal via embedded-crypto custodian partners (Zero Hash / BitGo class; KYC at claim), which is impossible for stocks without a broker-dealer. Money-transmission compliance replaces securities compliance and is mostly absorbed by the partner. HARD NO: pure bearer physical bitcoin (the Casascius/FinCEN 2013 trap) — everything stays custodial-claim or self-custody, registry as truth. Form-factor vision: cards first, then JEWELRY (pendants/watches — heirloom positioning); hardware note: NFC dies next to metal → on-metal NTAG 424 DNA constructions or ceramic/glass/resin elements; watches hardest. Volatility discipline: never market "grows over time"; provenance layer + House Rule #1 framing on everything. **Watch-list (revisit triggers for tokenized equities — TSLA-on-chain etc., currently the worst quadrant: securities law + crypto complexity + issuer counterparty risk, geo-blocked for US retail):** (1) US-registered venue (Dinari/Coinbase-class) with SEC-blessed retail tokenized equities, (2) custodial APIs for them (Zero Hash-for-equities), (3) multi-year issuer survival. Registry design is rail-agnostic, so late adoption costs nothing.

## Phase 2 — Physical NFC pilot — BITCOIN-FIRST ("First Bitcoin Card" SKU) — software half buildable now
Goal: one gifting-focused SKU, small run. Bitcoin only. Software half (1-3) is asset-agnostic and local-buildable today; hardware half (4-6) has lead time and owner gates.

1. **Public scan route `/c/[serial]`:** page over the existing `public_card_view` API — value (LIVE, 24/7 — BTC has no market hours), growth-since-issue, series/mint, owned-since, status — never holder account detail. Authed owner tap adds the private layer (basis, history, Kai analysis, transfer controls).
2. **Tap authentication:** NTAG 424 DNA SUN/SDM verification endpoint — per-chip keys, CMAC validation of the tap's one-time code, replay protection. Scan page renders "TAP-VERIFIED" vs "unverified link view" (printed QR fallback). Fully testable locally with simulated SDM payloads before chips exist.
3. **Claim/binding flow:** units ship unbound; first tap claims the serial → binds `nfc_uid` to a digital card (existing or minted-at-claim). Permanent marriage, provenance event.
4. **Custody partner track (owner + legal gate):** evaluate Zero Hash / BitGo-class embedded-crypto custodians for the PRE-LOADED product ("pendant with 100k sats"): brand sells artifact + custodied BTC, recipient KYCs at claim. Until a partner is signed, the sellable version is artifact-only + bind-your-own-BTC (self-reported/verified via future exchange linking).
5. **Hardware:** NTAG 424 DNA stock; cards for the pilot (~250 units, premium matte + foil), on-metal/ceramic constructions researched in parallel for the jewelry line. Packaging: "Always tap before you trade it."
6. **Store:** existing Shopify store, merch checkout, clean separation from any BTC funding flow.

> **PHASE 2 SOFTWARE HALF: BUILT + VERIFIED LOCALLY 2026-07-26** (NOT deployed/committed). Migration 180 applied (nfc_chips P-series, per-chip AES keys wrapped under NFC_MASTER_KEY in .env.local — key is IRRECOVERABLE, must reach prod env before deploy, losing it bricks all chips). Full NXP AN12196 SDM implementation (zero-dep AES-CMAC passing NIST SP 800-38B vectors, session-key derivation, timing-safe, monotonic counter) in src/lib/ownership/sdm.ts; routes tap/[serial] + claim; live 24/7 BTC spot pricing; scripts provision-chips.ts (5 chips CC-P01-000001..5) + simulate-tap.ts (valid/--replay/--tamper). Public scan pages src/app/c/[serial] (+/claim ceremony with inline sign-in, /about, per-serial public opengraph-image); PublicLivingCard SSR-first. BROWSER-VERIFIED on mobile viewport: fresh simulated tap → gold "TAP VERIFIED · GENUINE ARTIFACT" seal + live BTC $321 "LIVE · NEVER CLOSES"; identical URL reopened → demoted to "LINK VIEW · NOT TAP-VERIFIED" (replay floor). Bound: P01-000001→AAPL CC-S01-000009, P01-000002→BTC CC-S01-000010 (cardtest2); P01-000003/4/5 unclaimed for claim-flow testing. Remaining Phase 2 = hardware half: custody-partner track (owner+legal), chip stock + burn (manifest format ready in provision script), pilot run, Shopify SKU.

## Phase 3 — Jewelry line + Genesis + collection meta — only after pilot sells
1. **Jewelry drop:** pendants first (on-metal tag or ceramic inlay), sats-denominated series (e.g., 100k-sat / 1M-sat pieces); watches later (hardest RF form factor). Custodial-claim only.
2. **Genesis Series '27:** sats-denominated numbered editions; edition size set by pilot demand, not 5,000-by-default. (Stock-card Genesis deferred to the tokenized-equities watch-list triggers.)
3. Series completion mechanics, rarity tiers (rarity = design/edition attribute only, never implies returns).
4. Retired/unbound artifact stance: trade as pure collectibles; provenance shows the break; "holder-of-record" registration for artifact owners.
5. **"Sovereign" secure-element tier** (Tangem-class, keys in the metal, true self-custody): premium third tier for crypto-native buyers — highest mystique, highest support burden (lost jewelry = lost coins disclosures), only after custodial line is proven.

---

## Data model (Supabase, new tables only)
```sql
create table ownership_cards (
  id uuid primary key default gen_random_uuid(),
  serial text unique not null,              -- CC-S01-000184 (custody-agnostic)
  owner_id uuid not null references auth.users,
  asset_symbol text not null,
  asset_type text not null check (asset_type in ('stock','etf','crypto')),
  denomination numeric not null,            -- original units, never mutated
  series text not null default 'digital',
  edition int, edition_size int,
  rarity text,
  status text not null default 'active'
    check (status in ('draft','active','in_transfer','seal_broken','retired')),
  -- acquisition (frozen at mint)
  acq_quantity numeric not null,
  acq_avg_price numeric not null,
  acq_original_value numeric not null,
  acq_at timestamptz not null,
  -- bindings
  snaptrade_account_id text,
  brokerage_position_ref text,              -- lot/position identifier where available
  nfc_uid text unique,                      -- null until physical bind (Phase 2)
  activated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table card_events (                   -- append-only provenance
  id bigint generated always as identity primary key,
  card_id uuid not null references ownership_cards,
  kind text not null,                        -- activated|milestone_value|milestone_age|dividend|split|transfer_out|transfer_in|seal_broken|retired|snapshot|gifted
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

create table card_snapshots (
  id bigint generated always as identity primary key,
  card_id uuid not null references ownership_cards,
  label text not null,                       -- issue|year_1|milestone_25|...
  value numeric not null,
  design_state jsonb not null,               -- badges/border era for faithful re-render
  taken_at timestamptz not null default now()
);
```
RLS: owner full read; public scan route reads via a security-definer RPC returning only the public projection; `card_events` insert-only (trigger blocks update/delete).

## Compliance guardrails (standing, every phase)
- Card sales are merch; no card price ever includes or implies securities.
- Recipient KYC/brokerage account required in every transfer flow; minors via custodial (UTMA) with parent flow.
- No performance promises, no return-based leaderboards, no trade-triggered celebrations.
- Public pages expose no account data; holder first-name + last-initial only, optional.
- Copy review pass on every user-facing string in transfer/gift flows (this is where regulators read).

## Open items for Kway
- Legal review budget/timing before Phase 2 (physical + gifting copy) — recommended, not blocking Phases 0-1.
- Card visual direction: extend the Club design register or a distinct "Ownership" sub-brand? (Design lane loads design-taste skills + brand register either way.)
- Pilot SKU pricing and whether First Stock Card bundles into Starter Kit ($349).
- Where this sits vs C6/C7 lanes in priority — plan assumes it starts after challenge-machine work ships.
```
