# CURRENT APP INVENTORY — Cheat Code Club (fta-dashboard)

Functional inventory of the shipped app as of 2026-07-28. Feeds the design-project-v2 UI conversion plan.
Scope: WHAT the app does and WHERE. Not code detail. `src/app/cc/` (layout.tsx + cc.css, Barlow Condensed/Kaushan/Instrument Sans/IBM Plex Mono foundation) is a just-started design experiment — excluded from this inventory.

Audience key: **club** = solo adult member · **parent** / **teen** / **kid** = family mode roles · **admin** · **public** = no auth.
Tier key: free / club ($99, DB program `fic`) / fta (upgrade) / challenge (Sept-1 pass) — from `src/lib/tier.ts` + `src/lib/entitlements/`.

---

## 1. Route map

### Entry / public

| Path | Purpose | Audience | Nav placement |
|---|---|---|---|
| `/` | Splash: ∞ mark + sign-in / join doors; signed-in → /dashboard | public | entry |
| `/login` | Email/password sign-in | public | splash door |
| `/signup` | Signup (captures `?ref=` referral) | public | splash door |
| `/signup/invite/[code]` | Family-member invite claim | public | deep link (invite email) |
| `/forgot-password` | Password reset request | public | login link |
| `/onboarding` | Signup wizard: who's joining → experience → knowledge checks → goals → username → avatar → invite kids → celebration | new user | forced post-signup |
| `/onboarding/profile` | Profile questionnaire step (family profile) | new user | wizard step |
| `/auth/callback`, `/auth/confirm`, `/auth/finish`, `/auth/auth-code-error` | Supabase auth plumbing / magic-link landing / error | public | system |
| `/r/[code]` | Referral entry: logs click, sets 90d first-touch cookie, → /signup | public | shared link |

### Free-class funnel (public lead funnel)

| Path | Purpose | Audience | Nav placement |
|---|---|---|---|
| `/free-class` | Free class landing (next session, register CTA) | public/free | free-tier sidebar row |
| `/free-class/register` | Name/email registration | public | funnel step |
| `/free-class/q/[step]` | One-question-per-page qualifying quiz | public | funnel step |
| `/free-class/save` | Save progress / capture | public | funnel step |
| `/free-class/result` | Quiz result page | public | funnel step |
| `/free-class/setup` | Pre-class setup instructions | public | funnel step |
| `/free-class/confirmed` | Confirmation w/ Zoom join info + calendar | public | funnel step |
| `/free-class/vip-offer` | Post-register VIP upsell | public | funnel step |
| `/free-class/challenge` | Free-class → challenge bridge | public | funnel step |

### Challenge machine (Sept 1)

| Path | Purpose | Audience | Nav placement |
|---|---|---|---|
| `/challenge` | → /challenge/hq | public/challenge | deep link |
| `/challenge/hq` | Challenge home; phase decided server-side by `challenge_state()` (pre-season → live) | challenge | challenge shell |
| `/challenge/welcome` | Minute 0: journey provisioning + welcome board | challenge | flow |
| `/challenge/questions` | Minute 2: four get-to-know-you questions | challenge | flow |
| `/challenge/first-win` | Day 0: first artifact in 30 min (pick a company you know) | challenge | flow |
| `/challenge/days/[day]` | One of five day missions (real screener_metrics data) | challenge | HQ |
| `/challenge/vip-success` | VIP purchase success | challenge | checkout return |
| `/challenge/calendar` | ICS calendar feed (route handler) | challenge | confirmation link |

### Checkout / membership

| Path | Purpose | Audience | Nav placement |
|---|---|---|---|
| `/checkout/club` | Custom $99/mo Club checkout (Stripe Payment Element, inline confirm) | public | marketing-site CTA via /api/club/checkout |
| `/checkout/vip` | Custom $197 Challenge VIP checkout (30-day trial sub + ticket), gated by `app_settings.challenge_vip_enabled` | public | challenge "Go VIP" CTA |
| `/club/welcome` | Post-checkout welcome / account claim (reads Stripe session) | new member | checkout return |
| `/club` | Push deep-link bridge → /community (`?live=` → Live tab) | member | push notification |
| `/club/preview` | ClubHome design-review harness (404 in prod) | dev only | none |

### Shop

| Path | Purpose | Audience | Nav placement |
|---|---|---|---|
| `/shop` | Storefront (books/kits catalog) | member (paid tiers) | sidebar footer "Shop" |
| `/shop/[slug]` | Product detail + buy | member | shop |
| `/shop/thanks` | Order confirmation | member | checkout return |

### Ownership cards (NFC public)

| Path | Purpose | Audience | Nav placement |
|---|---|---|---|
| `/c/[serial]` | Public NFC card scan page (dark-premium, theme-independent) | public | physical card tap |
| `/c/[serial]/claim` | Claim a card to an account | public | scan page CTA |
| `/c/about` | What ownership cards are | public | scan page link |

### (dashboard) — member app

Sidebar schemes (from `DashboardSidebar.getNavItems`): **free** Home·Learn·Club·Watchlist + More(News, Practice, Free Class, Join) · **solo club** Home·Discover·Community·Watchlist + Learn/Markets/Account sections + FTA tail · **parent** Home·Discover·Club·Family + More · **teen** Home·Learn·Club·Watchlist + More · **kid** Kids Corner·Learn·Club·Missions + More. Footer: Shop/Help/Settings/Admin. Mobile: 5-slot tab bar (Home·{Discover|Learn}·Club·{Watchlist|Family|Missions}·You); Kai = floating FAB (adults).

| Path | Purpose | Audience | Nav placement |
|---|---|---|---|
| `/dashboard` | Home — persona-composed: ClubHome (solo), FamilyProfileHome, kid Kids Corner, FreeHome + journey checklist | all | primary "Home" |
| `/discover` | Discovery hub: For you · Screener · Trending tabs; rising fast, most divisive, black-belts-watching, newsroom foot | club/parent (teen in More) | primary slot 2 |
| `/community` | The Club — Feed / Lounge / Live modes; posts, ticker tags, mentions, pinned announcements | all (free read+post) | primary "Club" |
| `/community/compose` | Full-page post composer (ticker tags, position disclosure) | member (not kid) | from feed |
| `/community/changed-my-mind` | Club-wide public stance-flip feed w/ RESPECT reaction | member | Club subnav |
| `/circles` | Club Circles — 30-day breakout rooms around one thesis/event | club/parent/teen (kids read-only via RLS) | Club subnav |
| `/circles/[slug]` | One circle: notes, members | member | circles |
| `/watchlist` | Private watchlist (family board in family mode, "My Watchlist" solo); notes, votes | all | Watchlist subnav |
| `/watchlist/community` | Community Board — communal wiki-style watchlist + like counts + performance | all (free = upsell-capped) | Watchlist flagship |
| `/news` | Club Newsroom — AI-narrated market recaps + ticker events; free-visible | all incl. kids | top-level "News" |
| `/news/[slug]` | Single article | all | news feed |
| `/kai` | Ask Kai — AI research analyst chat, threads, memory; age-aware for kids | all members (never free-tier full) | kid More row; adults = Kai FAB |
| `/screener` | Stock screener (full universe, saved screens, NL search); kid wall variant | all (free = basic filters) | Markets section / Discover tab |
| `/research/[ticker]` | Ticker research: fundamentals, grades, charts, news, social, Kai report, stances | all (free = 3 reads/wk) | deep link from watchlist/screener/feed |
| `/research/thesis/[id]` | Published Research Object (structured thesis) detail | member | deep link |
| `/alerts` | Trade Alerts hub (C6): briefing + personalized rules engine; ADULTS ONLY (kids/teens redirected; free = LockedState) | club/parent adults | Markets section "Alerts" |
| `/alerts/e/[id]` | One alert event detail | adult member | alerts feed / push |
| `/chart` | Practice Chart (lightweight-charts ticker screen) | all | Practice subnav |
| `/simulator` | Paper-trading simulator (portfolios, positions, trades) | member (not young kids; free locked) | Practice subnav |
| `/simulator/simbot` | Embedded Simbot price-action sim (same-origin iframe) w/ XP awards | member | simulator tabs |
| `/simulator/lessons`, `/simulator/lessons/[scenarioId]` | Guided sim scenarios, scored | member | simulator tabs |
| `/games` | Training Room — games index w/ record | all | Practice subnav |
| `/games/candle-battle` | Candle Battle game (XP on ≥70% accuracy) | all | games |
| `/games/trend-or-trap` | Trend-or-Trap game | all | games |
| `/courses` | Learn hub ("Grow your edge"): journey/classes/missions rail; free sampler + tier locks + kid variant | all | primary/More "Learn" |
| `/courses/[slug]` | Course detail (modules) | member | courses |
| `/courses/[slug]/[moduleId]/[lessonId]` | Lesson player: video/steps, quizzes, resources, XP on complete | member | course |
| `/start-here` | Orientation checklist (broker, first steps) w/ celebration | adult member | Learn subnav |
| `/flashcards` | Flashcard sets ("My Cards" for kids), spaced reviews, XP | all | Learn subnav |
| `/live-sessions` | Live classes: schedule, RSVP, join links, recordings | all (free = preview) | Learn subnav "Live Classes" |
| `/missions` | Kid Missions quest set (weekly missions, XP rewards) | kid (parents can view) | kid primary / More |
| `/leaderboard` | Unified belts leaderboard, tri-period windows, animated rank moves | all incl. kids | Account section / More |
| `/belts` | Belt rank ladder (White→Black), share-of-club, "you are here" | all | Account section / More |
| `/progress` | Profile "You" surface: ring avatar, XP/level, streak, badges, positions | all ("My Badges" for kids) | primary slot 5 / More |
| `/u/[username]` | Public member profile: belt, tier, badges, stances | member | deep link from feed |
| `/referrals` | Refer-a-friend: code, link, event tracking | member | Account / Family subnav |
| `/collection` | Ownership Cards shelf (digital twins) | club adult | Markets section "Collection" |
| `/collection/[id]` | One card detail (events, seal, transfer) | owner | collection |
| `/collection/mint` | Mint an Ownership Card flow | club adult | collection CTA |
| `/vip-room` | Challenge VIP private room (intro + feed + composer); non-VIP see pitch | challenge VIP | orphan (challenge links/push) |
| `/pricing` | Canonical 3-tier pricing matrix (driven by entitlements source of truth) | all | upsell links |
| `/upgrade` | Join-the-Club / FTA upgrade pitch | free/fic parents+solo | FTA locked teaser, free "Join the Club" |
| `/help` | Help desk: AI chat + ticket escalation | all | footer "Help" |
| `/settings` | Settings: profile, theme, family activation (#family), notifications, billing portal | all | footer "Settings" |
| `/picks`, `/picks/[id]` | RETIRED Team Picks → redirects to /watchlist/community | — | legacy redirect |
| `/parent-corner` | Redirect → /family/corner | — | legacy redirect |

### (dashboard) family mode (parents unless noted)

| Path | Purpose | Audience | Nav placement |
|---|---|---|---|
| `/family` | Family hub landing | parent | primary "Family" |
| `/family/overview` | Overview + kid report cards | parent | Family subnav |
| `/family/members` | Manage members, invites, avatars | parent | Family subnav |
| `/family/corner` | Parent Corner (guides, conversation prompts) | parent | Family subnav |
| `/family/tonight` | Run Family Night — whole evening on one route (votes → winner one-pager → discussion), XP | parent+kids together | from family surfaces |
| `/family/night` (api-backed) | see /api/family/night | — | — |
| `/family/watchlist` | Family watchlist w/ votes | family | watchlist "My Family" |
| `/family/circle` | Family private chat circle + paper-trading standings | family | family surfaces |
| `/family/learn` | Family learning surface | parent | family surfaces |
| `/family/live` | F7 family live class strip w/ attendance reward | family | family surfaces |
| `/family/leaderboard` | Intra-family leaderboard | family | family surfaces |
| `/family/teen/[memberId]` | Parent view of one teen | parent | members |
| `/family/teen/[memberId]/progress` | Teen progress detail | parent | teen view |
| `/family/teen/[memberId]/guardrails` | Teen guardrail settings (what teen can do) | parent | teen view |

### (dashboard) FTA hub (gold, fta tier only; FIC parents see locked teaser)

| Path | Purpose | Audience | Nav placement |
|---|---|---|---|
| `/fta/chat` | FTA Traders chat room (realtime, belt-colored names, true-dark) | fta adults/teens | FTA gold section |
| `/fta/courses` | FTA course library | fta | FTA section |
| `/fta/recordings` | FTA session recordings | fta | FTA section |

### (admin) — role `admin` only, own layout

| Path | Purpose |
|---|---|
| `/admin` | Admin dashboard landing |
| `/admin/users` | User management, invites, view-as |
| `/admin/courses`, `/admin/courses/[courseId]` | Course/module/lesson CMS |
| `/admin/learn-drafts` | Draft stepped-lesson review |
| `/admin/live-sessions` | Schedule live sessions + live events |
| `/admin/announcements` | Post/pin announcements + broadcast push |
| `/admin/community` | Feed moderation |
| `/admin/community-watchlist` | Community board curation |
| `/admin/picks` | Legacy team picks admin |
| `/admin/fic-weeks` | Weekly FIC content ("This Week") |
| `/admin/coach-demos` | Coach demo video management |
| `/admin/shop` | Shop products + orders |
| `/admin/crm` | CRM home |
| `/admin/crm/members`, `/admin/crm/members/[userId]` | Member CRM + detail |
| `/admin/crm/families/[familyId]` | Family CRM detail |
| `/admin/crm/leads` | Marketing leads (incl. FB leads) |
| `/admin/crm/pipeline` | Sales pipeline |
| `/admin/crm/funnel` | Funnel analytics (funnel_sessions/events) |
| `/admin/crm/campaigns` | Email campaign sends |
| `/admin/crm/drips` | Drip sequence management |
| `/admin/crm/challenge` | Challenge cohort CRM |
| `/admin/crm/support` | Help-desk ticket queue |

**`src/app/cc/`** — just-started design experiment (layout + css foundation only); not part of the shipped app.

---

## 2. Feature surface per major area

### Home (/dashboard)
- Persona-composed server-side: solo ClubHome, family FamilyProfileHome, kid Kids Corner, FreeHome
- ClubHome: pulse masthead, "This Week in FIC" tab, for-you modules (`/api/club/home`, `/api/club/foryou`), Kai Brief "what changed since I left" (club-gated)
- Free home: journey checklist (free_journey), locked-module teasers, upgrade CTAs
- Milestone alerts, upsell cards, first-run hints, app tour (versioned, `data-tour` targets)

### Watchlist
- Community Board: communal watchlist, add/like tickers, like milestones, performance tracking, comments
- Private board: personal (solo) or family board w/ per-member votes + notes
- Active-monitoring cap: free = 5 active tickers (rows preserved, monitoring paused) — club unlimited
- Watch states / watch canvas (migrations 157/195): per-ticker watch status lifecycle
- Ticker tiles link into /research/[ticker]

### News
- AI-generated market wrap + per-ticker event articles (cron), kind tabs, ticker filter
- Free-visible on every tier incl. kids; personalized-to-watchlist news is club-gated

### Ask Kai
- Streaming chat w/ threads, per-user memory (view + clear), age-aware personas (kid/family-adult/club)
- Free = 3 msgs/day metered; club = full limits; deep research mode (`/api/kai/deep-mode`) club-gated
- Kai FAB floats on adult club surfaces; kids reach via nav row
- Kai reports per ticker (admin-ingested via `/api/admin/kai-report`, surfaced on research tab)

### Screener
- Full-universe metrics table (cron-refreshed via Polygon), sector filters, sort, saved screens
- Natural-language screen builder (`screener-nl`, AI) — club-gated; free = basic filters
- Kid wall variant (migration 137); embedded as Discover tab and standalone route

### Kid Missions
- Weekly quest set w/ XP rewards, completion tracking (fic_missions/mission_completions)
- Kid-curated loop: no upsells, no FTA, read-only circles, sentiment stripped on research

### Learn / lessons
- Courses → modules → lessons; video player + stepped lessons (lesson_steps) w/ per-step progress
- Quizzes (pass/perfect XP), lesson resources, skills + skill mastery mapping
- Free sampler courses; full library club-gated; kid-worded variant; FTA library separate
- Start Here orientation checklist; flashcard sets w/ reviews + XP

### Practice / simulator
- Practice Chart (lightweight-charts, Polygon bars)
- Paper simulator: portfolios, positions, trades, equity snapshots; advanced stats club-gated
- Simbot iframe sim w/ XP bridge; scored guided scenarios (sim lessons)
- Games: Candle Battle, Trend-or-Trap; XP at ≥70% accuracy, game scores stored

### Alerts (Lane C6)
- Trade alert briefing feed + per-member rules engine (alert_rules, strategy profiles)
- Kai Watch: natural-language alert rule creation (`/api/kai-watch/parse`, AI) — club-gated
- Setup lifecycle + per-setup subscribe; intraday + EOD cron evaluation; push + email digest
- Adults only (kids/teens hard-redirected); free sees LockedState

### Leaderboard / gamification
- Tri-period leaderboards (RPC-backed), animated rank movement, kid-inclusive
- Belts page (5-belt ladder w/ degrees), badges + badge case, streaks, family XP average
- Public profiles at /u/[username] w/ belt/tier/badges

### Community
- Feed: post w/ ticker tags + position disclosure, like, comment, @mentions (+@everyone admin), pinned announcements, media uploads
- Lounge chat rooms (realtime); free lounge; Live tab (go-live rooms via push deep link)
- Changed My Mind stance-flip feed w/ RESPECT reactions; ticker stances + debates (votes, arguments)
- Circles: 30-day breakout rooms w/ notes + membership; contribution respect scores
- Free tier: full read + post/react/comment (deliberately ungated — "the crowd is free")
- Kid feed read-only; profanity filter; XP on first 3 posts/day

### Live sessions / classes
- Schedule, RSVP (+XP), reminders, join links (Zoom URLs), state tracking, recordings (+XP)
- Live events (webinars) w/ interest capture + go-live push; host assignment; free = preview/replay clips

### FTA hub
- Traders chat (realtime, belt-colored usernames on true-dark), course library, recordings
- fta tier only; gold hard-split identity; FIC parents get /upgrade teaser; kids never see it

### Family mode
- Household: parent/child profiles, invites, avatars, age groups; solo-vs-family mode derivation
- Report cards (child stats), teen guardrails (parent-set permissions + event log), teen progress views
- Family watchlist w/ votes, family circle chat + paper standings, family leaderboard, family live class
- Family Night: one-route guided evening (vote winner → one-pager → questions) w/ XP
- Family activation is club-entitled; solo members activate via Settings#family

### Collection / ownership cards
- Mint digital-twin ownership card (card = title, not bearer), card events, snapshots, score
- Transfer flow (offer/accept/decline/cancel); NFC chip pairing; public scan page + claim; seal (SnapTrade verify = stub)

### Challenge machine
- Cohort-based, server-clocked phases (`challenge_state()`); pre-season HQ, welcome→questions→first-win, 5 day missions w/ beats + step completions
- Artifacts, activity days, push log, email sequences (cron), pass expiry, source attribution, VIP tier ($197) w/ private VIP room

### Shop
- Catalog (products + bundles), Stripe checkout, order tracking; Shopify variant fulfillment (textbook, kids bundle) + Lulu print-on-demand (sandbox, degrades to manual)
- Hidden from free tier; admin product/order console

### Admin
- Full CRM (members, families, leads, pipeline, funnel, campaigns, drips, challenge cohorts, support tickets)
- Content CMS (courses, draft lessons, FIC weeks, announcements, coach demos), community + watchlist moderation
- Live-session scheduling, shop management, user invites, view-as impersonation, broadcast push

### Onboarding / tour
- Gamified one-question-per-page signup wizard for every entry path (funnel, invite, Stripe claim)
- Comprehension checks, avatar picker, versioned app tour, first-run flags, new-member hints

### Membership gating
- Single source of truth `src/lib/entitlements` (`can()`, FEATURE_ACCESS, PRICING_MATRIX drives /pricing)
- 18 gated features (club_intel, trending_full, kai_watch, research_unlimited, screener_full, family_activation, fta_section, …)
- Free meters: 3 research reads/week, 5 active watchlist tickers, 3 Kai msgs/day; downgrade = preserve, never delete
- Kid/teen age walls compose with (never merge into) tier gates; contextual walls + LockedState/FreeLocked components

---

## 3. Backend surface

### Supabase tables (154, from supabase/migrations — 134 files, 001→205)

- **Auth/profiles/family**: profiles (role parent/child/coach/admin; age_group kids/teens/adults), families, family_profiles, family_invites, family_watchlist, family_watchlist_votes, family_circle_messages, family_guardrails, family_guardrail_events, family_night_sessions, family_activity_days
- **Membership/tier**: enrollments (program fic/fta ⇒ family_tiers view), programs/cohorts (013), pending_memberships, app_settings
- **Learning**: courses, modules, lessons, lesson_progress, lesson_resources, lesson_steps(+draft), lesson_step_progress, lesson_skills, skills, skill_mastery, quizzes, quiz_attempts, tests, test_attempts, flashcards, flashcard_reviews, orientation_progress, coach_demos, class recordings (026)
- **XP/gamification**: xp_events, badges, badge_awards, user_badges, game_items, game_scores, sim_equity_snapshots, streak/leaderboard RPCs (099, 118)
- **Simulator**: sim_portfolios, sim_positions, sim_trades, sim_scenario_scores
- **Community**: feed_posts, post_likes, post_comments, chat_rooms, chat_room_members, chat_messages, announcements, notifications, notification_email_queue, push_subscriptions, admin_broadcasts, vip_room_posts
- **Social/stances**: ticker_stances, stance_events, ticker_sentiment, ticker_like_counts, ticker_like_milestones, debates, debate_votes, debate_arguments, debate_argument_votes, object_reactions, club_circles, club_circle_members, club_circle_notes
- **Watchlist/market**: community_watchlist, community_ticker_comments, watchlist_notes, watch_states, ticker_snapshots, ticker_intel_snapshots, asset_prices, club_trending, club_metrics_kv, club_events, club_clock_notices
- **Research**: research_objects, research_object_comments, research_object_updates, research_fundamentals, research_reads (free meter), news_articles, kai_reports
- **Kai**: kai_chat_threads, kai_chat_messages, kai_user_memory, ai_conversations, ai_messages, coach_conversations
- **Screener**: screener_metrics, screener_meta, screener_history, screener_saved_screens
- **Alerts**: trade_alerts, alert_rules, alert_events, alert_prefs, alert_setups, setup_subscriptions, strategy_profiles
- **Challenge**: challenge_cohorts, challenge_members, challenge_days, challenge_beats, challenge_beat_progress, challenge_step_completions, challenge_questions, challenge_question_options, challenge_answers, challenge_artifacts, challenge_activity_days, challenge_sequences, challenge_push_log, challenge_pass_notices, challenge_vips
- **Ownership cards**: ownership_cards, card_events, card_snapshots, card_transfers, nfc_chips
- **FIC content**: fic_weeks, fic_picks (retired surface), fic_missions, mission_completions, pick_likes, pick_comments
- **Live**: live_sessions, live_events, live_event_interest, session_rsvps
- **Funnel/CRM/marketing**: funnel_sessions, funnel_events, free_class_registrations, free_journey, marketing_leads, marketing_lead_events, marketing_campaigns, marketing_sends, contact_comms, email_drips, drip_schedules, drip_optouts, admin_notes, report_notes, help_tickets, help_messages, referral_codes, referral_events, unified contacts (080)
- **Shop**: shop_products, shop_bundle_items, shop_orders, shop_order_items

### API routes (104 under src/app/api + 4 handler routes elsewhere)

- **club/** (14): home, foryou, brief, today, pulse, trending, collective, intel/[ticker], thinking, debate(+vote), people, track, refresh, invite, checkout — the Club Intelligence layer + Club checkout
- **kai/**: chat (streaming), deep-mode; **kai-watch/parse** (NL→alert rule); **coach/** chat + transcribe (voice)
- **alerts/**: ingest, setups(+subscribe), test-fire
- **market/** (6): quote, bars, news, search, company, logo (Polygon proxies)
- **research/[ticker]**, **social/research**, **search** (command-K universal search), **members/handles** (mentions)
- **challenge/** (6): register-email, complete-account, context, continuation, vip-checkout, vip-room
- **free-class/** (7): register, reserve, next, session, status, save, event
- **checkout/confirm**, **billing/portal**, **stripe/webhook**, **shop/** checkout + webhook + admin orders/products
- **ownership/** (14): mint, claim, collection, score, card ops (seal), transfer lifecycle, tap/[serial], public/[serial], cron
- **family/night**, **report-card**
- **live/**: list, [id], [id]/state, [id]/remind
- **push/**: dispatch, resubscribe, email-fallback
- **cron/** (13): evaluate-alerts (+intraday), alerts-digest, refresh-screener, news-market-wrap, news-ticker-events, track-performance, club-clock, live-events, challenge-day-push, challenge-sequences, expire-challenge-passes, drip-welcome (CRON_SECRET-guarded)
- **admin/**: invite, view-as, support, kai-report
- **marketing/**: campaigns/send, contacts/send, fb-leads (webhook), fb-config, unsubscribe; **drips/unsubscribe**
- **auth/**: password-status, reset; **help/chat**
- Handler routes: `/auth/callback`, `/auth/confirm`, `/r/[code]`, `/challenge/calendar` (ICS)

### RPCs / DB functions of note
- `challenge_state()` — server-clocked challenge phase
- Perf aggregate RPCs (038), XP leaderboard RPCs (099), belt batch (118), home_state, free quotas (204) — exact list in migrations; unverified individually

### External integrations (actually wired)
- **Stripe** — Club $99 sub, VIP $197 (trial sub + ticket), shop orders, billing portal, 3 webhooks; custom Payment Element checkouts
- **Supabase** — auth, Postgres, RLS, storage, Realtime (project zvkercqohmmeyofycbgr)
- **Polygon** — quotes, bars, news, company data, screener universe refresh
- **Anthropic** — Kai chat/deep-mode, help chat, coach, news generation, Kai Watch NL parsing, screener NL
- **OpenAI** — coach voice transcription (Whisper)
- **Resend** — auth emails, drips, marketing campaigns, push email fallback
- **Twilio** — SMS in marketing lib only (single touchpoint; token currently down per ops)
- **web-push (VAPID)** — browser push: alerts, go-live, challenge day pushes, broadcasts
- **Shopify Admin API** — physical fulfillment variants (textbook, kids bundle)
- **Lulu Print API** — print-on-demand textbook (sandbox; degrades to manual fulfillment)
- **Facebook Lead Ads** — fb-leads webhook → marketing_leads
- **SnapTrade** — STUB (providers.ts; seal verification no-op until consumer key)
- **Zoom** — join URLs only (free class, live sessions); no SDK embed in this app

### Realtime
- `useChatRoom` — chat rooms (Community Lounge, family circle) via Supabase Realtime channels
- `FtaChatRoom` — FTA Traders chat channel
- `NotificationsBell` — live unread notifications
- Community realtime RLS hardened in migrations 019/039/040

### XP / belts / streaks
- XP awards: lesson 50, quiz pass 30 (+20 perfect), flashcards 20, game 10 (≥70% acc), community 5 (cap 3/day), RSVP 5, recording 5; de-dupe guards per action
- 7 levels (Explorer→Playbook Pro) skinned as 5 belts w/ degrees (White→Yellow→Blue→Purple→Black); belt colors intrinsic (theme-independent)
- Tri-period leaderboards, streak lib, badges, family XP average; leaderboard exclusions list

### Auth + profiles
- Supabase email auth + invite claims; roles: parent / child / coach / admin; age_group: kids / teens / adults
- Family = households (families + family_profiles); tier lives on family via enrollments; every member inherits
- Tier: free / fic (=Club $99) / fta; Mode (display axis): individual "Cheat Code Club" vs family "FIC — part of Cheat Code Club", derived from solo-household check
- Admin view-as impersonation; challenge pass = time-boxed access (cron-expired)

---

## 4. Design system today

- **Theme**: light-primary "warm paper" + warm-charcoal dark, all in `src/app/globals.css` (2,159 lines, Tailwind v4 `@theme inline` → raw CSS vars, flipped by `data-theme` on `<html>`)
- **Mode axis**: `data-mode="club|family|fta"` (ModeManager) re-skins same components — family = warm paper + gold; club = sand + volt orange (#FF6A00) + teal + Kai blue; fta = metallic gold. The whole `gold-*` ramp remaps to volt in club mode (zero component edits); `ftagold-*` and `.chip-metal-gold` are constant
- **Tokens**: `midnight-*` surface/text ramp (inverted: 950 = page bg), `night-*` = only true darks (charts/film), `--accent`/`--accent-solid` semantic accent, belt hexes inline (intrinsic)
- **Fonts** (root layout, next/font): Sora (display), Inter (body/sans), IBM Plex Mono (market data), Kaushan Script + Caveat (script accents); mapped via `--font-display/body/mono` in `tailwind.config.ts`
- **Depth of embedding**: deep — shared `DashboardShell` + `DashboardSidebar` + `DashboardTopBar` (CommandSearch, bell, belt chip, avatar) + `MobileTabBar` + Kai FAB wrap every (dashboard) route; newer surfaces built from board-language primitive kits (`f0/`, `club2/`, `canvas2/`, `clubhome/`, `family/canvas`, `you/parts`) with house classes (`.club-b-card`, `.club-b-warm`, `.cta-button`, `.shadow-soft`); COLOUR-LAW rule: no generic card-grid containers on new surfaces
- **Motion**: framer-motion via LazyMotion `m` wrapper (`src/lib/motion`); charts via lightweight-charts

---

## Count summary

- **124 page routes** (+8 non-API route handlers) across (dashboard) / (admin) / (auth) / challenge / free-class / club / shop / checkout / c / r
- **104 API routes** under src/app/api (incl. 13 crons)
- **154 Supabase tables** across 134 migration files (001→205)
- **3 tiers** (free/club/fta) × **2 modes** (individual/family) × **4 member roles** (parent/child/coach/admin) × **3 age groups**
- **13 external integrations** wired (1 stub: SnapTrade)
