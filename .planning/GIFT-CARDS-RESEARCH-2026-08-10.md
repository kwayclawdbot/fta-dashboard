# Gift Cards Research — Stock & BTC Claim Cards + Bearer Cold-Wallet Cards
Research date: 2026-08-10 (3 parallel web-research passes). Context: FIC/Cheat Code physical card product — Stockpile-style purchasable cards recipients claim for shares/crypto, plus the bearer cold-wallet variant. Companion to OWNERSHIP-CARDS-BUILD-PLAN.md.

## HEADLINE FINDINGS

1. **Stockpile SHUT DOWN April 17, 2026.** Homepage is now a gift-card refund request form. Accounts migrated to Public/Stash/Apex. The US dollar-denominated stock gift card category is VACANT. EarlyBird (family gifting) was absorbed into Acorns 2025. Only visible successor is Endowe (cash registry via RIA — no cards). A family brand shipping a Stockpile-style card would have the category to itself, 4 months before holiday season.
2. **No patent blocks the mechanic.** Stockpile's gift-certificate-of-stock patent family (apps 20170228824 / 20200202441 / 20220215472) appears abandoned, never granted. Cheap patent-counsel confirmation recommended. (Adjacent: Bumped's stock-REWARDS patents now owned by Apex — cover spend-based loyalty rewards, not gift cards.)
3. **Alpaca is the #1 stock-lane partner.** UGMA (50 states) + UTMA (all but SC/VT) custodial accounts launched for Broker API partners May 11, 2026; Journals API (JNLC cash / JNLS shares, firm→user) + Rewards Account structure is documented for exactly this plumbing; startup-accessible posture; raised $135M July 2026. Constraint: journals are firm↔user only — gift buyer's money lands in our firm account at Alpaca, claim journals it to recipient's new account.
4. **Crypto lane: Fold's Bitcoin Gift Card (May 2025) is the structural template** — USD closed-loop card at purchase (Totus program manager, Blackhawk distribution, Kroger/Giftcards.com), BTC bought only at claim after KYC'd Fold account (18+), BitGo cold storage $250M insurance. Fold has an affiliate program (Nov 2025) + corporate bulk. Co-brand on Fold rails = fastest claim-code path; tradeoff: claimants become Fold customers.
5. **Cold-wallet bearer card is legal and white-labelable — SOLD EMPTY ONLY.** FinCEN line (FIN-2019-G001; Casascius 2013 precedent; kiosk notice FIN-2025-NTC1 shows active enforcement): empty hardware buyer funds = ordinary goods sale; preloaded (or load-as-a-service) = money transmission (MSB + ~50 state MTLs). Everyone in market (Coinkite, Ballet, Tangem, Burner) ships empty, giver funds.

## STOCK LANE (claim-code card)

- **Alpaca** (#1): rewards/gifting journals documented; UGMA/UTMA 3 months old; bespoke pricing; non-BD platforms accepted partner category. Ask: third-party-funded gifts vs platform-funded rewards; "$50 of Disney" SKU approval; grandparent-buys/parent-claims minor flow; minimums; unclaimed-balance handling.
- **DriveWealth** (#2): mature UTMA + teen accounts (UGMA not offered), 100+ partners, enterprise-leaning ($1k/mo minimum seen in 2019 doc, likely far higher now), no gifting primitive.
- **Apex Fintech** (#3): patented Stock Rewards API (ex-Bumped), custodial heritage (EarlyBird, got Stockpile's kids accounts); enterprise-only, loyalty-framed.
- **Atomic Invest**: no UTMA/UGMA or gifting found — weakest fit. **Embed**: dead (FTX). **GiveAShare**: alive, transfer-agent/DRS model ($39 fee + framing, 3–7 wk), no API; legal basis = Stock Art 1993 no-action (framed keepsake, ≥2x share value, marketed as gift not investment; OneShare lost comfort in 2002 when it slid toward investing). Affiliate keepsake option only.

### Compliance crux (stock)
- Stockpile's decade-long structure: non-BD prepaid issuer (Stockpile Gifts) + affiliated BD (Stockpile Investments); unredeemed card = prepaid balance, not a security; securities activity only at redemption. No SEC no-action letter findable — "market practice that survived," not blessed precedent.
- **Who holds money between purchase and claim is THE question.** ABA July 2026 analysis: closed-loop prepaid exemption protects the instrument, not the operator; holding gift funds pending redemption = textbook money transmission unless agent-of-the-payee doctrine applies (instant extinguishment, funds only to principal). Florida lacks both exemptions = binding constraint.
- De-risked design to validate with counsel: **BD partner is seller-of-record; buyer funds settle same-day to firm account at the BD; brand never touches funds; claim = KYC'd account opening (UGMA/UTMA for kids) + JNLC/JNLS + fractional buy; unclaimed gifts revert to buyer after stated window** (refund-by-default beats escheatment).
- Marketing guardrail: non-BD brand must not recommend securities or take transaction-based comp; recipient-can-swap-stock framing (Stockpile pattern) helps avoid "recommendation."
- Reg E §1005.20 (CARD Act: 5-yr expiry floor) applicability to stock-redeemable cards = open question; state unclaimed-property law clearly applies.

## CRYPTO LANE (claim-code card)

- **Zero Hash** (#1 infra): MSB + MT in 51 US jurisdictions + NY BitLicense; powers OnePay/Walmart, DraftKings, tastytrade, IBKR; consumer-account model exactly matches (user account with ZH "through agreement with" platform; brand never touches funds). Spreads 100–400bps + negotiated commissions; minimums NDA-gated, enterprise-leaning. ⚠️ Mastercard acquisition (~$2B) in flight late 2025 — status unconfirmed. No documented gifting client — claim-code support is a sales question.
- **Fold partnership** (#2, fastest): exact product live at retail; explore co-branded card on their rails (or Totus/Blackhawk direct with a different redemption partner).
- **Coinbase CaaS** (#3): full custodial stack (took Webull from Bakkt); high minimums likely. CDP Embedded Wallets + ≤$500 light-KYC onramp = low-barrier self-custodial fallback architecture.
- **BitGo**: custody leg (already under Fold's card); unclear MT wrapper for small brands. **Cybrid/MoonPay/Transak**: ramps, not gift programs. **Dead/not viable**: Bakkt (exited consumer, surrendered BitLicense), Fortress Trust, BitCard. **Gate US**: launched KYC crypto gift cards Apr 2026 (35 MTLs) — competitor, no white-label.
- **No purpose-built crypto-gifting API exists** — niche confirmed empty.
- Escheatment: RUUPA includes virtual currency; IL/DE force liquidation of abandoned crypto → keep unclaimed value in USD until claim (Fold pattern).

## BEARER COLD-WALLET CARD (evolution of paper wallets)

- **Legal**: sell EMPTY, buyer/giver funds = hardware sale, no MSB. NEVER preloaded. Even free pre-funded promo cards (challenge prizes) = unresolved gray zone — counsel before ever loading a card ourselves.
- **Coinkite SATSCARD** = the product already: $7–15 NFC card, 10 bearer slots, keys generated on-card (verifiable entropy, open protocol), tap-to-verify sealed state. **White-label confirmed**: "your own card branding" via sales@coinkite.com, ~12-week lead; precedent collabs (HRF, Bitcoin Standard, Nunchuk, bars, conferences). MOQ/pricing quote-only. BTC-only.
- **Tangem co-branding**: formal program (support@tangem.com), 4–8 weeks, precedent runs 1,000–5,000 units (Shiba/Kaspa/TRON); EAL6+ Samsung SE, audited; but it's a personal wallet w/ backup cards, not a hand-someone-value bearer object. Multi-asset option.
- **Burner (burner.pro)**: closest gift-card aesthetic (NFC SE bearer card, ships empty, giver loads); no public white-label — outreach needed.
- **Ballet model (print BIP38 keys ourselves)**: REJECTED — we'd be the key factory; Ballet survives on track record we don't have.
- **⚠️ TECHNICAL: NTAG 424 DNA CANNOT be a wallet** — AES-symmetric auth chip, no ECC/keygen/signing. True wallet card = smartcard-class SE (Satscard platform, Tangem/Samsung S3D350A, Infineon SECORA + Keycard applet = 6-figure ground-up, not worth it). Our Phase 2 NTAG stack stays as authenticity/registry layer; bearer card is a separate SKU on someone else's platform.
- UX truth: lost card = lost funds, funding friction on the giver, no registry visibility. Premium/sovereignty product, not the mass gift.

## RECOMMENDED PORTFOLIO & SEQUENCE

1. **NOW — Coinkite quote (sales@coinkite.com)**: branded SATSCARD run. 12-week lead means order ~Sept to land for holiday season. Pure Shopify merch, zero regulatory weight, ships first. Registry tie-in: NTAG-authenticated packaging/scan page around the Satscard.
2. **NOW — Alpaca sales call**: stock gift card is the strategic prize (category vacant, FIC's exact audience, UGMA/UTMA fresh). Target: holiday 2026 "$50 of Disney for Maya" SKU. This flips the July plan's "equities later" — Stockpile's death changed the calculus (tokenized-equity rejection unchanged; this is real fractional shares at a real BD).
3. **PARALLEL — Fold BD email**: cheap to explore co-brand; validates claim-code demand.
4. **LATER — Zero Hash**: only when volume justifies owning the crypto pipe.
5. Legal review (already owner-pending) now covers: agent-of-the-payee vs BD-as-seller structure, Florida MT, Reg E applicability, escheat domicile, patent clearance ($500 check on app 20170228824), pre-funded promo cards question.

## ALPACA COST RESEARCH (2026-08-10 follow-up pass)

Pricing is bespoke/NDA — no leaked numbers exist anywhere. Confirmed public facts:
- **Sandbox: free, self-serve, instant** — comes with $50k test firm account.
- Alpaca's public posture: "no recurring platform costs, no clearing fee, no per-account fee — just a simple setup cost and a clearing deposit" (amounts undisclosed). Sacra reports enterprise clients pay annual API fees — conflicting signal, must ask.
- **Market data tiers (published):** Standard = $0 (real-time IEX / 15-min SIP, 1k RPM — sufficient for launch); StandardPlus $500–$2,000/mo as volume grows; options add-on $1,000/mo (skip).
- **Fee schedule (published, rev 2026-07-20):** ACH free both ways ($25 returns), $0 commission (partner may charge 0–3% — OUR monetization lever), reg fees pass to end accounts. No custodial UGMA/UTMA surcharge published.
- **Partner model for non-BD: Fully-Disclosed correspondent** — Alpaca Securities is broker of record, runs KYC (Onfido/Trulioo integrated); we never register as BD. Omnibus/RIA paths not applicable.
- **Planning brackets (ESTIMATES):** one-time ~$25k–$100k total (setup fee est. $5–25k + clearing deposit est. $10–50k likely refundable + fintech-counsel legal est. $10–30k + gift-card float); monthly to Alpaca ~$0–$1.5k at launch, ~$500–$2k at 5k accounts. Wild card: possible annual API fee (est. $10–50k/yr, low confidence).
- **Timeline:** sandbox → limited beta → compliance review "usually within a week"; realistic 1–3 months signed-agreement→first funded production account.
- **Diligence flags:** they vet the advice line hard — education brand fine, in-app stock recommendations = RIA territory (concept-first framing helps); marketing review expected; E&O requirement unknown (ask).
- Negotiation leverage: vacant category post-Stockpile + their custodial product is 3 months old and needs launch partners → ask for waived/ramped minimums.
- 12 exact sales questions compiled in the agent report (setup fee, deposit amount/refundability, annual fee existence, KYC pass-through, custodial surcharges, unclaimed-value/escheat split, PFOF/sweep rev share, SIP display licensing, non-BD diligence reqs, go-live gates, ACH fraud reserves, exit/deconversion terms).
- Demo prototype: `~/projects/alpaca-gift-prototype` (mock-mode + sandbox-ready).

Full agent reports (with all source URLs) archived in session task outputs 2026-08-10; key sources: fincen.gov FIN-2019-G001 + FIN-2025-NTC1, store.coinkite.com/store/category/satscard, tangem.com/en/co-branding, alpaca.markets/blog custodial launch, docs.alpaca.markets funding-via-journals, foldapp support Bitcoin-Gift-Card-FAQ, doctorofcredit.com Stockpile closure, businesslawtoday.org July 2026 gift-card MT analysis.
