# App Design & UX Audit — app.familyinvestingclub.com

**Date:** 2026-07-25 · **Lane:** design/UX (sibling to LAUNCH-QA-AUDIT.md)
**Owner verdict being tested:** *"boring basic AI card containers for everything, no differentiation, very repetitive, boring and confusing — smooth out the UX flow."*
**Framework:** taste-skill (anti-slop, page identity, no generic card grids) + redesign-skill (audit checklist) + emil-design-eng (invisible-detail polish).
**Binding brand:** CLUB-REDESIGN-PLAN tokens — Club volt-orange `#FF5A00→#FFB000` / green-teal / Kai-blue on warm sand; Family warm-gold (no purple); FTA metallic. Standing rule: **generic card containers (rounded-rect + border/shadow + icon + title + body, repeated in grids) are hated on sight.** Nuance applied: functional DATA objects (ticker rows, stat chips) are legit; the sin is every SURFACE built as interchangeable card grids with no page identity.
**Method:** live prod desktop 1280 (+ mobile/kid spot views), authed Club + Family + Kid test users. Screenshots in scratchpad `qa-audit-*.png` / `qa-club-*.png`.
**Excluded per coordinator:** `checkout/**` (other agent) and the challenge tour (other agent). FTA section is tier-gated (404 for Club) — assessed only at its locked entry point.

**Verdict: the owner is right.** Six of the highest-traffic surfaces are the *same* vertical stack of identical bordered white cards. A blind "shuffle the screenshots" test fails — Community, Newsroom, Leaderboard, Watchlist, Alerts-feed and Discover-trending are indistinguishable without reading the header. The app also has *strong* signature elements (the Research grade-gauge, the illustrated Courses path, the real Screener table) that prove the team can differentiate — they're just buried under the card habit and not repeated as page identities.

---

## 1. Per-surface card census

Classification key: **(a)** legit data object · **(b)** lazy card → should be typography/rules/editorial flow · **(c)** card → should be a DESIGNED object (ledger/ticket/gauge/console idiom).

| Surface (screenshot) | Distinct layout patterns | Card-grid instances | Dominant sin |
|---|---|---|---|
| **ClubHome** `qa-club-dashboard.png` | 4 (belt bar, 3-equal row, hero lesson, list) | 3-equal-card row + "Keep going" list-in-card | (b) the "three equal cards" AI cliché (Market pulse / Community heat / Ask Kai) |
| **Discover** `qa-club-discover.png` | 2 | 5 stacked cards incl. 2-equal (Community/Ask Kai) — mirrors ClubHome | (b) near-duplicate of ClubHome |
| **Community** `qa-club-community.png` | 1 | ~35 identical feed cards (activity + posts same shell) | (b) feed-of-equal-cards; activity noise drowns real posts |
| **Watchlist** `qa-club-watchlist.png` | 2 (empty-state, Kai Watch) | rows-as-cards | (c) rows should be a table under a performance-chart hero |
| **Research** `qa-audit-research.png` | 4 (gauge, S/W, stats, about) | gauge card + 2 S/W boxes + 8 stat chips + 5 metadata chips | (c) strong gauge **signature** buried; (b) card-in-card-in-card body |
| **Screener** `qa-club-screener.png` | 2 (filters, table) | **0** — proper dense table | **(a) MODEL SURFACE** — this is how data should look |
| **Alerts** `qa-club-alerts.png` | 3 (Kai header, empty, events) | event rows-as-cards | (b) events list identical to News/Community |
| **Courses** `qa-audit-courses.png` | 3 (section headers, hero program, 2 course cards) | 3 illustrated cards | **(a) mostly good** — illustration gives identity |
| **Leaderboard** `qa-audit-leaderboard.png` | 1 | 13 identical rank cards | (c) should be podium + belt-tiered standings table; 9/13 are 0-XP (reads empty) |
| **Newsroom** `qa-audit-news.png` | 1 | 10 identical article cards | (b) no hierarchy — flagship Market Wrap looks like a 1-line Ticker Note; "AI-generated · educational" repeated 10× |
| **Family** `qa-audit-family.png` | 4 (crest, teaching moment, member rows, report card) | report-card stat boxes nested | warm-gold ✔ no purple ✔; (c) report card nests stat boxes + needs-work + coach |
| **Progress / Report cards** `qa-audit-progress.png` | — | stat boxes | (c) nested boxes |
| **Settings** `qa-audit-settings.png` | 1 | form cards | (b) generic |
| **Kid home** `qa-audit-kidhome.png` | tabbed Kids Corner | belt bar + tabs | warm/friendly ✔; inherits same card body |
| **FTA** (gated, 404 for Club) | — | — | assessed at locked nav entry only (metallic desk not live-audited) |

**Census totals:** 14 surfaces walked · **~9 surfaces are card-grid offenders** (b/c-dominant) · **3 model/good surfaces** (Screener a, Courses a, Research signature) · **~6 surfaces share one identical stacked-card rhythm** (Community, News, Leaderboard, Watchlist, Alerts, Discover-trending) · **3 surfaces nest cards ≥3 deep** (Research, Family report card, Progress).

---

## 2. Differentiation map — ONE signature move per surface

Each is concrete, buildable, token-compatible (Club volt/teal/Kai-blue on warm sand; no new color needed).

| Surface | Current identity | **Signature move (spec sketch)** |
|---|---|---|
| **ClubHome** | none (3 boxes) | **"Today in the Club" live masthead.** Kill the 3-equal-card row. One full-width warm-sand masthead: greeting + streak chip, then an inline stat *ticker strip* (members online · new posts · ideas shared · Kai alerts) as typographic numbers separated by hairline rules — NOT boxes. Below: one hero (today's lesson). Signature = the live pulse strip. |
| **Discover** | mirror of Home | **Ranked "what's moving / what the club's saying."** Trending as a numbered ranked list (1–10) with inline sparklines + %; Top Research as author bylines (avatar · title · likes). No equal cards. Signature = the ranked list rhythm (borrow the Screener's density). |
| **Community** | feed of equal cards | **Conversation-first editorial thread.** Weekly anchor becomes a masthead banner. Collapse all "is now researching" activity into ONE compact grouped strip ("12 families researched AAPL, NVDA…"). Real posts render as full-width editorial entries with ticker tag + bull/bear position + threaded replies. Signature = the anchor masthead + threaded discussion, not a card wall. |
| **Watchlist** | rows-as-cards | **Performance chart hero.** Family Watchlist Performance area chart on top (+total return, up/down/flat counts) per R4; holdings below as a dense table with per-row community-sentiment dot strips. Signature = the performance chart. |
| **Research** | gauge (buried) | **The grade gauge as page hero.** Lift the speedometer + 4 letter-grade rings OUT of its card to be the masthead object. Convert Strengths/Weaknesses to a two-column editorial ledger (✓/✗ rules on hairlines, no inner boxes); Key stats to a single mono stat-strip/table; About metadata to an inline definition list. Signature = the gauge (already the app's best object — make it the identity). |
| **Screener** | table ✔ | **Keep.** Elevate the filter "recipe" chips (Big breakouts / Oversold quality…) as the signature — name them, make them the entry idiom ("Stock Finder recipes"). |
| **Alerts** | Kai header ✔ | **Daily-brief masthead + rules console.** Kai's daily briefing as a narrated editorial block (dateline + prose), "This week in the market" as a compact ticker-tape (not cards), and My Rules as a device-like control panel of labeled toggle rows. Signature = the brief masthead + the console. |
| **Courses** | illustrated ✔ | **Keep + extend the illustrated learning path** into a visible path/spine connecting Foundations → Live Program. Signature = the path. |
| **Leaderboard** | 13 cards | **Podium + belt-tiered standings.** Top-3 as a podium (belt medallions), 4–N as a dense standings table (rank · avatar · name · belt · XP on hairlines). Collapse/hide the 0-XP tail. Signature = podium + belt credential. |
| **Newsroom** | 10 equal cards | **Editorial front page.** One hero Market Wrap (large headline + dek + inline movers), Ticker Notes below as a compact digest tape (one dense line each: badge · headline · ticker · %). Drop the repeated "AI-generated · educational" to a single page-level dateline. Signature = the lead-story masthead. |
| **Belts / Profile** | list in topbar chip | **Credential wall.** Belts as earned medallions on a wall (earned = full color, locked = ghost), with the next-belt requirement as a progress spine. Signature = the belt wall. |
| **Family** | warm-gold ✔ | **Family hearth.** Keep crest header + Teaching Moment; collapse the Report Card's nested boxes into one warm ledger per member (stat strip + one coach line). Signature = crest + teaching-moment masthead. |
| **FTA** (gated) | metallic (unseen) | **Metallic trading desk** — denser data layouts, mono numerics, metallic gold; deliberately *heavier* than Club so the tier feels like a different room. (Spec only — not live-audited.) |

---

## 3. UX flow / confusion — 5 core journeys

**J1 — New member first session:** ClubHome → tour v3 fires (good) → but the first row is 3 boxes competing for attention, and the "Ask Kai" box is a dead end (Kai down). Two floating FABs appear on Community (blue Kai + orange Club Chat) — competing primary actions. **Fix:** single hero focus on ClubHome (today's lesson), one FAB, hide the Ask-Kai box while Kai is degraded.

**J2 — Find & research a stock:** Research is reachable from ≥5 places (watchlist row, community ticker tag, discover trending, screener row, news ticker chip) — good — BUT the page always shows the breadcrumb "← Community Watchlist" regardless of where you came from, so back-context is wrong/lost. **Fix:** dynamic breadcrumb ("← Screener" / "← Community"), or a persistent close-to-previous.

**J3 — Post to community:** the post composer sits atop a wall of identical activity cards; a first-time poster can't tell their post from bot activity. **Fix:** separate real posts (editorial entries) from activity (collapsed strip) so a new post lands somewhere legible.

**J4 — Set an alert:** two entry points that look different but converge — the Research page "Alert" button and the Alerts hub "My Rules," plus Watchlist "Kai Watch" NL box (a third alert-creation idiom). Three ways to make an alert, three visual languages. **Fix:** unify on one alert-creation surface (Kai Watch NL + rules console), and make Research "Alert" deep-link into it.

**J5 — Parent + kid session:** clean tier split (kid "Kids Corner" nav, warm tone) — good. Gap (from QA lane): kid can reach `/screener` by URL. Design-wise the kid body still uses the same card shells as adult; kid identity is only in the greeting.

**Cross-cutting nav ambiguity (the "confusing" complaint):** the same 4 destinations have too many duplicate entry points —
- **News**: top-level nav item **+** Discover tab **+** Research tab.
- **Community**: top-level nav **+** ClubHome card **+** Discover card **+** Research tab.
- **Ask Kai**: top-level nav **+** floating FAB **+** ClubHome card **+** Discover card (4 doors, all dead while Kai is down).
- **Leaderboard**: top-level nav **+** Family › My Progress context.
The R2 5-item nav (Home · Discover · Community · Watchlist · Profile) in CLUB-REDESIGN-PLAN is the correct fix and should be prioritized — the current 13-item sidebar + duplicate cards is the structural source of "confusing."

**Same-looking-pages disorientation:** Community / Newsroom / Leaderboard / Alerts-feed / Watchlist all render as a vertical stack of equal cards → a user mid-scroll cannot tell which surface they're on. This is the #1 driver of "repetitive and confusing." Giving each a distinct signature (Section 2) is the fix.

---

## 4. Top 10 repetition offenders (ranked by visibility)

1. **Community feed cards** — ~35 identical stacked cards; first social impression, activity noise buries real posts.
2. **Newsroom article cards** — 10 identical; no lead-story hierarchy; "AI-generated · educational" ×10.
3. **Leaderboard rank cards** — 13 heavy bordered cards where a dense standings table belongs; 9/13 are 0-XP.
4. **ClubHome 3-equal-card row** (Market pulse / Community heat / Ask Kai) — the textbook AI cliché, first screen a member sees.
5. **Discover** — near-verbatim repeat of ClubHome's card set (Community + Ask Kai equal cards again).
6. **Alerts "This week in the market" event cards** — identical rhythm to News/Community.
7. **Watchlist holdings as cards** — should be a table under a performance chart.
8. **Research card-in-card-in-card** — Strengths/Weaknesses boxes + 8 Key-stat chips + 5 About-metadata chips nested inside the page card.
9. **Family Report Card nested boxes** — Quiz/Practice/Badges stat boxes + Needs-work + Coach's-note stacked.
10. **Research "About" metadata chips** (Industry/Exchange/Employees/HQ/Trading since) — five bordered boxes for five key-values that want a definition list.

---

## 5. Phased execution plan

Buckets per coordinator (D1 highest-traffic → D3 rest). Each spec is detailed enough to hand to a build lane without re-deriving. All use existing tokens; no new palette. Keep tour anchors coherent, both themes, 390px, zero residue.

### D1 — Highest traffic: ClubHome · Community · Research

**D1.1 ClubHome (`src/app/(dashboard)/dashboard/*`)**
- Remove the 3-equal-card row. Build a **"Today in the Club" masthead**: greeting + day-streak chip on row 1; row 2 = inline stat ticker (`members online · new posts · ideas shared · Kai alerts`) rendered as Space-Mono numbers + label, separated by 1px warm-sand hairlines — no boxes, no borders.
- Keep exactly ONE hero below: today's lesson (already illustrated — good). Move Market pulse into a slim single-line market strip (indices as inline mono, not a boxed card).
- While Kai credits are out: render the Ask-Kai entry as a quiet inline link, not a hero card (avoid a dead box).
- "Keep going" list: drop the outer card; render as a plain labeled list with hairline dividers.
- Signature deliverable: the live pulse strip. Accent = volt-orange for the active/CTA only; teal for community counts (never on the index %).

**D1.2 Community (`src/app/(dashboard)/community/*`)**
- Split the feed into **two lanes**: (1) real posts = full-width editorial entries (author byline, body, ticker tag chip, bull/bear pill, threaded Like/Comment inline) on hairlines, no card border; (2) activity ("is now researching / going to Free Class") = ONE collapsed grouped strip ("14 families researched AAPL · NVDA · DIS…"), expandable, not 25 cards.
- Weekly anchor ("This Week: How Apple Makes Money") → promote to a masthead banner at top with the teaching thesis.
- Tabs (For You/Following/Research/Discussions) stay; make Discussions the default-feeling home (conversation-first).
- One FAB only (fold "Club Chat" into the composer or a tab); remove the stacked second FAB.
- (Ties to LAUNCH-QA B2: purge the `e2e-post…`, `$ndva worst stock`, `@JehuGraham` test rows so the new editorial feed isn't seeded with junk.)

**D1.3 Research (`src/app/(dashboard)/research/*`)**
- Make the **grade gauge the page masthead**: gauge + Value/Growth/Health/Momentum rings sit directly under the ticker header, not inside a separate white card.
- Strengths/Weaknesses → a two-column **editorial ledger**: green ✓ / red ✗ items on hairline rows, no inner bordered boxes.
- Key stats → one **mono stat-strip / small table** (label above, value in Space Mono), not 8 bordered chips.
- About → inline definition list (Industry · Exchange · Employees · HQ · Since) on hairlines, not 5 boxes.
- Dynamic breadcrumb reflecting the true referrer (fixes J2).

### D2 — Watchlist · Alerts · Courses

**D2.1 Watchlist (`src/app/(dashboard)/watchlist/*`)**
- Add the **performance area chart hero** (R4): total return + up/down/flat counts.
- Holdings → dense table rows (ticker · price · %chg · community-sentiment dot strip · discussion count · avatars), hairline dividers, not cards.
- Keep the Kai Watch NL card but restyle its gradient to Kai-blue (`#2563FF`) per token spec, not orange→teal.

**D2.2 Alerts (`src/app/(dashboard)/alerts/*`)**
- Kai daily briefing → narrated **brief masthead** (dateline + prose paragraph), not a gradient banner over empty state.
- "This week in the market" events → compact **ticker-tape** (one dense line each: logo · headline · ticker · %), not stacked cards.
- My Rules → a **rules console**: labeled toggle rows in one panel (the R4 alert-rules device idiom); unify Research "Alert" + Kai Watch to deep-link here (fixes J4).

**D2.3 Courses (`src/app/(dashboard)/courses/*`)**
- Mostly keep (it's a model). Add a visible **learning-path spine** connecting Foundations → Live Program; ensure all tracks' courses surface (DB has 39; only 2 foundation cards render for Club adults — verify track filter isn't hiding content). Illustrated thumbnails stay.

### D3 — Rest: Discover · Leaderboard · Newsroom · Family · Profile/Belts · Screener-polish · FTA

- **Discover:** ranked numbered trending list w/ sparklines + Top-Research bylines; remove the ClubHome-duplicate Community/Ask-Kai equal cards; "Launch Stock Finder" stays.
- **Leaderboard:** top-3 podium (belt medallions) + dense belt-tiered standings table; collapse 0-XP tail (and cross-ref: 9/13 rows are 0-XP test/seed accounts — groom before launch).
- **Newsroom:** editorial front page — hero Market Wrap + Ticker-Note digest tape; single page-level "AI-generated" dateline instead of per-card repetition.
- **Family:** keep warm-gold; collapse Report Card nested boxes into one warm member ledger (stat strip + one coach line).
- **Profile/Belts:** build the credential wall (earned vs ghost medallions + next-belt spine); resolve the ambiguous top-bar "W White" belt chip (reads like a toggle) — make it a clear belt indicator that deep-links to the wall.
- **Screener:** minimal — name the filter recipes as the signature; fix the logo 404s (from QA lane).
- **FTA:** when built, commit to metallic desk density so the tier feels like a different room (spec only).

**Structural prerequisite that de-risks all three phases:** ship the R2 5-item nav (Home · Discover · Community · Watchlist · Profile) and delete the duplicate Community/Ask-Kai/News entry-point cards. The current 13-item sidebar + duplicated cards is the root of "confusing"; the signature moves land far better on top of it.

---

## Cleanup (verified zero)
Design-lane test users provisioned for authed views, then fully removed:
- Deleted: 2 auth users (Club `QADesign`, Kid `QAKidD`), 2 profiles, 1 family, 1 enrollment. These users made no posts/chats/RSVPs, so no child-row residue.
- Verified: remaining `qa-design%` auth users = **0**; `qa-design%` profiles = **0**. No feed residue (0 feed_posts authored). (`feed_posts` count moved 36→33 independently of this lane — consistent with another agent purging the 3 test-artifact posts flagged in LAUNCH-QA-AUDIT B2.)
