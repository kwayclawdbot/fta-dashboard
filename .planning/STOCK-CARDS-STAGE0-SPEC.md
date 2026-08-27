# Collectible Stock Cards — Stage 0 Product Spec
2026-08-10. Settled with Kway. Companion docs: GIFT-CARDS-RESEARCH-2026-08-10.md, OWNERSHIP-CARDS-BUILD-PLAN.md. Supersedes nothing — this is the zero-capital launch layer under the existing ownership-cards stack.

## Settled model (Kway-approved 2026-08-10)

**"The buyer keeps the shares in their own investing app. The card is what makes it the kid's."**
- Universal flow, no recipient routing: buy kit ($39-class) → checkout tells buyer to purchase the stock in ANY app they already use (Cash App / Robinhood / Fidelity / anywhere) → buyer enters the fill (ticker, qty, price, date) + recipient name → card mints with that FROZEN SNAPSHOT → physical NFC card ships → recipient taps to see live experience.
- Shares stay in buyer's own account. Card = certificate + registry entry + learning experience. Legally buyer's shares "held for" recipient — honest provenance line ("Held by Mom for Maya"). No custody, no partners, no licenses, no float.
- Works for kids any age, spouses, grandkids — recipient-agnostic by design.
- Verification tiers unchanged: self-reported at mint; SnapTrade upgrade later where the buyer's brokerage supports it (Cash App never will — stays self-reported).
- Stage 2 (Alpaca) later collapses this into one-tap in-app custody incl. UGMA; Stage 0 is the demand test.

## KEY PRIORITY (Kway directive): the NFC tap experience must be visually rich and engaging — that is the product. Plastic is the key; the scan page is the toy.

## Card anatomy — three layers

1. **Frozen layer (printed on card + immutable in registry):** company + logo, recipient name, "Owned since [date]", price at purchase, mint number ("2026 Series · No. 214"). Uniqueness mechanic: market timestamps every card — no two are alike. Teaches "when you buy matters."
2. **Live layer (the tap):** live price vs frozen price, gain/loss since THEIR date, chart-since-mint, days-owned counter, hold-age milestones. HOLD-BASED ONLY, never return-ranked (locked decision — a down stock is "you held through your first dip" badge, not a loss screen). Gains shown as fact, never "winning" — education/advice line.
3. **Learning layer (per-company evergreen page):** concept-first (plain what-it-does + how-it-makes-money mechanics BEFORE any story/metaphor, per standing teaching rule), "what it owns" reveals (Disney→Marvel/ESPN), founder story, scale facts. Written once per company, every card of that company links to it forever.

## Scan-page IA (mobile-first — it IS a phone-tap page)
Tap → card reveal (the Living Card materializes, name + since-date) → the number that matters ("Your Disney is worth $61.20 — up $11.20 since your day") → chart since mint → days-owned + next milestone → "What you own" learning layer → collection shelf teaser ("Maya's 3rd card") → parent CTA (quiet, bottom: add another card / FIC).
- NO login, NO data collection on the kid-facing page (public-by-serial like /c/[serial]; kid never a door; COPPA-trivial).
- Tap-auth (NTAG 424 SDM) = TAP VERIFIED seal vs shared-link view, already built.

## Design register
- Family warm-gold premium, NEVER soft-childish (kid experience derived from adult style); no purple; ticker ALWAYS with logo; typography/objects-with-identity, no generic rounded-card grid slop; no emojis in UI. Load design-taste skill packs in any design lane.

## Starter set (launch series, 10–12 kid-legible companies)
Disney, Nike, McDonald's, Apple, Roblox, Netflix, Coca-Cola, Amazon, Google, Spotify, Mattel/Lego-adjacent, Tesla. Final list = owner call (licensing note: logos on COLLECTIBLE CARDS SOLD AS MERCH is a trademark question for legal review — nominative use likely defensible for the scan page; the printed card is the riskier surface. Add to legal-review list.)

## Build delta vs already-built stack
Already built (Phases 0–2 local): LivingCard, /collection, mint APIs, gift ceremony, provenance, share images, snapshots, NTAG SDM tap-auth, /c/[serial] scan pages.
NEW for Stage 0: (a) mint flow captures + freezes market snapshot at fill (small — snapshot infra exists), (b) buyer fill-entry flow w/ recipient dedication, (c) rich scan-page experience v2 (THE build), (d) company learning pages (content + template), (e) Shopify kit SKU + card print pipeline, (f) deploy the existing local stack (commit, cron, CRON_SECRET, NFC_MASTER_KEY to prod).

## Content machine (three native formats)
Mint ceremony reveal (parent films) · tap check-in ("day 47 of Maya owning Nike") · collection shelf. Company learning pages double as reel source material via existing pipelines.

## Owner-pending
Starter-set final list · kit pricing · logo/trademark legal question · design mockup review (preview gate) · deploy approval for existing local phases.
