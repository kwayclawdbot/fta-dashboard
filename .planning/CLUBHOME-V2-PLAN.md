# CLUBHOME V2 — "The Collective" (owner-ratified 2026-07-26)

Owner decision: implement the Home Dashboard brief NOW. Concept = live collective intelligence network ("What is the Club seeing right now?"). UI/UX must be impeccable. Prod stays safe: UI ships on a PREVIEW branch, promote only after owner review.

## RATIFIED DECISIONS (binding)
1. **NO Family purple.** Brief's #7C3AED is rejected; Family Mode keeps its ratified warm-gold identity. Family Mode is untouched by this lane entirely.
2. **NO "gm, Alex 👋" vernacular.** Premium time-aware greeting instead: "Good morning, Alex" / "Good evening, Alex". No emoji in the greeting. No crypto-Twitter language anywhere.
3. **SUPERSEDED 07-26 (owner, after 2 editorial rounds): mock = FULL spec, build faithfully.** Owner rejected both the editorial rendering ("too muted") and the vibrancy pass ("don't like it") → reproduce the mock (~/Downloads/C676844B-2559-4218-B53F-6A2DC9091F1F.PNG) pixel-faithfully — its layout, containers, density, color treatment, typography energy — "and see how that fits." The mock's contained components count as owner-approved functional data objects (the standing no-generic-cards rule's in-app nuance). Kept regardless: scale-aware founding states, kid walls, no purple, live wiring, Build the Club section (owner-ratified, not in mock — style it mock-consistent), existing global 5-item nav (mock's expanded sidebar deferred — global nav change is its own decision).
4. **Cold start = motivation, not drawback.** Never fake numbers, never render embarrassing small counts raw. Instead: founding-era framing + PROMINENT invite/growth mechanics. Members are recruited into making the network stronger — invites earn rewards, competition ranks top contributors. "You just made the Club smarter" is product personality.
5. Colors: existing warm-sand token system (do NOT introduce a second cream base), volt orange = action/live/trending, teal = network/collective/momentum, Kai blue = AI features ONLY. Charcoal/obsidian text, never pure black or pure white bg.

## SCALE-AWARE RENDERING RULES (every section)
- Any member-count/action-count below floor (default 50, per-metric override) renders as non-numeric copy or founding framing — never the raw number. Examples: "The Club is watching NVDA" instead of "3 members watching"; "Founding era — every mind you bring makes the Club smarter."
- Club Score shows RANK + DIRECTION (arrow/delta), never raw participant counts at small N.
- Signals must be REAL at any N: derive from screener activity, research pages, newsroom, watchlist adds, feed, bull/bear positioning — never fabricated. Compliance line on Trending: attention metric, NOT a recommendation (in the UI, not just spec).
- Kid profiles: Debate, sentiment display, invite competition, and People discovery are kid-walled (same deriveRegister pattern as screener migration 137). Kids get the safe subset.
- Kai features degrade gracefully while credits are dead: "Kai is temporarily unavailable" pattern (dc49ce5); Kai Brief falls back to newsroom/briefing-derived items (no-LLM path) when live Kai is down.

## SECTIONS (content spec from owner brief + mock)
1. **Header**: time-aware greeting; "N minds connected" (scale-aware → founding copy below floor); universal search placeholder "Search the Club…" (stub → routes to existing ticker search for now); notifications; avatar.
2. **Live Pulse** (hero): "LIVE PULSE / What the Club is seeing today" — 3–4 strongest COMMUNITY signals (most researched, new watchers, sentiment shift from bull/bear positioning, Kai/alerts pattern from track-record surface). Community behavior, not market movers. Sparkline accents.
3. **The Collective**: network identity moment. At scale: avatar constellation + "N actions added today" + activity breakdown (watches/reactions/comments/research saves/Kai questions). Below floor: this section BECOMES the growth engine — founding-member framing, invite CTA front and center, "Build the Club" mission copy. This is the owner's cold-start-as-motivation play.
4. **Invite / Build-the-Club mechanics (NEW, prominent)**: personal invite link w/ ref code; signup attribution; XP reward on activated invite (wire into existing XP/belt system); inviter recognition (Founding Builder framing) + top-inviters competition ledger; share affordances (copy link, native share). Adults + teens only; kids excluded. Reuse/extend existing referral-share pattern from challenge thank-you.
5. **Kai Brief**: "Here's what changed since your last check-in." 3–5 delta items (research velocity, sentiment shift, watcher growth, alert/pattern events) + "Ask Kai anything" CTA (opens existing Kai panel/FAB). Kai blue. LLM-optional: items derivable from data; LLM polish only when credits live.
6. **Trending in the Club**: ranked ledger (NOT a card, NOT top-gainers) — ticker, Club Score, change. Club Score = weighted community attention (research views, watchlist adds, comments, unique participants, saves, searches, Kai questions, sentiment activity). Tooltip + compliance line: "Attention inside the Club — not a recommendation."
7. **Today's Best Thinking**: editorial feature — one lead piece (big typography, ticker, author + badge/credibility, saves/comments/votes) + 2–3 secondary pieces in a ruled list. Sourced from existing community feed (research-type posts ranked by engagement; editor-pick flag optional).
8. **The Debate**: one live question, YES/NO split bar (not a donut if it fights the editorial language — designer's call), vote counts scale-aware, join CTA, avatars of participants. After voting: "Your view was added to Club Sentiment." Kid-walled. Backed by new debates/debate_votes tables; seeded with one question.
9. **For You**: "Based on your watchlist, research and activity" — per-member deltas on watched tickers (new research count, sentiment trend, watcher growth, Kai/alert pattern flags). Bridge from network → me. Links to research pages.
10. **People worth following (v1 = discovery, NO follow graph)**: surface genuinely useful members (by research output/helpful votes) w/ avatar, style tags, reason line. NO follower counts (fake at our N), NO follow button yet — "View profile". Follow graph is a later lane.
11. **Contribution feedback**: toast/inline confirmations after meaningful actions (vote → "added to Club Sentiment"; watchlist add → "strengthened this ticker's signal"; publish → "N investors learned from your research" scale-aware; invite → "You just made the Club smarter."). Small shared component, wired at the action sites.
12. **Challenge module slot**: reserved high-priority slot near top when challenge_pass active (DAY X OF 5, continue CTA) — wire to existing challenge state; renders only during challenge.
13. **Navigation**: unchanged (already matches brief). Home = this page (replaces/evolves D1 "Today in the Club" masthead — masthead's live-pulse concept is ABSORBED into §2, don't ship two competing heroes).

## DATA CONTRACT (API lane builds, UI lane consumes)
All under /api/club/:
- GET /api/club/pulse → { signals: [{kind, ticker, headline, detail, delta, spark?: number[]}] } (3–4)
- GET /api/club/collective → { connectedMinds, actionsToday, breakdown: {watches, reactions, comments, saves, kaiQuestions}, floorMet: boolean, avatars: [{id, url}] (consented/adult only) }
- GET /api/club/brief → { updatedAt, items: [{ticker?, text, kind}], source: "live"|"derived" }
- GET /api/club/trending → { rows: [{rank, ticker, score, change}], updatedAt }
- GET /api/club/thinking → { lead: {...post}, secondary: [...] }
- GET /api/club/debate + POST /api/club/debate/vote → question, counts, userVote, floorMet
- GET /api/club/foryou → { items: [{ticker, deltas...}] } (auth, watchlist-driven)
- GET /api/club/people → { members: [{id, name, avatar, tags, reason}] }
- GET /api/club/invite → { code, url, activatedCount, xpEarned, leaderboard: [{name, count}] } + attribution hook in signup
Score pipeline: derive from EXISTING tables first (feed posts/reactions/comments, community_watchlist, watchlists, alert_rules, research/screener access if logged); add ONE lightweight club_events table (member_id, kind, ticker, created_at, RLS insert-own/read-aggregate) for search/research-view/kai-question events going forward + minimal instrumentation at those sites. Aggregates cached (matview or cron-refreshed table) — home must load fast, no fan-out queries per request.

## TERRITORY FENCES (parallel lanes, one repo)
- **DATA lane** (branch → merge to main, additive only): supabase/migrations/*, src/app/api/club/**, src/lib/club/** (score, signals), instrumentation call sites (small, surgical). NO page/component/UI files.
- **UI lane** (branch lane/clubhome-v2, vercel PREVIEW only, NO merge to main): ClubHome page + new src/components/clubhome/**, tokens/styles if needed. NO migrations, NO /api/club/** files. Builds against this contract with a fixtures fallback (?fixtures=1 renders rich fixture data for design review — clearly dev-only, never reachable in prod) and wires real endpoints as they land.
- Both: rebase before push.

## PROCESS GATES (binding, from standing rules)
- UI lane loads design-taste skills + brand register before designing. No generic card containers. Both scale states (founding-era AND at-scale) must be designed and reviewable via fixtures.
- Preview-first: vercel (NO --prod). Coordinator pixel review (Playwright screenshots, desktop + 390px) → owner review → only then promote/merge.
- No fabricated stats ever rendered from real endpoints; fixtures are for design review only.
- Verify in real browser before claiming anything works.
