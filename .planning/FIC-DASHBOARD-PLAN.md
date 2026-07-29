# FIC Dashboard Plan (owner-locked 2026-07-20)

Positioning: FTA dashboard = "learn trading skills, complete the six-week program." FIC dashboard = "every week your family learns one money concept, studies one company, completes one mission, builds a family investing habit." FIC feels like family wealth classroom + weekly investing club + parent/kid operating system, NOT trading school.

## Access model (owner decision)
- FTA families: FULL access to everything — all courses, all community rooms, all class types, plus every FIC feature. Nav = FTA program nav + "Family Investing Club" section.
- FIC families: FIC courses (foundations), FIC community chat, games, flashcards, and all club features below. No FTA advanced courses/sessions.
- Community: split into rooms — "FIC Club" room + "FTA" room (chat_rooms table exists; single global room today). FIC sees FIC room only; FTA sees both. RLS: keep policies SIMPLE (018/019 scars — no recursive/subquery realtime policies).
- Implement via existing src/lib/tier.ts TIER_ACCESS matrix extension.

## MVP scope (owner-locked)
1. **Start Here / Orientation** — mandatory checklist, persistent home card until complete, per-family tracked:
   watch orientation (embed existing deck) → intro post in community → open your accounts (guide page: custodial/brokerage education framing, no broker-pushing; weekly contribution amount is each family's PERSONAL decision made on their own — the guide mentions the habit, the platform does NOT collect an amount) → add first 3 companies to watchlist → RSVP first live class → complete first kid mission. Education-first / no-live-trading-pressure language lives here.
2. **This Week in FIC** — subtab on the dashboard home (not separate page). AUTHORED BY ADMIN LOGIN (admin form; no agent-drafting for MVP). Weekly record: class title/link, featured stock, family assignment, parent prompt, kid challenge, + Company of the Week folded in with breakdown template (what they do / how they make money / why customers love them / why investors watch / what could go wrong / family discussion question / watchlist assignment). One weekly record feeds home card, Parent Corner, kid challenge.
3. **Family Watchlist** — the family research board:
   - Add: any member; search name/ticker or one-tap from Company of the Week / Big Book (pre-filled). Conversational add-flow questions, kid-simpler phrasing. Adder = CHAMPION (avatar on card).
   - STATUS LADDER (the teaching mechanic): Watch → Study → Favorite/Avoid. Everything enters Watch. Study opens research card (how they make money, one strength, one risk, trend). Favorite/Avoid LOCKED until research card complete — no verdicts without homework.
   - Card: name/ticker, status chip, trend tag, champion, family-words thesis (bull/bear), timestamped notes stream (anyone adds), price sparkline via FREE TradingView mini symbol widget (no market-data key), "Open in Practice Chart" deep link.
   - Views: board grouped by status columns; filter by trend/member/in-Big-Book.
   - Hooks: Company of the Week "add to watchlist"; Brand Detective mission completes via watchlist adds → XP; Favorites later feed practice portfolio ("promote" = phase 2 bridge).
   - Permissions: family-scoped RLS; anyone adds/annotates; champion + parents edit/delete.
4. **Parent Corner** — parent-role-gated; weekly content rides the fic_weeks record (what your child learned, dinner questions, explain-simply, what not to do, risk talk, patience) + evergreen guidance sections.
5. **Kid Missions** — playful mission cards, per-kid completion + XP (existing xp.ts). Seed the 5 owner missions: Brand Detective, Snack Stock, Money Machine, Stock vs Product, Family CEO.
6. **Live Classes** — add class_type (weekly family stock class / guest speaker / orientation / parent Q&A / kids money lab / market recap) + worksheet_url + assignment to live_sessions; grouped UI. Builds on shipped recordings system.
7. **My Progress** — FIC reframe of existing page (missions done, classes attended, watchlist contributions).
8. **Practice Chart** — full-screen TradingView Advanced Chart widget (free public embed, no license/key; small TV branding accepted). Warm-paper theme, deep-linkable ?symbol=, kids default line-chart preset, teens/parents candles. Lives in practice area; linked from watchlist + Company of the Week.
9. **FIC nav**: Home · Start Here · This Week · Live Classes · Family Watchlist · Kid Missions · Flashcards · Games · Community · My Progress · Parent Corner · Settings. (Sections added as they exist — no dead links.)

## Deferred (owner-ratified)
- Guest Speaker Vault: SKIPPED for now (class_type data makes it a cheap filtered view later, once 2-3 guest replays exist).
- Standalone Company of the Week dossier page (merged into This Week for MVP).
- Family Portfolio Simulator retrofit (family-shared, $10k, S&P compare, monthly review) — existing simulator stays as-is for now; safe language ("practice portfolio", "educational simulator", "no live money") applies everywhere already.
- FIC flashcard categories + kid-version definitions (Money Dictionary) — fast-follow, content work.
- ~~Family Badges~~ → PROMOTED TO BUILD (owner 07-20): badge names are PROFESSIONAL IDENTITY TITLES, not playful scout names (owner: "'investor', 'analyst' etc"). 6 seed badges: **Scout** = add 5 companies to watchlist · **Analyst** = complete research cards on 3 companies · **Risk Manager** = identify risks on 5 stocks · **Investor** = complete 4 weekly classes · **Technician** = complete beginner chart lesson · **CEO** = complete the Family CEO mission. Simple criteria checks in lib/badges.ts fired from action sites, badge case on profile/family pages. Visual: credential/title-card energy (think earned rank), not cartoon badges.
- ALSO PROMOTED (owner 07-20): onboarding avatar + username step — preset avatar packs generated via Higgsfield for adults/teens/kids (consistent illustrated warm-paper style, ~10 per group, stored in public/avatars/), pick-avatar + set-display-name step in onboarding, changeable in Settings, avatars render everywhere initials do today; @mention resolution must keep working with display names.
- Starter Kit Hub — build when physical kit contents are final.

## Build notes
- Migration numbers: next free = 031 (026 recordings, 027 media, 028 notifications, 029 tiers, 030 home-state fix).
- Design system: warm-paper (midnight-* ramp INVERTED to light), gold accents, Poppins/Inter; match existing pages.
- Route contract: /start-here, /watchlist, /missions, /parent-corner, /chart; This Week = subtab on /dashboard; live classes stay /live-sessions.
- Contended files if built in parallel: DashboardSidebar.tsx, dashboard/page.tsx, community/page.tsx — single owner per file.
- STATUS: PLAN LOCKED, BUILD NOT STARTED — awaiting owner go.
