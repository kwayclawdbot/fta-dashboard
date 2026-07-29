# Navigation / Information-Architecture UX Audit — FIC/FTA Platform

Read-only audit. No code changed, nothing committed. Date 2026-07-22.
Live target: https://fta-dashboard-ruddy.vercel.app · Repo: `/Users/kwaysclawd/projects/fta-dashboard`
Sources: `src/components/dashboard/DashboardSidebar.tsx` (`getNavItems`), `MobileTabBar.tsx`, `DashboardTopBar.tsx`, `src/components/admin/AdminSidebar.tsx`, admin route tree under `src/app/(admin)/admin/`.
Screenshots (confirmatory, real logins on the live site via seeded disposables — since cleaned up): `scratchpad/ux-audit/nav/*.png`.

Method note: nav is **deterministic** from `getNavItems(role, ageGroup, tier)`, so the inventory below is exact from code and was visually confirmed for kid, free, admin, and FTA-parent (auth rate-limiting blocked live capture of fic-parent/fic-teen; their trees are the FTA-parent tree minus the FTA section, verified in code).

---

## 1. NAV INVENTORY (current, as-built)

### Desktop sidebar — item counts per persona

Utility rows (Shop/Help/Settings, +Admin for admins) are counted because today they sit **inside** the scrolling nav list, not a separate footer.

| Persona (role / age / tier) | Top-level rows | Rows |
|---|---|---|
| **FIC parent** (parent/adults/fic) | **19** (+1 section header) | Home · Community · Team Picks · Start Here · This Week · Courses · Live Classes · Family Watchlist · Kid Missions · Practice▸ · Flashcards · My Progress · Family▸ · Parent Corner · Invite Families · —*Trading Academy*— · Upgrade to FTA · Shop · Help · Settings |
| **FTA parent** (parent/adults/fta) | **18** (+1 header) | Home · Community · Team Picks · Start Here · This Week · Family Watchlist · Kid Missions · Practice▸ · Flashcards · My Progress · Family▸ · Parent Corner · Invite Families · —*FTA — Trading Academy*— · Courses · Live Classes · Shop · Help · Settings |
| **FIC teen** (child/teens/fic) | **15** | Home · Community · Team Picks · Start Here · This Week · Courses · Live Classes · Family Watchlist · Kid Missions · Practice▸ · Flashcards · My Progress · Shop · Help · Settings |
| **Young kid** (child/kids/fic) | **13** | Kids Corner · Start Here · This Week · My Lessons · Live Classes · Kid Missions · Family Watchlist · Practice▸ · My Cards · My Badges · Shop · Help · Settings |
| **Free** (any/free) | **9** | Home · Community · Free Courses · Practice▸ · Team Picks · Free Class · Join FIC · Help · Settings |
| **Admin** (member side) | above + **Admin** row (→`/admin/crm`) inserted before Shop | — |

`▸` = expanding group. **Practice** group children: Practice Chart (`/chart`), Simulator (`/simulator`, dropped for young kids), Games (`/games`). **Family** group children (parents only): Overview & Report Cards (`/family/overview`), Leaderboard (`/family/leaderboard`), Members (`/family/members`).

Owner target is **≤9 top-level**. Only Free is there today; parents are at ~2×.

### Mobile tab bar (5 fixed slots: Home · flank1 · **Community**(center) · flank2 · More)

| Persona | flank1 | flank2 |
|---|---|---|
| Parent (fic/fta) | Watchlist | Live |
| Teen | Watchlist | Missions |
| Young kid | Missions | Games |
| Free | Courses (`/courses`) | Picks |

**More sheet** = the full sidebar nav for that persona **minus** the 4 hrefs already used by tabs (Home, /community, flank1, flank2). Section headers pass through. Sub-items render nested. Header row = avatar/name → `/settings`.

### Confirmed by screenshot
- `fta-parent-desktop.png` — 18 rows + FTA section header exactly as coded; also shows an onboarding tour popup **and** two "finish setup" cards ("Finish setting up your family 0/6 Start Here", "Tell us about your family") firing **despite** onboarding being complete.
- `kid-desktop.png` — 13 rows; sidebar label "Kids Corner" but TopBar title reads "Home".
- `free-desktop.png` — 9 rows (already at target).
- `kid-mobile-more.png` — More sheet; **Games appears twice** (bottom-tab flank + Practice sub-item in the sheet).
- `admin-desktop.png` / `admin-users.png` / `admin-crm-leads.png` — see §4.

---

## 2. IA ANALYSIS — CARD SORT + CONSOLIDATION SCHEMES

### Card sort by user goal

| Goal bucket | Routes today |
|---|---|
| **Home** | `/dashboard` (incl. the *This Week* subtab) |
| **Community** | `/community` |
| **Club** (weekly, do-together, research) | This Week (subtab of Home), Team Picks `/picks`, Family Watchlist `/watchlist`, Kid Missions `/missions` |
| **Learn** | Courses `/courses`, Live Classes `/live-sessions`, Flashcards `/flashcards`, Start Here `/start-here` |
| **Practice** | Practice Chart `/chart`, Simulator `/simulator`, Games `/games` (already a group) |
| **Family / Grow** | Family overview·leaderboard·members, Parent Corner `/parent-corner`, Invite Families `/referrals`, My Progress `/progress`, Upgrade `/upgrade` |
| **Account / Utility** | Shop `/shop`, Help `/help`, Settings `/settings`, Admin |

### Standing constraints honored
- **Community = #2** (immediately after Home) in every scheme.
- **Club-first inversion** — club surfaces stay primary; the academy is framed as an add-on.
- **Practice-group precedent** — `subItems` + `childActive` highlighting already work; all schemes reuse that mechanism (no route moves needed).
- **Frequency of use** — This Week (weekly) and the club research pages stay reachable in ≤1 tap; Settings/Shop/Help (rare) drop into a persistent footer cluster, out of the scrolling budget.
- **Groups already render** section headers + nested sub-items, so nothing new is required structurally.

### Cross-scheme moves shared by all three
1. **Retire "This Week" as a nav item.** It links to `/dashboard?tab=this-week`; `usePathname()` strips the query, so it can *never* show active and Home is always active on it (active-state bug, §3). It already lives as the Home "This Week in FIC" tab (visible in `fta-parent-desktop.png`). Keep it there only.
2. **Demote "Start Here" to a Home card**, dismissed when the 0/6 checklist completes. Post-onboarding it duplicates the Home setup card. Optionally park it inside the Learn group as a permanent "Start Here" refresher, but not a standalone top row.
3. **Move Shop / Help / Settings (and Admin) into a footer utility cluster** below the collapse toggle — present, but not counted against the ≤9 budget.
4. **Team Picks + Family Watchlist are adjacent research surfaces** — keep them together (both schemes A/B place them side by side or in the same Club group).

---

### SCHEME A — Goal groups (max consolidation, 6–7 top-level)

Everything nests into four goal groups. Best ≤9 achiever; costs one extra tap on some weekly surfaces.

**FIC parent (19 → 6 + footer)**
```
Home
Community
Club ▸            This Week · Team Picks · Family Watchlist · Kid Missions
Learn ▸           Start Here · Courses · Live Classes · Flashcards
Practice ▸        Practice Chart · Simulator · Games
Family ▸          Overview & Report Cards · Leaderboard · Members ·
                  Parent Corner · Invite Families · My Progress
Upgrade to FTA    (FIC only — slim single row, no header)
── footer ──      Shop · Help · Settings
```
**FTA parent (6 + footer)** — identical, minus "Upgrade to FTA"; rename **Learn ▸** to **Academy ▸** with a premium badge (this replaces the separate "FTA — Trading Academy" section header and its relocated Courses/Live Classes; the tier framing moves onto the group label + the pages themselves).
**FIC teen (5 + footer)** — drop Family group and Upgrade; My Progress surfaces flat:
```
Home · Community · Club▸ · Learn▸ · Practice▸ · My Progress   → footer: Shop·Help·Settings
```
**Young kid (5 + footer)**
```
Kids Corner · Community · Learn▸(My Lessons·Live Classes·My Cards) ·
Club▸(This Week·Kid Missions·Family Watchlist) · Practice▸(Chart·Games)
── footer ── Shop · Help · Settings
```
**Free (5 + footer)**
```
Home · Community · Free Courses · Practice▸ · Team Picks · Free Class
── footer ── Join FIC · Help · Settings
```
Mobile tab bars: Parent `Home·Watchlist·Community·Missions·More` · Teen `Home·Watchlist·Community·Missions·More` · Kid `Home·Missions·Community·Games·More` · Free `Home·Courses·Community·Picks·More`.
**Trade-off:** This Week / Watchlist / Team Picks all become 2-tap (inside Club). Cleanest tree, slowest weekly path.

---

### SCHEME B — Frequency-tiered (RECOMMENDED, ~8 top-level)

High-frequency club surfaces stay **flat and visible**; only lower-frequency Learn/Family nest. Honors "This Week weekly / Settings rare" best while still hitting ≤9.

**FIC parent (19 → 9 + footer)**
```
Home
Community
Team Picks
Family Watchlist
Kid Missions
Learn ▸           Start Here · Courses · Live Classes · Flashcards
Practice ▸        Practice Chart · Simulator · Games
Family ▸          Overview & Report Cards · Leaderboard · Members ·
                  Parent Corner · Invite Families · My Progress
Upgrade to FTA    (FIC only)
── footer ──      Shop · Help · Settings   (+ Admin for admins)
```
**FTA parent (8 + footer)** — same, minus Upgrade; **Learn ▸ → Academy ▸** (premium badge) holds Courses · Live Classes · Flashcards · Start Here. No separate FTA section header.
**FIC teen (7 + footer)**
```
Home · Community · Team Picks · Family Watchlist · Kid Missions ·
Learn▸ · Practice▸ · My Progress          → footer: Shop·Help·Settings
```
(8 rows — drop Kid Missions for non-kid-facing teens if desired to reach 7.)
**Young kid (7 + footer)** — surface the play/earn loop flat, nest lessons:
```
Kids Corner · Community · Kid Missions · Family Watchlist ·
Learn▸(My Lessons·Live Classes·My Cards) · Practice▸(Chart·Games) · My Badges
── footer ── Shop · Help · Settings
```
*(Also adds Community to the kid **desktop** sidebar — today kids get the Community center button on mobile but have no Community row on desktop; §3.)*
**Free (7 + footer)** — unchanged shape, just move Help/Settings to footer:
```
Home · Community · Free Courses · Practice▸ · Team Picks · Free Class · Join FIC
── footer ── Help · Settings
```
Mobile tab bars (**unchanged from today**, they already reflect frequency well — only fixes: dedupe kid's Games, and never use This Week as a tab):
Parent `Home·Watchlist·Community·Live·More` · Teen `Home·Watchlist·Community·Missions·More` · Kid `Home·Missions·Community·Games·More` · Free `Home·Courses·Community·Picks·More`.
**Why recommended:** parents drop from 19→9 with **zero** added taps on the weekly club surfaces (This Week folds into Home where it already lives; Team Picks/Watchlist/Missions stay one click). Only Learn + Family (browsed, not daily) nest. Smallest behavior change for the biggest count win.

---

### SCHEME C — Minimal-change / two-cluster (lowest effort, ~10 top-level)

Keep today's flat order; make only three edits. For a ship-tonight, low-risk pass.

**FIC parent (19 → 10 + footer)**
```
Home · Community · Team Picks · Start Here · Family Watchlist · Kid Missions
Learn ▸           Courses · Live Classes · Flashcards       (NEW group)
Practice ▸        Practice Chart · Simulator · Games        (unchanged)
Family ▸          Overview·Leaderboard·Members ·
                  Parent Corner · Invite Families · My Progress   (absorb 3 rows)
Upgrade to FTA
── footer ──      Shop · Help · Settings
```
Edits: (1) fold Courses+Live Classes+Flashcards into **Learn**; (2) fold Parent Corner+Invite Families+My Progress into **Family**; (3) footer-cluster Shop/Help/Settings; (retire This Week per shared move). No relocation of Start Here, no FTA-section rework. Other personas follow the same 3 edits.
**Trade-off:** still 10 (misses ≤9 by one because Start Here/This Week not fully resolved), but the least code and least user relearning.

---

### Scheme comparison

| | A (goal groups) | B (frequency) ★ | C (minimal) |
|---|---|---|---|
| FIC parent top-level | 6 | **9** | 10 |
| Added taps on weekly surfaces | up to +1 | **0** | 0 |
| Honors "Community #2" | ✓ | ✓ | ✓ |
| Hits ≤9 all personas | ✓ | ✓ | ✗ (parent=10) |
| FTA framing preserved | via group badge | via group badge | via existing section |
| Implementation effort | **M** | **M** | **S** |
| Relearning cost | high | **low–med** | low |

---

## 3. WAYFINDING FINDINGS

| # | Area | Sev | What's wrong | Recommendation | Effort |
|---|---|---|---|---|---|
| W1 | TopBar page title | **P1** | `routeTitles` in `DashboardTopBar.tsx` is a static ~13-entry map; `/watchlist`, `/picks`, `/missions`, `/flashcards`, `/start-here`, `/parent-corner`, `/referrals`, `/help`, `/shop`, `/chart`, `/games` are **absent** → all fall back to `"Home"`. The header lies on most pages. | Derive title from the active nav item (label), or add every route; default to the persona's Home label, not literal "Home". | S |
| W2 | This Week active state | **P1** | Nav item `href="/dashboard?tab=this-week"`; `usePathname()` drops the query, so This Week can never be active and **Home is always active while on it**. Also duplicates Home. | Remove from nav; keep as the Home page tab (already exists). | S |
| W3 | No breadcrumbs / back on nested pages | **P2** | Picks detail (`/picks/[id]`), `/family/*`, lesson player, help ticket have no in-app back affordance; desktop TopBar has no back button. Users rely on browser back. | Add a back chevron in TopBar on any route one level below a nav root; optional breadcrumb for `/family/*` and picks/lesson detail. | M |
| W4 | Kid label vs title mismatch | P3 | Sidebar row "Kids Corner" but TopBar shows "Home" for `/dashboard` (routeTitles hardcode). | Fixed by W1 (pull title from nav label). | S |
| W5 | Community missing on kid desktop | **P2** | Young kids get the elevated Community center button on **mobile** but **no Community row in the desktop sidebar** (`getNavItems` isKid branch omits it). Same child can't reach Community on desktop. | Add Community to the kid desktop nav (or intentionally gate on both — pick one; current split is accidental). | S |
| W6 | Duplicate onboarding prompts post-onboarding | P3 | With onboarding complete, Home still shows the guided tour + "Finish setting up your family (0/6)" + "Tell us about your family" cards (`fta-parent-desktop.png`). | Gate the setup cards on the same completion flags as onboarding; don't restart the tour every load. | S |
| W7 | Start Here persists after onboarding | P2 | Standalone nav row duplicates the Home setup card once onboarding exists. | Demote to Home card (dismiss on complete) or fold into Learn group (schemes A/B). | S |
| W8 | Notification bell / avatar | P3 (OK) | Bell + avatar dropdown top-right on every persona; consistent. Avatar dropdown Profile & Settings both point to `/settings`. | Point "Profile" at `/u/[me]` (public profile route exists) or remove the redundant row. | S |
| W9 | Admin entry placement | P3 | Admins reach the console via an "Admin" row mid-list (→`/admin/crm`, i.e. CRM not the admin Dashboard). | Move to footer cluster with Shop/Help/Settings; point at `/admin` (Dashboard) as the neutral landing. | S |
| W10 | Orphan / duplicate routes | P3 | `/leaderboard` route exists with no nav entry (Family→Leaderboard uses `/family/leaderboard`); `/simulator/lessons` ("Pattern Practice") has a title but no Practice sub-item; kid's **Games** shows twice in the More sheet (flank tab + Practice sub-item — the More filter dedupes top-level hrefs only, not sub-items). | Delete/redirect `/leaderboard`; add Pattern Practice to Practice group or drop it; extend the More-sheet used-href filter to sub-items. | S |

---

## 4. ADMIN QUICK PASS (read-only, as jehu@cheatcode.com)

### Inventory (`AdminSidebar.tsx`, confirmed `admin-desktop.png`) — 16 rows
**Main (12):** Dashboard · CRM · Support · Announcements · This Week (FIC) · Team Picks · Shop · Courses · Coach Demos · Live Sessions · Users · Community
**Marketing group (4):** Leads · Pipeline · Funnel · Campaigns
Footer: Back to Dashboard · Logout.

But the CRM area **also** carries its own page-level tab bars, and they disagree:
- `/admin/crm` (root) tabs: **Overview · Members** (`admin-desktop.png`)
- `/admin/crm/leads` tabs: **Overview · Contacts · Leads · Pipeline · Campaigns · Support** (`admin-crm-leads.png`)
- Sidebar "Marketing": **Leads · Pipeline · Funnel · Campaigns**
So the same CRM children live in up to **three** navs that don't agree on membership (Funnel only in sidebar; Contacts/Members/Overview only in tabs; Support in both a sidebar top-row **and** a tab; Families reachable only via a hub-page link).

### Proposed admin grouping (one nav, ≤5 groups)
```
Overview            (/admin)
CRM ▸               Overview · Members · Families · Pipeline · Leads ·
                    Campaigns · Funnel · Support        (absorbs Marketing + Support;
                                                         page tab-bar mirrors THIS set exactly)
Content ▸           This Week (FIC) · Team Picks · Announcements ·
                    Courses · Coach Demos · Live Sessions · Community
Commerce ▸          Shop
People              Users            (or merge into CRM ▸ Members — see A2)
── footer ──        Back to Dashboard · Logout
```
Rule: **sidebar is the single source of truth**; within CRM, the horizontal tab bar shows the *same* children in the *same* order — never a third, different list.

### Top admin wayfinding issues
| # | Sev | Issue | Fix | Effort |
|---|---|---|---|---|
| A1 | **P1** | Three competing CRM navs (sidebar Marketing group + CRM-root tabs + Leads-page tabs) with disjoint membership. Users can't tell where a CRM sub-page "lives" or which nav is canonical. | Collapse into one CRM group (tree above); make every CRM page render the identical tab set. | M |
| A2 | **P2** | Two member directories: `/admin/users` (has search + role filter + count + Invite) vs `/admin/crm/members`. Unclear source of truth. | Merge — one directory under CRM ▸ Members; redirect the other. | M |
| A3 | **P2** | Orphaned CRM sub-pages: `/admin/crm/families` reachable only via a hub-page link; `/admin/crm/funnel` only via sidebar (absent from CRM tabs). | Put both in the unified CRM group + tab set. | S |
| A4 | **P2** | Flat 16-row sidebar; content-management rows (Announcements, This Week, Team Picks, Shop, Courses, Coach Demos, Live Sessions, Community) interleave with CRM/ops with no grouping beyond "Marketing". | Apply the Content/Commerce/CRM grouping above. | M |
| A5 | P3 | Three overlapping content-video surfaces — Courses vs Coach Demos vs Live Sessions — read as ambiguous siblings. | Nest under Content ▸; clarify labels ("On-demand Courses", "Coach Demo Clips", "Live Sessions"). | S |

### 5 biggest admin UX frictions observed
1. **Nav fragmentation (A1)** — the single largest friction; the CRM's own tabs contradict the sidebar and each other.
2. **Duplicate member lists (A2)** — Users vs CRM Members; no clear canonical directory.
3. **Bare loading states** — every admin page renders a lone amber spinner with no skeleton/empty-state (`admin-desktop.png`, `admin-users.png`, `admin-crm-leads.png` all captured mid-spinner); no "0 results" affordance visible.
4. **No bulk actions / row selection** — Users and Leads tables offer single search + one filter but no visible multi-select, bulk role change, bulk export, or bulk stage move (Leads has stage tiles new/contacted/engaged/nurture/converted/cold but no batch operation to move between them).
5. **Inconsistent search coverage** — Users (search + role filter) and Leads (search + stage filter) have search, but CRM root/Members and content lists (Courses, Announcements, Team Picks) show no search box, so parity of "find a record" is uneven across admin.

---

## Recommendation (3 sentences)

Ship **Scheme B (frequency-tiered)**: it cuts FIC parents from 19 → 9 top-level and every persona to ≤9 while adding **zero** extra taps on the weekly club surfaces (This Week folds back into Home where it already renders; Team Picks / Watchlist / Missions stay one click), nesting only the browse-not-daily Learn and Family groups that the existing `subItems`/`childActive` machinery already supports. It preserves the owner's standing decisions — Community at #2, club-first, the Practice-group pattern — and reframes FTA as a premium **Academy ▸** group badge instead of a stray section header, so there is no route churn. Pair it with the P1 wayfinding fixes (W1 TopBar titles, W2 kill the broken This Week nav item) and the P1 admin fix (A1 unify the three CRM navs) as the must-do companions.

### Severity tally
- **P1: 4** — W1 (TopBar titles lie), W2 (This Week active-state bug), A1 (three CRM navs).  *(W1, W2 member-side; A1 admin — 3 distinct P1 findings; nav-inventory oversizing is the framing, not counted.)*
- **P2: 6** — W3, W5, W7, A2, A3, A4.
- **P3: 7** — W4, W6, W8, W9, W10, A5, plus kid Games double-listing (folded into W10).

Doc: `.planning/UX-AUDIT/navigation-ia.md` · Screenshots: `scratchpad/ux-audit/nav/` · Disposable personas seeded via service role and deleted (verified clean).
