-- ════════════════════════════════════════════════════════════════════════════
-- 203 · FAMILY NIGHT — the transcript table
--
-- WHAT THIS IS NOT: the ledger of record. Attendance and the XP it pays are
-- xp_events rows carrying ref_id 'family_night:<YYYY-MM-DD>', written through
-- /api/family/night. Those rows are readable back by the household (the family
-- read policy on xp_events), so the guided flow at /family/tonight works with
-- NO new table at all — it shipped before this migration was applied and does
-- not depend on it.
--
-- WHAT THIS IS: the transcript. xp_events records that somebody was paid for a
-- night; it cannot record WHICH COMPANY the night was about or who hosted it.
-- One row per family per night carries that context so the household can look
-- back at what it has actually studied together.
--
-- Additive only. No existing table, policy or grant is touched. The API route
-- writes this row inside a try/catch that ignores "relation does not exist", so
-- applying this migration turns the transcript on with no code change.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists family_night_sessions (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  night        date not null default current_date,
  ticker       text,
  company_name text,
  host_id      uuid references profiles(id) on delete set null,
  attendee_ids uuid[] not null default '{}',
  created_at   timestamptz not null default now(),
  unique (family_id, night)
);

create index if not exists idx_family_night_family
  on family_night_sessions(family_id, night desc);

alter table family_night_sessions enable row level security;

-- Same shape as the family_mode tables in 192: the household reads its own
-- history; only a parent of that household writes it. get_my_family_id() and
-- get_my_role() are the SECURITY DEFINER helpers from 039 — a policy cannot
-- subquery profiles directly here without recursing (018/019 scars).
grant select, insert, update on family_night_sessions to authenticated;

drop policy if exists "Family reads its nights" on family_night_sessions;
create policy "Family reads its nights" on family_night_sessions
  for select to authenticated
  using (family_id = public.get_my_family_id());

drop policy if exists "Parents record a night" on family_night_sessions;
create policy "Parents record a night" on family_night_sessions
  for insert to authenticated
  with check (
    family_id = public.get_my_family_id()
    and public.get_my_role() in ('parent', 'admin')
  );

drop policy if exists "Parents amend a night" on family_night_sessions;
create policy "Parents amend a night" on family_night_sessions
  for update to authenticated
  using (
    family_id = public.get_my_family_id()
    and public.get_my_role() in ('parent', 'admin')
  )
  with check (
    family_id = public.get_my_family_id()
    and public.get_my_role() in ('parent', 'admin')
  );

comment on table family_night_sessions is
  'Transcript of a family discussion night: which company, who hosted, who was there. NOT the ledger of record — attendance XP lives in xp_events with ref_id family_night:<date>, and /family/tonight works without this table.';
