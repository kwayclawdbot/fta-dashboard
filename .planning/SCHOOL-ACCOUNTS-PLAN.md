# School Accounts — Architecture & Product Plan (FTA / FIC platform)

**Status:** PLAN ONLY. No code, migrations, or deploys are performed by this document. All SQL below is *proposed / illustrative design*, not to be applied as written.
**Author context:** Written against the live schema at migration `025`; next free migration slot is `026`. Repo `/Users/kwaysclawd/projects/fta-dashboard`, Supabase ref `zvkercqohmmeyofycbgr`, Vercel deploy is CLI-only (`vercel --prod`, not GitHub-linked).
**Date:** 2026-07-18

---

## 0. What exists today (research summary — the ground truth we build on)

| Concern | Current implementation | Reuse handle for schools |
|---|---|---|
| Tenant unit | `families` (plan_tier `challenge`/`academy`, Stripe fields) | `organizations` becomes a *second, parallel* tenant unit |
| People | `profiles` (PK = `auth.users.id`; `role` ∈ parent/child/coach/admin; `family_id`; `age_group` kids/teens/adults; `track`; `notification_prefs`) | add org roles + org membership **without** breaking family dimension |
| Onboarding | Parent-first: main signup creates a family; kids **only** via invite → kid onboarding (verified E2E) | mirror exactly for teacher-first + roster-only students |
| Invites | `family_invites` (code unique, role, `invited_by`, `used_by`, `expires_at`, 7-day). UI: `family/members/page.tsx` generates a 12-char code → link `/signup/invite/[code]`; redeemed in `/signup/invite/[code]/page.tsx` | clone → `org_invites` + `/signup/join/[code]` |
| Enrollment / access | `enrollments` (family-level, `program` fic\|fta, `cohort_id`, unique `family_id+program`); `cohorts` (start_date, weeks); resolver `get_home_state(user_id)` reads family enrollment → program/week/track | extend resolver to **union** org licenses |
| Content | `courses.program` (fic foundations / fta 6-week ICT), `modules.track` (kids/teens/adults), `lessons.drip_week`, `lesson_progress`, `quizzes`, `quiz_attempts` | **unchanged** — content track is orthogonal to org |
| Gamification | `xp_events` (per-user), `family_xp_leaderboard(window)` SECURITY DEFINER (cross-family aggregate), flashcards, `game_scores`, `session_rsvps`, badges | XP is per-user → re-aggregate into a class scope, no new storage |
| Report cards | `child_report_stats(child)` SECURITY DEFINER — verifies caller is a **parent in same family**, returns cross-table stats; `/api/report-card` caches Haiku notes; `components/dashboard/ReportCard.tsx` | clone → `class_report_stats(class)` verifying caller is teacher/principal of the org |
| Community | **One** global room. `chat_rooms` (type family/cohort/general/lesson/dm/coach_dm, `ref_id`), `chat_room_members` (role member/moderator/admin), `chat_messages` (`category`, `reply_to_id`). Frontend `/community/page.tsx` reads `chat_messages WHERE room_id = 'c0000000-…-0001'` and subscribes to Realtime `filter: room_id=eq.<uuid>`, calling `realtime.setAuth(token)` | param the room + add org scoping |

### The two RLS/Realtime laws we must obey (learned the hard way — mig 018 & 019)

1. **No self-referential subquery in a policy** (mig 018). The original `chat_room_members` SELECT policy subqueried `chat_room_members` inside its own `USING` → Postgres error `42P17` (infinite recursion). Fix was `user_id = auth.uid()`. **Rule: membership tables get "see your own rows" policies only.**
2. **Realtime cannot authorize a SELECT policy that subqueries another table** (mig 019). The `exists (select … from chat_rooms)` SELECT policy made live `postgres_changes` silently *not deliver* even though inserts succeeded. Fix was a bare column compare: `room_id = '<fixed uuid>'`. **Rule: any table streamed over Realtime must have a SELECT policy that is a pure predicate over the row's own columns and/or the JWT — never a join/subquery to another table.**

These two laws are *the* central design constraint for private school communities. Everything below is shaped by them.

> **Hard pre-GA gate:** 9 core tables are still `RLS-disabled` in dev (advisory). Family data leaking to another family in dev is tolerable; **school (minor) data crossing tenants is not.** RLS **must** be enabled on all people/content/community tables before School Accounts reach real students. Treat this as a launch blocker, not a nice-to-have.

---

## 1. Recommended architecture (one-paragraph shape)

Introduce `organizations` as a **second tenant type that coexists with `families`** — a `school` org owns many `class` orgs (self-referencing `parent_org_id`), each `class` owns students. People attach through an **`org_members` join table** (not an `org_id` column on `profiles`), so a child can belong to a family **and** one-or-more classes at once with zero conflict. Private school/class chat is delivered by **denormalizing `org_id` onto `chat_messages`** and gating it with a **Custom Access Token Hook that injects the user's `org_ids` array into the JWT** — the Realtime SELECT policy then reads `org_id = any(<jwt org_ids>)`, a pure token-vs-column predicate that obeys both RLS laws (no cross-table subquery, no recursion). All teacher/principal read-tools (rosters, class report cards, class leaderboards, principal rollups) are **SECURITY DEFINER RPCs** that verify the caller's org role internally — the exact pattern already proven by `child_report_stats` and `family_xp_leaderboard`. Content, curriculum track, and per-user XP are **untouched**; a dual-membership kid simply gets a second community and a second leaderboard scope over the same underlying rows.

---

## 2. Data model

### 2.1 New tables

```sql
-- PROPOSED (mig 026). Not applied.

create table organizations (
  id             uuid primary key default uuid_generate_v4(),
  type           text not null check (type in ('school','class')),
  parent_org_id  uuid references organizations(id) on delete cascade, -- class -> its school; null for school or standalone class
  name           text not null,
  owner_id       uuid references profiles(id) on delete set null,     -- principal (school) / teacher (standalone class)
  join_code      text unique,                                          -- optional org-wide staff code
  -- licensing surface (structure only; no prices)
  license_program text check (license_program in ('fic','fta')),       -- curriculum tier granted to all seats
  license_model   text check (license_model in ('per_seat','per_class','per_school')),
  seats           int,                                                 -- seat cap (null = unlimited/site license)
  status          text not null default 'active' check (status in ('active','suspended','cancelled')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_org_parent on organizations(parent_org_id);

create table org_members (
  id        uuid primary key default uuid_generate_v4(),
  org_id    uuid not null references organizations(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  role      text not null check (role in ('principal','teacher','assistant','student')),
  status    text not null default 'active' check (status in ('active','pending','removed')),
  joined_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index idx_org_members_user on org_members(user_id);
create index idx_org_members_org  on org_members(org_id);

create table org_invites (            -- mirror family_invites; supports shared roster codes
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  code        text not null unique,
  role        text not null check (role in ('teacher','student')),
  invited_by  uuid references profiles(id),
  email       text,                    -- optional; NEVER required for a student (minor safety)
  max_uses    int  not null default 1, -- 1 = per-student code; >1 = shared class roster code capped by seats
  uses        int  not null default 0,
  used_by     uuid references profiles(id), -- last redeemer (kept for parity; roster join table is source of truth)
  expires_at  timestamptz not null default (now() + interval '14 days'),
  created_at  timestamptz not null default now()
);
create index idx_org_invites_code on org_invites(code);

create table assignments (            -- homework: point an existing content ref at a class with a due date
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade, -- a class
  created_by  uuid references profiles(id) on delete set null,
  kind        text not null check (kind in ('lesson','quiz','flashcards','game','custom')),
  ref_id      uuid,                    -- lessons.id / quizzes.id / etc (null for custom)
  title       text not null,
  instructions text,
  points      int not null default 0,
  assigned_at timestamptz not null default now(),
  due_at      timestamptz
);
create index idx_assignments_org on assignments(org_id);
```

**Design decisions & why:**

- **Join table (`org_members`), not `profiles.org_id`.** Membership is many-to-many (a teacher teaches several classes; a student could sit in two classes; a principal spans a whole school) and, crucially, must **coexist with `family_id`** on the same profile. A column can't express that; a join table does, and it keeps `profiles` unchanged for the family dimension.
- **Self-referencing `organizations`** (`parent_org_id`) models school→class as one table with a `type` discriminator — cheaper than two tables and gives free principal rollup (`where parent_org_id = <school>`).
- **`profiles.role` extended** to add `teacher` and `principal` (`alter … check (role in ('parent','child','coach','admin','teacher','principal'))`). This drives *default shell navigation only*. **`org_members.role` is the authority** for org tools. A parent who is also a teacher keeps `role='parent'` and simply has a teacher `org_members` row — documented edge case, no schema pain.
- **Assignments derive completion, don't duplicate it.** A `lesson`/`quiz`/`game` assignment's "done?" is answered by joining `assignments.ref_id` to existing `lesson_progress` / `quiz_attempts` / `game_scores`. Only `kind='custom'` (manual/offline work) needs a lightweight `assignment_submissions` table — deferred to Phase 2, added only if custom homework is actually requested.

### 2.2 Community columns (additive to existing tables)

```sql
-- PROPOSED. Additive; existing global room keeps org_id = NULL.
alter table chat_rooms    add column org_id uuid references organizations(id) on delete cascade;
alter table chat_rooms    drop constraint if exists chat_rooms_type_check;
alter table chat_rooms    add  constraint chat_rooms_type_check
  check (type in ('family','cohort','general','lesson','dm','coach_dm','org','class'));
alter table chat_messages add column org_id uuid references organizations(id) on delete set null;
create index idx_chat_messages_org on chat_messages(org_id);
```

`chat_messages.org_id` is **denormalized from the room** (set by a trigger or by the writing API from `chat_rooms.org_id`) precisely so the Realtime SELECT policy can filter on a single own-column value (Law #2). The global FIC room stays `org_id IS NULL, room_id = 'c0000000-…-0001'`.

### 2.3 How a kid in BOTH a family and a school behaves

| Dimension | Behavior | Mechanism |
|---|---|---|
| **Content / track** | Unchanged. Age/track still drives curriculum. | `get_home_state` keeps reading `age_group`/`track`. |
| **Program access** | Union of family enrollments **and** any org license. | Extend `get_home_state` to also grant program access when the user is an active `org_members.student` of an org whose `license_program` covers it (see §3.4). |
| **Communities** | Two (or three): global FIC room + family room (if any) + school/class room. Fully isolated. | JWT `org_ids` set decides which private rooms are visible. |
| **Leaderboards** | Two scopes: family leaderboard (existing) + class leaderboard (new). | Same `xp_events` rows re-aggregated by two different RPCs. **XP is never double-stored.** |
| **Report cards** | Parent sees family report; teacher sees class report. Both read the same child. | Two SECURITY DEFINER RPCs, each with its own caller-authorization check. |

The family and org dimensions are **orthogonal**: nothing about joining a class mutates `family_id`, and nothing about a family mutates `org_members`.

---

## 3. Registration, invites & minor safety

### 3.1 Two new self-serve registration paths (mirror the parent-first flow)

- **Teacher registration** → creates a `class` org (`parent_org_id = null`), inserts `org_members(role='teacher')`, sets `profiles.role='teacher'`. This is the teacher analog of "parent creates a family."
- **School registration** → creates a `school` org, `org_members(role='principal')`, `profiles.role='principal'`. The principal then creates classes and invites teachers (teacher redeems a `role='teacher'` `org_invite` which attaches them to a class under the school).

### 3.2 Students: roster-only, no self-signup (the safety spine)

Students **cannot discover or self-register**. Two supported provisioning modes:

1. **Shared class roster code** — teacher generates one `org_invite(role='student', max_uses=<seats>)`; each redemption increments `uses` (capped). Fast for a whole class.
2. **Per-student codes** — teacher pre-enters roster names → one `org_invite(max_uses=1)` per student; redemption claims that seat.

Redemption (`/signup/join/[code]`, a minor-safe fork of `/signup/invite/[code]/page.tsx`) collects **display name + password only**. **No student email is required**; where Supabase auth needs an address, mint a synthetic `code+slug@students.local` and store no PII beyond first name. Optional **teacher-approval gate**: student redeems → `org_members.status='pending'` → teacher approves in roster UI → `active`.

### 3.3 Minor-safety / compliance posture (design-level)

- **COPPA school-consent exception:** the school/teacher acts as the parent's agent for consent for under-13 students used for a school-authorized educational purpose. The org model *is* the compliance vehicle — document consent capture at org creation and keep student PII minimal.
- **No public directory, no cross-org discovery, no student→student DMs by default.** Students see only their class/school room(s); staff are moderators.
- Reuse the existing **kid privacy locks** (`role==='child'` redirects away from admin/roster pages) for students.

### 3.4 Access resolution change (one surgical RPC edit, Phase 1/3)

`get_home_state(user_id)` today resolves program strictly from `enrollments` by `family_id`. Extend the "highest active enrollment" select to also consider org licenses:

```
accessible_programs(user) =
   { e.program : e ∈ enrollments where family_id = user.family_id and status='active' }
 ∪ { o.license_program : o ∈ organizations
        join org_members m on m.org_id = o.id
        where m.user_id = user and m.role='student' and m.status='active' and o.status='active' }
-- highest wins: fta > fic  (unchanged precedence)
```

This is the *only* change to a shipped resolver; it's additive (a union) and preserves the existing fta>fic precedence and cohort-week math.

---

## 4. Private community — the Realtime-safe isolation design

### 4.1 Recommended: Custom Access Token Hook injects `org_ids` into the JWT

Supabase supports a **Custom Access Token Hook** (a Postgres function run at token mint / refresh) that adds claims to `app_metadata`. We inject the caller's active org memberships **expanded to include a principal's child classes**:

```sql
-- PROPOSED hook (illustrative). Runs at token issue/refresh.
-- Adds claims.app_metadata.org_ids = [ ...all org ids the user may read... ]
create or replace function auth.add_org_claims(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  uid uuid := (event->>'user_id')::uuid;
  ids uuid[];
begin
  select array_agg(distinct o.id) into ids
  from org_members m
  join organizations o on o.id = m.org_id
  left join organizations child on child.parent_org_id = o.id   -- principal sees child classes
  where m.user_id = uid and m.status = 'active';
  -- (real impl unions child.id for principals; simplified here)
  event := jsonb_set(event, '{claims,app_metadata,org_ids}',
                     to_jsonb(coalesce(ids, '{}'::uuid[])));
  return event;
end $$;
```

Then the streamed table gets a **pure predicate** policy — no cross-table subquery, satisfying Law #2:

```sql
-- SELECT (Realtime-safe): own token's org set OR the public global room
create policy "read org + global messages" on chat_messages for select
using (
  (org_id is null and room_id = 'c0000000-0000-4000-a000-000000000001'::uuid)
  or org_id = any (
       array(select jsonb_array_elements_text(
         auth.jwt() -> 'app_metadata' -> 'org_ids'))::uuid[])
);

-- INSERT: must be a member of the target org (same token check), staff or student of that room
create policy "post to my org rooms" on chat_messages for insert
with check (
  auth.uid() = user_id and (
    (org_id is null and room_id = 'c0000000-0000-4000-a000-000000000001'::uuid)
    or org_id = any (array(select jsonb_array_elements_text(
         auth.jwt() -> 'app_metadata' -> 'org_ids'))::uuid[]))
);
```

- **Why it works with Realtime:** the predicate reads only `chat_messages.org_id`/`room_id` and the JWT — Realtime already holds the JWT (`realtime.setAuth(token)` is already called in `community/page.tsx`), so it can authorize row delivery without touching another table.
- **Client:** reuse `community/page.tsx` verbatim, parameterized by `roomId`; subscribe with `filter: room_id=eq.<roomId>`. Membership is enforced by RLS on top of the room filter.
- **`chat_rooms` / `chat_room_members` policies stay non-recursive** (Law #1): `chat_room_members` keeps `user_id = auth.uid()`; `chat_rooms` SELECT becomes `type = 'general' OR org_id = any(<jwt org_ids>)`.
- **Isolation guarantee:** a message is visible **iff** its `org_id` is in *your own token's* set. There is no query path from student A (class X) to class Y's rows. Global-only members have an empty/absent set and see only the global room.

**Trade-off — token staleness.** JWT claims refresh on token rotation (≈1h) or explicit `supabase.auth.refreshSession()`. Roster changes (add/remove student, new class room) take effect on next refresh. Mitigation: **call `refreshSession()` immediately after** a student joins, is removed, or a room is created, so access flips within the session. Acceptable because class rosters change rarely.

### 4.2 Fallback (only if the token hook is unavailable)

Gate private-room **reads through a SECURITY DEFINER RPC** (`org_room_messages(room_id, before, limit)`) and keep the Realtime subscription but **skip live gating** by making the private-room SELECT policy a bare `room_id = <that room's uuid>` — acceptable *only* if room ids are unguessable UUIDs and never enumerated. This is strictly weaker (a leaked room id = a leak) and is **not recommended**; the JWT approach is the design of record.

---

## 5. Teacher / principal tools & tracking

All read-tools follow the proven **SECURITY DEFINER + internal caller-authorization** pattern (`child_report_stats`, `family_xp_leaderboard`). None of them rely on client-side RLS joins, so none can trip Law #1.

| Tool | Mechanism | Reuse |
|---|---|---|
| **Class roster** | `org_roster(p_org)` RPC → students + status + last-active. Membership reads use `org_members` `user_id=auth.uid()` (self) or the RPC (staff). | `family/members` UI shell |
| **Per-student progress dashboard** | `class_report_stats(p_class)` — clone of `child_report_stats`; verify caller is `teacher`/`principal`/`assistant` of that org; return **per-student** rows (foundations done/total, behind_count, quiz avg, xp, last active) + class aggregates. | `child_report_stats`, `ReportCard.tsx` |
| **Assign homework w/ due dates** | `assignments` table; completion **derived** by joining `ref_id` → `lesson_progress`/`quiz_attempts`/`game_scores`. A `class_assignment_status(p_class)` RPC returns the due/late/done matrix. | existing progress tables (no new tracking) |
| **Class XP leaderboard** | `class_xp_leaderboard(p_class, window)` — clone of `family_xp_leaderboard` but ranks **students within the class** over 7d/30d/all. | `family_xp_leaderboard`, `/leaderboard` |
| **Exportable progress reports** | `/api/class-report` renders `class_report_stats` → CSV (and optional PDF); optional Haiku per-student notes reuse `/api/report-card`. | `/api/report-card` + Haiku-notes cache pattern (`report_notes`) |
| **Principal rollup** | `school_rollup_stats(p_school)` — per-class summaries (active students, avg progress, teacher, at-risk count) across `where parent_org_id = p_school`; verify caller is principal. | new, but same RPC shape |
| **Community moderation** | Staff are `chat_room_members.role='moderator'`; add message soft-delete + `content_reports` in Phase 4. | existing `chat_room_members` roles |

---

## 6. Pricing / licensing surface (structure only — no prices invented)

Billing entity is the **`organizations`** row (`stripe_customer_id`, `stripe_subscription_id`, `seats`, `license_model`, `license_program`). Three exposed models, each mapping to the existing `fic`/`fta` program tiers:

| `license_model` | Meaning | Enforcement | Maps to |
|---|---|---|---|
| `per_seat` | price × active student seats | `org_invites.uses < organizations.seats` at redemption; count active `org_members(role='student')` | `families.plan_tier` equivalent, per head |
| `per_class` | flat license = a bundle of N seats for one class | `seats` set to the bundle size on the class org | one class org |
| `per_school` | site license across all classes (seats null = uncapped) | granted at the school org; child classes inherit | school org + all `parent_org_id` children |

**Curriculum tier ↔ program model:** `organizations.license_program` ∈ {`fic`, `fta`} mirrors `enrollments.program` / `families.plan_tier` (`challenge`≈fic, `academy`≈fta). An org license grants program access to **all its students without per-family `enrollments` rows** — resolved in `get_home_state` via the union in §3.4. FTA-tier org access implies FIC foundations (same rule as families). **No dollar amounts are specified here by design**; the Stripe products/prices are a separate setup step keyed off `license_model` + `license_program`.

---

## 7. Phased build plan (effort: S ≈ ≤1 day, M ≈ 2–4 days, L ≈ 1–2 weeks)

### Phase 0 — Foundations & guardrails · **S**
- Finalize schema (§2), COPPA/consent copy, minor-safety policy doc.
- **Decide + enable the Custom Access Token Hook** in a dev branch and prove `org_ids` lands in the JWT. *(Gate for Phase 1 realtime.)*
- **Enable RLS** on the 9 currently-disabled core tables in a branch and re-verify the existing 7/7 live flows. *(Hard pre-GA blocker; do it early.)*
- Reuse: nothing. New: migration `026` scaffolding.

### Phase 1 — Teacher + Class + Roster + Private Class Community (MVP) · **L**
Ship the smallest end-to-end unit: **one teacher, one class, a roster, and a private class chat that streams.**
- Migration `026`: `organizations`, `org_members`, `org_invites`, `chat_rooms.org_id`, `chat_messages.org_id`, extend `profiles.role` (+teacher), `chat_messages` denorm trigger, token hook, all with RLS per §4.
- Teacher registration path + class creation UI. *(new; models on parent signup)*
- Roster + invite generation UI. *(reuse `family/members/page.tsx` almost verbatim → `org_invites`)*
- Student roster-only redemption `/signup/join/[code]`. *(reuse `/signup/invite/[code]` minor-safe fork)*
- Private class room: parameterize `community/page.tsx` by `roomId`/`org_id`; auto-create a class room on class creation; staff seeded as moderators. *(reuse)*
- Class roster + per-student progress via `class_report_stats`. *(reuse `child_report_stats` + `ReportCard.tsx`)*
- Extend `get_home_state` union (§3.4) so org students get content access. *(surgical RPC edit)*
- Teacher shell nav variant. *(reuse role-aware shell)*
- **Reuse ≈ 70%** (invites, invite-signup, community page, report RPC, shell). **New ≈ 30%** (org tables, token hook, teacher signup/class-create).

### Phase 2 — Teacher tools depth · **M**
- `assignments` + `class_assignment_status` RPC (derived completion); homework UI with due dates. *(reuse progress tables)*
- `class_xp_leaderboard` + class leaderboard page. *(reuse `family_xp_leaderboard` + `/leaderboard`)*
- Exportable reports `/api/class-report` (CSV, optional Haiku notes). *(reuse `/api/report-card`)*
- Optional `assignment_submissions` only if custom/offline homework is requested.

### Phase 3 — School / Principal tier · **L**
- School registration, multi-class management, teacher invites under a school.
- Principal rollup `school_rollup_stats`; school-wide community room; token-hook expansion to include child classes for principals.
- **Seat licensing + Stripe org billing** (`per_seat`/`per_class`/`per_school`), seat-cap enforcement at redemption, org billing console. *(models on family billing, but org-scoped)*

### Phase 4 — Safety, moderation & polish · **M**
- Message soft-delete, `content_reports`, moderation queue for staff, audit log of roster/permission changes.
- Per-class room enable/disable toggle; optional parent-visibility bridge (parent of a student sees that child's class report).
- Profanity filter on student posts; rate limits.

---

## 8. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Minor safety / moderation** — under-13 students, unmoderated chat, PII exposure | High | Roster-only (no self-signup, no directory, no student DMs); display-name-only PII; staff-as-moderators; COPPA school-consent captured at org creation; profanity filter + report button (Phase 4); reuse existing kid privacy locks. |
| **RLS complexity → Realtime silently not delivering** (the mig-019 trap) | High | Private-room SELECT is a **pure JWT-vs-column predicate** (§4.1), never a cross-table subquery. Add an explicit Realtime delivery test to the Phase 1 acceptance matrix (insert as student → assert the other student receives it live). |
| **RLS recursion** (the mig-018 trap) | Med | `org_members`/`chat_room_members` policies stay `user_id = auth.uid()`; all staff cross-member reads go through SECURITY DEFINER RPCs, never client joins. |
| **Community isolation leak** (class X sees class Y, or private leaks to global) | High | Single denormalized `org_id` filter + JWT `org_ids` set; `chat_messages.org_id` set **server-side** from the room (trigger), never client-supplied; global room pinned to `org_id IS NULL`. Ship a **cross-tenant test matrix**: student-A-in-X must see X only; global-only member sees global only; principal sees school + child classes only. |
| **JWT staleness on roster change** | Low | `refreshSession()` immediately after join/removal/room-create; document ≈1h natural refresh; roster changes are infrequent. |
| **Dual-membership confusion** (kid in family + school) | Low | Family and org dimensions kept orthogonal; XP single-sourced, two aggregations; content resolver unions access (§3.4). |
| **`profiles.role` vs `org_members.role` collision** (parent who teaches) | Low | `org_members.role` is authoritative for org tools; `profiles.role` drives default nav only; documented. |
| **9 RLS-disabled core tables reaching real students** | High | Hard pre-GA gate in Phase 0: enable + re-verify all shipped flows before any real minor data lands. |
| **Seat over-allocation / billing drift** | Med | Enforce `uses < seats` at redemption inside the invite-redeem RPC (atomic); reconcile active students vs seats nightly. |

---

## 9. Reuse-vs-new ledger (at a glance)

**Reuse (minimal change):** `family_invites` UI → `org_invites`; `/signup/invite/[code]` → `/signup/join/[code]`; `community/page.tsx` (param by room); `child_report_stats` → `class_report_stats`; `family_xp_leaderboard` → `class_xp_leaderboard`; `ReportCard.tsx`; `/api/report-card` Haiku-notes + `report_notes` cache; role-aware shell nav; kid privacy-lock redirects; `realtime.setAuth(token)` flow.

**New:** `organizations` / `org_members` / `org_invites` / `assignments` tables; Custom Access Token Hook (`org_ids` claim); `chat_*` `org_id` columns + denorm trigger; teacher & school registration + class-create flows; `school_rollup_stats`; seat licensing + org Stripe billing; moderation/audit (Phase 4); the `get_home_state` union edit.

---

## 10. Open decisions for the user (not blockers to Phase 1 planning)

1. Confirm the **Custom Access Token Hook** is acceptable (it's the linchpin of realtime isolation). If not, we fall back to §4.2 (weaker).
2. **Student auth identity:** synthetic email vs. Supabase anonymous auth vs. teacher-provisioned credentials — affects the redemption flow.
3. **Teacher approval gate** on student join: on or off by default?
4. Should a **parent of a student** be able to see the child's *class* report (cross-dimension bridge), or keep family/school strictly separate? (Phase 4 toggle either way.)
5. Whether standalone teachers (no school) are a first-class product or only exist under schools.
```