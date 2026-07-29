# MONETIZATION GATES — free/paid architecture (owner-ratified 2026-07-26)

**Philosophy (internal decision rule for every future gate): The crowd is free. The edge is paid.**
Free users participate in and strengthen the network (they ARE the data engine). Paid members buy the intelligence extracted from it: interpretation, personalization, monitoring, action. Free = "here's what everyone is saying." Paid = "here's what matters, why it's changing, how it relates to YOUR stocks, and Kai monitors it for you."
The paid tier IS the Kai Intelligence Layer (see KAI-INTELLIGENCE-LAYER.md): Club Score drivers/history = provenance endpoint; "why is this trending" = snapshots + Kai reasoning; Kai Watch / For You / "what changed" = signal pipeline + Context API. Monetization and moat are the same roadmap.

## TIERS (final — brutally simple, no new plans ever)
- **Cheat Code Free** — $0. "Participate in the network." (Named tier, never "Basic". A permanent free tier is NOT a trial; the no-free-trial rule stands — challenge pass remains the ONLY temporary-premium mechanism.)
- **Cheat Code Club** — $99/mo. "Unlock the intelligence." Entire household included (no per-kid pricing, ever).
- **FTA** — separate advanced upgrade (unchanged; challenge $1,500 = FTA lifetime + 12mo Club unchanged).

## FEATURE MATRIX (binding)
| Surface | Cheat Code Free | Cheat Code Club $99 |
|---|---|---|
| Community feed | Full read | Full |
| React / comment / post | ✅ | ✅ |
| Polls / debates / sentiment votes | ✅ (contributes to the data engine) | ✅ |
| Follow members | ROADMAP — no follow graph exists yet; do NOT print on pricing page until built | same |
| Trending in the Club | Top 5 | Full rankings + history |
| Club Score | Current score only | Drivers + history + score alerts (= provenance/"why?" endpoint) |
| Community sentiment | Basic current split | Detailed trends + 24h/7d change |
| Research reads | 3 premium pieces/week (metered, then contextual wall); normal discussion always free | Unlimited |
| Publish research | Basic ticker post (stance + text) | Structured thesis (catalysts/risks/valuation/time horizon) + thesis tracking/updates/performance — **build to SOCIAL-OBJECTS.md Research Object v1 spec (one build serves paid publishing + social object + intel ticker memory)** |
| Watchlist | 5 tickers (preserve-don't-delete above cap) | Unlimited + Intelligent Watchlist (Kai Watch, custom alerts, community deltas, news summaries, sentiment shifts, briefings) |
| Kai chat | 3–5 questions/day (hard meter; quota plumbing exists incl. refund-on-fail) | Much higher limits |
| Kai deep stock research | Basic | Full |
| Kai Watch / custom AI alerts | ❌ (contextual wall; optionally 1 demo ticker later) | ✅ |
| For You / personalized Home | Basic | Deep personalization |
| Kai Brief / "what changed since I left" | ❌ | ✅ (flagship retention feature) |
| Screener / Stock Finder | Basic filters | Full screener + AI search |
| News | General | Personalized to watchlist/holdings |
| Simulator | Basic $10K portfolio (fun + sticky) | Advanced stats, unlimited portfolios, challenges, family portfolios, thesis connection |
| Learning | Starter lessons + challenge content | Full library + live classes + recordings (supporting value — don't lead marketing with lesson counts) |
| Live Club sessions | Preview/replay clips at most | Live + archive |
| Weekly Club research/picks | Preview/delayed | Full (% -worked stats stay IN-APP ONLY, never marketing) |
| Family Mode | **Structure free, activation paid**: free families CAN create family + kid subprofiles (kid-strict Kai floor applies, FIC-door experience stays warm) but family watchlist, progress/report cards, family challenges LOCKED w/ contextual wall | Fully included (spouse + kids + family watchlist + progress + age-adjusted Kai) |
| FTA section | ❌ | Separate upgrade (unchanged) |

## CHALLENGE PASS = TEMPORARY CLUB (presentation layer on existing mechanic)
challenge_pass already grants full Club until Sept 6. ADD: every premium surface shows **"Included with your Challenge Pass · N days remaining"** instead of a paywall — loss aversion ("you have this, you're going to lose it") beats upgrade framing. Countdown component reads pass expiry; N computed server-side.

## DOWNGRADE = PRESERVE, NEVER DELETE (binding, applies to every gate)
On pass expiry or cancellation: lock functionality, keep ALL data. Watchlist: "26 stocks saved · Your free plan actively monitors 5 · Upgrade to reactivate Kai Watch for all 26." Same for Kai alerts (paused, not deleted), research saves, family profiles (visible, features locked), simulator positions. Their data is the reason to return. **The downgrade screens ARE the Sept 6–8 conversion moment — highest-leverage UI in the funnel; design them to the impeccable bar.**

## PAYWALL UX (binding — never generic "Upgrade to Pro")
Every gate gets specific contextual copy naming exactly what's missing. Canonical copy:
- **Kai Watch:** "Let Kai watch this for you — Club members ask Kai to monitor stocks 24/7 and get alerted when something important changes. Unlock Kai Watch — $99/mo"
- **Family:** "Bring your family into the Club — add your kids and spouse, create family watchlists and track everyone's progress, included with your membership. Unlock Family Mode"
- **Club Intelligence:** "See why {TICKER} is moving up the Club — unlock attention history, sentiment changes and the signals driving today's score. Unlock Club Intelligence"
- **Research meter:** "You've used your weekly research passes. Upgrade to unlock unlimited Club Research." (only after 3 free premium reads; never walls normal discussion)
Compliance framing rides along everywhere: attention/intelligence, never advice.

## IMPLEMENTATION SHAPE
1. **Central entitlements**: single server-side `can(user, feature)` module (extends existing tier/challenge_pass/register derivation — one source of truth; UI + API routes + RLS all consult it; kid walls compose with it, they don't merge).
2. **Gate primitives**: <Gated feature=…> wrapper rendering content / contextual wall / pass-countdown ribbon by entitlement state; server enforcement on every gated API (never UI-only — screener lesson).
3. **Meters**: research reads (3/wk) + Kai questions (daily) on existing quota plumbing w/ refund-on-fail pattern.
4. **Preserve semantics**: caps enforce "active N" not "max N rows" — flags/ordering pick the active subset; nothing deleted on downgrade; downgrade screens per above.
5. **Pricing page**: Cheat Code Free / Cheat Code Club / FTA, matrix-driven; free column copy = participation verbs, paid = intelligence verbs. No follow-graph row until built.

## SEQUENCING
- Builds AFTER ClubHome v2 lanes land (gates wrap the new surfaces; data lane's floorMet/tier shapes feed <Gated>).
- HARD DEADLINE: entitlements + walls + pass-countdown live before August challenge marketing (pricing page must match reality); downgrade UX complete well before Sept 6 pass expiry.
- Kai Watch demo-ticker for free = optional later; ship ❌ first.
