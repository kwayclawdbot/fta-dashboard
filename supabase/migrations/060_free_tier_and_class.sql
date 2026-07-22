-- 060 — FREE tier + free-class funnel
--
-- Adds a third membership tier ('free') for social-funnel signups, the weekly
-- free class as a live_sessions.class_type, and the funnel's data tables.
--
-- TIER MECHANISM (chosen: enrollments.program gains 'free'):
--   The ENTIRE tier derivation already lives in the enrollment-based
--   `family_tiers` view (migration 029). Adding a third program value is a
--   natural extension of that ONE mechanism, versus a parallel families marker
--   column that would create two sources of truth to keep in sync.
--   BACKWARD COMPAT: existing families have only 'fic'/'fta' enrollments or NO
--   enrollment at all; none have 'free'. The view keeps its default (no
--   matching active enrollment => 'fic'), so paying-era families with no
--   enrollment still derive 'fic' exactly as before. Only an explicit active
--   'free' enrollment (created by the funnel) yields tier 'free'.

-- ── 1. enrollments.program gains 'free' ──────────────────────────────────────
alter table enrollments drop constraint if exists enrollments_program_check;
alter table enrollments add constraint enrollments_program_check
  check (program in ('fic', 'fta', 'free'));

-- ── 2. family_tiers: explicit priority fta > fic > free, default 'fic' ────────
-- Priority matters so a free family that later BUYS fic/fta reads as the paid
-- tier even if the stale 'free' enrollment row lingers (view is derived, never
-- needs cleanup). Same 2 columns/types as 029, so create-or-replace is safe.
create or replace view family_tiers as
  select f.id as family_id,
         case
           when exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'fta' and e.status = 'active'
           ) then 'fta'
           when exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'fic' and e.status = 'active'
           ) then 'fic'
           when exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'free' and e.status = 'active'
           ) then 'free'
           else 'fic'
         end as tier
  from families f;

grant select on family_tiers to authenticated;

-- ── 3. live_sessions.class_type gains 'free_class' ───────────────────────────
alter table live_sessions drop constraint if exists live_sessions_class_type_check;
alter table live_sessions add constraint live_sessions_class_type_check
  check (class_type in (
    'weekly_class', 'guest_speaker', 'orientation',
    'parent_qa', 'kids_money_lab', 'market_recap', 'free_class'
  ));

-- ── 4. app_settings — admin-configurable, public-readable UI config ──────────
-- key/value store. First use: the free-class funnel video URL (shown on a
-- PUBLIC page, so anon read is intentional; values here are non-sensitive).
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;
grant select on app_settings to anon, authenticated;
grant insert, update, delete on app_settings to authenticated;

drop policy if exists "app_settings public read" on app_settings;
create policy "app_settings public read" on app_settings
  for select using (true);

drop policy if exists "app_settings admin write" on app_settings;
create policy "app_settings admin write" on app_settings
  for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Seed the funnel video with the existing app walkthrough as a PLACEHOLDER.
-- TODO(owner): record a proper free-class funnel video and update this value
-- (admin can PATCH app_settings key 'free_class_video_url').
insert into app_settings (key, value)
values (
  'free_class_video_url',
  to_jsonb('https://zvkercqohmmeyofycbgr.supabase.co/storage/v1/object/public/community-media/walkthrough/app-walkthrough.mp4'::text)
)
on conflict (key) do nothing;

-- ── 5. free_class_registrations — funnel signups ─────────────────────────────
create table if not exists free_class_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  email text not null,
  quiz jsonb not null default '{}'::jsonb,
  source text not null default 'funnel',
  session_id uuid references live_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_free_class_reg_session on free_class_registrations(session_id);
create index if not exists idx_free_class_reg_email on free_class_registrations(email);

alter table free_class_registrations enable row level security;
grant select on free_class_registrations to authenticated;

-- Rows are written by the registration API using the service role (bypasses
-- RLS). Admins can read for the CRM; no member-facing read path is needed.
drop policy if exists "free_class_registrations admin read" on free_class_registrations;
create policy "free_class_registrations admin read" on free_class_registrations
  for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
