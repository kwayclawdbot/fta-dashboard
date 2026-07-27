-- ============================================================================
-- 180 · CLUB MISSIONS — weekly reps for the adult club register
-- ----------------------------------------------------------------------------
-- The canvas "10 · Missions" artboard needs real, trackable club missions
-- (not the kid FIC missions seeded in 032). Rather than a parallel table, we
-- EXTEND fic_missions with the columns a weekly, register-aware club mission
-- needs, and add a per-user streak row so the "STREAK REWARD" strip on the
-- artboard is real. Everything remains additive + nullable so the existing
-- kid missions and their completions keep working untouched.
-- XP stays on the existing ledger (awardXp / xp_events) — no new points system.
-- ============================================================================

-- 1. Extend the mission catalog for the club register ------------------------
alter table fic_missions
  add column if not exists register     text not null default 'kid',   -- 'kid' | 'club'
  add column if not exists cadence       text not null default 'evergreen', -- 'evergreen' | 'weekly'
  add column if not exists category      text,                          -- rate | thesis | event | lesson | invite
  add column if not exists target_count  int  not null default 1,       -- e.g. rate 5 tickers
  add column if not exists action_href   text,                          -- where "Start" routes
  add column if not exists accent        text,                          -- teal | kai | volt | gold (chip identity)
  add column if not exists is_weekly_hero boolean not null default false;-- the single "THIS WEEK" mission

-- Existing kid rows keep register='kid' via the default. Nothing else changes.

-- 2. Weekly mission progress (per user, per ISO week) ------------------------
-- Club missions reset every Sunday. We track progress against the current week
-- key so the artboard's "3 / 5 done" + progress bar are real, and Sunday's
-- reset is a pure key rollover (no destructive wipe of history).
create table if not exists club_mission_progress (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  mission_id  uuid not null references fic_missions(id) on delete cascade,
  week_key    text not null,                       -- e.g. '2026-W30' (ISO week, resets Sunday)
  progress    int  not null default 0,
  target      int  not null default 1,
  completed_at timestamptz,
  updated_at  timestamptz not null default now(),
  unique (user_id, mission_id, week_key)
);
create index if not exists idx_club_mission_progress_user_week
  on club_mission_progress(user_id, week_key);

alter table club_mission_progress enable row level security;
drop policy if exists "Own read club mission progress" on club_mission_progress;
create policy "Own read club mission progress" on club_mission_progress for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Own upsert club mission progress" on club_mission_progress;
create policy "Own insert club mission progress" on club_mission_progress for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "Own update club mission progress" on club_mission_progress;
create policy "Own update club mission progress" on club_mission_progress for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Mission streak (per user) — powers the "STREAK REWARD" strip ------------
create table if not exists club_mission_streaks (
  user_id        uuid primary key references profiles(id) on delete cascade,
  weeks_current  int not null default 0,      -- consecutive weeks the hero mission was completed
  weeks_best     int not null default 0,
  last_week_key  text,
  updated_at     timestamptz not null default now()
);
alter table club_mission_streaks enable row level security;
drop policy if exists "Own read mission streak" on club_mission_streaks;
create policy "Own read mission streak" on club_mission_streaks for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Own write mission streak" on club_mission_streaks;
create policy "Own upsert mission streak" on club_mission_streaks for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "Own update mission streak" on club_mission_streaks;
create policy "Own update mission streak" on club_mission_streaks for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
