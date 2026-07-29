# CHEAT CODE APP CONVERSION PLAN v1
**2026-07-28 · Turn the shipped app into the mockup format — keep every function, wire everything real.**
Inputs: `CURRENT-APP-INVENTORY.md` (124 routes · 154 tables · 104 APIs) + `MOCKUP-CAPABILITY-AUDIT.md` (23 artboards + 6 sibling canvases). Read those first; this doc is the synthesis.

---

## 0. The strategic frame

1. **The mockup family already solves the light-vs-dark tension.** `App.dc` (dark) and `App Light.dc` are the SAME 23 screens in two themes. The shipped app already has a `data-theme` axis. So the conversion is not "kill the light system" — it's **re-token both themes to the mockup pair**: dark canvas = dark theme, Light canvas = light theme. The 07-27 light redesign's structure (shell, primitives, COLOUR LAW discipline) survives; its token values and type voices are replaced.
2. **The `data-mode` axis survives.** club / family / fta re-skinning stays exactly as architected. The Family canvas (9 boards) is the family-mode register; FTA keeps metallic gold (no mockup — brief below); club mode = the primary canvas.
3. **UI conversion never waits on new backend.** Every artboard element that maps to a MISSING capability ships in v1 rendering **existing data** (e.g. the signal ring shows raw sentiment % until the weighted engine exists; "watching now" appears when presence lands). The visual system converts on schedule; capabilities light up behind it.
4. **One coupled loop drives the new backend work** (from the audit): call grading → belt engine → influence weight → weighted signal → Kai consumes signal. It gets built as one sequenced track (Phase W below), not as scattered features.
5. **Nothing is lost.** All 124 routes are mapped in §2: each converts to an artboard, adopts an artboard's pattern, or gets a missing-mockup brief (§4). Zero routes deleted; legacy redirects stay.

---

## 1. Gap matrix — mockup capability × current backend

Status key: ✅ HAVE (wire the new UI to it) · 🟡 PARTIAL (exists, shape differs — adapt) · 🔴 MISSING (new build) · ⚠️ DECISION (owner call before build)

### Opinions / conviction
| Capability | Status | Current asset → gap |
|---|---|---|
| Opinion entity (stance + ticker + prose + media) | 🟡 | `ticker_stances` + `feed_posts` exist separately; mockup treats one atomic "take." Adapter: join stance to post at composer; keep both tables. Club Screens 05 composer spec (stance selector, post types, drafts) = the target composer. |
| Changed-my-mind revisions | ✅ | `/community/changed-my-mind` + `stance_events` + RESPECT — near-exact match; re-skin + surface counters in room/watch/profile per boards 05/06/07. |
| Call grading vs price outcome | 🔴 | `track-performance` cron grades community-watchlist picks only. New: per-member graded-call job (stance → % move over window → ✓/✗). Root of the whole loop. |
| Influence attribution ("382 influenced / 47 minds changed") | 🔴⚠️ | No analog. Needs a definition (what credits a flip?) before any build. Defer to W4. |
| Composer w/ post types | 🟡 | `/community/compose` has ticker tags + position disclosure; add stance selector + Thesis/Risk/Chart/CMM types + drafts. |

### Signals / aggregation
| Capability | Status | Notes |
|---|---|---|
| Raw sentiment per ticker | ✅ | `ticker_sentiment` + stances. |
| **Weighted signal (the 78% ring)** | 🔴 | Needs influence weights (belt/accuracy) → new aggregation job. Ships behind raw sentiment until W2. |
| Daily snapshots + shift deltas | 🟡 | `ticker_intel_snapshots`/`club_trending` exist; add per-day sentiment snapshot + delta queries. |
| Belt-cohort aggregation ("88% of Black Belts") | 🔴 | Small job once graded belts exist. |
| Attention ranking + acceleration ("rising fast", "quiet to loud") | 🟡 | `club_trending` + club metrics exist; add 24h growth % + z-score acceleration rollups. |
| Divisiveness metric | 🔴 | Trivial computation over existing stances. |
| Circle/room-scoped sentiment series | 🔴 | New, scoped stance events (W3). |

### Circles
| Capability | Status | Notes |
|---|---|---|
| 30-day time-boxed circles | ✅ | `club_circles` already 30-day breakout rooms w/ members + notes. Strong match. |
| Category taxonomy + event anchor | 🟡 | Add columns + earnings/Fed calendar linkage. |
| Expiry "receipts get graded" job | 🔴 | Depends on call grading (W1). |
| Pinned thesis w/ grade date | 🔴 | New entity, small. |
| Channels (#takes/#charts/#receipts) + chat | 🟡 | `chat_rooms`/`chat_messages` (realtime, belt-colored) exist for lounge/FTA — instantiate per-circle channels on same infra. |
| 🔊 voice channel | 🔴⚠️ | New media infra. Recommend descope v1 (text + the Live room cover it). |
| Kai bot auto-posts (sentiment deltas) | 🔴 | Cron + system-author messages; needs circle-scoped sentiment. |
| Hosting rights + quotas (Free=1) | 🟡 | `entitlements` SoT exists — add flags. |

### Live rooms
| Capability | Status | Notes |
|---|---|---|
| Scheduled rooms, RSVP, go-live push, recordings | ✅ | `live_sessions`/`live_events` + push + recordings. |
| In-app stage (video, active speaker) | 🔴⚠️ | Today = Zoom join URLs. The standing architecture decision (Zoom Meeting SDK embed + custom Supabase chat) is exactly board 05's shape — implement it here. |
| In-room sentiment poll + series + mind-change counters | 🔴 | New room-scoped votes on realtime channel. |
| Live reactions + activity stream | 🟡 | Realtime chat exists; add typed reaction events + activity rows. |
| Replays (Pro) | 🟡 | Recordings exist; build replay library surface + entitlement. |

### Kai surface
| Capability | Status | Notes |
|---|---|---|
| Per-ticker verdict (daily, confidence, falsification conditions) | 🟡 | `kai_reports` admin-ingested → convert to scheduled generation job w/ verdict taxonomy + confidence + stored invalidation conditions (which the condition engine then monitors). |
| Kai insights injected into feed/circles | 🔴 | New system-post pipeline (reuse news-generation plumbing). |
| Daily personalized alert batch (BUY/SELL/HEADS-UP + evidence chips) | 🟡 | C6 is most of this: `trade_alerts`+`alert_rules`+briefing+push+digest. Add typed cards, entry/invalidation fields, evidence chips (club-shift chip needs snapshots). |
| "…and positions" (holdings-aware alerts) | ⚠️ | Only brokerage mention in canvas. SnapTrade is a stub pending consumer key. Descope: ship watchlist-only; light up when SnapTrade lands (ownership-cards lane shares the key). |
| Condition engine w/ live measured values | 🟡 | C6 setups + intraday/EOD evaluation exist. Add: current-value surfacing (not just booleans), club-sentiment-delta condition type, per-setup notify prefs (partially in `alert_prefs`). |
| "Est. Trigger: Today" | ⚠️ | Implies a prediction model. Descope v1 → replace with "n/m conditions met" (honest, already computable). |
| Setup-archetype backtests ("72% follow-through") | 🔴 | Backtest archive job over historical detections. W3. |
| Alert outcome tracking ("+6.1% since") | 🟡 | `track-performance` cron pattern → extend to triggered alerts. |

### Watch / picks
| Capability | Status | Notes |
|---|---|---|
| Watchlist / counts / ★ | ✅ | Solo + family boards, watch_states. |
| Kai Watch inventory + quotas | ✅ | Setups + subscriptions + NL parse; entitlements handle 3-vs-unlimited. |
| Setup detail w/ annotated chart | 🟡 | `alerts/e/[id]` + lightweight-charts exist; build the zone-annotation layer (board 19). |
| Earnings calendar digest | 🟡 | Polygon company data; add calendar feed scoped to watchlist. |
| Official Club Picks (Black-Belt vote, month-end grading) | 🟡 | Retired `fic_picks` + community-board performance tracking = plumbing; new governance layer (belt-gated election + monthly grading job). |

### Belts / reputation ⚠️ THE BIG ONE
| Capability | Status | Notes |
|---|---|---|
| Belt engine from **graded calls** (quantitative gates) | 🔴⚠️ | Current belts = XP levels skinned. Mockup belts = accuracy-derived with explicit gates (10/40/100/250/500 calls at 50-70%). **Decision: dual-track.** Keep XP belts for family/kids/learn identity (unchanged, nothing breaks); add a graded-call **club rank** track that drives influence/weighting/picks voting in club mode. Board 22 becomes the club-rank ladder; family keeps today's belt page. Prevents resetting every member's earned identity. |
| Opinion score (0-100) + percentile | 🔴 | Composite over graded calls. W2. |
| Influence multiplier | 🔴 | Derived from score/belt; the exact number the weighted signal consumes. W2. |
| Per-sector accuracy percentiles | 🔴 | Calls tagged by sector (screener_metrics has sectors). W3. |
| Belt rendering rules everywhere | ✅ | Belt colors already intrinsic + chips + leaderboard; extend to chart pins/live dots. |

### Learn / XP
Nearly all ✅: courses/modules/lessons/steps/quizzes/flashcards/XP/streaks/skills/games/simulator. Gaps: 🟡 path-node map UI (board 20) over existing course graph; 🔴 XP-chest claim mechanic (small); 🔴 animated recap + audio lesson asset types (content pipeline, not schema); board 21 = existing stepped lessons re-skinned.

### Presence / realtime
| Capability | Status | Notes |
|---|---|---|
| Ticker "watching now", circle "online", typing, room occupancy | 🔴 | Supabase Realtime **Presence** channels — supported by current stack, one shared hook, medium lift. Member-count on login = trivial endpoint. |
| Unread badges / NEW counts | ✅ | Notifications + bell exist. |

### Market data
| Capability | Status | Notes |
|---|---|---|
| Quotes/OHLC/timeframes/index strip | ✅ | Polygon proxies + lightweight-charts. |
| Technicals battery (RSI/MACD/MAs/rel-vol/levels, 15-min SLA) | 🟡 | `screener_metrics` has some; build indicator compute job + per-ticker readout API. |
| Pattern detection + historical follow-through | 🔴 | Heaviest market-data lift; W3/W4, ship tab without pattern card first. |
| Fundamentals (statements, margins, health grade, peer comps) | 🟡 | `research_fundamentals` + grades on research page exist; add consensus estimates + peer mapping + narrative line (LLM template). |
| Options analytics (flow, sweeps, implied move) + short interest | 🔴⚠️ | No feed today. Vendor decision (Polygon options tier vs alternative). Until then: hide flow chips, keep layout. |
| Earnings/macro calendar | 🟡 | Assemble from Polygon + static Fed calendar. |

### Social feed / pricing
Feed: ✅ posts/likes/comments/mentions/pins/media/moderation; 🟡 cashtag→ticker autolink, typed reactions (extend `object_reactions`), bookmarks (new small table); Top Voices 🔴 needs reputation rank (W2). Kai FAB stays (adult club surfaces).
Pricing: ✅ Stripe + entitlements SoT + custom checkout. ⚠️ Board 11 says **$99/yr**; live Club = **$99/mo**. Treat board 11 as design language only — keep real pricing from `PRICING_MATRIX`, adopt the paywall layout. "Restore purchases" = native-app concept; omit on web (revisit if app ships to stores).

---

## 2. Route conversion map (all 124 — grouped)

**Direct artboard conversions (dark+light canvases):**
| Current | Artboard(s) | Notes |
|---|---|---|
| `/dashboard` (ClubHome) | 01 | Persona composition stays; solo-club home = board 01 modules (ranking rail, 30-seconds briefing, signals inbox, XP card). |
| `/discover` | 02 + 15 | Existing For-you/Screener/Trending tabs = the mockup's exact tab set; screener keeps NL builder (not in mockup — keep, it's better). |
| `/research/[ticker]` | 03/12/13/14 | Current fundamentals/grades/news/social/Kai-report tabs re-organize into Overview·Technicals·Fundamentals·Kai. Free 3-reads meter + LockedStates persist. |
| `/community` | 04 (+Club Screens 01/06) | Feed/Lounge/Live modes → FEED/CIRCLES/LIVE sub-tabs; Lounge becomes a room under LIVE tab or stays third tab — keep all three surfaces. |
| `/community/compose` | Club Screens 05 | The full composer spec (stance, types, drafts). |
| `/community/changed-my-mind` | 04 CMM pattern | Keep RESPECT; adopt stance-transition card. |
| `/circles`, `/circles/[slug]` | 16, 23 | Notes→channel chat upgrade (W3). |
| `/watchlist`, `/watchlist/community` | 06, 17 | Watch tab = OVERVIEW·WATCHLIST·KAI WATCH·ALERTS; community board keeps like/perf features under 17's picks pattern; official picks = new governance (W3). |
| `/alerts`, `/alerts/e/[id]` | 18, 19 | C6 briefing+rules → Kai-alerts cards + setup detail w/ zones. Adults-only + LockedState survive. |
| `/kai` | 14 pattern + FAB | Chat stays full-screen; verdict surfaces on ticker tab. |
| `/progress`, `/u/[username]` | 07 (+Club Screens 09) | You tab; public profile = trimmed board 07. |
| `/belts`, `/leaderboard` | 22 | Belts page = club-rank ladder (dual-track note §1); leaderboard re-skinned in 22's language (brief for list layout). |
| `/courses` + lesson player | 08, 20, 21 | Paths/levels over existing courses; stepped lessons = 21. |
| `/` (splash), `/login` | 09, 10 | OAuth buttons appear only when Apple/Google providers configured (⚠️ new auth work — currently email-only). |
| `/pricing`, `/upgrade` | 11 | Real matrix from entitlements; 11's layout. |
| `/live-sessions` | 05 | Schedule/RSVP/recordings + the in-room experience (Zoom SDK, W3). |

**Family mode (9 routes) → Family canvas F1-F9:** `/family`→F1, teen views→F2/F9, guardrails→F3, `/family/circle`→F4, `/family/learn`→F5, `/family/watchlist`→F6, `/family/live`→F7, `/family/corner`→F8. `/family/tonight`, `/family/overview`, `/family/members` = briefs (below). Kid Corner/missions keep warm register derived from Family canvas.

**Challenge (8 routes) → 5-Day Challenge + Challenge Days canvases:** welcome→board 1, questions→1B, first-win→2, hq→3/4 (phase-driven), days/[day]→D1-D5 Brief/Do/Share, vip → brief.

**Pattern-adoption (no dedicated artboard — inherit the system, no new mockup needed):** auth plumbing pages, legacy redirects, `/club` bridge, `/challenge/calendar`, `/news/[slug]` (article = editorial template from 02's newsroom foot), `/research/thesis/[id]` (research-object card language), `/flashcards` (21's quiz language), `/games/*` (already dark-friendly; re-token), `/simulator/*` (re-token + 07's stat language), `/chart` (12's chart chrome), `/help`, `/referrals`, `/start-here` (checklist in 20's node language), `/settings`.

**Briefs required (§4):** onboarding wizard, News hub, Simulator suite, Live schedule+replays library, Collection (ownership cards), FTA hub (3), Shop (3), free-class funnel (9), checkouts (2)+welcome, VIP room, Family tonight/overview/members, Leaderboard list, Admin console (one system brief), `/c/[serial]` public scan (existing dark design — likely keep, note only).

---

## 3. Phased execution

**Phase 0 — Tokens & theme foundation (1 lane, ~2 days)**
Extract the two mockup palettes into the `data-theme` axis (`globals.css` @theme): dark = #141216/#FF7A1A system, light = App Light values. Fonts: add Barlow Condensed (display italic) + Instrument Sans (body) alongside existing; keep IBM Plex Mono + Kaushan (already installed). Grow `src/app/cc/` foundation files into `src/components/cc/` app kit (TabBar/ui.tsx primitives already built). Belt hexes stay intrinsic. Ship behind `data-design="v2"` flag on `<html>` so conversion can run route-by-route with instant rollback.

> **PHASE 0 ✅ COMPLETE 2026-07-28 (local, verified in browser both themes).** Token layer appended to globals.css under `[data-design="v2"]` (append-only, v1 byte-identical); light values EXTRACTED from the App Light canvas — note the canvas darkens green/pink (#0BA05A/#D92652) and uses deep-orange `--cc-orange-ink` #D95E00 for orange TEXT on paper (AA), diverging from §2 prose — canvas wins. Fonts added additively to root layout. Component canon complete in `src/components/cc/ui.tsx` (static) + `interactive.tsx` (client: SubTabs/CountdownChip/ZoneChart on lightweight-charts v5). Review gallery: `/cc/gallery` (dev-only, theme flip). Opt-in: `data-design="v2"` attribute (+ `data-theme` for light).
>
> **NEW CANVAS (2026-07-28 import):** `cc-family-challenge-export-src.html` — "One signup, the whole crew shows up": family variant of the pre-season→challenge journey (missions as dinner-table activities, XP pools to a Family Level, Day-3 offer framed as family plan). Folds into Phase 4 scope with Family + Challenge canvases.

**Phase 1 — Shell + core loop — ✅ BUILT + AUTH-VERIFIED LOCALLY 2026-07-28 (awaiting Kway review gate)**
Converted under `NEXT_PUBLIC_DESIGN_V2` (env absent in prod = byte-identical v1; verified both flag states build + render): shell (SidebarV2/TopBarV2/MobileTabBarV2 via v1 nav data — all persona slots preserved, FTA gold lane, Kai FAB untouched), splash 09, login 10 (Google sign-in kept as quiet secondary), pricing+upgrade 11 (real PRICING_MATRIX, $99/mo), Home 01 (solo-adult branch only; family/kid/free stay v1), Discover 02+15 (real screener + NL builder embedded), Ticker 03/12/13/14 (SubTabs over existing research; raw sentiment labeled; no fake gauges/levels/confidence), You 07 (real XP/belt; percentile/influence omitted). Flag helper reconciled to `src/lib/design-flag.ts` (Lane B temp copy deleted). Browser-verified authed (QA acct, light theme across all surfaces + gallery both themes; zero console errors). **Known follow-ups:** splash renders on user-theme ground — must force dark full-bleed like board 09; /upgrade long-form FTA narrative needs a v2 pass (v2 shows compact paywall only); interior shared panels (PriceTechnicals/Fundamentals/KaiReport bodies, ScreenerSurface) still v1 warm chrome inside cc frames; one-frame theme flash pre-hydration (root-layout inline script would fix); logged-in persona sweep (parent/teen/kid/fta) still to run.
Shell: DashboardShell/Sidebar/TopBar/MobileTabBar re-skinned; mobile = 5-tab (Home·Discover·Club·Watch·You per persona variants — kid/family slots preserved); desktop sidebar = same IA in mockup language. Screens: Home 01, Discover 02+15, Ticker 03/12/13/14 (rendering existing data; flow chips hidden, ring = raw sentiment), You 07 (existing stats), Splash/Login/Pricing 09/10/11.

**Phase W — The reputation loop backend (parallel track, sequenced)**
W1 call-grading job (stance→outcome ✓/✗) + graded-call ledger → W2 opinion score + influence multiplier + **weighted signal job** + belt-cohort aggregates (ring upgrades from raw→weighted; club-rank ladder goes live dual-track) → W3 snapshots/deltas everywhere, circle receipts grading, Club Picks governance, backtest archive, sector percentiles → W4 influence attribution (after definition ⚠️), Est-Trigger revisit.

> **PHASE 2 ✅ BUILT + AUTH-VERIFIED LOCALLY 2026-07-28.** Lane C: /community (board 04 — FEED/DISCUSSIONS/LOUNGE/LIVE + Circles/CMM chips, real belts via beltForXp, presence strip, full composer + moderation preserved), /community/compose (Club Screens 05 on real stance_events/content_type), /community/changed-my-mind, /circles + /circles/[slug] (board 16/23, single-channel honest, 30-day TTL confirmed real). Lane D: /live-sessions (L1/L2 from LIVE-LEADERBOARD-CANVAS-NOTES.md — ON-AIR hero, RSVP+XP preserved, replay grid on real entitlements), /leaderboard (real tri-period RPCs, FLIP rank animations, "% hit" columns omitted per honesty rule), /belts. Browser-verified authed: real members w/ real belt chips on the ladder, real posts w/ belt identity in the feed, staff-exclusion + honest empty states all rendering. Stances render NEUTRAL (never green/pink — opinions aren't market truth; design-law extension). **New owner decision ⛔③: kid-safe ladder** — canvas designs no-ranks-under-13 (race your own last week); v1 ranks kids inline; v2 preserves v1 pending owner call. Known cosmetic follow-ups: Discussions/Lounge/Live tab interiors keep v1 chrome inside v2 shell (realtime components deferred); v1-skeleton flash pre-mount (same as Phase 1 note).

**Phase 2 — Social depth (2 lanes, ~1 week)**
Community 04 + composer (Club Screens 05), Changed-my-mind, Circles 16/23 (channels on existing chat infra), presence hooks (watching-now/online/typing), notification re-skin. Live 05: Zoom SDK embed + room sentiment + reactions (the standing live-sessions architecture, finally built).

**Phase 3 — Learn + practice + watch (2 lanes, ~1 week)**
Learn paths 08/20/21 over existing curriculum; games/flashcards/simulator re-token; Watch hub 06 assembly; alerts 18/19 with condition current-values; technicals compute job; earnings calendar.

**Phase 4 — Family + challenge + FTA (2 lanes, ~1 week)**
Family canvas F1-F9 conversion (guardrails/paper-trading already exist ✅); challenge canvases onto the live challenge machine (careful: Sept 1 freeze — convert BEFORE Aug marketing push or AFTER Sept 6, owner call ⚠️); FTA hub via brief (gold register preserved).

**Phase 5 — Long tail + generated mockups**
Claude Design generates §4 briefs → convert funnel/shop/admin/onboarding/news/simulator/collection surfaces. Admin can lag safely (internal).

Every phase: preview-gate discipline (local build → browser verification → Kway review → merge), no prod deploy without approval, `data-design` flag until full coverage, then flag removal.

---

## 4. Missing-mockup briefs (for Claude Design)

Feed these to Claude Design in the existing project so generated boards inherit the canvas system (#141216 ground, #FF7A1A signal, Barlow/Kaushan/Instrument/Plex voices, belt hexes, card/ring/sparkline language). One board per brief unless noted.

1. **Onboarding Wizard (6-8 boards):** one-question-per-page gamified signup — who's joining (solo/family door), experience level, 2 comprehension checks (board-21 quiz pattern), goals, username+avatar (avatar grid, belt-ring preview), invite-kids step (family door only), celebration board w/ White-Belt ceremony + XP chest. Warm, zero finance-jargon; the celebration is the brand moment.
2. **News Hub + Article:** "Newsroom" — AI market-wrap hero card (play/read, timestamps), kind tabs (Wraps/Ticker events), article rows w/ ticker chips; article page = editorial dark reading surface, cashtags hot-linked, "discuss in Club" CTA. Free-visible everywhere.
3. **Simulator Suite (3 boards):** portfolio overview ($ equity curve, positions table w/ live P&L in green/pink, buying power), trade ticket (buy/sell, qty, est. cost, confirm), scored-scenario player (chart replay + decision prompts + score reveal). Board-12 chart chrome, board-07 stat language.
4. **Live Schedule + Replay Library (2 boards):** upcoming sessions list (RSVP w/ count, host chips, calendar add), replay library grid (Pro-gated cards w/ duration + watched state). Extends board 05.
5. **Collection — Ownership Cards (note, not brief):** existing dark-premium LivingCard system (shelf/detail/mint/scan) already matches the canvas's warm-black+premium direction — adopt tokens (orange accents where volt was), no redesign. Generate only if art direction diverges after Phase 0.
6. **FTA Hub (3 boards):** Traders chat (belt-colored names on true-dark + metallic-gold identity), course library, recordings grid. Constraint: FTA gold stays distinct from club orange — same layout system, gold accent lane.
7. **Shop (2 boards):** storefront (book/kit cards w/ physical-product photography slots, bundle badges), product detail + checkout CTA. Premium merch energy, not SaaS pricing energy.
8. **Free-Class Funnel (4 boards):** landing (next-session hero + countdown + register), quiz step (one question, progress dots), confirmation (calendar/SMS/what-happens-next timeline), VIP offer. Public-facing: lighter compliance-clean marketing register bridging cheatcode.com → app.
9. **Checkout ×2 + Welcome (3 boards):** Club $99/mo Payment-Element checkout, Challenge VIP $197, post-checkout welcome/claim ("your seat is held — create your login"). Trust-heavy, receipt-clear.
10. **Challenge VIP Room:** private feed board — VIP badge identity, intro post pattern, member rail; non-VIP pitch state.
11. **Family Tonight / Overview / Members (3 boards):** Family Night = one-route guided evening (vote → winner one-pager → discussion cards → XP finale, warm celebratory); Overview = kid report-card rail; Members = manage/invite w/ avatar+belt rows. Extends Family canvas register.
12. **Leaderboard (list layout):** tri-period tabs, animated rank rows (belt ring + XP + movement arrows), family-average variant, kid-safe variant. Board 22 is the ladder explainer; this is the ranked list.
13. **Help + Settings (2 boards):** help = AI chat + ticket escalation states; settings = profile/theme toggle (the light/dark pair!)/family activation/notifications/billing rows. Utilitarian, quiet.
14. **Admin Console (1 system brief, many screens):** internal tool language on the same tokens — dense tables, filters, bulk actions, view-as banner. One direction board is enough; admin converts last.
15. **Public scan page (note):** `/c/[serial]` stays theme-independent dark-premium (by design — physical artifact). No brief.

---

## 5. Open decisions for Kway (blocking marked ⛔, rest can start)

1. ⛔ **Belts dual-track** (§1 Belts): confirm XP belts stay for family/learn + new graded-call club rank drives weighting. (Recommended; avoids resetting member identity.)
2. ⛔ **Challenge freeze window**: convert challenge surfaces before Aug marketing or after Sept 6. (Recommended: after — don't touch the armed machine.)
3. **Pricing**: keep $99/mo (board 11's $99/yr = design fiction) — confirm.
4. **Descopes v1**: voice channels in circles, Est-Trigger model, options-flow vendor, influence attribution, Apple/Google OAuth — all deferred; confirm.
5. **Light-theme default**: which personas default light vs dark (kids likely light/warm; club adults dark?).
6. **Zoom SDK build** (Phase 2 live room) — the ~$13/mo Zoom plan + SDK work, per the standing architecture memory.

## 6. What Claude Design gets next
Paste §4 briefs 1-14 into the design project as new generation requests, one per brief, referencing the primary canvas for system inheritance. Generated boards land back in `.planning/design-project-v2/` and their routes convert in Phase 5.

> **2026-07-28 LATE WAVE (all local, flag-gated):** Owner rejected first conversion as "v1 bones in v2 paint" → FIDELITY pass (artboard px values, single-column, compact cards) + font-variable takeover (fix: declare on `[data-design="v2"] body`, NOT html — --font-cc-* live on body; html-scoped override = guaranteed-invalid = UA serif) + RICHNESS pass (WARM_HERO #241009→#17141A gradient grounds, halo moments, designed empty-state furniture) + demo seed `scripts/seed-v2-demo.ts` (8 belt-spread demo members, 3 circles, 12 posts, stances, CMM flips; markers: v2demo). Also done: community IA = FEED+CIRCLES w/ countdown-ring rail (owner-directed), Alerts v2 = Kai SMS-migration hub (NL "New Kai Watch" hero on real C6), ScreenerSurfaceV2 both mounts, research interiors V2 (PriceTechnicals/Fundamentals/KaiReportSection siblings; TickerDebate omitted pending ratification), cleanup wave 1 (9 skeletons, chrome, dead code). V1-REMNANT-AUDIT.md has the 13 nav/IA owner calls — ALL STILL UNANSWERED along with belts dual-track ⛔ / challenge freeze ⛔ / kid-safe ladder. Next builds queued on those answers: Watch hub, nav 5-bucket, Lounge/Discussions/Debates retirement, v1-twin deletion endgame, Phase 4 (family/kid homes), 7 new canvases (fetch from design project), Phase W backend.
