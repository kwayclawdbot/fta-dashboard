# Design import — board index

Mechanical extraction of the owner's Claude Design canvases. Every board has its own
directory containing:

| file | what it is |
| --- | --- |
| `render.png` | element screenshot of the phone frame, `deviceScaleFactor: 2` (so 784×1692 px for a 392×846 frame) |
| `dom.html` | the frame's `outerHTML` subtree, prettified — every style is inline, nothing is inherited from an external sheet |
| `spec.md` | top-to-bottom mechanical walk: role → tag → exact computed styles → text, children indented, plus a token appendix |

Per-canvas: `TOKENS.md` (palette with usage counts, type scale, radius scale, spacing steps,
shadows) and `_raw.json` (machine-readable board list + tokens).

Repo-level: [`TOKEN-MAP.md`](./TOKEN-MAP.md) — the light↔dark 1:1 token proof.
[`DELTA.md`](./DELTA.md) — the honest-data ledger (content that cannot ship as drawn).
Re-runnable scripts in [`_scripts/`](./_scripts/).

**Style ports exactly. Only content is negotiable, and only per `DELTA.md`.**

---

## Frame geometry

| canvas | frame outer | inner content | tab bar | notes |
| --- | --- | --- | --- | --- |
| `app-dark` / `app-light` | 392×846 (390×844 + 1px border) | 390×781, padding `18px 18px 0 18px` | 390×63 | radius 34px, `overflow: hidden` |
| `family` | 392×846 | same | 390×63 | same shell |
| `club-screens` | 406×860 | — | — | older canvas, larger shell; treat `app-dark` as the shell authority |

Port at 390px logical width. Every px value in the specs is already at that scale — do not divide.

---

## Canvas: `app-dark` — "CHEAT CODE · LOCKED BRAND · GLOW AT 40%"

Source: `~/Desktop/Cheat Code App (Standalone).html` · 23 boards · ground `#141216`.
**This is the file the owner named for implementation.** `app-light` is the same DOM,
same 23 boards, same type scale, palette swapped — see `TOKEN-MAP.md`.

| # | slug | screen | app route |
| --- | --- | --- | --- |
| 01 | `01-home` | Greeting, TOP IN THE CLUB tile rail, Today-in-30-seconds player, Your Signals rows, belt/XP/score footer card | `/dashboard` |
| 02 | `02-discover` | Rising Fast sparkline cards, Most Divisive donut, Black Belts Are Watching avatar row, Quiet-to-Loud sparklines | `/discover` |
| 03 | `03-ticker-nvda` | Ticker overview: price header, watcher avatars, intraday chart, timeframe pills, Where-the-club-stands gauge, active circle, top voices | `/research/[ticker]` (Overview tab) |
| 04 | `04-club-feed` | Feed/Circles/Live tabs, Happening-now event rail, composer, post cards, Changed-my-mind card, Kai Insight card | `/community` |
| 05 | `05-live-the-club-room` | Live room: host stage photo, room sentiment gauge, reaction bar, activity ticker | `/live-sessions` (+ `/vip-room`) |
| 06 | `06-watch` | Overview/Watchlist/Kai Watch/Alerts tabs, 4 destination rows, "Getting close" condition checklist | `/watchlist` (tab shell) |
| 07 | `07-you-profile` | Belt header, opinion score dial, influence multiplier, strongest areas, stat grid, streak, recent calls | `/progress` (+ `/u/[username]`) |
| 08 | `08-learn` | Your Paths progress rows, Continue-reading card, streak block, Up-next audio/reading rows | `/courses` |
| 09 | `09-splash` | Logo lockup, script tagline, "Reading the room…" loader | pre-auth — `/` |
| 10 | `10-login` | GM greeting, member-count line, Apple/Google/email auth, terms + not-investment-advice line | `/login` |
| 11 | `11-pricing` | Annual/Monthly toggle, Club Pro card, Member free card, rating + member count, testimonial, trial CTA | `/pricing`, `/upgrade`, `/checkout/club` |
| 12 | `12-ticker-technicals` | Tab bar, **drawn BUY/SELL meter (DO NOT SHIP — see DELTA)**, RSI gauge, MACD, key-levels ladder, pattern card, MA chips | `/research/[ticker]` → Technicals |
| 13 | `13-ticker-fundamentals` | Grade badge, revenue bar chart FY23→FY26E, margin trio, valuation-vs-peers bars, footnote | `/research/[ticker]` → Fundamentals |
| 14 | `14-ticker-kai-report` | Kai verdict chip + confidence dial, 3 insight blocks, "What would change Kai's mind" list, Set-Kai-Watch CTA | `/research/[ticker]` → new Kai tab (5th) |
| 15 | `15-discover-screener` | For You/Screener/Trending tabs, filter chips, match count, result rows, most-bullish/bearish columns, trending rail | `/screener` |
| 16 | `16-club-circles` | Circles grid with countdown + member count, expiry copy, Start-yours tile | `/circles` |
| 17 | `17-watchlist-club-picks` | Official Club Picks month header, pick rows with entry + since-%, member quote cards, graded-month strip | `/picks` (+ `/watchlist/community`) |
| 18 | `18-watch-kai-alerts` | Kai daily alerts: **BUY SIGNAL / SELL SIGNAL / HEADS UP cards (DO NOT SHIP verdicts — see DELTA)**, condition checks, actions | `/alerts` |
| 19 | `19-alert-view-setup` | Single setup: chart with entry/invalidation bands, condition list, notify toggles, historical follow-through, armed state | `/alerts/e/[id]` |
| 20 | `20-learn-path` | Winding node path with lesson/lock/test/chest nodes, streak + XP header, up-next card | `/courses/[slug]` (journey view) |
| 21 | `21-learn-micro-lesson` | Progress 3/5, question, animated scene placeholder, 4 answer options, +10 XP check button | `/courses/[slug]/[moduleId]/[lessonId]` |
| 22 | `22-belts-rank-system` | Six belt rows with criteria + % of club, YOU-ARE-HERE marker, "How belts show up" examples, next-rank card | `/belts` |
| 23 | `23-inside-a-circle` | Circle header with countdown, channel chips, pinned thesis, threaded posts, Kai auto-post, composer | `/circles/[slug]` |

## Canvas: `app-light` — "CHEAT CODE · LIGHT THEME · SAME SYSTEM"

Source: `~/Desktop/Cheat Code App Light (Standalone).html` · 23 boards · ground `#E9E5DC`.
Board list, slugs and route mapping are **identical to `app-dark`** (verified board-for-board
in `TOKEN-MAP.md` § Board parity). Use the light renders as the port target — the shipped app
is light-primary — and the dark specs for the dark-mode values.

## Canvas: `family` — "CHEAT CODE · FAMILY MODE"

Source: `~/Desktop/Cheat Code Family (Standalone).html` · 9 boards · ground `#E9E5DC`
(same light palette; warm gold-orange accent, **no purple**).
Note the family tab bar is a different 5: Home · Learn · Watch · Live · Family.

| # | slug | screen | app route |
| --- | --- | --- | --- |
| F1 | `01-f1-family-home` | Family level + XP bar, member roster with belts, Family Challenge leaderboard vs S&P, Watching-together rows, Kai-for-kids card | `/family` (+ `/family/overview`) |
| F2 | `02-f2-teen-paper-account` | Teen paper portfolio value + all-time, stat quad, next-belt bar, **Guardrails-on-this-account list**, trophies | `/family/teen/[memberId]` |
| F3 | `03-f3-parental-controls` | Money / People / Time guardrail toggle groups, weekly digest quad, recent-changes log, "notify both parents" footer | `/family/teen/[memberId]/guardrails` |
| F4 | `04-f4-family-circle` | Private family chat, Kai mini-lesson card, XP auto-event, live challenge scoreboard, composer | `/family/circle` |
| F5 | `05-f5-family-learn` | Four learning tracks with step nodes, up-next card, weekend quiz card, weekly stat trio | `/family/learn` |
| F6 | `06-f6-family-watchlist` | "Which company should we learn about tonight?" vote tiles, cast-your-vote avatars, recently-discussed rows, tonight card | `/family/watchlist` (+ `/family/tonight`) |
| F7 | `07-f7-family-live-class` | Live class video stage, live poll with counts, participant avatars, up-next sessions, raise-hand bar | `/family/live` |
| F8 | `08-f8-parent-corner` | Conversation-starter rows, age-band tabs (6–8 / 9–12 / 13+), family missions with XP, completed-last-week card | `/family/corner` (+ `/parent-corner`) |
| F9 | `09-f9-teen-progress` | Level header, badge/streak trio, skill mastery bars, weekly family bonus, family XP card, recent badges | `/family/teen/[memberId]/progress` |

## Canvas: `club-screens` — "CHEAT CODE CLUB — FTA-DASHBOARD"

Source: `.planning/design-project-v2/Club Screens.dc.html` (no Desktop standalone twin)
· 9 boards · ground `#DED5C3` · 406×860 frames.
**Older canvas, different shell and a different accent orange (`#F05A28` vs `#FF7A1A`).**
It is included because the adoption plan draws three of its ideas. Where it conflicts with
`app-dark`, `app-dark` wins.

| # | slug | screen | app route |
| --- | --- | --- | --- |
| 01 | `01-club-feed` | Members-online header, Feed/Discussions/Changed-my-mind tabs, contributor rail, Top-in-Club strip, hot discussions | `/community` |
| 02 | `02-club-discussions` | Hot/New/Tickers/Mine filters, pinned thread, **Rooms-by-topic 4-tile grid** (one tile is "Options desk" — see DELTA), trending threads | `/community` (discussions view) |
| 03 | `03-club-changed-my-mind` | Editorial headline, change card with BEAR→BULL, "what I said before" quote, **RESPECT** reaction, "The Club rewards the update, not the ego." | `/community/changed-my-mind` |
| 04 | `04-ticker-thread` | Ticker header, sentiment split bars, Club-discussion / Kai-insight tabs, comment cards, add-to-watchlist + Trade | `/research/[ticker]` |
| 05 | `05-share-your-call` | **Structured composer**: stance (Bearish/Neutral/Bullish) + post type (Thesis/Risk/Chart/Changed my mind) + 2,000-char body + `$TICKER` binding | `/community/compose` |
| 06 | `06-the-lounge` | Main circle / Semis / Beginners channels, chat with shared-research card, typing indicator | `/community` (lounge) — UNMAPPED as its own route |
| 07 | `07-live-rooms` | Now live / Upcoming / Replays, live room hero, upcoming session rows, recent replay | `/live-sessions` |
| 08 | `08-in-the-room` | Live timer, on-stage speaker cards with roles, covering-now ticker, room chat, Leave | `/live-sessions` (in-room state) |
| 09 | `09-member-profile` | Level + XP bar, badge grid, stats list (**includes Accuracy 74% — see DELTA**), watchlist rail | `/u/[username]` |

---

## Not extracted (out of scope for this lane)

| file | why |
| --- | --- |
| `~/Desktop/Cheat Code 5-Day Challenge (Standalone).html` | challenge funnel canvas — separate lane (`CHALLENGE-PRESEASON-PLAN.md`) |
| `~/Desktop/Cheat Code Challenge Days (Standalone).html` | same |
| `.planning/design-project-v2/Cheat Code Directions.dc.html` | direction/mood exploration, not screen specs |

Re-run any of them with `node _scripts/extract.mjs <key> "<file>"`.
