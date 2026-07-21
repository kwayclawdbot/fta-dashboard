# RLS Hardening Audit — Legacy Tables (FTA/FIC production)

Date: 2026-07-21
Supabase project: `zvkercqohmmeyofycbgr`
Live: https://fta-dashboard-ruddy.vercel.app

## 1. Problem inventory

Supabase security advisor (`get_advisors security`) + `pg_class.relrowsecurity` agree on
**9 legacy `public` tables with RLS DISABLED** (advisor findings `rls_disabled_in_public`
ERROR x9 and `policy_exists_rls_disabled` ERROR x9 — the SAME 9 tables). The anon key can
read/write all of them today.

| # | table | RLS | policies already defined? |
|---|-------|-----|---------------------------|
| 1 | `profiles`        | OFF | yes (incl. 2 RECURSIVE admin policies) |
| 2 | `families`        | OFF | yes (own-family SELECT, create INSERT) |
| 3 | `family_invites`  | OFF | yes (parents-manage ALL) |
| 4 | `lesson_progress` | OFF | yes (own ALL, parents SELECT, admin SELECT) |
| 5 | `lessons`         | OFF | yes (visible-course SELECT `public` role, admin CRUD) |
| 6 | `modules`         | OFF | yes (visible-course SELECT `public` role, admin CRUD) |
| 7 | `courses`         | OFF | yes (published SELECT `public` role, admin CRUD) |
| 8 | `badges`          | OFF | yes (anyone-read `public` role, admin CRUD) |
| 9 | `user_badges`     | OFF | yes (own SELECT only) |

**Key discovery: the policies were written but `ENABLE ROW LEVEL SECURITY` was never run.**
So most of the work is (a) fixing the few policies that don't match real app behaviour,
(b) tightening the `public`-role read policies so ANON is actually blocked, (c) enabling RLS.

Other advisor findings (OUT OF SCOPE for this task, noted for the record):
- `security_definer_view` ERROR x1 → `family_tiers` view (kept working; separate remediation).
- `function_search_path_mutable` WARN x4 → `get_my_family_id`, `handle_new_user`,
  `update_updated_at`, `fic_watchlist_touch_updated_at` (we fix `get_my_family_id` as a
  low-risk bonus; the others left alone).
- `rls_policy_always_true` WARN x5, `extension_in_public`, `public_bucket_allows_listing`,
  `auth_leaked_password_protection`, `anon/authenticated_security_definer_function_executable`
  — config/other-table findings, not part of the 9.

## 2. Client architecture (who is bound by RLS)

- `src/lib/supabase/client.ts` — **browser** client (anon key). RLS applies as the logged-in
  user. **Almost the entire app, including the admin pages, uses this.**
- `src/lib/supabase/server.ts` — **server** client (anon key + user cookies). RLS applies as
  the user. Used by: `(dashboard)/layout.tsx`, `(admin)/layout.tsx`, `api/coach`,
  `api/coach/transcribe`, `api/report-card`, `auth/callback`, `auth/confirm`.
- `src/lib/supabase/admin.ts` — **service role**. BYPASSES RLS. Used by ONLY:
  `api/push/dispatch/route.ts`, `r/[code]/route.ts`. (These are unaffected by hardening.)
- All `.rpc()` targets are `SECURITY DEFINER` (verified against `pg_proc.prosecdef`):
  `get_home_state`, `family_xp_leaderboard`, `child_report_stats`, `award_badge`,
  `admin_set_family_tier`, `admin_*` CRM suite, `attach_referral`,
  `get_or_create_referral_code` → all BYPASS RLS and keep working.

## 3. Access-pattern map (client reads/writes to the 9 tables, file:line)

Legend: [R]=read [W]=write. All are the browser/server client (RLS-bound) unless noted.

### profiles
- [R] own profile: `(dashboard)/layout.tsx:23`, `(admin)/layout.tsx:23`,
  `onboarding:51`, `family/page:59`, `family/members:58`, `family/overview:95`,
  `family/leaderboard:51`, `community:213`, `settings:57,104`, `dashboard:151,168,188`,
  `chart:46`, `missions:82`, `parent-corner:63`, `referrals:54`, `start-here:50,64`,
  `upgrade:55`, `flashcards:71`, `watchlist:187,205`, `courses/page:81`,
  `leaderboard:41`, `simulator/leaderboard:36,48`, `live-sessions:670`,
  `api/coach:93`, `api/report-card:68`.
- [R] OTHER users' profiles (cross-family, authors/leaderboards/@mentions/avatars):
  `community:116` (limit 300), `settings:84` (limit 1000), `onboarding:80` (limit 1000),
  `family/members:84`, `family/page:93`, `family/overview:124`, `family/leaderboard:68`,
  `admin/page:34`, `admin/users:34,86`, `signup/invite:78` (**ANON** — inviter name),
  `api/report-card:70` (child profile), `components/community/LiveRooms:101,128`,
  `push/dispatch:63` (service role).
- [W] update OWN: `onboarding:118,151`, `settings:118` (notification_prefs),
  `signup/invite:124` (upsert self on join).
- [W] update OTHER family members (parent): `family/members:129` (`family_id=null` = remove),
  `family/members:139` (`role` change). **Needs a parent-scoped UPDATE policy.**
- [W] update ANY (admin): `admin/users:53` (`role` change). **Needs an admin UPDATE policy.**
- [W] INSERT: only via `handle_new_user` (SECURITY DEFINER trigger, role default 'parent') and
  the self-upsert on invite join (`auth.uid()=id`). No parent-creates-child INSERT exists.

### families
- [R] OWN family: `onboarding` (implicit via profile), `family/page:80`, `family/overview:115`,
  `signup/invite:65` (**ANON** — family name for invite banner).
- [R] COUNT ALL (vanity stat): `community:233` — count of families in the community.
- [W] INSERT (onboarding, parent becomes owner): `onboarding:112` (`auth.uid() IS NOT NULL`).
- No client UPDATE anywhere (tier via `admin_set_family_tier` RPC; Stripe fields via service
  role webhooks). `stripe_customer_id`/`stripe_subscription_id` live here → must NOT be
  exposed to all members.

### family_invites
- [R] by code (**ANON**, pre-signup validation): `signup/invite:48`.
- [W] INSERT (parent creates invite): `family/page:116`, `family/members:111`.
- [W] mark `used_by` (the joining child): `signup/invite:135`.

### lesson_progress
- [R] OWN: `courses/[slug]:222`, `courses/[slug]/[moduleId]/[lessonId]:265`,
  `courses/page:105`, `dashboard:196`, `progress:123`, `lib/badges:163`,
  `lib/lesson-bridge:143`, `api/coach:103`.
- [R] family members (parent): `family/overview:140,205`, `family/leaderboard:81`.
- [W] upsert OWN: `courses/[slug]/[moduleId]/[lessonId]:316`, `lib/lesson-bridge:150,182`
  (all set `user_id = auth.uid()`).

### lessons / modules / courses
- [R] authenticated members (course catalog / player / progress / badge engine):
  `courses/[slug]:190,198,213,239`, `courses/[slug]/[moduleId]/[lessonId]:217,226,235`,
  `courses/page:97`, `progress:118,138,196,211,218,248`, `family/overview:216`,
  `dashboard`, `lib/badges:173`.
- [W] admin CRUD only: `(admin)/admin/courses/*` (create/update/delete). No anon path needs
  these tables → tighten SELECT from `public` role to authenticated.

### badges
- [R] authenticated (badge engine + progress page): `lib/badges:274`, `progress:274`.
- [W] admin CRUD only. No anon path → tighten to authenticated.

### user_badges
- [R] OWN: (badge case components).
- [R] family members (badge counts): `family/overview:146` (`.in(user_id, memberIds)`).
  **Current own-only policy blocks this → add a family-scoped SELECT policy.**
- [W] none from client (legacy table; new badges write to `badge_awards` via `award_badge`).

## 4. Hazards identified (and how each is handled)

1. **profiles recursion**: `admins_select_profiles` / `admins_update_profiles` subquery
   `profiles` inside a `profiles` policy → `42P17 infinite recursion` once RLS is on.
   → DROP both; add an `is_admin()` SECURITY DEFINER helper and an admin UPDATE policy that
   calls it. Admin READ is already covered by the authenticated-read-all policy (admin is
   authenticated). All remaining profiles policies use column/`auth.uid()`/DEFINER helpers
   only → provably non-recursive.
2. **profiles cross-row writes**: parents edit children (remove/role) and admins edit anyone.
   → add `Parents update family profiles` (uses DEFINER `get_my_family_id()` + `get_my_role()`)
   and `Admins update any profile` (uses `is_admin()`).
3. **ANON invite validation** (`signup/invite` reads `family_invites`+`families` while logged
   out): invite codes are bearer secrets — a permissive anon policy would leak ALL pending
   invites (family takeover risk). → move validation to a SECURITY DEFINER RPC
   `invite_details(code)`; move the join+mark-used to `redeem_invite(code, display_name)`.
   Small edit to `signup/invite/[code]/page.tsx`. No anon policy on the tables.
4. **`public`-role read policies** on courses/modules/lessons/badges would let ANON read
   published content → the anon-blocked proof would fail. → recreate those SELECT policies
   scoped to the `authenticated` role.
5. **families billing exposure**: making `families` authenticated-read-all to fix the
   community count would expose `stripe_customer_id`/`stripe_subscription_id` to every member.
   → keep `families` SELECT own-scoped; serve the community count via a DEFINER
   `community_family_count()` (one-line edit in `community/page.tsx`).
6. **Realtime** tables (`chat_messages`, `notifications`) are NOT touched.

## 5. Final policy design (per table)

- **profiles**
  - SELECT `Authenticated can read profiles` — `auth.uid() IS NOT NULL` (blocks anon, allows
    all members: authors/leaderboards/@mentions/avatars). KEPT.
  - SELECT `Users can read own and family profiles` — own OR `family_id = get_my_family_id()`.
    KEPT (redundant but safe, DEFINER-based).
  - INSERT `Users can insert own profile` — `auth.uid() = id`. KEPT.
  - UPDATE `Users can update own profile` — `auth.uid() = id`. KEPT.
  - UPDATE `Parents update family profiles` — NEW: `get_my_role()='parent' AND family_id =
    get_my_family_id()` (USING); WITH CHECK allows the row to stay in-family or be removed
    (`family_id IS NULL OR family_id = get_my_family_id()`).
  - UPDATE `Admins update any profile` — NEW: `is_admin()`.
  - DROP `admins_select_profiles`, `admins_update_profiles` (recursive).
- **families**
  - SELECT `Members can read own family` — `id IN (own family)`. KEPT (own-scoped, protects
    billing; anon → empty).
  - INSERT `Authenticated users can create families` — `auth.uid() IS NOT NULL`. KEPT.
- **family_invites**
  - ALL `Parents manage family invites` — `family_id IN (my family where role in parent/admin)`.
    KEPT (parent INSERT). Anon validation + child mark-used move to DEFINER RPCs.
- **lesson_progress**
  - ALL `Users manage own progress` — `auth.uid() = user_id`. KEPT.
  - SELECT `Parents read family progress` — family + parent. KEPT.
  - SELECT `admins_select_lesson_progress` — `is_admin()`-equivalent (subquery on profiles,
    different table → no recursion). KEPT.
- **lessons / modules / courses** — visible-course/published SELECT recreated with role
  `authenticated` (blocks anon). Admin CRUD policies KEPT (subquery profiles, no recursion).
- **badges** — SELECT recreated as `authenticated` read-all. Admin CRUD KEPT.
- **user_badges**
  - SELECT `Users read own badges` — `auth.uid() = user_id`. KEPT.
  - SELECT `Family reads member badges` — NEW: `user_id IN (profiles of my family)` via
    `get_my_family_id()` (for `family/overview` counts).

## 6. Helper functions (all SECURITY DEFINER, `search_path` locked)
- `get_my_family_id()` — EXISTS; recreated with `SET search_path` (clears one advisor WARN).
- `get_my_role()` — NEW: current user's `profiles.role`.
- `is_admin()` — NEW: `get_my_role() = 'admin'`.
- `invite_details(p_code text)` — NEW: anon-safe invite validation (returns jsonb).
- `redeem_invite(p_code text, p_display_name text)` — NEW: join family + mark invite used.
- `community_family_count()` — NEW: total family count for the community stat.

## 7. Rollout (zero-window)
1. Migration A: helper functions + RPCs + all policy changes, **RLS still OFF** (policies inert).
2. Deploy app edits (`signup/invite`, `community`) that use the new RPCs. RLS still OFF →
   old and new code both work during the deploy window.
3. Migration B: `ENABLE ROW LEVEL SECURITY` on the 9 tables (atomic, one transaction).
4. Verify anon-blocked + full member regression.

Rollback: `supabase/migrations/ROLLBACK_rls_hardening.sql` (disables RLS on the 9 tables).
