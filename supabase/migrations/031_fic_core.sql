-- 031 — FIC core: weekly club record, orientation checklist state, live-session class types.
--
-- The Family Investing Club runs on a weekly rhythm: one money concept, one
-- Company of the Week, one family assignment, one kid challenge. The owner
-- authors each week from the admin dashboard (no agent-drafting for MVP).
--
-- RLS notes (018/019 scars): these are NOT realtime tables (never added to the
-- supabase_realtime publication), so simple scalar subqueries against profiles
-- in the policies are safe. No policy selects from its own table (no recursion).

-- ── 1. fic_weeks ────────────────────────────────────────────────────────────
-- One row per club week. Feeds the home "This Week in FIC" subtab, Parent
-- Corner, and the kid challenge from a single record.
create table if not exists fic_weeks (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,

  -- Class
  class_title text not null,
  class_session_id uuid references live_sessions(id) on delete set null,

  -- Company of the Week (breakdown template, plan §2)
  company_name text,
  company_ticker text,
  cotw_what_they_do text,            -- what they do
  cotw_how_they_make_money text,     -- how they make money
  cotw_why_customers_love text,      -- why customers love them
  cotw_why_investors_watch text,     -- why investors watch
  cotw_what_could_go_wrong text,     -- what could go wrong
  cotw_discussion_question text,     -- family discussion question
  cotw_watchlist_assignment text,    -- watchlist assignment

  -- Family assignment + prompts
  family_assignment text,
  parent_prompt text,
  kid_challenge text,

  -- Parent Corner weekly content (plan §4)
  parent_what_child_learned text,
  parent_dinner_questions text,
  parent_explain_simply text,
  parent_what_not_to_do text,
  parent_risk_talk text,
  parent_patience text,

  -- Publishing / current-week selection
  published boolean not null default false,
  is_current boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fic_weeks_published_week_idx
  on fic_weeks (published, week_start desc);

alter table fic_weeks enable row level security;

-- Members read PUBLISHED weeks; admins read/write everything (incl. drafts).
drop policy if exists "fic_weeks_member_read" on fic_weeks;
create policy "fic_weeks_member_read" on fic_weeks
  for select to authenticated
  using (
    published
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "fic_weeks_admin_insert" on fic_weeks;
create policy "fic_weeks_admin_insert" on fic_weeks
  for insert to authenticated
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

drop policy if exists "fic_weeks_admin_update" on fic_weeks;
create policy "fic_weeks_admin_update" on fic_weeks
  for update to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

drop policy if exists "fic_weeks_admin_delete" on fic_weeks;
create policy "fic_weeks_admin_delete" on fic_weeks
  for delete to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- ── 2. orientation_progress ─────────────────────────────────────────────────
-- Family-level "Start Here" checklist state. One row per (family, step).
create table if not exists orientation_progress (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  step_key text not null,
  completed_at timestamptz not null default now(),
  completed_by uuid references profiles(id) on delete set null,
  unique (family_id, step_key)
);

create index if not exists orientation_progress_family_idx
  on orientation_progress (family_id);

alter table orientation_progress enable row level security;

-- Any member reads / writes their own family's checklist state.
drop policy if exists "orientation_progress_family_read" on orientation_progress;
create policy "orientation_progress_family_read" on orientation_progress
  for select to authenticated
  using (family_id in (select family_id from public.profiles where id = auth.uid()));

drop policy if exists "orientation_progress_family_insert" on orientation_progress;
create policy "orientation_progress_family_insert" on orientation_progress
  for insert to authenticated
  with check (family_id in (select family_id from public.profiles where id = auth.uid()));

drop policy if exists "orientation_progress_family_delete" on orientation_progress;
create policy "orientation_progress_family_delete" on orientation_progress
  for delete to authenticated
  using (family_id in (select family_id from public.profiles where id = auth.uid()));

-- ── 3. live_sessions class types ────────────────────────────────────────────
alter table live_sessions add column if not exists class_type text
  check (class_type in (
    'weekly_class', 'guest_speaker', 'orientation',
    'parent_qa', 'kids_money_lab', 'market_recap'
  ));
alter table live_sessions add column if not exists worksheet_url text;
alter table live_sessions add column if not exists assignment text;
