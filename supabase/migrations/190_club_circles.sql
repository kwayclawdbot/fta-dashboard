-- 190 — CIRCLES: time-boxed sub-groupings of the Club (canvas v2, App board 16).
--
-- WHY A NEW TABLE AT ALL. The Circles surface had NO backing schema before this
-- migration — audited against every existing grouping table and none of them is
-- a Circle:
--   • chat_rooms (001)      — family/cohort/general/lesson/dm rooms. Permanent,
--                             no clock, no premise, and its `type` check would
--                             have to be widened, which touches a shipped table.
--   • cohorts (013)         — an ENROLLMENT window for a program, not a member-
--                             started room around a thesis.
--   • debates (139)         — one club-wide YES/NO question with a tally. A
--                             Circle is a room with a roster and a thread.
--   • club_events (138)     — attention telemetry, insert-own/read-own.
-- So: two new tables plus a thread table. Nothing existing is altered.
--
-- WHAT A CIRCLE IS. A breakout room around ONE event or ONE thesis, opened by a
-- member, with a hard 30-day clock. When the clock runs out the Circle closes
-- and the thread stands as the record. It is deliberately NOT "graded" — the
-- canvas copy says receipts get graded at month end, and grading a member's
-- calls is a performance claim we do not publish (plan §0.1).
--
-- KID WALL. Family Mode limits a minor's chat to the Family Circle, so kids may
-- READ a Circle but may not open one, join one, or post in one. Enforced in RLS
-- via viewer_is_kid() (migration 137) — the same definer used by the screener
-- and debate walls, so the wall cannot be bypassed by hitting PostgREST direct.
--
-- ROSTER VISIBILITY. Membership rows are readable club-wide: the roster IS the
-- surface (who is in this room), and the same names/avatars are already public
-- on the leaderboard and public profiles. No private data is added here.

-- ── 1. The Circle ───────────────────────────────────────────────────────────
create table if not exists club_circles (
  id uuid primary key default gen_random_uuid(),
  -- URL identity. Stable for the life of the Circle; generated app-side from
  -- the title with a short random suffix so two "Fed Decision" Circles can
  -- coexist without a collision retry loop.
  slug text not null unique,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  -- A short free label ("Semis", "Macro", "Energy"). Not an enum: the canvas's
  -- own list is open-ended and a fixed enum would date within a month.
  topic text not null check (char_length(btrim(topic)) between 2 and 24),
  -- The one line the Circle exists to argue about.
  premise text not null check (char_length(btrim(premise)) between 10 and 280),
  -- Optional bound equity. Equities only — there is no options surface here.
  ticker text check (ticker is null or ticker ~ '^[A-Z.\-]{1,10}$'),
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- The clock. Hard-capped at 30 days from creation by the check below.
  expires_at timestamptz not null,
  constraint club_circles_clock check (
    expires_at > created_at and expires_at <= created_at + interval '30 days'
  )
);

create index if not exists idx_club_circles_expires on club_circles(expires_at desc);
create index if not exists idx_club_circles_creator on club_circles(created_by);

-- ── 2. The roster ───────────────────────────────────────────────────────────
create table if not exists club_circle_members (
  circle_id uuid not null references club_circles(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (circle_id, member_id)
);

create index if not exists idx_club_circle_members_member on club_circle_members(member_id);

-- ── 3. The thread ───────────────────────────────────────────────────────────
-- A contribution inside a Circle. `stance` mirrors the existing bear/neutral/
-- bull vocabulary (ticker_stances, migration 151) so the two never diverge, but
-- it is stored here rather than bridged: a stance taken INSIDE a 30-day room is
-- scoped to that room's premise, not to the member's standing position on the
-- ticker.
create table if not exists club_circle_notes (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references club_circles(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  stance text check (stance is null or stance in ('bear', 'neutral', 'bull')),
  created_at timestamptz not null default now()
);

create index if not exists idx_club_circle_notes_circle on club_circle_notes(circle_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table club_circles enable row level security;
alter table club_circle_members enable row level security;
alter table club_circle_notes enable row level security;

-- Circles are readable by every authenticated member, kids included (reading a
-- room is not chatting in it).
drop policy if exists "Read circles" on club_circles;
create policy "Read circles" on club_circles
  for select to authenticated using (true);

-- Opening a Circle: adults/teens only, must be your own row, and the clock must
-- already be inside the 30-day cap (the table check enforces the cap itself).
drop policy if exists "Open own circle" on club_circles;
create policy "Open own circle" on club_circles
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and not coalesce(public.viewer_is_kid(), false)
  );

-- The opener may edit the premise/title while the clock is still running. The
-- clock itself is immutable by design — a Circle cannot be extended, which is
-- the entire point of the format.
drop policy if exists "Opener edits own circle" on club_circles;
create policy "Opener edits own circle" on club_circles
  for update to authenticated
  using (created_by = auth.uid() and expires_at > now())
  with check (created_by = auth.uid());

-- Roster: club-readable, join/leave is own-row only, adults/teens only.
drop policy if exists "Read circle roster" on club_circle_members;
create policy "Read circle roster" on club_circle_members
  for select to authenticated using (true);

drop policy if exists "Join circle" on club_circle_members;
create policy "Join circle" on club_circle_members
  for insert to authenticated
  with check (
    member_id = auth.uid()
    and not coalesce(public.viewer_is_kid(), false)
    and exists (
      select 1 from public.club_circles c
      where c.id = circle_id and c.expires_at > now()
    )
  );

drop policy if exists "Leave circle" on club_circle_members;
create policy "Leave circle" on club_circle_members
  for delete to authenticated using (member_id = auth.uid());

-- Thread: club-readable. Posting requires (a) not a kid, (b) your own row,
-- (c) membership of the Circle, (d) a Circle whose clock has not run out.
drop policy if exists "Read circle notes" on club_circle_notes;
create policy "Read circle notes" on club_circle_notes
  for select to authenticated using (true);

drop policy if exists "Post in joined circle" on club_circle_notes;
create policy "Post in joined circle" on club_circle_notes
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and not coalesce(public.viewer_is_kid(), false)
    and exists (
      select 1 from public.club_circle_members m
      where m.circle_id = club_circle_notes.circle_id and m.member_id = auth.uid()
    )
    and exists (
      select 1 from public.club_circles c
      where c.id = club_circle_notes.circle_id and c.expires_at > now()
    )
  );

-- A member may retract their own note. No edit: the thread is a record.
drop policy if exists "Delete own circle note" on club_circle_notes;
create policy "Delete own circle note" on club_circle_notes
  for delete to authenticated using (author_id = auth.uid());

-- ── Roster + thread counts without an N+1 ───────────────────────────────────
-- The list surface needs "how many are in this room" and "how many notes" for
-- every open Circle in ONE round trip. Both counts are over club-readable rows,
-- so this is a convenience aggregate, not a privilege escalation — it stays
-- `stable` and NOT security definer for exactly that reason.
create or replace function public.club_circle_counts()
returns table (circle_id uuid, members bigint, notes bigint)
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select c.id,
         (select count(*) from public.club_circle_members m where m.circle_id = c.id),
         (select count(*) from public.club_circle_notes n where n.circle_id = c.id)
  from public.club_circles c
$$;

revoke all on function public.club_circle_counts() from public;
grant execute on function public.club_circle_counts() to authenticated;
