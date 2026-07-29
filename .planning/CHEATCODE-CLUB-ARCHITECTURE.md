# CHEAT CODE CLUB — Umbrella Architecture (owner-approved 2026-07-24)

Owner decision (07-24, after strategy review): adopt the network architecture. ONE app, one membership umbrella.
- **Cheat Code Club** = the umbrella membership/community. Sold at **cheatcode.com** (owner controls; currently Bluehost, 403 parked — needs pointing at new marketing site).
- **Family Investing Club** = Family Mode within the Club — the family door. Sold at **familyinvestingclub.com** (owner wrote "fic.com" — interpreted as familyinvestingclub.com since fic.com resolves to a third party; FLAGGED for confirmation).
- **Cheat Code AI / Kai** = the embedded intelligence layer (never a separate SKU). The legacy Kai SMS product folds INTO the Club (subscriber migration = separate coordinated phase).
- **FTA** = advanced trading academy, premium add-on tier (existing gold hub).
- Schools B2B line stays FIC-branded (never "Cheat Code" — institutional trust).

## Kai guardrail tiers (owner directive)
Three persona guardrail profiles, config-driven (src/lib/kai/persona.ts):
1. **kid** (FIC family kids): current strict register — educational only, simple language, no levels/setups, heavy guardrails. UNCHANGED.
2. **family-adult** (users in Family Mode): current education-first adult register — analysis, research, no trade-idea framing. Essentially current adult behavior.
3. **club** (individual Club members, Family Mode off): FEWER guardrails, MORE ACTIONABLE — concrete technical read-outs, key levels, setup structure, screener-driven candidates, "what changed today" briefings, direct market opinions. COMPLIANCE FLOOR (never crosses, any profile): no personalized financial advice ("you should buy X for your account"), no performance promises, disclaimers retained, never "SuperTrend". The delta is depth/directness/actionability, not advice.
- Profile selection: role/age → kid; family-mode adult → family-adult; solo/individual → club. Family-mode adults MAY get a settings toggle to opt into club-level depth (owner default: auto by mode; kids NEVER escalate).

## Tier / membership mapping
- DB stays: enrollments program free|fic|fta (avoid destructive renames). DISPLAY layer re-maps: fic → "Cheat Code Club" membership (family door label: "Family Investing Club"); fta → "Club + FTA".
- Stripe: Cheat Code Club $99/mo product (reuse/rename existing FIC $99 or new product w/ same price — builder judgment, no double-billing risk), FTA add-on/upgrade path preserved. Both marketing doors checkout into the SAME membership.
- Free tier = "Cheat Code Free": community read + trending + limited watchlist + limited AI (current teaser posture already matches).

## Lanes
- **C1 — Membership + mode plumbing** (app): display-layer tier relabel (mode-aware: club door shows Club branding, Family Mode shows FIC branding), Family Mode activation surface for solo members ("Add your family" → converts solo→family framing, invites), mode-aware TopBar/nav wordmarks, tier badges (Club chip vs FIC chip vs FTA gold), upgrade page restructure (Free→Club $99→+FTA). Uses 13A isSolo as the mode switch foundation.
- **C2 — Kai guardrail profiles** (parallel-safe w/ C1): the 3-profile system above; club profile prompt authoring (actionable register modeled on the Kai SMS alert voice — levels, R:R framing, honest win-rate culture); profile injection via existing kai_personalization; verify kid isolation hard (kids can never receive club profile even via family settings).
- **C3 — cheatcode.com marketing site**: world-class-web build selling Cheat Code Club ($99, community+AI+research+live sessions+family included), 5-Day Investing Challenge funnel (30-day Club pass, "just me / my family" fork per strategy doc), Kai as the hero intelligence. BLOCKED on owner: point cheatcode.com DNS at Vercel (Bluehost currently).
- **C4 — In-app umbrella rebrand**: shell wordmark "Cheat Code Club" (Family Mode surfaces keep FIC identity), voice-bridge copy pass ("the cheat code is starting early / investing together"), PWA titles, email templates door-aware (drip variants align: solo=Club voice, parent=FIC voice — 13B variants already split on exactly this line).
- **C5 — Kai SMS fold-in** (breakout-alert-system + Stripe, coordinate w/ salvage plan): migration offer to remaining Kai SMS payers → founding Club members; tradewithk.ai messaging; SEPARATE lane, owner-gated (touches live paying customers).
- Sequencing: C1+C2 parallel now → C4 → C3 when DNS ready → C5 owner-gated.

## Owner decisions RESOLVED 2026-07-24
1. ✅ fic.com = familyinvestingclub.com confirmed.
2. cheatcode.com DNS connected LATER by owner — build site first on Vercel URL.
3. ✅ Club $99 = everything-but-FTA ratified.
4. ✅ CHALLENGE: starts **Sept 1**; 30-day marketing runway (August). Challenge signups get IMMEDIATE full $99-tier access until challenge END; then pay $99/mo or downgrade to free. Primary challenge offer: **FTA at $1,500 = FTA + 1 YEAR of Club/FIC access** (new Stripe product needed).
5. ✅ C5 Kai-SMS migration (owner 07-24): same $99 → converts to FULL Club membership (no price change, "your membership just got 10x bigger"); SMS continues during a transition window then app/push-first. Execute AFTER C6+C7 (needs alerts hub live + working Twilio for comms).

## Post-C7 decisions (owner 07-24 eve)
- YEAR-1 FTA CLOCK IS REAL: $1,500 fta_challenge = FTA academy LIFETIME + Club 12 months (club_until stamped by webhook, mig 127 lane); after lapse: FTA hub preserved, Club surfaces gate to free until $99 fic enrollment; LEGACY fta (=$2,997/admin) stays unlimited (club_until null). D-14/D-3 warnings.
- NO 7-day free trial — offers are exactly: Free tier / Club $99 / FTA upsell. (Mock's trial band overridden.)

## LANE C8 — DEDICATED CHALLENGE FUNNEL (owner directive 07-24: "highest converting format, use the hormozi skills")
Launches AFTER site v5 lands (same repo /challenge becomes the funnel entry). Components:
1. FUNNEL PAGES (cheatcode-club-site): /challenge rebuilt as a true Hormozi-format funnel page — grand-slam-offer structure: hook headline + subhead (dream outcome), VALUE STACK w/ price anchoring (5 days of: full Club access ($99 value), daily challenge curriculum, Kai AI analyst, community, alerts hub, live energy — stacked "total value" vs FREE), value equation framing (outcome up, time/effort/risk down), risk reversal (no card, nothing to cancel), urgency/scarcity (Sept 1 cohort, honest — no fake counters), objection-handling FAQ, multi-CTA placement, honest social proof only. Use generate-sales-script skill (4E method) for the copy backbone; keep compliance floor (education-not-advice, no income/return promises — Hormozi format WITHOUT the guru income claims).
2. REGISTRATION MICRO-FUNNEL: multi-step commitment flow (app side /free-class?challenge=1 already exists w/ funnel-v2 patterns: step pages, partial capture, exit intent, UTM tracking) — verify challenge variant carries these; add challenge-specific steps if thin. Thank-you page = SHARE/refer loop (referral system exists) + calendar add + what-happens-next.
3. EMAIL NURTURE MACHINE (app repo, drip/campaign infra): (a) registration welcome + expectations; (b) August warm-up sequence (weekly value emails, community pull-in — registrants already HAVE full access: drive activation NOW, activated users convert); (c) show-up sequence D-3/D-1/day-of; (d) DAILY challenge emails Sept 1-5 (each day's mission); (e) post-challenge close sequence (3 emails: $99 continue w/ what-they-built framing, $1500 FTA pitch, last-call) — coordinates w/ C7 expiry warnings (dedupe: expiry cron already sends D-3/D-1 — the close sequence REPLACES/absorbs those for challenge cohort, don't double-email).
4. AD BRIEFS (deliverable, not spend): write-ad skill (2026 viral frameworks) → 10-hook Meta brief + creative directions for the August push; meta-campaign skill optional after owner reviews.
SMS nurture: blocked on Twilio token (note).

## Challenge decisions FINAL (owner 07-24)
- NO card at signup — card only when continuing at $99 after challenge (matches published "never auto-charge a surprise").
- $1,500 offer = FTA LIFETIME access + 12 months Club bundled; Club renews $99/mo after the year.
- C6 = HYBRID confirmed: daily Kai Morning Briefing for all club members + personalized watchlist/strategy alert engine on top (respec per the personalized-alerts audit: strategy profile builder, contextual "Set alert" on screener/watchlist/research surfaces w/ smart prefills incl. preset-diff alerts and key-level prefills, per-user caps + instant-vs-digest + quiet hours, delayed-data labeling; club default-on, family-adult opt-in, kids never).

## LANE C6 — TRADE ALERTS HUB (owner directive 07-24: "features specifically for cheat code ai users")
Daily Kai trade alerts become an in-app product surface for club-profile users:
- Bridge: breakout-alert-system (Railway morning/intraday alerts) POSTs each broadcast to a secret-guarded app API → trade_alerts table (ticker, direction, setup label, entry/levels/targets, narrative, chart url, issued_at).
- Delivery: push notification (existing 028 pipe) to club-tier members opted in (alerts pref default ON for club/individual, OPT-IN for family-mode adults, NEVER kids); alerts ALSO appear in-app.
- Alerts hub page (/alerts): feed of alerts w/ live performance since issue (reuse snapshot/tracker patterns — price at alert vs now, peak), filters (open/closed/direction), links to /research/[ticker]; honest performance culture (peak-is-the-win rule from Kai memory; no win-rate inflation).
- Custom alerts v1: user sets ticker + price-cross condition → checked by cron against delayed quotes → push when triggered; manage list in hub; caps per user (e.g. 20 active).
- Compliance: alerts framed as analysis/education (same floor as club Kai profile); disclaimers on hub.
Sequence: after C1/C2 land (app repo). Then C7.

## LANE C7 — CHALLENGE MECHANICS (app-side)
- challenge signup path (?challenge param + dedicated landing in-app): creates account w/ full club access, enrollment kind challenge_pass w/ expires_at = challenge end; expiry cron downgrades to free (graceful: warning emails D-3/D-1 via drip infra, in-app banner).
- Stripe: new product FTA-$1500 (FTA + 1yr club bundled); post-challenge $99 continue flow.
- Admin: challenge cohort dashboard (signups, activation, conversion).
Sequence: after C6; must be live before Aug marketing start (~Aug 1).
