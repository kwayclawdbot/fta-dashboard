# SOCIAL OBJECTS — object-based social architecture (owner-ratified 2026-07-26)

**Philosophy:** social interaction is object-based, event-driven, collaborative. The social object is a stock, an investing question, a thesis, or a market event — never a random post. Feed+chat+groups produce content; these objects produce content + reputation + market signal + STRUCTURED collective intelligence (structured-at-capture — the same data the Kai Intelligence Layer runs on; see KAI-INTELLIGENCE-LAYER.md). "We're Smarter Together" as product mechanics, not slogan.

**End state:** community is not a destination — it's inside everything (Discover counts, ticker sentiment/debate, watchlist thesis-changes, Learn answer-reveals, simulator comparisons, Kai citing the Club, Home activity graph). Migrate by ADDITIVE replacement: ship objects, let the activity graph absorb the feed's job, rename the tab to "The Club" only when objects carry the weight. Never demolish the shipped community first.

## THE SIX OBJECTS
1. **Ticker Rooms** — every stock has a living social layer on its research page: header (watching count, sentiment %, attention delta) + living timeline of real events (watchlist adds, Kai question spikes, thesis publishes, sentiment moves, debate starts). Timeline = ticker_intel_snapshots provenance + club_events rendered as narrative — the data already exists.
2. **Research Objects (theses)** — persistent investing objects, not posts: ticker, stance, one-line hook, author, time horizon, price-at-publish; sections (thesis/catalysts/risks/valuation) with section-anchored responses; Club response via informational reactions; performance tracking + THESIS UPDATE lifecycle ("+28% since publish — thesis strengthened"). **This IS the paid structured-thesis from MONETIZATION-GATES.md — build ONCE as the social object; it also feeds user_ticker_theses (intel Phase 4 ticker memory).**
3. **Debates** — structured disagreement per ticker/question: bull/bear cases with top voted arguments, three-way stance (BULL/BEAR/UNDECIDED), one-reason capture after voting. Extends the live debates v1 (migration 139). Produces sentiment + arguments + structured data.
4. **Collaborative Research Rooms / Research Missions** — shared research board per ticker: sections (business model/moat/bull/bear/catalysts/risks/valuation) filled by community, best contributions voted up, completion meters ("Valuation — needs contributors"), Kai synthesis on top ("strongest consensus… biggest disagreement…"). Mission variant = CLUB MISSION quests (gamified crowdsourced equity research). First mission = the weekly world event company (FIC-LEARNING-WORLD.md §9 — same object, every register participates at its level).
5. **Live Market Moments** — event rooms for NOW (earnings, big news): live headline facts, structured interaction modules lead (predict / react / what-matters vote / Kai Live), comments beneath; when the event ends the room becomes an ARCHIVED INTELLIGENCE ARTIFACT ("what the Club thought before vs what happened").
6. **Circles** — small investing teams (5–20), NOT chat-first: shared watchlist, current debate, research assignments, portfolio experiment, weekly picks, collective scorecard, circle consensus.

### CIRCLE MECHANICS (owner-ratified 07-26)
- **The existing community chat = the "Main" Circle** — rebrand/reframe, do not rebuild. Everyone belongs to Main.
- **Custom Circles UNLOCK at a member-count threshold** (density gate; threshold configurable — set via config, owner tunes; curated/admin-created circles first).
- **Circle CREATION is a Black Belt privilege** — members must reach Black Belt (existing belt system) to open their own Circle. Belt = earned trust + creation rights; this also makes Black Belt aspirational.
- Kid circles ride the Learning World Phase 8 safety framework (age-matched, structured, moderated), never the adult mechanics.

## CROSS-CUTTING MECHANICS
- **Informational reactions** (replace generic likes on research surfaces): 🧠 Strong point · ✓ I agree · ? Needs evidence · ⚠ Missing risk · ↻ Changed my mind · 🔖 Saved to research. "38 people changed their mind after reading this" is the headline signal.
- **"Changed My Mind" = SIGNATURE FEATURE**: stance-change with reason taxonomy (valuation / thesis broken / new evidence / risk increased / better opportunity), tracked over time; Kai surfaces aggregate mind-changes ("12 high-quality NVDA contributors moved Bull→Neutral this week"). Culture: changing your mind = intelligence. Cheap to build, feeds intel layer directly.
- **Follow ideas, not just people**: subscribable objects = tickers, themes (AI infrastructure, dividend growth), specific theses; person-follow later. Solves the missing follow graph — subscriptions to existing objects.
- **Activity graph Home**: "Your Network Today" items (view-changes by people you follow, adds, circle debates, new theses, disagreement highs) — this matures ClubHome's For You/Pulse, same data spine.
- **Investing-identity profiles**: Research Score, focus areas, contribution ledger (theses/insights/people-helped), THINKING HISTORY (per-ticker stance evolution + performance since first thesis), reputation counts (Strong-point reactions, minds changed, research saves). Status from usefulness, not follower counts.
- **Collaborative predictions**: pre-event structured predictions (ranges/direction) → actual result reveal → % correct → forecaster track records; topic-specific forecasting reputation feeds intel-layer opinion weighting ("Top Semiconductor Analysts: 82% Bull" as a displayable surface). ONE prediction primitive shared with Learning World market-event lessons — never built twice.

## REGISTER POLICY (owner-ratified 07-26)
- **Cheat Code Club (adult register): advice-tolerant.** Price/move predictions, forecaster leaderboards, weighted expert sentiment displays are APPROVED product surfaces. (Marketing rule unchanged: performance/%-worked stats stay in-app, never marketing.)
- **FIC / family / kid registers: strict posture stays.** No price predictions, no forecaster boards, no advice framing for kids/family surfaces; kid social = structured battles/teams/research cards per FIC-LEARNING-WORLD Phase 8. Kid walls per existing viewer_is_kid() patterns.
- Kai guardrail profiles continue to govern Kai's own voice per register (kid-strict / family-adult-edu / club-actionable) — unchanged.

## PHASING (density-honest)
- **S1 (works at any N — pre/during challenge):** informational reactions + Changed My Mind + Research Object v1 (= the gates lane's structured thesis, built once) + per-ticker debate extension. Main Circle rebrand.
- **S2 (challenge cohort arrives):** predictions primitive (shared w/ Learning World) + Research Missions (first = weekly world event) + activity-graph items on Home.
- **S3:** Ticker Room living timelines (snapshot provenance narrative) + investing-identity profiles + follow-ideas subscriptions.
- **S4 (post-density):** custom Circles (unlock threshold) + Black-Belt circle creation + Live Market Moments + forecaster reputation weighting.
- **DEPENDENCY:** the monetization-gates lane consumes THIS spec for structured-thesis publishing (Research Object v1) — gates and S1 coordinate so the thesis object is built once.

## GUARDRAILS
- Scale floors everywhere (no "3 members voted" embarrassments — same floor discipline as ClubHome/intel layer).
- Voting quality: basic anti-brigading on best-answer voting before Missions scale.
- Moderation applies to structured free-text (thesis bodies, arguments, reasons).
- Additive builds only; the shipped community (D1 two-lane, 4 tabs) keeps working throughout the migration.
