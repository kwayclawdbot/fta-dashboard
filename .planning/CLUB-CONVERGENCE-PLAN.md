# CHEAT CODE CLUB — CONVERGENCE PLAN v1.1 (owner-ratified 2026-07-26; owner review 9.5/10, five amendments folded in)

**THE ONE RULE THAT GOVERNS EVERYTHING BELOW (owner amendment #1): The Club has NO landing page above Feed/Lounge/Live. The Club IS Feed/Lounge/Live — the ONLY exposed social taxonomy. All richness (Happening Now, debates, missions, Kai signals) lives INSIDE Feed as rich objects, never as parallel sections. The one risk of this plan is accidentally reintroducing social fragmentation inside The Club after solving it conceptually — guard against it in every review.**

**The final iteration.** Begins when the two in-flight lanes land (Learning World P2 LessonEngine, Kai Watch Lane B UX). When this plan completes, the app is FINISHED for launch-scale: one authored ecosystem, not strong products connected by navigation.

**Objective:** reduce visible complexity 30–40% without removing capability. Every screen answers "here is the most important thing right now" — never "here is everything you can do."
**Benchmark:** hide the logos and the app is still unmistakably Cheat Code — from its proprietary interaction patterns (Club Score, Changed My Mind, The Collective, Kai Watch states, the learning path, live_event cards), not its color.
**FEATURE FREEZE:** no new major features until this pass completes. Capability is ahead of interface; the leverage is convergence.
**Deferred by owner:** brand-mark decision (infinity vs C◇C) — owner hands off separately; do not block on it, do not change marks in this pass.

---

## PART I — THE CLUB: Feed · Lounge · Live
Community restructures around three modes of human communication (not content taxonomy):

- **Feed** — asynchronous, persistent. What should still matter tomorrow: research/theses, stock ideas, questions, polls, Changed My Mind moments, watchlist shares, market observations, Kai insights, challenge contributions, live_event cards + recaps. The Social Objects live here.
- **Lounge** — conversational. Where people hang out: fast chat, replies, wins/losses, "anyone watching AMD?", intros, reactions, presence. = the existing Main Circle, reframed. Show presence: "● 74 in the Lounge" + avatar strip. Discord psychology without the channel maze.
- **Live** — synchronous. One infrastructure, multiple room types: 🎙 Audio Room (Spaces-style: listen, raise hand, react, written Qs, come on stage) · 📈 Market Room (chart/screen-share dominates, conversation beside, "stocks being discussed" chips + contextual actions Research/Ask Kai/Watch) · 🎓 Class (lesson/slides + instructor) · later 📺 Watch Party. **Same Live infra serves Club rooms, Education classes, and FTA desk — different permissions, one system.**

Top of The Club: a quiet mode strip — `Feed | Lounge | 🔴 Live 2` — with an animated live indicator when rooms are on. No giant navigation change. **Owner amendment #2: when a room is ACTIVE, a prominent "LIVE NOW" strip/card also appears ABOVE the mode strip** (host, title, viewer count, Join) — synchronous activity feels urgent without changing the IA.

**Cross-mode flows (the differentiators):**
- **Live → Feed:** when a room ends, Kai generates a recap object (key takeaways, stocks discussed, attendee sentiment, top questions, replay link). Synchronous conversation becomes persistent intelligence.
- **Lounge → Feed:** "Promote to Club" (long-press / mod / Kai-suggested) turns a valuable conversation into a structured Feed object linking back.
- **Feed → Live:** a hot thesis/post gets "Go Live on this" → room opens with the original object pinned.
- **Kai Watch × Live:** member watches NVDA + a host opens an NVDA room → "🔴 A Live room just opened for a stock Kai is watching for you." Inside the room: `Kai Watch: ON` + current state. Live, community, alerts, watchlist collapse into one experience.

**Live UI rule: never Zoom.** No black rectangle + participant tiles + corporate controls. The interface adapts to room type: trading = chart dominates; audio = people/presence dominate; class = lesson dominates.

## PART II — THE live_event OBJECT (first-class, one object through its whole life)
```
live_event { status: scheduled → starting_soon → live → ended → replay_ready;
  host, cohosts, room_type, title, description, tickers[], thumbnail,
  viewer_count, started_at, ended_at, replay_url, kai_summary, top_questions }
```
The Feed renders the CURRENT STATE of the same object; notifications subscribe to state changes. One object, one URL, one engagement history.
- **Scheduled/Starting soon:** rich Feed card ("starts in 30 min · 112 interested · [Remind Me]") → targeted push at start for opted-in members.
- **Live:** card updates in real time (viewer count, tickers discussed, "12 people you follow are here", live reactions). Push copy is contextual per room type, sells the reason to enter (never generic "X is live"). In-app banner + Live tab badge.
- **Ended:** the card TRANSFORMS (never deleted): recap layout — covered tickers, key takeaways, attendee sentiment split, [Watch Replay], Kai Summary attached.
- **Notification hierarchy (ship WITH v1, not later):** push = host followers, ticker watchers, registrants, FTA members for FTA rooms, families for family classes; medium = frequent Live joiners; everyone else = in-feed/tab only. Member setting: All Club Lives / Hosts I follow / Stocks I watch / Joined events / Important only.
- **SEQUENCING GIFT: the five Sept 2–6 challenge webinars are the FIRST live_events.** Build the minimal slice (object + evolving Feed card + Remind Me + recap/replay) for the webinars — needed anyway, guaranteed audience, battle-tests the model. Audio rooms, Go-Live-on-this, and screen-share infra come after density (post-challenge). Existing Zoom SDK + Supabase Realtime (FTA live-sessions arch) is the starting infrastructure.

## PART III — DESIGN GRAMMAR (enforced; every screen built ONLY from these primitives)
**Owner amendment #4: these rules are LITERAL CODE-REVIEW CRITERIA.** Every convergence-pass PR is checked against them line by line — "containment communicates meaning or doesn't exist," the type scale, and Kai-blue-only-when-Kai-speaks are pass/fail gates, not guidelines.
1. **Page intro** — headline, context, 0–2 actions.
2. **Signal row** — ticker / event / alert / person (the shared TickerRow family).
3. **Feature canvas** — the dominant experience of the screen.
4. **Editorial section** — no card by default; type, spacing, hairlines on open canvas.
5. **Object card** — ONLY for persistent objects: thesis, lesson, alert/setup, person, ticker, live_event.
6. **Action sheet** — universal contextual actions.
7. **Kai layer** — consistent Kai-blue treatment wherever Kai speaks.
8. **Status chip** — tiny semantic indicators.

**Rules:**
- **Containment communicates meaning or doesn't exist.** Kill cards-for-hierarchy: replace `rounded-2xl border bg-card p-4` reflex with typographic hierarchy, spacing, hairlines, full-bleed moments, scale. Object cards keep containment (they're objects).
- **Typography scale gets contrast:** 32–40px feature headings · 20–24px section leads · 16px reading body · tiny text ONLY for metadata. Kill the everything-is-13px density.
- **Accent discipline per screen:** ONE dominant accent + ONE semantic supporting accent. Club = volt dominant, teal signals, Kai-blue only when Kai speaks. Family = gold. FTA = metallic. Fewer simultaneous accents; badges/sentiment noise reduced.
- **Motion communicates product meaning, not component garnish:** rank changes physically rise; Changed My Mind visually transforms Bull→Neutral; Kai Watch near_trigger tightens/pulses; lesson mastery animates the path unlock; collective shifts move the network viz. (Reduced-motion respected always.)

## PART IV — SHELL (Sprint 1)
- **One permanent mental map:** `Home · Discover · Club · Watchlist · You` (desktop + mobile). Everything else emerges contextually: Discover ⊃ stocks/research/news/screening · Watchlist ⊃ my stocks/Kai Watch/alerts · You ⊃ practice/progress/family/settings. FTA = a mode/up-level, not parallel nav.
  - **AMENDMENT (coordinator + owner #3): Learn stays one tap from primary for kid + family registers** (a retention pillar can't live under "You" for kids). Kid: `Home · Learn · Club · Missions · Me`. **Adults: Learn stays consistently VISIBLE through contextual "Continue Path" objects on Home AND ticker pages** (e.g. a lesson relevant to the viewed ticker) — so it never feels buried even though it isn't primary nav.
- **Stable mobile shell: only ONE slot changes per register.** Adult: Home·Discover·Club·Watch·You / Parent: Home·Discover·Club·Family·You / Kid: Home·Learn·Club·Missions·Me. Retire the elevated center-circle Community FAB style (reads social-app-2020; the Club deserves premium).
- **Top bar:** shell stops duplicating page titles that the content already announces. Desktop = global search + notifications + avatar; each experience owns its opening composition. Mobile keeps compact titles.
- **Universal search = a main product anchor:** one command surface. "NVDA" → stock + people + theses + debates + lessons + Ask Kai. NL queries route: screening intents → Stock Finder; questions → Kai. ⌘K everywhere.
- **Kai = system capability, not a destination:** opens as desktop side-sheet / mobile bottom-sheet, already knowing current ticker/lesson/thesis/alert/chart context. The /kai page remains as the full view, but contextual Kai is primary.
- **Hub reduction:** four conceptual worlds only — **Club** (market+community intelligence) · **Learn** (capability building) · **Family** (household mode) · **FTA** (advanced mode). Everything else is a route inside one of them, not a presented "hub."

## PART V — SURFACE PASSES
- **Home (hierarchy pass — keep v3's content + object identity, add dramatic hierarchy):** LIVE PULSE near-full-width and dominant above the fold; THE COLLECTIVE as the large signature visualization w/ Kai Brief adjacent; the tail (Debate, For You, Best Thinking, Build the Club, People, Keep Learning) goes editorial on the sand canvas — not every module in a white card. Nine concepts, one dramatic order. live_event cards join the Pulse tier when rooms are on.
- **Discover (de-tab, editorialize):** kill the six-tab switcher (Trending/Most Discussed/Top Research are ranking filters on one universe). One editorial page: search anchor → For You → Trending Now → Best Research → News Moving the Club → "Explore stocks →" / "Open Stock Finder →" (Finder = full-screen tool, News = detail view).
- **Community → The Club (the biggest single lift; AMENDED per owner review):** The Club opens DIRECTLY into Feed/Lounge/Live — no landing layer above them. **Feed itself** surfaces the richness as ranked rich objects in the stream: Happening Now (sentiment moves), Today's Debate, New Thinking (theses), Research Mission progress, Kai signals, live_event cards, Changed My Mind moments, plus posts from people you follow — one intelligently-ordered stream with visual rhythm (object cards break the text flow), not parallel sections. Composer/likes wall stops being the front door. **Your Circles: DEFERRED until activity justifies it** (density-gated per SOCIAL-OBJECTS S4 — do not expose in this pass).
- **Ticker/Research (make it the best UX in the app):** canonical single scroll — identity header (price · Club Score · watchers) → 4 compact actions (Ask Kai · Watch · Practice · Share) → What changed → Kai's read → What the Club thinks (sentiment/stance/debate) → Best research → Fundamentals → News. Un-bury the social objects from the nested Community tab. Ticker Room living timeline (SOCIAL-OBJECTS S3) lands here.
- **Kai Watch (verify, don't rebuild):** Lane B (in flight) builds the companion screen; on landing, VERIFY against this plan's bar — status board leads, no "Rules/Strategy/Track Record" as top-level tabs (config/history behind gear + secondary), states visible, Kai Daily + updates thread. Residual polish only.
- **Learn (P3 journey UI, already ratified in FIC-LEARNING-WORLD):** Learn Home = journey (streak · level · continue-path large · Today's Review · Market Challenge · Weekly Club Challenge · skill map). Course catalog demotes under "Explore curriculum." Rides the P2 engine now in flight.
- **Family convergence (Sprint 5 — Club through a household lens, not a bolted-on learning portal):** Family Home = family identity header → This Week (one shared challenge) → Family Watch (researching together) → Tonight's Conversation (one question) → Kids' progress viz → family-relevant Club intelligence → Continue Learning. Same components/grammar as Club, family-gold register, family content.
- **FTA (Sprint 6 — professional trading room, not "Discord vibe"):** keep immediacy chat, but inside a Live Desk frame: market status · instructor note · today's setups · current session (a live_event) · trader room chat · latest recordings. Same ticker components, Kai sheets, grammar; metallic register.

## PART VI — SPRINTS (sequenced against Aug 1 marketing / Sept 1 challenge)
- **S0 (prereq, in flight now):** Learning World P2 engine + Kai Watch Lane B land.
- **S1 — Shell grammar (first, fast):** nav map + stable mobile shell, top-bar simplification, universal search, contextual Kai sheet, typography scale, containment rules, tabs/cards/empty-state discipline. One strict grammar doc enforced in code (primitives above).
- **S2 — Club surface continuity:** Home hierarchy pass + Discover editorial + Community→The Club landing + Ticker canonical page, built together so they read as one world.
- **S2.5 — live_event minimal slice:** object + evolving Feed card + Remind Me + recap, wired to the FIVE Sept webinars. (Pre-challenge deliverable.)
- **S3 — Kai Watch verify/polish** (post-Lane-B). **S4 — Learn P3 journey UI** (post-P2).
- **S5 — Family convergence · S6 — FTA Live Desk:** September / post-challenge-start; family and FTA audiences are the most forgiving during the runway.
- Full Live infra (audio rooms, screen-share rooms, Feed→Live, Lounge promotion) = post-challenge, when density exists.

## PART VII — 10/10 BLOCKERS → WHERE RESOLVED
| Blocker (severity) | Resolved in |
|---|---|
| Too many simultaneous social concepts (very high) | Part I — Feed/Lounge/Live as the ONLY exposed social taxonomy |
| Community still feed-first (very high) | S2 (The Club opens into Feed/Lounge/Live) + Part I |
| Learn course-library-first (very high) | S0 P2 engine + S4 journey UI |
| Alerts UI ≠ Kai Watch intelligence (very high) | S0 Lane B + S3 verify |
| Context switching vs seamless flow (very high) | S1 shell + Part I cross-flows + Kai sheet |
| Too many card containers (high) | Part III grammar + S1/S2 |
| Navigation exposes too much structure (high) | S1 (four worlds, one map) |
| Family feels like a different product (high) | S5 |
| Typography/hierarchy too uniform (medium-high) | Part III scale + S1 |

## GUARDRAILS (unchanged, binding)
Register rules (Club volt / Family gold / FTA metallic / Kai blue; NO purple) · kid walls + KID_FEED_READONLY posture · scale floors on every count · no fabricated numbers · additive migrations only · preserve-don't-delete · compliance framing per register policy (Club adult advice-tolerant; FIC strict) · zero-LLM primary paths, LLM = enrichment (live recaps queue when credits are dark) · preview-gate + pixel review + owner review on every design lane · isolated worktrees for all parallel lanes · reserved migration ranges per lane.
