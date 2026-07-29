# KAI INTELLIGENCE LAYER — canonical architecture (owner-ratified 2026-07-26)

Kai is not "Claude with a big database attached." Three layers:
**Raw data (backend) → Derived intelligence (proprietary moat) → Claude (reasoning/synthesis only).**
Backend does storage, normalization, aggregation, retrieval, signal detection. Claude does interpretation, synthesis, explanation, personalization, conversation. The derived middle layer (Club Score, sentiment trends, velocity, themes, unusual-activity, relevance, thesis deltas) is where Cheat Code Club's unique value lives.

Standing patterns this formalizes (already shipped, keep):
- Machines detect → Claude interprets (Kai Watch: Haiku parses NL once → deterministic alert_rules → no-LLM cron evaluation; strategy plays no-LLM; C6 hybrid alerts).
- Controlled typed tools, NEVER raw SQL from the model (guardrail profiles kid/family-adult/club + tools like get_daily_changes).
- Model tiering: cheap model (Haiku) for parse/classify/tag/summarize; strong model (Sonnet) for Kai conversations/deep reasoning.
- 2-tier prompt caching (global tools+guardrail block, per-member personalization block — 384ac4e).
- Zero-LLM derived paths are PRIMARY wherever possible (Kai Brief derived path, research pages). LLM = polish, never dependency.

## 1. Raw data layer (exists / extends)
Everything Kai may need, in Supabase (zvkercqohmmeyofycbgr) + Railway feeds: prices/fundamentals (screener_metrics, EODHD/Polygon via Railway), news (newsroom), community posts/reactions/comments/saves w/ ticker tags + bull-bear stance, watchlists + community_watchlist, alert_rules + firings, club_events (search/research-view/kai-question — ClubHome v2 data lane), debate votes, challenge/simulator activity, Kai conversations + memory.

## 2. Derived intelligence layer (the moat)
### 2a. Ticker Intelligence Snapshot — the canonical object Kai reads
One precomputed row per active ticker, refreshed by the same cadence machinery as the ClubHome aggregates:
```
ticker_intel_snapshots {
  ticker, as_of,
  club_score, score_change_24h,
  watchers, watch_velocity_24h,
  sentiment: {bullish, neutral, bearish},      -- from stance capture + debate/positioning votes
  sentiment_change_24h,
  research_velocity_24h, comment_velocity_24h,
  top_topics: [..], top_risks: [..],           -- from classification (2b), null until Phase 2
  unusual_activity: bool,                       -- floor-gated composite
  provenance: {raw counts backing every derived number}
}
```
Supersets the /api/club/* aggregates from CLUBHOME-V2-PLAN.md — Phase 1 = re-plumb those aggregates INTO snapshots so ClubHome and Kai read the same object. Never two parallel pipelines.

### 2b. Community content classification
- **Structured-at-capture FIRST** (cheaper + more accurate than inference): stance already captured at post time (bull/bear); EXTEND compose forms w/ optional time_horizon + content_type (thesis/question/news-react). Never infer what we can ask.
- Cheap background classifier (Haiku, batched, idempotent, queue-backed) fills what can't be asked: themes[], risks[], quality_score. Stored on the post row (classification cols or side table). Snapshot top_topics/top_risks aggregate from these.
- Credits-dark safe: classifier queue backlogs and catches up in one batch when the org is funded. Nothing downstream hard-depends on classifications existing (null-tolerant).

### 2c. Signal pipeline
RAW EVENTS → NORMALIZATION → FEATURES/METRICS → SIGNAL DETECTION → USER RELEVANCE → CLAUDE INTERPRETATION → NOTIFICATION.
Detection = deterministic conditions on snapshots + market data (threshold cross, volume spike, sentiment shift, velocity spike, earnings, news, Club Score jump). Claude invoked ONLY post-trigger, per-relevant-user, to interpret ("this matters because margin expansion was part of the thesis you've been tracking") — never scanning.
**SMALL-N SIGNAL HYGIENE (binding):** every relative delta pairs with an absolute floor (e.g. comment_velocity fires only if Δ% ≥ X AND count ≥ N). One extra comment ≠ +100% velocity signal. Same floors philosophy as ClubHome scale-aware rules (default 50, per-metric override). Below floors → metric renders/feeds as null, not as noise.

## 3. Semantic retrieval (pgvector)
Enable pgvector in the app Supabase. Embed community posts/comments (quality-weighted), research posts, newsroom items, user theses, Kai conversation summaries. Reuse the proven contextual-embeddings pattern from the knowledge-base build (chunk + context prefix; watch JSONB null vs SQL NULL; `chunk_meta` not `metadata`). Retrieval budget: 10–30 high-quality chunks max into Claude, never raw dumps. Embedding writes are cheap-model/API work → also queue-backed and credits-tolerant.

## 4. Kai Context API (single bundler)
One internal service replaces per-route ad-hoc context assembly. Given (user, query|event) → classifies what context is required → assembles bundle in PARALLEL fetches: user block (compact profile, watchlist, alerts, prior ticker theses) + market block (snapshot, price/fundamentals) + community block (snapshot sentiment/themes, top bull/bear arguments, retrieved research) + news block. Bundles cached briefly (60–300s) keyed by (ticker, context-kind); user block rides the existing per-member cache tier. Must NOT become a blocking monolith — chat route degrades to partial bundle on any sub-fetch timeout.
Tool surface exposed to Claude (typed, backend-executed): get_ticker_snapshot, get_club_intelligence, get_community_research(limit), get_sentiment_history(days), get_user_watchlist, get_user_alerts, get_recent_news, get_fundamentals, get_price_history. Extends (does not replace) existing profile tools; guardrail profiles wrap ALL of it (kid/family-adult/club floors unchanged).

## 5. Memory levels
- Short-term: current conversation (exists).
- User memory: persistent prefs + compact investment profile — periodically re-summarized by cheap model into the per-member cache block (profile text ~1 paragraph: horizon, risk, sectors, avoids, watchlist).
- **Ticker memory (NEW, differentiating):** user_ticker_theses {user, ticker, thesis_summary, as_of} — captured from Kai conversations + published research; enables "has anything changed since what we said about NVDA last month?" (diff old thesis vs current snapshot).
- Club memory: the snapshots (2a).
- Market memory: newsroom archive + screener_history + track-record ledger (exists).

## 6. Provenance (trust + compliance)
Every derived claim Kai or the UI makes is tappable → shows the raw numbers behind it (snapshot.provenance). "Community sentiment turning bullish" → +218 watchers, 74% bullish votes, 83 research posts, top themes. Grounded-in-the-Club, never magic-AI. Doubles as compliance armor: attention/activity framing, never advice; disclaimer strings ship in API responses (per CLUBHOME-V2-PLAN) and Kai answers cite Club data, not recommendations.

## 7. Modes
- **Reactive Kai:** question → Context API bundle → Claude answers.
- **Proactive Kai (= Kai Watch matured):** signal pipeline event → relevance filter (does THIS user care: watchlist, thresholds, novelty vs last-notified) → Claude interprets → push/alert. Dedupe + genuinely-new checks mandatory (no repeat noise).

## PHASING
- **Phase 1 (queued — starts when ClubHome v2 DATA lane lands; same tables, extends its pipeline):** ticker_intel_snapshots table + refresh (re-plumb /api/club aggregates to read snapshots), provenance object + "why?" endpoint, absolute-floor signal hygiene into the existing rules/alert crons, extend compose structured capture (time_horizon, content_type). Zero LLM required — fully buildable while credits dark.
- **Phase 2:** classification pipeline (Haiku queue) → themes/risks/quality on posts → snapshot top_topics/top_risks live; compact user-profile summarizer. Needs credits (queue can be built dark, drained later).
- **Phase 3:** pgvector + embeddings + retrieval into community research answers.
- **Phase 4:** Kai Context API consolidation (chat route refactor onto the bundler), full tool surface, ticker memory + thesis-diff experience, proactive Kai interpretation upgrade on the signal pipeline.

## GUARDRAILS (binding)
- No raw SQL access for the model, ever. Typed tools only.
- Compliance profiles wrap every new tool; kid register gets the safe subset (mirrors screener/debate walls).
- No derived metric renders or triggers below its floors.
- Nothing hard-depends on LLM availability; LLM stages are queue-backed and catch up.
- Additive builds only (never destabilize prod Kai) — sidecar/extend, per standing additive-build rule.
