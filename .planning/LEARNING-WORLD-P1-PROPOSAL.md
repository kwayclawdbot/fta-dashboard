# LEARNING WORLD — P1 Architecture & Migration Proposal (inspection only)

**Lane:** P1 of `.planning/FIC-LEARNING-WORLD.md` — codebase + schema inspection → migration proposal. **No code, no migrations written.** This doc is the owner-review gate before P2 (Lesson runtime) starts.

**Method:** read the live Supabase migrations (96 files, `supabase/migrations/001`→`142`), the lesson viewer + iframe bridge, XP/belt/badge libs, games + simulator components + seeds, onboarding/comprehension, family/age profiles, and ClubHome v2. Everything below is grounded in what is actually in the repo today.

---

## 1. INVENTORY — what exists today

### 1.1 Education data model (Supabase)

| Table | Purpose | Key columns | Notes |
|---|---|---|---|
| `courses` (001, +`program` 013) | top of curriculum | `slug`, `title`, `min_tier` (challenge/academy), `program` (fic/fta/NULL), `published` | `program` splits FIC foundations vs FTA live vs NULL legacy catalog |
| `modules` (001) | course → unit | `course_id`, `track` (kids/adults, NULL=family), `sort_order` | `sort_order` doubles as cohort week number in FTA |
| `lessons` (001, +`is_free` 085) | the unit of content | `module_id`, `video_provider` (mux/youtube/bunny/**html**), `video_id`, `video_duration_sec`, `drip_week`, `has_quiz`, `is_free`, `sort_order` | **`video_provider='html'` + `video_id`=URL is the current "interactive lesson" mechanism** — an external iframe, not native |
| `lesson_progress` (001) | **the completion record to preserve** | `user_id`, `lesson_id`, `status` (not_started/in_progress/completed), `progress_pct`, `completed_at`, `time_spent_sec`, `unique(user,lesson)` | monotonic progress; parents can read children's rows |
| `quizzes` (001) | per-lesson quiz | `lesson_id` (unique), `questions` **jsonb**, `passing_score` (default 70) | question shape `{question, options[], correctIndex, explanation}` |
| `quiz_attempts` (001) | **graded attempts to preserve** | `user_id`, `quiz_id`, `score`, `answers` jsonb, `passed` | report-card data |
| `xp_events` (020) | **XP ledger — single source of truth; belts derive from it** | `user_id`, `amount`, `kind` (lesson/quiz/flashcards/game/community/rsvp/bonus), `ref_id` | de-dupe by `(kind, ref_id)`; own-insert RLS |
| `flashcards` (020) | spaced-rep cards | `id` (string PK), `week`, `track`, `front`, `back` | **306 cards seeded** (021) |
| `flashcard_reviews` (020) | **spaced-rep state already exists** | `user_id`, `card_id`, `due_at`, `interval_days`, `streak`, `last_result` | this is the SM-style scheduler the spec asks for, already built for cards |
| `game_items` (020) | game content bank | `id`, `game`, `prompt`, `answer`, `why`, `ord` | **48 items** (24 `candle-battle`, 24 `trend-or-trap`) |
| `game_scores` (020) | game results | `user_id`, `game`, `score`, `rounds` | |
| `game_items.chart_data` (023) | per-item OHLC/level/trendline JSON | | drives the animated renderers |
| `sim_portfolios / sim_positions / sim_trades` (003) | paper-trading simulator | | balance, PnL |
| `sim_scenario_scores` (003) | pattern-decision drills | `user_id`, `scenario_id`, `pattern_score`, `trade_score`, `decision` (buy/sell/wait) | 18 scenarios defined in code (`src/lib/simulator/scenarios.ts`), not DB |
| `badges` (001, +033) | credential defs | `slug`, `title`, `subtitle`, `criteria_key`, `sort` | 6 professional titles seeded (Scout/Analyst/Risk Manager/Investor/Technician/CEO) |
| `badge_awards` (033) | **earned badges to preserve** | `(badge_id, user_id)` unique; write only via `award_badge()` definer | criteria evaluated in `src/lib/badges.ts` |
| `user_badges` (001) | legacy badge awards | | superseded by badge_awards; keep for safety |
| `profiles.comprehension_level` (115) | onboarding knowledge-check calibration | beginner/developing/proficient | per-member; seeds Kai depth |
| `family_profiles` (075) | household/experience/goals/market_interest (108) | | drives personalization + Kai |
| `debates / debate_votes` (139) | live community poll | | **the "community_reveal" primitive already has a home** |
| `feed_posts.time_horizon / content_type` (142) | structured-at-capture on posts | thesis/question/news_reaction | Research-Card-adjacent structured capture already landing |

**There is NO belt table and NO skill/mastery table.** Belts are a pure presentation skin computed client-side (`src/lib/belts.ts`) from a member's summed `xp_events`. Skills do not exist anywhere yet.

### 1.2 Curriculum content volume (what would migrate)

Authoritative current curriculum is the **dual-program seed (014)**, program-tagged:

- **FIC Adult Foundations** (`fic-adult-foundations`): 6 weekly modules, **12 lessons**
- **FIC Teen Foundations**: 6 modules, **12 lessons**
- **FIC Kids Corner — Money Explorers**: 6 modules, **12 lessons**
- **FTA Trade Ready** (`fta-trade-ready`, live ICT program): 6 modules, **12 lessons** (live class + drill pairs, `track=NULL` = family attends together)
- **Legacy trading catalog (010)**: ~40 courses across investor/swing/day-trading/forex/futures/crypto tracks, many lessons — **mostly placeholder shells (`video_id` NULL)**; `program IS NULL`, hidden from program UIs. Low content value; do **not** prioritize converting.

**~48 program lessons are the real conversion target.** Video assets are largely unproduced (`video_id` NULL in 014) — meaning most lessons are today just a title + description + optional quiz, which is *good news*: converting a mostly-empty video shell into a step sequence is additive, not destructive.

- **Quizzes:** seeded per quiz-flagged lesson (017 = Week-1 across tracks; 006 legacy). JSONB, QuizPanel shape.
- **Flashcards:** 306 (021) + visual sets (025) — real, high-value, adult + kid/teen registers, textbook-sourced.
- **Games:** 48 items (021) with animated chart data (023).
- **Sim scenarios:** 18 (code).

### 1.3 Runtime components (the "engine" today)

- **`LessonViewerClient.tsx`** (`/courses/[slug]/[moduleId]/[lessonId]`) — the current lesson runtime. Three modes: (a) **video** (`VideoPlayer` + sidebar with AI Coach / Notes / Lessons list), (b) **HTML embed** (full-width iframe to `fta-university.vercel.app` or `*.here.now`), (c) mock fallback. On "Mark Complete": engagement gate (8s dwell or 50% scroll) → `lesson_progress` upsert → `awardXp('lesson', 50)` → belt-crossing celebration. Quiz via `QuizPanel` → `quiz_attempts` + XP.
- **`useLessonBridge` / `lesson-bridge.ts`** (feat/lesson-iframe-bridge) — `postMessage` protocol `{type:'fta', event:'section'|'quiz_answer'|'complete'}` from an external HTML lesson iframe → writes `lesson_progress` (monotonic), `quiz_attempts`, XP (all origin-validated, RLS-scoped). **This is the interface the new engine replaces: the same three write intents (section progress, quiz result, complete) but emitted by native step components instead of a cross-origin iframe.**
- **`QuizPanel.tsx`** — MC/true-false renderer; per-question select, results breakdown, retry, `onComplete(score, passed, answers)`. **Directly reusable as the `multiple_choice`/`true_false` step primitive.**
- **Games:** `CandleBattleGame`, `TrendOrTrapGame`, `CandleRenderer` (draws OHLC + level lines + trendlines from `chart_data`), `GameChrome`, `StreakFlame`, `ScorePop`, `useGameSound`, `useGameRounds`. **`CandleRenderer` is a genuinely strong, reusable read-a-chart primitive.**
- **Simulator:** `CandlestickChart`, `ChartDrawingTools`, `OrderPanel`, `ScenarioDecisionPanel` (buy/sell/wait), `ScenarioResultPanel`, `PortfolioSummary`. `PracticeInSimbotLink` already cross-links lessons → simulator scenarios (`SIMBOT-LESSON-MAP.md`).
- **Celebration:** `Celebrate.tsx` + `useCelebrate` (variants `mission`/`levelup`), register-aware; `beltCelebrateFields()` produces the belt-ceremony payload.
- **Register system:** `src/lib/register.ts` `deriveRegister(profile)` → kid/teen/adult (precedence age_group → role → track → adult). Server-mirrored in `viewer_is_kid()` (137). This is the audience-skin backbone.
- **XP/level ladder:** `src/lib/xp.ts` — 7 levels (Explorer→Playbook Pro), award constants (LESSON 50, QUIZ_PASS 30, +20 perfect, FLASHCARDS 20, GAME 10, COMMUNITY 5). Belts (`belts.ts`): 5 belts White→Black mapped over the 7 levels with degrees.

### 1.4 Journey entry point — what "Keep Learning" links to (asked)

`ClubHomeV2.tsx` renders a `<KeepLearning>` pickup at the bottom. It reads a `LearningPickup {title, href, context}` resolved in `dashboard/page.tsx` from the **`get_home_state` RPC** (013/030): its `today` field = the **next incomplete FIC foundation lesson within unlocked drip weeks**, deep-linking to `/courses/{course_slug}/{module_id}/{lesson_id}`. Fallback when caught up / no enrollment: `href:"/courses"`, title "Pick up the Foundations". So today the journey's entry point is a single resume line → the raw lesson viewer, and the "browse" fallback is the classic `/courses` grid.

**Implication for the journey UI:** the coherent entry point already exists and is wired to real resume state. P3 should repoint `KeepLearning.href` (and the `/courses` fallback) at the new **Learn Home (`/learn`)**, while keeping `get_home_state.today` as the "continue where you left off" resume target inside it. No new plumbing needed to give the world a front door.

---

## 2. LESSON JSON SCHEMA — finalized against reality

Store as a nullable `steps jsonb` column on `lessons` (additive; see §4). A lesson with non-null `steps` renders in `<LessonEngine>`; a lesson with null `steps` renders in the legacy viewer unchanged. Envelope:

```jsonc
{
  "schema": 1,
  "title": "What a Stock Is",
  "skills": ["stock_ownership", "market_basics"],   // 1–3 skill ids (§5)
  "difficulty": 2,                                    // 1–5
  "audience": ["adult","teen","kid"],                 // registers this lesson serves
  "duration_minutes": 4,
  "xp": 50,                                           // total; engine still de-dupes via xp_events(kind,ref_id)
  "guide": { "intro": "...", "outro": "..." },        // authored Kai lines (no live LLM)
  "steps": [ /* 5–8 StepSpec */ ]
}
```

**StepSpec** = `{ "type": <string>, "id": <stable>, "skill"?: <id>, ...typeProps }`. Each step optionally targets one skill so mastery updates per-interaction (§5).

### Step-type → existing-primitive mapping (the block-diversity map)

| Spec interaction | `type` | Build status | Backed by |
|---|---|---|---|
| micro video | `micro_video` | **restyle** | `VideoPlayer` |
| explanation / concept | `explainer` | **restyle** | new thin text/figure block (trivial); can embed `CandleRenderer` figure |
| multiple choice | `multiple_choice` | **restyle** | `QuizPanel` (single-Q mode) |
| true / false | `true_false` | **restyle** | `QuizPanel` variant |
| read-a-chart | `read_chart` | **restyle** | `CandleRenderer` + tap/choice overlay |
| bull / bear / unsure | `bull_bear` | **restyle** | `ScenarioDecisionPanel` (relabel buy/sell/wait) |
| buy / watch / pass | `buy_watch_pass` | **restyle** | `ScenarioDecisionPanel` (relabel) + Research-Card capture |
| prediction → reveal | `prediction` | **net-new** (small) | new; reveal uses `CandleRenderer` / Remotion Answer-Reveal |
| community reveal / poll | `community_reveal` | **restyle** | `debates`/`debate_votes` (139) |
| swipe decision | `swipe` | **net-new** | gesture wrapper over choice |
| tap-the-area | `tap_area` | **net-new** | hit-region over `CandleRenderer` figure |
| match pairs | `match_pairs` | **net-new** | |
| arrange-in-order | `order` | **net-new** | |
| compare two stocks | `company_compare` | **net-new UI** (data exists) | screener_metrics / research pages |
| choose the better business | `choose_business` | **net-new UI** (data exists) | screener_metrics |
| allocate portfolio | `allocate` (DragAllocate) | **net-new** | |
| spot-the-risk | `spot_risk` | **net-new** | tap_area variant |
| identify revenue/profit | `identify_number` | **net-new** | tap_area/choice variant |
| mini thesis | `thesis` | **net-new** (structured text) | `feed_posts` structured capture (142) |
| **real-world actions** | `real_world` (`research_ticker`/`save_watchlist`/`ask_kai`/`vote_club`/`comment`/`sim_trade`) | **integration** | `/research/[ticker]`, watchlist, `/kai`, feed, simulator — all exist; step = deep-link + return-with-result |
| game-as-node | `game` (`candle_battle`/`trend_or_trap`) | **restyle** | existing game components |
| spaced review | `review` (Today's Review) | **restyle** | `flashcard_reviews` scheduler already built |

**Tally: ~9 restyles/integrations of existing primitives, ~9 net-new (7 small).** This comfortably clears the spec's binding block-diversity gate — the "three quizzes in costume" failure is avoidable because `CandleRenderer`, `ScenarioDecisionPanel`, games, debates, research pages, and the flashcard scheduler are all already real and non-quiz.

Every step reports one of three engine outcomes so the write layer stays identical to the current bridge: **section progress**, **graded result** (→ `quiz_attempts` + XP), **complete**.

---

## 3. LESSONENGINE ARCHITECTURE

**Location:** `src/components/learn/LessonEngine/` (renderer + step registry) and `src/lib/learn/` (schema types, mastery hooks, resume). New tree; does not touch `courses/**`.

**Renderer:** `<LessonEngine lesson={LessonJSON} lessonId register onExit/>`.
- Reads `steps[]`, walks a step-progression state machine (`stepIndex`, per-step `state`).
- **Step registry:** `Record<StepType, StepComponent>` — each step gets `{ spec, register, onResult(outcome) }`. Unknown type → skip gracefully (forward-compat).
- **Mistake handling (mastery-loop, binding):** wrong answer → guide explanation panel (authored `explanation`) → **immediately re-ask a variant** of the same step (`variant` field or shuffled options) rather than red/retry. Only after the corrected attempt does the step resolve and mastery update.
- **Register skinning:** engine + each step read `register`; copy/graphics/feedback scale (adult editorial ↔ kid bright). Derived DOWN from adult per standing rule. `register` from `deriveRegister(profile)`.
- **Feedback:** on correct → `useGameSound` micro-cue + XP count-up + color pulse + small guide reaction (register-scaled); reuse `Celebrate` for step/lesson wins and `beltCelebrateFields` for belt crossings. No cartoon explosions for adult/teen.
- **Guide character:** authored `guide.intro/outro` + per-step `explanation` strings — **zero live LLM in the lesson flow** (spec §5, §7). Kai-generated exercises are a later garnish behind human review.
- **Accessibility/responsive/sound:** honored per step; mobile-first (the audience is on phones — see the audit notes in `LessonViewerClient`).

**Resume state:** new `lesson_step_progress` row (see §4) `{user_id, lesson_id, step_index, step_state jsonb, updated_at}` — monotonic, own-row RLS. Engine hydrates on mount, persists on step advance (debounced). Distinct from `lesson_progress` (which stays the coarse completion record the rest of the app + `get_home_state` already read).

**Write layer (unchanged intents):** a small `useLessonEngineSink(lessonId, quizId)` hook wraps the *exact* three writes the iframe bridge does today — `lesson_progress` upsert (section/complete), `quiz_attempts` insert, `awardXp` with `(kind, ref_id)` de-dupe + belt-crossing celebration. **Because XP/belts/progress/quiz_attempts write paths are byte-for-byte the current ones, every downstream surface (leaderboards, belts, report cards, home state, badges) keeps working with no changes.**

**How existing lessons keep working during migration:** the router stays `/courses/[slug]/[moduleId]/[lessonId]`. `LessonViewerClient` gains one branch at the top: *if `lesson.steps` is non-null → render `<LessonEngine>`; else → existing video/html/mock paths untouched.* A lesson is "migrated" the instant its `steps` column is populated and reviewed — no big-bang cutover, no dead URLs, the iframe/`fta-university` path remains valid for any lesson not yet converted. `feat/lesson-iframe-bridge` stays mergeable and is simply superseded lesson-by-lesson.

---

## 4. MIGRATION STRATEGY — additive, preserves all progress + belts

**Non-negotiable:** no destructive change; `lesson_progress`, `quiz_attempts`, `xp_events`, `flashcard_reviews`, `game_scores`, `sim_scenario_scores`, `badge_awards` all retained as-is. **Belts need no migration — they are derived from `xp_events`, so preserving the ledger preserves every earned belt automatically.** Badges likewise (own tables kept).

New migration (single file, e.g. `143_learning_world.sql`), **all additive**:

1. `alter table lessons add column if not exists steps jsonb;` (nullable — null = legacy render).
2. `alter table lessons add column if not exists est_minutes int, add column if not exists lesson_xp int;` (optional; engine falls back to `XP.LESSON`).
3. `create table lesson_step_progress (user_id, lesson_id, step_index int, step_state jsonb, updated_at, unique(user_id, lesson_id))` — own-row RLS mirroring `lesson_progress`; parents read family (mirror existing policy).
4. **Skill graph tables** (§5): `skills`, `lesson_skills`, `skill_mastery`.
5. `alter table lessons add column if not exists node_kind text check (node_kind in ('lesson','game','challenge','boss','mission'))` default `'lesson'` — lets a "lesson" row represent a game/boss node in the path without a parallel structure (games-as-nodes, §7).

**`lesson_progress` → new structure mapping:** no data move. `lesson_progress` remains the completion truth; `lesson_step_progress` is *additive resume detail*. A member who completed a lesson pre-migration has `lesson_progress.status='completed'` and no step rows → engine treats it as done (skips resume, allows replay). A member mid-way has `progress_pct` but no steps → engine starts at step 0 (they re-enter a richer lesson; acceptable, and better than losing them). **No user loses completion, XP, belts, or badges.**

**Course→unit→lesson stays internally** (spec §3: "kill 'courses' in the UI; keep it internally"). The journey/world/path is a *presentation* over `courses`/`modules`/`lessons` + `node_kind`, not a schema replacement.

---

## 5. SKILL GRAPH SEED

Net-new (nothing exists). Three tables + a seed mapping onto the existing 014 curriculum.

- `skills (id text pk, name, domain, sort)` — seed the spec's 15: `stock_ownership, market_basics, revenue, profit, margins, growth, competitive_advantage, financial_statements, valuation, diversification, risk, portfolio_construction, technical_analysis, market_psychology, thesis_building`.
- `lesson_skills (lesson_id, skill_id, weight)` — each lesson teaches 1–3.
- `skill_mastery (user_id, skill_id, mastery_score, attempts, last_seen, next_review_at, unique(user,skill))` — **directly mirrors the already-proven `flashcard_reviews` spaced-rep shape** (`due_at`/`interval_days`/`streak`), so the scheduler is a known quantity. Deterministic updates only (correct → +, wrong → schedule sooner). **Zero LLM** (spec §7).

Seed mapping (from 014 module titles → skills), e.g.:

| 014 lesson (FIC Adult) | skills |
|---|---|
| Why Invest — Compounding | market_basics, growth |
| What a Stock Is & How Market Works | stock_ownership, market_basics |
| Candlestick Anatomy & Timeframes | technical_analysis |
| Support/Resistance/Trend/Volume | technical_analysis |
| Chart Patterns & Indicators | technical_analysis |
| Fundamentals Lite: P/E, Earnings | financial_statements, valuation |
| Calls/Puts/Premium | risk (options) |
| Buying Options Without Blowing Up | risk, market_psychology |
| Position Sizing / 1-2% / Stops / R:R | risk, portfolio_construction |
| Trading Psychology & Journal | market_psychology |
| Brokerage Account / Order Types | market_basics |

Teen/Kids mirror the same skills at register depth (same backend, §4 audience skins). Surface = "YOUR INVESTOR BRAIN" bars (spec §7). The spec's 5 Worlds (Become an Owner / Follow the Money / Find Great Businesses / Build Your Portfolio / Think Like an Investor) are a *presentation grouping* over these skills + existing modules — no new content axis.

---

## 6. CONTENT-CONVERSION PLAN

**Priority order (highest-value, lowest-risk first):**
1. **FIC Adult Foundations Week 1–2** (4 lessons) — the free sampler + strongest openers (085 marks W1L1/W1L2 free), highest traffic, editorial adult register sets the derivation baseline.
2. **FIC Teen + Kids Week 1–2** (register derivations of #1) — proves the one-backend/four-registers claim early.
3. **Remaining FIC Foundations Weeks 3–6** (all three tracks).
4. **Flashcards → `review` step / "Today's Review"** — already structured (306 cards + scheduler); near-zero conversion, mostly wiring.
5. **Games → path nodes** (§7) — content already exists (48 items + chart data); wiring only.
6. **FTA Trade Ready** — live-class program; convert *drills* to steps, leave live classes as scheduled sessions (§8, FTA fence).
7. **Legacy trading catalog (010)** — **deprioritize/skip**; mostly empty placeholder shells, `program NULL`, hidden from program UIs.

**AI-assisted bulk transform (spec §11, binding):** existing lesson `title`+`description`(+quiz JSON) → draft `steps[]` JSON via a Claude authoring pass (needs Anthropic credits — currently an owner blocker per memory). Output is **draft only**. **Human review gate before publish, always** — never auto-publish, never manual full rewrite. Pipeline: `scripts/convert-lessons.mjs` reads a lesson, prompts for a step sequence honoring the §2 schema + block-diversity rule, writes to a `steps` staging column / preview; reviewer approves per-lesson (this is P5 + the Lesson Studio). Until credits land, **manual authoring of the ~4 Week-1 lessons is unblocked** and is the right P2 seed set anyway.

---

## 7. GAMES-AS-PATH-NODES INTEGRATION

Spec §2: games become nodes inside journeys, not a separate tab; flashcards → "Today's Review".

- **Two integration shapes:** (a) **inline step** `{"type":"game","game":"candle-battle","rounds":3}` inside a lesson's `steps[]`; (b) **standalone path node** via `lessons.node_kind='game'` with a `steps:[{type:'game',...}]` body — so a game appears as its own node on the vertical path between lessons.
- Both reuse `CandleBattleGame`/`TrendOrTrapGame` unchanged; results still write `game_scores` + `awardXp('game',10)` (existing paths).
- **Flashcards → `review` node** using `flashcard_reviews` (due cards) → maps cleanly to spec's "Today's Review — 3 concepts due; correct → mastery +3." When `skill_mastery` lands, `review` also advances skill mastery, unifying card review + skill review.
- **Simulator scenarios → `sim_trade` / `real_world` steps** via the existing `PracticeInSimbotLink` mapping (`SIMBOT-LESSON-MAP.md`); `ScenarioDecisionPanel` already yields buy/watch/pass-shaped decisions for boss-battle-style applied questions.
- **Boss battles (spec §3):** a `node_kind='boss'` lesson whose `steps[]` are all applied questions about one real ticker (what does it sell / how it makes money / which number is revenue / growing? / one risk / Buy-Watch-Pass), scored into an Investor Score breakdown — composed entirely from existing primitives (`buy_watch_pass`, `identify_number`, `spot_risk`, `company_compare`).

---

## 8. PHASED BUILD ORDER (P2–P4+) with fences + effort

Ordering follows the spec's phase list; estimates are rough engineering-days for an Opus build lane (design lanes add preview-gate cycles).

| Phase | Scope | Territory (fence) | Est. |
|---|---|---|---|
| **P2 Lesson runtime** | `143_learning_world.sql` (steps col + `lesson_step_progress`); `<LessonEngine>` + step registry + resume + mastery-loop mistake handling; write-sink hook; **5 core step types** (`explainer`, `multiple_choice`, `true_false`, `read_chart`, `bull_bear`); `LessonViewerClient` branch on `lesson.steps`. Author ~4 Week-1 lessons by hand (no credits needed). | `src/components/learn/**`, `src/lib/learn/**`, one migration, one-line branch in `courses/.../LessonViewerClient.tsx`. **No** journey UI, **no** skill tables yet. | 5–7d |
| **P3 Journey UI** (design lane, preview-gate) | Learn Home (`/learn`): streak header, continue-your-path (from `get_home_state.today`), Today's Review, Weekly Challenge slot, INVESTOR BRAIN bars (stub until P6); vertical path/map, node states (done/current/locked), 5 Worlds, daily goal 0/3, streak. Repoint `KeepLearning.href` + `/courses` fallback → `/learn`. | `src/app/(dashboard)/learn/**`, `src/components/learn/journey/**`; edit `KeepLearning` in `clubhome`. **No** engine changes, **no** migrations. Design-taste skills + brand register loaded; founding/at-scale states; kid wall. | 6–9d |
| **P4 Interaction library** | Remaining primitives incl. real-world actions (`research_ticker`/`save_watchlist`/`ask_kai`/`vote_club`/`sim_trade`), `company_compare`, `allocate`, `match_pairs`, `order`, `swipe`, `tap_area`, `prediction`, `thesis`; **games-as-nodes** wiring; boss-battle node. **Block-diversity gate before "done."** | `src/components/learn/steps/**`; deep-link integrations into existing research/watchlist/kai/sim/debate surfaces (read-only reuse). `node_kind` migration if not in P2. | 8–12d |
| **P5 Content conversion + Lesson Studio** | AI bulk-transform pipeline (`scripts/`), staging + human-review gate, admin authoring UI. **Needs Anthropic credits.** | `scripts/**`, `src/app/(admin)/lesson-studio/**`. | 6–10d (gated on credits) |
| **P6 Mastery/adaptive** | `skills`/`lesson_skills`/`skill_mastery` migration + seed (§5); deterministic mastery updates per step; spaced-rep daily challenge targets weakest due skill; INVESTOR BRAIN bars go live. | migration + `src/lib/learn/mastery.ts`; wire `review` node. Deterministic, zero LLM. | 5–7d |
| **P7 Market-event lessons + weekly world event** | earnings/news → auto `prediction`-style lesson from newsroom (117) + screener/track-record; "THIS WEEK IN THE CLUB" cross-register event feeding `fic_weeks` (031) + debate. | `src/app/api/learn/**`, cron. LLM-optional (derived facts primary). | 6–9d |
| **P8 Kids community** (own lane, never bundled) | Research Card share, kid clubs/rooms, structured posts only, age-cohort isolation, moderation, COPPA. Builds on kid-wall (137), structured capture (142), debates (139). | its own migrations + components; **do not bundle**. | 8–12d |
| **Asset track (parallel, non-blocking)** | Higgsfield world/character/celebration art + 5–6 Remotion templates (Concept Explainer / Company Breakdown / Chart / News / Answer-Reveal / Weekly Recap). | assets only; feeds `micro_video`/reveal steps. | ongoing |
| **Pull-forward (small, can run early)** | **Research Card** (structured capture already 80% there via 142); **Weekly Challenge v0** (content + poll on existing `debates` plumbing). | small additive lanes. | 2–3d each |

**Recommended cut for a pre-Sept win:** P2 (hand-authored Week-1) + a thin P3 Learn Home + the Research-Card pull-forward — demonstrates the whole "interactive sequence is the lesson, journey is the front door" thesis without waiting on Anthropic credits or the full library.

---

## 9. RISKS / OPEN QUESTIONS FOR THE OWNER

1. **Anthropic credits block bulk conversion (P5), not the runtime.** Kai is in outage per memory. P2–P4 + P6 need zero credits (deterministic + hand-authored). Confirm: OK to ship the engine + 4 hand-authored lessons first and convert the rest once credits return?
2. **`fta-university.vercel.app` iframe lessons** — are any *live/high-traffic* today, or is the HTML-embed path effectively unused? If unused, the engine can supersede it cleanly; if used, we keep both indefinitely (the branch-on-`steps` design already allows this). **Need the owner/analytics answer to know how hard to push cutover.**
3. **Legacy trading catalog (010, ~40 courses):** confirm these are deprioritized/skippable (they're placeholder shells, `program NULL`). Or should any trading vertical be first-class in the World?
4. **FTA fence:** spec says "FTA untouched." FTA Trade Ready is a *live* program. Proposal: convert only its self-paced **drills** to steps, leave live classes as sessions. Confirm FTA drills are in-scope for the World or fully hand-off.
5. **Register coverage vs. content:** kids/teens Foundations exist as titles+descriptions but little produced media. Converting to steps is fine, but **who authors the kid-register step copy** — AI draft + human review (needs credits) or hand-authored? Affects P2 vs P5 sequencing for non-adult registers.
6. **Belts vs. spec's belt *criteria*:** today belts are pure XP thresholds (`belts.ts`). Spec §8 wants **competency criteria** (e.g. WHITE→YELLOW = 8 lessons + 2 games + research 3 companies + 80% mastery). That's a **behavior change to the belt meaning** — additive (a new criteria layer gating belt award) but it changes what an earned belt means. Confirm: keep XP-belts and add a parallel competency track, or redefine belts as competencies? (Recommend: keep XP levels; layer competency "certifications" as badges to avoid disrupting earned belts.)
7. **Simulator returns in leagues:** spec §8 is emphatic — **XP/leagues NEVER from simulator returns** (anti-gambling, compliance for minors). Current `xp.ts` has no sim-return XP (good), but confirm the World's leaderboards stay XP-derived and simulator PnL is never a headline.
8. **Daily goal 0/3 + streaks** are net-new state (no streak table today beyond flashcard streaks). Confirm the daily-goal definition (1 Learn / 1 Practice / 1 Apply) is fixed so P3 can build the counter deterministically.
9. **"Keep Learning" repoint:** repointing `KeepLearning.href` from the raw lesson to `/learn` changes the ClubHome behavior. Since ClubHome v2 is itself an in-flight preview lane (`lane/clubhome-v2`), **coordinate the repoint so the two lanes don't collide** on that component.

---

### Key decisions (summary)
- **Additive-only:** one `steps jsonb` column + `lesson_step_progress` + 3 skill tables; **belts/XP/badges/progress preserved automatically** (belts derive from the untouched `xp_events` ledger).
- **One universal `<LessonEngine>`** reading lesson JSON, branched-in beside the legacy viewer (`if lesson.steps → engine, else → current`), so migration is lesson-by-lesson with zero dead URLs.
- **Block diversity is achievable now:** ~half the ~15 primitives are restyles/integrations of real existing components (`QuizPanel`, `CandleRenderer`, `ScenarioDecisionPanel`, games, `debates`, research pages, flashcard scheduler) — not quizzes in costume.
- **Spaced repetition already exists** (`flashcard_reviews`); `skill_mastery` mirrors it. Deterministic, zero LLM in the flow.
- **Journey front door already wired:** ClubHome's `KeepLearning` (from `get_home_state.today`) is the coherent entry — repoint it at the new `/learn` Learn Home in P3.
- **Credit-independent path exists:** engine + hand-authored Week-1 + Research Card can ship pre-Sept without Anthropic credits; bulk AI conversion (P5) waits on credits with a human-review gate.
