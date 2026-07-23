# Community Watchlist — Build Plan

**Project:** fta-dashboard (Next.js 16 App Router · Supabase `zvkercqohmmeyofycbgr` "FTA" · Tailwind v4)
**Live:** https://fta-dashboard-ruddy.vercel.app · GitHub-linked (`kwayclawdbot/fta-dashboard`), push to `main` auto-deploys.
**Author context:** highest existing migration = `096`. Next free slots: `097`, `098`. Deploy is GitHub auto-deploy (NOT CLI-only anymore). `pg_net` is enabled; **`pg_cron` is NOT** — so the daily tracker runs as a **Vercel Cron → secret-guarded API route**, not in-DB.

> ⚠️ Connection note: the task brief named project `ryprohqthwflinadqotj` — that is the **Kai/CheatCode** project, not this app. fta-dashboard is `zvkercqohmmeyofycbgr`. The db password at `~/.openclaw/secrets/supabase_db_password` is shared and authenticates the FTA pooler (`aws-0-us-west-2.pooler.supabase.com:5432`, user `postgres.zvkercqohmmeyofycbgr`). Migrations applied there.

---

## 1. Product shape (owner-decided, not re-litigated)

- **Team Picks is retired.** `/picks`, `/picks/[id]`, `/admin/picks` are absorbed into a flagship **Community Watchlist** — a single communal research board (distinct from the community chat/feed).
- **The communal board** shows: admin-curated "our research" picks + member picks that families explicitly promoted. Every member (FIC + FTA) sees it, researches together, and comments — **wikipedia-like collaborative research per ticker**.
- **Family/personal adds stay private** (existing `family_watchlist`, Watch→Study→Favorite/Avoid ladder, champion mechanic, missions XP — all unchanged). A new explicit action **"Add to community watchlist"** promotes a family pick to the public board with attribution.
- **Performance tracker:** snapshot price at the moment a ticker lands on ANY watchlist (private add, community promote, admin pick); daily close history; "% since added" on every card; per-ticker performance chart; a **Pick Record** board (best/worst, admin vs community).
- **Performance XP:** members earn XP as their promoted picks perform (anti-gaming rules §4).
- **Free tier ("Guest"):** members-only. Free users hit `LockedState`/`UpsellCard` on all watchlist surfaces. Old `is_free` picks teaser removed.

---

## 2. Schema (migration `097_community_watchlist.sql`)

### 2a. Extend `family_watchlist` (private board) — performance snapshot
```
alter table family_watchlist
  add column snapshot_price numeric,      -- price at the moment of the private add
  add column snapshot_at   timestamptz;
```
Set client-side at add time from the live quote; the cron backfills any NULL from the first daily close.

### 2b. `community_watchlist` — the public board (one row per card/entry)
| col | type | note |
|---|---|---|
| id | uuid pk | |
| ticker | text not null | |
| company_name | text not null | |
| kind | text check in ('admin','member') | admin = "our research"; member = promoted family pick |
| source_watchlist_id | uuid null → family_watchlist(id) on delete set null | the family pick promoted (member) |
| family_id | uuid null → families(id) on delete set null | attribution (member) |
| promoted_by | uuid null → profiles(id) on delete set null | individual promoter (member) / admin author |
| promoter_age_group | text null | snapshot of kids/teens/adults posture for AgeBadge |
| headline | text | admin pick headline |
| thesis | text | admin long thesis (migrated AAPL content) |
| blurb | text | short "why" (member: from why_we_picked/what_they_sell) |
| status | text check in ('active','watching','closed','archived') default 'active' | admin lifecycle; member entries default 'active' |
| snapshot_price | numeric | price when it landed on the community board |
| snapshot_at | timestamptz default now() | |
| created_at / updated_at | timestamptz | touch trigger |

- Partial unique index `unique(source_watchlist_id) where source_watchlist_id is not null` → a family pick can be promoted once (idempotent promote).
- Indexes on `(kind)`, `(ticker)`, `(status)`, `(created_at desc)`.

### 2c. `community_ticker_comments` — collaborative research per TICKER (the wiki thread)
Comments key on **ticker**, not on a board entry, so all promotions + the admin pick of the same ticker share one research thread.
```
id uuid pk, ticker text not null, user_id uuid → profiles(id) on delete set null,
body text not null, created_at timestamptz
index (ticker, created_at)
```
Profanity filtered app-side (existing `profanity.ts`), rendered with `AgeBadge` (author age_group) exactly like feed/pick comments.

### 2d. `ticker_snapshots` — daily close history (shared by all surfaces)
```
ticker text, as_of date, close numeric, created_at timestamptz,
primary key (ticker, as_of)
```
One row per ticker per day → efficient, idempotent (upsert). Populated by the cron. `snapshot_price` on entries + `ticker_snapshots` give "% since added" and the per-ticker chart.

### RLS posture (matches repo: bare SELECT + app-tier gating; SECURITY DEFINER for privileged writes; forge-proof INSERTs)
- `community_watchlist`: SELECT `to authenticated using (true)` (free tier gated in-app via LockedState). Admin INSERT/UPDATE/DELETE via `role='admin'` policy (same pattern as `fic_picks`). Member promotion goes through the `promote_to_community` SECURITY DEFINER RPC (no direct member INSERT policy). De-promote DELETE: `promoted_by = auth.uid()` or admin.
- `community_ticker_comments`: SELECT `using (true)`; INSERT `with check (user_id = auth.uid())`; DELETE own-or-admin.
- `ticker_snapshots`: SELECT `using (true)`; **no** authenticated write policy — only the cron (service-role) writes (bypasses RLS).

---

## 3. RPCs, triggers, notifications (in `097`)

- **`get_community_board()`** SECURITY DEFINER → jsonb `{ entries[], comment_counts{}, snapshots{} }`. Entries carry attribution (family name, promoter display_name + age_group), snapshot, latest close. One round trip (mirrors `get_watchlist_board`). Granted to `authenticated`.
- **`promote_to_community(p_watchlist_id uuid, p_snapshot_price numeric)`** SECURITY DEFINER, forge-proof: verifies the source `family_watchlist` row belongs to `auth.uid()`'s family; snapshots price + attribution (family, promoter, age_group from the caller's profile); inserts `kind='member'`; idempotent on `source_watchlist_id`. Returns the new row id.
- **`award_community_perf_xp(...)`** — helper the cron calls (or the cron inlines the logic; see §5). XP flows through `xp_events` (kind `'bonus'`, `ref_id = 'perf:{entry_id}:{milestone}'`).
- **Notification rewire (reuse the 092 pipe + `notif_audience_ids`):**
  - New **admin community pick** (`community_watchlist` INSERT where `kind='admin'`) → trigger `notify_on_community_admin_pick`: fan-out to members via `notif_audience_ids('fic')` (paying members), type `'new_pick'`, link `/research/{ticker}`. Deduped by `ref_id`.
  - New **ticker research comment** (`community_ticker_comments` INSERT) → trigger `notify_on_ticker_comment`: earlier distinct commenters on the same ticker (capped 20), self-skipped, type `'reply'`, link `/research/{ticker}`. Mirrors 092(a).
  - The old `fic_picks` `notify_on_pick_active` trigger stays but is dormant (no new active picks; `/picks` redirects). Left in place — harmless.

---

## 4. Performance XP — rules as implemented (anti-gaming)

XP is awarded by the **daily cron only**, off **daily closes** (never intraday), and only for **community-promoted member picks** (`kind='member'`). Public accountability = the anti-spam gate: to earn performance XP you must put your pick on the public board under your family's name.

| Rule | Value / behavior |
|---|---|
| Eligible entries | `community_watchlist` `kind='member'` only. Admin picks and private family adds earn **zero** performance XP. |
| Milestones (vs `snapshot_price`) | **+5% → +15 XP**, **+10% → +25 XP**, **+25% → +50 XP** |
| Measurement | latest **daily close** from `ticker_snapshots`; never intraday/delayed live price → no minute-to-minute churn gaming |
| One award per milestone per entry | `ref_id = 'perf:{entry_id}:{pct}'`, unique in `xp_events` → idempotent, re-runs never double-pay |
| Minimum hold | entry must have survived ≥1 daily close (`snapshot_at < today`) before any milestone counts → can't promote-at-a-dip then instant-pop within minutes |
| Cumulative | crossing 25% in one day still awards 5/10/25 tiers not yet paid (ratchet up), but never re-pays a tier |
| No claw-back | de-promoting (deleting the entry) forfeits FUTURE milestones; already-earned XP stays |
| Per-family daily cap | ≤ **5** performance-milestone awards counted per family per cron run (stops a family spraying dozens of promotions to farm a rally) |
| Recipient | `promoted_by` (the individual) → feeds family XP via the existing **averaged** `family_xp_leaderboard` (mig 035) |

Documented amounts are calibrated against the existing ladder (LESSON=50, watchlist ADD=10, RESEARCH=15) so performance XP is meaningful but never dominates learning XP.

---

## 5. Daily tracker cron

**Mechanism chosen: Vercel Cron → `/api/cron/track-performance`** (pg_cron unavailable; Vercel Cron is explicitly endorsed and needs no DB extension).

- `vercel.json`: `{ "crons": [{ "path": "/api/cron/track-performance", "schedule": "0 22 * * 1-5" }] }` (22:00 UTC, Mon–Fri ≈ after US close).
- Route guard: if `CRON_SECRET` env is set, require `Authorization: Bearer <CRON_SECRET>` (Vercel injects this header automatically) OR `?secret=` for manual runs; refuse otherwise. Uses the **service-role** client (bypasses RLS).
- Steps (idempotent per day):
  1. Collect distinct tickers from `community_watchlist` ∪ `family_watchlist`.
  2. Batch quotes via the server Polygon lib (`getQuotes`, one snapshot call per ≤100 tickers; cached). Today's close = `quote.price ?? prevClose`.
  3. **Upsert** `ticker_snapshots (ticker, as_of=today, close)` — idempotent.
  4. Backfill `snapshot_price` on any entry (community + family) still NULL → today's close.
  5. Evaluate member-entry milestones per §4; insert `xp_events` (dedup by `ref_id`, per-family cap).
  6. Return a JSON summary (counts) — no residue, safe to re-run.
- **Owner action:** set `CRON_SECRET` in Vercel project env (documented; route degrades to "unauthorized" until set, so it fails safe).

---

## 6. Routes & navigation

| Route | Change |
|---|---|
| `/watchlist` | **My Family** private board — unchanged page/behaviour |
| `/watchlist/community` | **NEW** flagship communal board (admin picks + member promotions + Pick Record section) + `loading.tsx` |
| `/research/[ticker]` | **NEW** per-ticker collaborative research page: performance chart, all entries for the ticker, wiki comment thread + `loading.tsx` |
| `/picks`, `/picks/[id]` | **redirect** → `/watchlist/community` |
| `/admin/picks` | **redirect** → `/admin/community-watchlist` |
| `/admin/community-watchlist` | **NEW** admin console (adapts the old picks console): create/edit/close admin "our research" picks |

**Nav (`getNavItems`, single source):** the existing `Family Watchlist` row becomes an umbrella **Watchlist** group (icon `Eye`), parent → `/watchlist/community` (flagship), subItems `[Community Board /watchlist/community, My Family /watchlist]`. `Team Picks` (`CLUB_PICKS`) removed from every tier list (incl. the free-tier list — free users no longer get a picks teaser row). Free tier keeps no watchlist access (gated). Mobile tab bar watchlist slot points at `/watchlist/community`.

---

## 7. Team Picks retirement (migration `098_retire_team_picks.sql` + code)

- **Data:** copy the real AAPL moat pick (`0f9b5e1f-…`, status active, `picked_price` 325.82, headline "The clearest example of a moat in modern business", 1227-char thesis, article links, tags) into `community_watchlist` as `kind='admin'` — **thesis/content preserved verbatim**, `snapshot_price`=325.82, `snapshot_at`=its `created_at`. Idempotent (skip if an admin AAPL entry already exists).
- **Delete** the owner's stray draft `7e54a380-…` ("this is the pick") from `fic_picks`.
- **Comments:** `pick_comments` count = **0** → nothing to migrate (noted; no data lost).
- **`fic_picks` table + old AAPL row:** left in place (no longer surfaced; `/picks` redirects). Not dropped — avoids touching the 092 trigger and keeps history.
- **Code:** delete `/picks/page.tsx`, `/picks/[id]/page.tsx`, `/admin/picks/page.tsx` → replace with redirect stubs. `lib/picks.ts` helpers (`sincePickPercent`, `formatSincePct`, `toParagraphs`, youtube helpers) retained (reused by community surfaces). Remove `is_free` teaser branch from nav.

---

## 8. UI register

Adult-first, premium/confident, warm-paper design system + dark theme tokens (`@theme` vars, both themes correct), 390px mobile, `loading.tsx` skeletons on new routes, framer-motion via the `@/lib/motion` LazyMotion barrel (`m`). Reuse `WatchlistShareCard`, `ResearchLadder`, `TrendGlyph`, `Sparkline`, `CompanyLogo`, `LockedState`, `UpsellCard`, `Celebrate`, `AgeBadge`, `TierBadge`, `Avatar`.

---

## 9. Commit plan

1. `feat(community-watchlist): plan doc`
2. `feat(community-watchlist): schema + RPCs + triggers (mig 097)` — DB + `lib/community-watchlist.ts` types
3. `feat(community-watchlist): communal board + per-ticker research pages` — member UI, promote action, LockedState gating
4. `feat(community-watchlist): admin console + daily performance cron` — `/admin/community-watchlist`, `/api/cron/track-performance`, `vercel.json`
5. `feat(community-watchlist): retire Team Picks (mig 098 + redirects + nav)` — data migration, redirects, nav rewire

Each staged file-by-file (never `git add -A`); messages end with the Co-Authored-By trailer.

## 10. Verification

`npm run build` green → push → poll Vercel deploy in a shell loop → Playwright live: `/watchlist/community` health + board renders (migrated AAPL admin pick), `/research/AAPL`, `/picks` redirect, free-tier LockedState, both themes, mobile 390px. **E2E residue policy:** read-only verification against the migrated AAPL pick; any test rows created are deleted before finish (zero residue).

## 11. Deferred / risks

- `CRON_SECRET` must be set in Vercel by owner (route fails safe until then).
- Vercel Cron requires a plan tier that permits scheduled functions; if unavailable the route is still manually/externally triggerable with the secret.
- Per-ticker performance chart uses `ticker_snapshots` (accumulates from first cron run) + Polygon daily bars for backfill history.
