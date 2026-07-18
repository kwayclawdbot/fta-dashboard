-- ============================================
-- Tier 1 engine: XP/gamification, flashcards, games, RSVP, report notes.
--
-- RLS notes (learned the hard way by a prior agent):
--   * Policies here are SIMPLE and NON-recursive. The "family read" pattern
--     subqueries `profiles` (a different table), mirroring the existing
--     sim_scenario_scores policy — safe because none of these tables are
--     consumed via Realtime and none of the policies are self-referential.
--   * The cross-family leaderboard uses a SECURITY DEFINER function so it can
--     rank every family without exposing raw xp rows to clients.
-- ============================================

-- 1. XP events ---------------------------------------------------------------
create table if not exists xp_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount int not null,
  kind text not null check (kind in ('lesson','quiz','flashcards','game','community','rsvp','bonus')),
  ref_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_xp_events_user on xp_events(user_id);
create index if not exists idx_xp_events_created on xp_events(created_at);

alter table xp_events enable row level security;
drop policy if exists "Family members read xp" on xp_events;
create policy "Family members read xp" on xp_events for select to authenticated
  using (user_id in (
    select id from profiles
    where family_id = (select family_id from profiles where id = auth.uid())
  ));
drop policy if exists "Own insert xp" on xp_events;
create policy "Own insert xp" on xp_events for insert to authenticated
  with check (user_id = auth.uid());

-- 2. Flashcards --------------------------------------------------------------
create table if not exists flashcards (
  id text primary key,
  week int,
  track text,
  front text not null,
  back text not null,
  source text
);
create index if not exists idx_flashcards_track_week on flashcards(track, week);

alter table flashcards enable row level security;
drop policy if exists "Read flashcards" on flashcards;
create policy "Read flashcards" on flashcards for select to authenticated using (true);

create table if not exists flashcard_reviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  card_id text not null references flashcards(id) on delete cascade,
  due_at date not null default current_date,
  interval_days int not null default 1,
  streak int not null default 0,
  last_result text,
  updated_at timestamptz not null default now(),
  unique (user_id, card_id)
);
create index if not exists idx_flashcard_reviews_user on flashcard_reviews(user_id);

alter table flashcard_reviews enable row level security;
drop policy if exists "Own flashcard reviews" on flashcard_reviews;
create policy "Own flashcard reviews" on flashcard_reviews for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Games -------------------------------------------------------------------
-- Seeded game content (keeps the content bank's string ids as PKs).
create table if not exists game_items (
  id text primary key,
  game text not null,
  prompt text not null,
  answer text not null,
  why text,
  source text,
  ord int not null default 0
);
create index if not exists idx_game_items_game on game_items(game, ord);

alter table game_items enable row level security;
drop policy if exists "Read game items" on game_items;
create policy "Read game items" on game_items for select to authenticated using (true);

create table if not exists game_scores (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  game text not null,
  score int not null default 0,
  rounds int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_game_scores_user on game_scores(user_id);

alter table game_scores enable row level security;
drop policy if exists "Family members read game scores" on game_scores;
create policy "Family members read game scores" on game_scores for select to authenticated
  using (user_id in (
    select id from profiles
    where family_id = (select family_id from profiles where id = auth.uid())
  ));
drop policy if exists "Own insert game scores" on game_scores;
create policy "Own insert game scores" on game_scores for insert to authenticated
  with check (user_id = auth.uid());

-- 4. Session RSVPs -----------------------------------------------------------
create table if not exists session_rsvps (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  family_id uuid references families(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);
create index if not exists idx_session_rsvps_session on session_rsvps(session_id);
create index if not exists idx_session_rsvps_user on session_rsvps(user_id);

alter table session_rsvps enable row level security;
-- Counts ("N families going") need to see all RSVPs for a session.
drop policy if exists "Read rsvps" on session_rsvps;
create policy "Read rsvps" on session_rsvps for select to authenticated using (true);
drop policy if exists "Own insert rsvp" on session_rsvps;
create policy "Own insert rsvp" on session_rsvps for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "Own delete rsvp" on session_rsvps;
create policy "Own delete rsvp" on session_rsvps for delete to authenticated
  using (user_id = auth.uid());

-- 5. Report-card coach notes (cached) ---------------------------------------
create table if not exists report_notes (
  id uuid primary key default uuid_generate_v4(),
  child_id uuid not null references profiles(id) on delete cascade,
  week int not null,
  note text not null,
  created_at timestamptz not null default now(),
  unique (child_id, week)
);
create index if not exists idx_report_notes_child on report_notes(child_id);

alter table report_notes enable row level security;
drop policy if exists "Family members read report notes" on report_notes;
create policy "Family members read report notes" on report_notes for select to authenticated
  using (child_id in (
    select id from profiles
    where family_id = (select family_id from profiles where id = auth.uid())
  ));
-- Notes are written by the /api/report-card route on the parent's session,
-- which verifies family ownership before writing.
drop policy if exists "Authenticated write report notes" on report_notes;
create policy "Authenticated write report notes" on report_notes for insert to authenticated
  with check (true);
drop policy if exists "Authenticated update report notes" on report_notes;
create policy "Authenticated update report notes" on report_notes for update to authenticated
  using (true) with check (true);

-- 6. Let parents read their children's quiz attempts (mirror the existing
--    sim_scenario_scores family-read policy) so report cards can show scores.
drop policy if exists "Family members read quiz attempts" on quiz_attempts;
create policy "Family members read quiz attempts" on quiz_attempts for select to authenticated
  using (user_id in (
    select id from profiles
    where family_id = (select family_id from profiles where id = auth.uid())
  ));

-- 7. Family XP leaderboard (cross-family, SECURITY DEFINER) ------------------
--    Ranks every family by summed member XP over a time window. Visible to
--    all members (kids included) — returns only aggregate family totals.
create or replace function family_xp_leaderboard(p_window text default 'all')
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.xp desc, t.name), '[]'::jsonb)
  from (
    select f.id as family_id,
           f.name,
           count(distinct p.id) as members,
           coalesce(sum(x.amount), 0)::int as xp
    from families f
    join profiles p on p.family_id = f.id
    left join xp_events x on x.user_id = p.id
      and (
        p_window = 'all'
        or (p_window = '7d'  and x.created_at >= now() - interval '7 days')
        or (p_window = '30d' and x.created_at >= now() - interval '30 days')
      )
    group by f.id, f.name
  ) t;
$$;
grant execute on function family_xp_leaderboard(text) to authenticated;
