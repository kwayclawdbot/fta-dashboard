-- 033 — Community rooms split, professional-title badges, onboarding avatars
--
-- Three additive changes for the FIC dashboard build (owner-locked plan
-- 2026-07-20, "Family Badges" + "onboarding avatar/username" PROMOTED items):
--
--   1. ROOMS  — the single community room (seeded 016 as "FTA Community") is
--      renamed "FIC Club" (history preserved) and a second general room,
--      "FTA Traders", is added. Which rooms a member may OPEN is enforced at
--      the app layer (community page: FIC families see FIC Club only, FTA
--      families see both) — the same posture the platform already uses for its
--      single global room. RLS below stays deliberately simple.
--
--   2. BADGES — professional-title credentials (career identities, not scout
--      names). Extends the legacy `badges` table (001) with subtitle /
--      criteria_key / sort, adds `badge_awards`, seeds the 6 owner titles, and
--      exposes a SECURITY DEFINER `award_badge(slug)` as the ONLY write path.
--
--   3. AVATARS — no schema change: profiles.avatar_url (001) already stores the
--      chosen preset path (e.g. '/avatars/adults/a03.png') or an uploaded URL.
--
-- ⚠️ RLS SCARS (migrations 018/019): Supabase Realtime evaluates the SELECT
-- policy per row and CANNOT authorize a policy that subqueries another table,
-- and self-referential policies caused 42P17 recursion in prod. The
-- chat_messages SELECT policy therefore stays a bare column comparison — now an
-- IN against TWO constant room UUIDs (still no subquery, still realtime-safe).
-- badge_awards is NOT a realtime table, so its family-read subquery is fine.

-- ── 1. ROOMS ────────────────────────────────────────────────────────────────

-- Fixed IDs (idempotent). Room 1 already exists from migration 016.
--   FIC Club     c0000000-0000-4000-a000-000000000001  (renamed in place)
--   FTA Traders  c0000000-0000-4000-a000-000000000002  (new)
update chat_rooms
  set name = 'FIC Club'
  where id = 'c0000000-0000-4000-a000-000000000001'::uuid;

insert into chat_rooms (id, type, name)
values ('c0000000-0000-4000-a000-000000000002'::uuid, 'general', 'FTA Traders')
on conflict (id) do nothing;

-- Realtime-safe SELECT: bare column comparison against the two known community
-- rooms (constants only, no subquery — honors the 019 scar). The 016 "Post to
-- general rooms" INSERT policy already covers both (both are type 'general').
drop policy if exists "Read community messages" on chat_messages;
create policy "Read community messages" on chat_messages
  for select using (
    room_id in (
      'c0000000-0000-4000-a000-000000000001'::uuid,
      'c0000000-0000-4000-a000-000000000002'::uuid
    )
  );

-- ── 2. BADGES ───────────────────────────────────────────────────────────────

-- Extend the legacy badges table (001: id, slug, title, description, icon_url,
-- criteria jsonb, created_at) with the credential fields the plan calls for.
alter table badges add column if not exists subtitle text;
alter table badges add column if not exists criteria_key text;
alter table badges add column if not exists sort int not null default 0;

-- badge_awards — one row per (badge, user). Separate from the legacy
-- user_badges table (which stays untouched); awards land here via award_badge().
create table if not exists badge_awards (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references badges(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (badge_id, user_id)
);

create index if not exists idx_badge_awards_user on badge_awards(user_id);
create index if not exists idx_badge_awards_badge on badge_awards(badge_id);

alter table badge_awards enable row level security;

-- Read: your own awards + your family's (non-realtime table, subquery is fine).
drop policy if exists "Read own and family badge awards" on badge_awards;
create policy "Read own and family badge awards" on badge_awards
  for select using (
    user_id = auth.uid()
    or user_id in (
      select p.id from profiles p
      where p.family_id = (select family_id from profiles where id = auth.uid())
    )
  );

-- No INSERT/UPDATE/DELETE policy — writes go only through award_badge() below.
revoke insert, update, delete on badge_awards from authenticated, anon;

-- badges read-all already exists (001 "Anyone can read badges"); re-assert.
drop policy if exists "Anyone can read badges" on badges;
create policy "Anyone can read badges" on badges for select using (true);

-- award_badge — the sole write path into badge_awards. Self-award only
-- (a user can only earn their own badge); idempotent via the unique pair.
create or replace function public.award_badge(p_slug text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_badge_id uuid;
  v_inserted boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  select id into v_badge_id from badges where slug = p_slug;
  if v_badge_id is null then
    return false;
  end if;

  insert into badge_awards (badge_id, user_id)
  values (v_badge_id, auth.uid())
  on conflict (badge_id, user_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted > 0;
end;
$$;

grant execute on function public.award_badge(text) to authenticated;

-- Seed the 6 PROFESSIONAL TITLES (career identities, not playful scout names).
-- criteria_key documents the engine check; evaluation lives in src/lib/badges.ts.
insert into badges (slug, title, subtitle, criteria_key, sort) values
  ('scout',        'Scout',        'Added 5 companies to the family watchlist',   'watchlist_adds_5',      1),
  ('analyst',      'Analyst',      'Completed research cards on 3 companies',     'research_cards_3',      2),
  ('risk_manager', 'Risk Manager', 'Identified the risk on 5 companies',          'risk_fields_5',         3),
  ('investor',     'Investor',     'Attended 4 weekly family classes',            'weekly_classes_4',      4),
  ('technician',   'Technician',   'Completed the beginner chart lesson',         'chart_lesson_beginner', 5),
  ('ceo',          'CEO',          'Completed the Family CEO mission',            'mission_family_ceo',    6)
on conflict (slug) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  criteria_key = excluded.criteria_key,
  sort = excluded.sort;
