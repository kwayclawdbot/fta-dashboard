# FIC LEARNING WORLD — living learning world, not a course section (owner-ratified 2026-07-26)

**North star:** not Netflix-for-courses, not even Duolingo-for-stocks — an interactive investing world that learns who you are, teaches through real companies and current markets, lets you practice what you learn, and connects progress to the actual investing community. Don't ask "did the kid watch the lesson?" — ask "can the kid use the concept?" Reward understanding + application + participation, never watch-time.

**OWNER PRIORITY: UI/UX FLOW.** The feel of moving through the world — journey map, lesson step flow, transitions, feedback, celebrations — is the product. Design-taste skills + brand register load in every design lane; preview-gate + pixel review + owner review before promote (standing process).

**Tool assignments (ratified):**
- **Claude Code + Fable 5** — product architecture, LessonEngine, UI logic, adaptive paths, game mechanics, QA. Full spec + codebase inspection + controlled phases; never one giant prompt.
- **Higgsfield** — world/environment art, guide-character scenes (character-consistency tools), cinematic transitions, boss intros, achievement/unlock cinematics.
- **Remotion** — parametrized micro-lesson video templates rendered in bulk (see remotion-best-practices skill; Higgsfield generates expensive visuals ONCE, Remotion assembles them programmatically with narration/captions/numbers/charts/brand motion — never regenerate whole AI videos per lesson).

## ARCHITECTURE
CONTENT STUDIO (Claude drafts + Higgsfield visuals + Remotion motion) → LESSON DATABASE → LESSON ENGINE → audience skins (KIDS/TWEENS/TEENS/ADULTS) → SKILL GRAPH → ADAPTIVE ENGINE (deterministic first; Kai selects next). Overlay: MARKET + CLUB DATA → current events → dynamic challenges → Learning World. Education, Club, and FIC become one system at the weekly world event.

## 1. LessonEngine (the architectural change)
Current: video is the lesson, quiz validates it. New: **interactive sequence is the lesson; video is one block type.** ONE universal renderer reading lesson JSON — never 300 hard-coded pages:
```
{ "title": "Revenue vs Profit", "skill": "financial_statements", "difficulty": 2,
  "audience": ["adult","teen","kid"], "duration_minutes": 4, "xp": 50,
  "steps": [ {"type":"micro_video","asset":"revenue_intro"}, {"type":"tap_choice","question_id":"rev_001"},
    {"type":"match_pairs","question_id":"rev_002"}, {"type":"company_compare","tickers":["NKE","RBLX"]},
    {"type":"prediction","question_id":"rev_003"}, {"type":"real_world_action","action":"research_ticker"},
    {"type":"community_reveal","poll_id":"rev_poll_01"} ] }
```
Engine requirements: step progression, resume state, mistake handling (mastery-loop: wrong answer → guide explains → immediately re-ask a variant — never just red/retry), retries, XP, mastery updates, sound, animation, accessibility, responsive mobile. A lesson = 5–8 interactions, ~4 minutes.

## 2. Interaction library — ~15 strong primitives, not 150 bespoke games
- **Quick:** multiple choice · true/false · swipe decision · tap-the-area · match pairs · arrange-in-order
- **Investing-specific:** Bull/Bear/Unsure · Buy/Watch/Pass · compare two stocks · spot-the-risk · identify revenue/profit · allocate portfolio (DragAllocate) · choose the better business · read-a-chart · prediction-then-reveal · mini thesis
- **Real-world actions (THE differentiator vs Duolingo — lessons escape the lesson screen into the live product):** research a real ticker (opens real Discover, returns with the pick woven in) · save to watchlist · ask Kai · vote with the Club · comment on research · simulated trade
Existing games (Candle Battle, Trend or Trap, flashcards, simulator scenarios) become path nodes inside journeys — not a separate Games tab. Flashcards → "Today's Review" spaced-repetition block.
**Calibration warning (binding):** if v1 ships with three block types that are all quizzes in costume, this is Khan-with-a-path. Block DIVERSITY is where the feel lives — Phase-gate on it.

## 3. Journey/World UI (kill "courses" in the UI; keep course→unit→lesson internally)
Vertical scrolling path/map; nodes = lesson · game · challenge · boss battle · real-world mission; states: done/current/locked; world visuals evolve with progress. Header: "YOUR INVESTING JOURNEY · Level 3 · Business Detective · streak · XP".
**Worlds:** 1 Become an Owner (Brand Detective) · 2 Follow the Money (Revenue Race) · 3 Find Great Businesses (Spot the Moat) · 4 Build Your Portfolio (Portfolio Builder) · 5 Think Like an Investor (Buy/Watch/Pass). Higgsfield environments: Ownership city of known businesses · Money District flow scenes · Moat Island · Portfolio City (sector neighborhoods) · Market Mountain (risk rises as you climb).
**Boss Battles** end each unit: a real company, applied questions (what does it sell / how does it make money / which number is revenue / growing? / one risk / Buy-Watch-Pass) → Investor Score breakdown (Research/Financials/Risk-Thinking) + big XP. Feels like doing investing, not a test.
**Learn Home:** streak header · continue-your-path (world, %, next lesson + time + XP) · Today's Review (due skills) · Weekly Challenge · YOUR INVESTOR BRAIN skill bars. Never "36 of 80 lessons complete."

## 4. Audience skins — ONE backend, four registers (adult-first derivation rule applies)
Same engine + skills; different copy/graphics/difficulty/feedback/depth. Kids 7–10: bright, illustrated, minimal text, "Boss Battle: Can You Analyze Nike?". Tweens 11–14: game-like, competitive, real company imagery. Teens 15–18: close to Club UI — charts, research cards, sophistication; must feel like the junior REAL Club, never a kids app. Adults: editorial, minimal gamification, real market data, "Case Study: Evaluate Nike" — the journey mental model WITHOUT a cartoon city. Registers derive DOWN from the premium adult style (standing rule).

## 5. Guide character
Kai as subtle companion, not "hi I'm your AI assistant": short in-world lines ("You understand revenue. Now spot a profitable business."), animates into next challenge. Expressive for kids, restrained for adults — same identity. Higgsfield character-consistency for recurring expressions/scenes. Guide lines are authored content (no live LLM dependency in the lesson flow).

## 6. Remotion templates — build 5–6, populate from structured content
Concept Explainer (20–40s) · Company Breakdown ("How does Costco make money?") · Chart Explainer · News Breakdown · Answer Reveal (prediction → animated reveal) · Weekly Recap. Parametrized props → bulk render; branded intro/outro, captions, sound cues.

## 7. Skill Graph + mastery + spaced repetition
Skills (not courses) underneath everything: stock_ownership, market_basics, revenue, profit, margins, growth, competitive_advantage, financial_statements, valuation, diversification, risk, portfolio_construction, technical_analysis, market_psychology, thesis_building. Each lesson teaches 1–3 skills; each interaction updates mastery.
`skill_mastery { user_id, skill_id, mastery_score, attempts, last_seen, next_review_at }` → spaced repetition ("Quick Review — 3 concepts due; correct → mastery +3, wrong → we'll bring it back"). Adaptive daily challenge targets weakest due skill. **Deterministic first — zero LLM in the engine; Kai-generated exercises are a later garnish.** Surface = "YOUR INVESTOR BRAIN" bars.

## 8. Habit loop
Daily goal, brutally obvious: TODAY 0/3 — 1 Learn (3 min) · 2 Practice (2 min) · 3 Apply (research a real ticker, 3 min) → Daily goal complete + XP. Streaks. Weekly age-separated leagues — XP from lessons/correct answers/research/helpful participation/challenges, **NEVER simulator returns** (multiple leaderboards: Top Researcher, Longest Streak, Best Portfolio Explanation, Challenge Champion, Most Helpful, Quiz Master; simulator performance is one dimension, never the headline — anti-gambling posture for minors, compliance-relevant).
Belts = competencies w/ explicit criteria (e.g. WHITE→YELLOW: 8 core lessons + 2 games + research 3 companies + 80% mastery challenge) → full-screen belt cinematic (3–5s Higgsfield/Remotion sequence). Correct answers: micro-haptics, subtle sound, XP count-up, color pulse, small guide reaction, node-unlock animation — satisfying, never cartoon explosions (register-scaled).

## 9. Market generates curriculum (endlessly renewable)
- **Market-event lessons:** earnings/news → auto lesson ("NFLX reported. Revenue beat, sub growth slowed. What happened to the stock? UP/DOWN/FLAT" → reveal actual reaction → Kai explains). Backed by newsroom + screener/track-record data; explanation LLM-optional (derived facts primary).
- **Weekly world event — THIS WEEK IN THE CLUB:** one company, every register participates at its level (kids: how does Costco make money · adults: why the valuation premium · advanced: model membership economics · families: vote Buy/Watch/Pass). This is where Club + FIC + education become ONE system; feeds Club sentiment + intel snapshots (kid-walled aggregates).

## 10. Social layer + KIDS SAFETY SPEC (own phase, binding)
Post-lesson reveals: "74% of the Club answered the same way" · under-18 vs adult splits · family agreement ("Dad ✅ Andwele ✅ Arielle ❌"). Kid Clubs/Rooms (Tech Investors, Gaming Stocks, Sports Brands, Food, Young Entrepreneurs): vote, react, answer prompts, share research cards, challenges, compare paper portfolios.
**Safety (non-negotiable):** NO DMs for minors, no open feed for young kids — structured posts only (My Stock Pick: company + choose/write reason + Buy/Watch/Pass); age-cohort isolation; parent visibility; moderation pipeline even for structured free-text; COPPA-shaped data handling; kid data never in adult-facing surfaces (existing kid-wall patterns). Constrained inputs are the moderation strategy, not an afterthought.
**Research Card (signature feature, PULL-FORWARD candidate):** company · what they do · how they make money · what I like · biggest risk · decision Buy/Watch/Pass · confidence /10 → share to family/age-group/challenge. It is structured capture — the kid-sized intel-layer input; aggregates ("68% of FIC kids voted WATCH") are collective intelligence junior division.

## 11. Lesson Studio + AI authoring
Admin interface: Add Step (explanation/video/MC/match/compare/bull-bear/allocation/real-world mission/community poll) → preview as Kid/Teen/Adult → publish. No code needed to add lessons.
"Generate with Kai": prompt ("teach operating margins to a 13-year-old using Starbucks") → draft concept/examples/questions/wrong-answer feedback/challenge/poll → HUMAN REVIEW BEFORE PUBLISH, always. Content conversion of the existing curriculum = AI-assisted bulk transform (existing course text → lesson JSON) + human review; never manual rewrite, never unreviewed publish. (Authoring generation needs Anthropic credits; Studio + manual authoring do not.)

## 12. Migration + monetization
- Inspect current courses/lessons/quizzes/XP/belts/games/schema/age profiles FIRST; migrate WITHOUT destroying current progress (additive-build rule; lesson_progress preserved; belts keep earned state).
- Gates per MONETIZATION-GATES.md: starter lessons + weekly challenge + daily goal FREE (habit + data engine); full Worlds/library/boss content + advanced tracks PAID; kids community = Family Mode activation (paid); FTA untouched.

## OWNER RULINGS 07-26 (post-P1 inspection; proposal = .planning/LEARNING-WORLD-P1-PROPOSAL.md)
- **Belts = HYBRID:** belt-up requires the XP threshold AND a short mastery challenge — one gate, not two systems. Existing earned belts preserved (XP ledger untouched).
- **fta-university iframe path = effectively unused** → cut over lesson-by-lesson without protecting it.
- **Legacy ~40-course trading catalog (mig 010) = SKIP.** Convert only the 48 program lessons (FIC Adult/Teen/Kids Foundations + FTA Trade Ready).
- Coordinator rulings (standing patterns): engine + hand-authored Week-1 ships before bulk AI conversion; kid/teen step copy = AI-draft + human review; leagues XP-derived, sim PnL never headline (already binding); daily goal = 1 Learn + 1 Practice + 1 Apply, streak = any goal item, 3/3 = bonus XP.

## BUILD PHASES (each = its own lane w/ plan-mode inspection first; UI/UX flow gets the design-lane treatment)
- **P1 Learning architecture:** codebase + schema inspection → migration proposal (plan mode, no build) → owner review.
- **P2 Lesson runtime:** <LessonEngine/> + step schema + resume/mistakes/XP/mastery hooks + 5 core interaction types.
- **P3 Journey UI:** Learn Home, path/map, node states, worlds, daily goal, streak, Investor Brain. (UI/UX flow priority — full preview-gate process.)
- **P4 Interaction library:** remaining primitives incl. real-world actions + games-as-nodes; block-diversity gate before calling it done.
- **P5 Content conversion:** AI bulk transform existing curriculum → lesson JSON + human review + Lesson Studio.
- **P6 Mastery/adaptive:** skill_mastery + spaced repetition + adaptive daily challenge (deterministic).
- **P7 Market-event lessons + weekly world event.**
- **P8 Kids community** (safety spec above; own lane, never bundled).
- **Asset track (parallel, non-blocking):** Higgsfield world/character/celebration assets + Remotion templates.
- **Pull-forward candidates** (small lanes, can run early if owner wants wins pre-Sept): Research Card; weekly challenge v0 (content + poll on existing plumbing).

**QUEUE POSITION (owner-directed):** starts after the currently-pending lanes — ClubHome v2 UI, Kai Intelligence Phase 1, and monetization gates — which are Sept-critical and run first.
