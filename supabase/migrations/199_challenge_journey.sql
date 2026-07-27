-- ============================================================================
-- 199 — THE CHALLENGE: pre-season journey + the SHARED CHALLENGE DATA LAYER
--
-- Lane M7. This migration is the data contract for the WHOLE challenge — the
-- August pre-season (this lane's screens) AND the Sept 2-6 day missions (the
-- next lane's screens). Nothing here duplicates what already exists:
--
--   ALREADY MODELLED, LEFT ALONE (do not re-invent):
--     • enrollments.program='challenge_pass' + expires_at    (migration 126)
--       — the ACCESS/tier mechanism. family_tiers derives 'fic' until expiry.
--     • challenge_pass_notices                                (migration 126)
--     • challenge_sequences + challenge_emails_enabled        (migration 128)
--       — the EMAIL machine. Untouched.
--     • challenge_vips / vip_room_posts                       (migration 133)
--     • admin_challenge_cohort() / admin_challenge_vip_stats() (126/128/130/133/135)
--     • marketing_leads.source='challenge'                    (migration 126)
--     • the FIVE live sessions as live_events rows            (migration 171)
--       — Wed Sept 2 → Sun Sept 6 2026, 23:00 UTC (= 7:00 PM EDT). Fixed UUIDs
--         a5100000-0000-4000-8000-00000000000{1..5}. challenge_days POINTS at
--         them; it does not restate the schedule as a second source of truth
--         for the room, only for the mission's own unlock/session clock.
--
--   WHAT THIS ADDS — the JOURNEY, which had no storage at all:
--     1. challenge_cohorts        — the owner-editable calendar (one row/cohort)
--     2. challenge_days           — per-day mission definition + unlock/session
--                                   timestamps (owner moves a date, no deploy)
--     3. challenge_members        — per-USER journey state (the pass is per
--                                   FAMILY; the journey is per person)
--     4. challenge_questions /_options / challenge_answers  — the MINUTE-2 quiz
--     5. challenge_beats / challenge_beat_progress          — the August rhythm
--     6. challenge_step_completions — brief/do/share per day (day-missions lane)
--     7. challenge_artifacts        — the thing they made (day 0 through day 5)
--     8. challenge_activity_days    — the streak ledger
--     9. challenge_push_log         — per (user, day, kind) push idempotency
--    10. notifications.type gains 'challenge' (TRUE SUPERSET of the 12 existing)
--
-- TIME IS SERVER-AUTHORITATIVE. Every unlock/session moment is a real
-- timestamptz. The canonical wall clock is America/New_York; September 2026 is
-- EDT (UTC-4), so 7:00 PM ET == 23:00 UTC. Nothing compares naive dates and no
-- gate trusts a client clock: challenge_state() returns `now` alongside every
-- boundary so a client countdown is SEEDED from the server, never sourced from
-- the device.
--
-- XP: every grant flows through the existing xp_events path (kind='bonus'),
-- de-duped by a namespaced ref_id (`challenge:*`). There is NO parallel XP
-- ledger here. Amounts live in DATA (challenge_days.xp_award, challenge_beats.xp)
-- so the owner can retune without a deploy; the four fixed journey grants are
-- named constants in challenge_grant_xp() callers.
--
-- HONESTY: no table here stores a decorative count. Cohort sizes come from
-- challenge_cohort_counts(), which counts rows. Below CHALLENGE_COHORT_FLOOR
-- (50 — the threshold the funnel review set for social proof) the RPC returns
-- below_floor=true and the surfaces render founding copy instead of a number.
--
-- All member-facing writes go through SECURITY DEFINER RPCs that key off
-- auth.uid(); the tables themselves grant SELECT only. Cron-only functions are
-- granted to service_role exclusively.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 0. FIX: the challenge pass expired BEFORE the final live session
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 126 seeded app_settings.challenge_end = 2026-09-06T00:00:00Z, which
-- is Sept 5 8:00 PM ET — 27 hours BEFORE the Day-5 session (Sun Sept 6, 7:00 PM
-- ET = 2026-09-06T23:00:00Z). Both register routes read this key to stamp
-- enrollments.expires_at, so every registrant's full-Club pass would have died
-- mid-challenge. The routes' own hardcoded DEFAULT is already the correct value
-- (2026-09-09T04:00:00Z = end of day Sept 8 ET, the 48h decision window after
-- the final session, per src/app/api/free-class/register/route.ts:143) — it just
-- never applied because the row exists. Align the stored value with it.
--
-- challenge_start is likewise corrected to the first SESSION day rather than
-- Sept 1: the sessions run Wed Sept 2 → Sun Sept 6 (migration 171, owner-set).
update app_settings
   set value = to_jsonb('2026-09-09T04:00:00Z'::text)
 where key = 'challenge_end'
   and value = to_jsonb('2026-09-06T00:00:00Z'::text);

-- Any pass already written with the too-early expiry gets the corrected one.
update enrollments
   set expires_at = '2026-09-09T04:00:00Z'::timestamptz
 where program = 'challenge_pass'
   and status  = 'active'
   and expires_at = '2026-09-06T00:00:00Z'::timestamptz;


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. challenge_cohorts — the owner-editable calendar
-- ─────────────────────────────────────────────────────────────────────────────
-- One row per cohort. Every date the app draws (pre-season open, kickoff
-- countdown, access end) reads from HERE, so moving the challenge is an UPDATE,
-- not a deploy. `tz` is the canonical wall clock for downtime/day-boundary math.
create table if not exists challenge_cohorts (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  tz                  text not null default 'America/New_York',
  -- Pre-season opens (free account + rhythm begins).
  preseason_opens_at  timestamptz not null,
  -- The last pre-season week — "your cohort is forming" flips on here.
  cohort_forming_at   timestamptz not null,
  -- The first live session. The kickoff countdown targets this exact moment.
  kickoff_at          timestamptz not null,
  -- The final session's end; after this the finisher/recap surface is live.
  ends_at             timestamptz not null,
  -- When the free challenge_pass expires (mirrors app_settings.challenge_end).
  access_ends_at      timestamptz not null,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists idx_challenge_cohorts_active
  on challenge_cohorts (active) where active;

-- The September 2026 cohort. Session times mirror migration 171 exactly:
-- Wed Sept 2 → Sun Sept 6 2026, 23:00 UTC == 7:00 PM EDT.
insert into challenge_cohorts
  (id, slug, name, preseason_opens_at, cohort_forming_at, kickoff_at, ends_at, access_ends_at)
values (
  'c9100000-0000-4000-8000-000000000001',
  'sept-2026',
  'The 5-Day Investing Challenge · September 2026',
  '2026-08-01 04:00:00+00',   -- Aug 1, 12:00 AM ET — pre-season opens
  '2026-08-25 04:00:00+00',   -- Aug 25, 12:00 AM ET — cohort forming week
  '2026-09-02 23:00:00+00',   -- Wed Sept 2, 7:00 PM ET — session 1 (kickoff)
  '2026-09-07 00:00:00+00',   -- Sun Sept 6, 8:00 PM ET — session 5 ends
  '2026-09-09 04:00:00+00'    -- EOD Mon Sept 8 ET — free pass expires
)
on conflict (slug) do nothing;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. challenge_days — the per-day mission DEFINITION (day-missions lane's spec)
-- ─────────────────────────────────────────────────────────────────────────────
-- The next lane builds five 3-step boards (Brief → Do → Share). It reads this
-- table for everything it renders and writes challenge_step_completions +
-- challenge_artifacts back. Nothing about a day is hardcoded in a component:
-- copy, XP, estimate, artifact kind and BOTH clock moments live here.
--
--   unlock_at   the mission opens (midnight ET of that session's day)
--   session_at  the live session (7:00 PM ET) — also the live_events row
--   late_ok     true ⇒ a missed day stays completable (defending a streak is
--               the whole product; a missed day must never become a dead end)
create table if not exists challenge_days (
  cohort_id       uuid not null references challenge_cohorts(id) on delete cascade,
  day_no          smallint not null check (day_no between 1 and 5),
  title           text not null,
  theme           text not null,
  -- Short board tag, e.g. 'NO EXP' / 'W/ KAI' / 'YOU VOTE' / '$0 RISK' / 'FINALE'.
  tag             text,
  est_minutes     smallint not null default 20 check (est_minutes > 0),
  xp_award        int not null default 100 check (xp_award >= 0),
  -- What the member MAKES that day. The share step is not complete without it.
  artifact_kind   text not null check (artifact_kind in
                    ('watchlist', 'research_card', 'vote', 'practice_trade', 'routine')),
  brief_headline  text not null,
  brief_body      text not null,
  do_headline     text not null,
  share_headline  text not null,
  unlock_at       timestamptz not null,
  session_at      timestamptz not null,
  session_minutes smallint not null default 60,
  -- The live_events row this session IS (migration 171 fixed UUIDs). Null-safe:
  -- a day with no event still renders its own clock.
  live_event_id   uuid references live_events(id) on delete set null,
  late_ok         boolean not null default true,
  primary key (cohort_id, day_no)
);

insert into challenge_days
  (cohort_id, day_no, title, theme, tag, est_minutes, xp_award, artifact_kind,
   brief_headline, brief_body, do_headline, share_headline,
   unlock_at, session_at, live_event_id)
values
  ('c9100000-0000-4000-8000-000000000001', 1,
   'Your first practice watchlist', 'Companies you already know', 'NO EXP', 20, 125, 'watchlist',
   'Build a list of five companies you actually know',
   'Every investor you admire started with a list. Five companies, five reasons, one post — and you keep the list for good.',
   'Tap what you used this week',
   'Post your first watchlist',
   '2026-09-02 04:00:00+00', '2026-09-02 23:00:00+00', 'a5100000-0000-4000-8000-000000000001'),

  ('c9100000-0000-4000-8000-000000000001', 2,
   'Research with Kai', 'One company, properly', 'W/ KAI', 25, 150, 'research_card',
   'Get to know one company properly',
   'Four questions answer almost everything: what it sells, how the money comes in, who is trying to beat it, and what would make you worry.',
   'Work the four questions with Kai',
   'Post your research card',
   '2026-09-03 04:00:00+00', '2026-09-03 23:00:00+00', 'a5100000-0000-4000-8000-000000000002'),

  ('c9100000-0000-4000-8000-000000000001', 3,
   'The community watchlist', 'What the room sees', 'YOU VOTE', 20, 150, 'vote',
   'Plug into what the room sees',
   'You have your own read. Tonight you add it to everyone else''s — and see where you agree, where you do not, and why that gap is the interesting part.',
   'Read the room, then cast your take',
   'See where the room landed',
   '2026-09-04 04:00:00+00', '2026-09-04 23:00:00+00', 'a5100000-0000-4000-8000-000000000003'),

  ('c9100000-0000-4000-8000-000000000001', 4,
   'Screener & practice', 'Find one you have never heard of', '$0 RISK', 25, 175, 'practice_trade',
   'Find a company you have never heard of',
   'Three filters, one shortlist, one practice rep with your reasoning on the record. Practice money only — nothing real is ever at risk here.',
   'Build the screen, then place a practice rep',
   'Post your practice position',
   '2026-09-05 04:00:00+00', '2026-09-05 23:00:00+00', 'a5100000-0000-4000-8000-000000000004'),

  ('c9100000-0000-4000-8000-000000000001', 5,
   'Putting it all together', 'The routine you keep', 'FINALE', 20, 200, 'routine',
   'Turn five skills into one routine',
   'The challenge ends tonight. The routine does not — you leave with a weekly loop small enough that you will actually keep it.',
   'Lay your five skills across the week',
   'Lock your routine',
   '2026-09-06 04:00:00+00', '2026-09-06 23:00:00+00', 'a5100000-0000-4000-8000-000000000005')
on conflict (cohort_id, day_no) do nothing;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. challenge_members — per-USER journey state
-- ─────────────────────────────────────────────────────────────────────────────
-- The challenge_pass lives on the FAMILY (enrollments). The journey — answers,
-- streak, badges, opt-ins — is per PERSON, so it needs its own row. Created
-- lazily by challenge_join() on first visit to any challenge surface, so a
-- registrant provisioned before this migration is picked up on next login.
create table if not exists challenge_members (
  user_id            uuid primary key references profiles(id) on delete cascade,
  cohort_id          uuid not null references challenge_cohorts(id) on delete cascade,
  family_id          uuid references families(id) on delete set null,
  joined_at          timestamptz not null default now(),
  src                text,
  -- SMS reminders. Consent is a FACT we store whether or not a send path exists
  -- today; the surface says so plainly rather than implying a live send.
  sms_opt_in         boolean not null default false,
  sms_opt_in_at      timestamptz,
  phone_e164         text,
  -- .ics downloaded (calendar commitment step).
  calendar_added_at  timestamptz,
  -- Community intro post (the "say hi" step) — set by challenge_post_artifact
  -- for day_no 0 kind='intro' or by challenge_mark_intro().
  intro_posted_at    timestamptz,
  -- Day-0 first win (pick a stock, one sentence, post it).
  day0_completed_at  timestamptz,
  -- Earned by touching at least one beat in each of the four pre-season weeks.
  preseason_badge_at timestamptz,
  -- 5 of 5 day missions complete.
  finisher_at        timestamptz,
  updated_at         timestamptz not null default now()
);

create index if not exists idx_challenge_members_cohort on challenge_members (cohort_id);
create index if not exists idx_challenge_members_family on challenge_members (family_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. MINUTE 2 — the get-to-know-you questions
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists challenge_questions (
  key      text primary key,
  sort     smallint not null,
  prompt   text not null,
  helper   text,
  kind     text not null default 'choice' check (kind in ('choice', 'text')),
  required boolean not null default true
);

create table if not exists challenge_question_options (
  question_key text not null references challenge_questions(key) on delete cascade,
  key          text not null,
  label        text not null,
  emoji        text,
  sort         smallint not null,
  primary key (question_key, key)
);

insert into challenge_questions (key, sort, prompt, helper, kind) values
  ('experience', 1, 'Where are you starting from?', 'No wrong answer — it just tunes the pace.', 'choice'),
  ('goal',       2, 'What''s the goal by the end of this?', null, 'choice'),
  ('help',       3, 'What would help most getting there?', null, 'choice'),
  ('ten_of_ten', 4, 'What would make this a 10/10?', 'In your own words.', 'text')
on conflict (key) do nothing;

insert into challenge_question_options (question_key, key, label, emoji, sort) values
  -- Q1 · Experience
  ('experience', 'beginner',  'Total beginner',                              '🌱', 1),
  ('experience', 'dabbled',   'I''ve bought a stock or two',                 '🪴', 2),
  ('experience', 'investing', 'I invest already, but not systematically',    '📊', 3),
  ('experience', 'active',    'I''m active and want to sharpen it',          '⚡', 4),
  -- Q2 · Goal (verbatim from the canvas board)
  ('goal', 'understand', 'Finally understand how investing works',                    '🌱', 1),
  ('goal', 'watchlist',  'Build a real watchlist & start investing confidently',      '📈', 2),
  ('goal', 'family',     'Get my family learning money together',                     '👨‍👩‍👧', 3),
  ('goal', 'sharpen',    'Sharpen a strategy I already run',                          '⚡', 4),
  -- Q3 · What would help most
  ('help', 'plain',     'Plain explanations, no jargon',        '💬', 1),
  ('help', 'practice',  'Practice reps with no money at risk',  '🎯', 2),
  ('help', 'routine',   'A routine I''ll actually keep',        '🗓', 3),
  ('help', 'people',    'People to think it through with',      '🤝', 4)
on conflict (question_key, key) do nothing;

create table if not exists challenge_answers (
  user_id      uuid not null references profiles(id) on delete cascade,
  question_key text not null references challenge_questions(key) on delete cascade,
  answer_key   text,
  answer_text  text,
  answered_at  timestamptz not null default now(),
  primary key (user_id, question_key)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. AUGUST — the weekly rhythm ("today's one thing" + this week's beats)
-- ─────────────────────────────────────────────────────────────────────────────
-- Four pre-season weeks × four beats. `opens_at` makes the week boundary real
-- rather than a modulo of the current date, so a member who joins in week 3
-- sees week 3 — not week 1 — and past weeks read as catch-up, not failure.
create table if not exists challenge_beats (
  key        text primary key,
  cohort_id  uuid not null references challenge_cohorts(id) on delete cascade,
  week       smallint not null check (week between 1 and 4),
  kind       text not null check (kind in ('lesson', 'community', 'simulator', 'live')),
  label      text not null,
  sub        text,
  xp         int not null default 25 check (xp >= 0),
  href       text,
  est_minutes smallint not null default 10,
  opens_at   timestamptz not null,
  sort       smallint not null default 0,
  active     boolean not null default true
);

create index if not exists idx_challenge_beats_cohort_week
  on challenge_beats (cohort_id, week, sort);

insert into challenge_beats (key, cohort_id, week, kind, label, sub, xp, href, est_minutes, opens_at, sort) values
  ('w1-lesson',    'c9100000-0000-4000-8000-000000000001', 1, 'lesson',    'Lesson: what moves a stock price', 'One short lesson — about ten minutes.',            25, '/courses',   10, '2026-08-01 04:00:00+00', 1),
  ('w1-community', 'c9100000-0000-4000-8000-000000000001', 1, 'community', 'Community beat: introduce your pick', 'Say why you chose it. One sentence is plenty.',  20, '/community', 5,  '2026-08-01 04:00:00+00', 2),
  ('w1-simulator', 'c9100000-0000-4000-8000-000000000001', 1, 'simulator', 'Simulator rep: one practice trade', 'Practice money only — nothing real at risk.',      30, '/simulator', 10, '2026-08-01 04:00:00+00', 3),
  ('w1-live',      'c9100000-0000-4000-8000-000000000001', 1, 'live',      'Wednesday live class · 7 PM ET', 'The weekly free class doubles as pre-season.',       25, '/live',      60, '2026-08-01 04:00:00+00', 4),

  ('w2-lesson',    'c9100000-0000-4000-8000-000000000001', 2, 'lesson',    'Lesson: reading a company in plain English', 'What it sells, how money comes in.',      25, '/courses',   10, '2026-08-08 04:00:00+00', 1),
  ('w2-community', 'c9100000-0000-4000-8000-000000000001', 2, 'community', 'Community beat: call a chart''s trend', 'Up, down or sideways — and why you think so.', 20, '/community', 5,  '2026-08-08 04:00:00+00', 2),
  ('w2-simulator', 'c9100000-0000-4000-8000-000000000001', 2, 'simulator', 'Simulator rep: buy or pass, then say why', 'The reason matters more than the trade.',   30, '/simulator', 10, '2026-08-08 04:00:00+00', 3),
  ('w2-live',      'c9100000-0000-4000-8000-000000000001', 2, 'live',      'Wednesday live class · 7 PM ET', 'Bring a question — that is the whole price of entry.', 25, '/live',    60, '2026-08-08 04:00:00+00', 4),

  ('w3-lesson',    'c9100000-0000-4000-8000-000000000001', 3, 'lesson',    'Lesson: risk before reward', 'The habit that keeps beginners in the game.',            25, '/courses',   10, '2026-08-15 04:00:00+00', 1),
  ('w3-community', 'c9100000-0000-4000-8000-000000000001', 3, 'community', 'Community beat: ask the room one question', 'Lurkers don''t learn. Posters show up.',   20, '/community', 5,  '2026-08-15 04:00:00+00', 2),
  ('w3-simulator', 'c9100000-0000-4000-8000-000000000001', 3, 'simulator', 'Simulator rep: close a position and grade it', 'Was the reason still true?',            30, '/simulator', 10, '2026-08-15 04:00:00+00', 3),
  ('w3-live',      'c9100000-0000-4000-8000-000000000001', 3, 'live',      'Wednesday live class · 7 PM ET', 'Two weeks out — the room starts to know your name.',  25, '/live',      60, '2026-08-15 04:00:00+00', 4),

  ('w4-lesson',    'c9100000-0000-4000-8000-000000000001', 4, 'lesson',    'Lesson: what a watchlist is really for', 'Setting up Day 1 before Day 1.',              25, '/courses',   10, '2026-08-22 04:00:00+00', 1),
  ('w4-community', 'c9100000-0000-4000-8000-000000000001', 4, 'community', 'Community beat: share your pre-season list', 'Whatever you have. It does not need to be finished.', 20, '/community', 5, '2026-08-22 04:00:00+00', 2),
  ('w4-simulator', 'c9100000-0000-4000-8000-000000000001', 4, 'simulator', 'Simulator rep: your last pre-season trade', 'Then leave it alone until Sept 2.',        30, '/simulator', 10, '2026-08-22 04:00:00+00', 3),
  ('w4-live',      'c9100000-0000-4000-8000-000000000001', 4, 'live',      'Wednesday live class · 7 PM ET', 'The last one before the cohort forms.',              25, '/live',      60, '2026-08-22 04:00:00+00', 4)
on conflict (key) do nothing;

create table if not exists challenge_beat_progress (
  user_id      uuid not null references profiles(id) on delete cascade,
  beat_key     text not null references challenge_beats(key) on delete cascade,
  completed_at timestamptz not null default now(),
  ref_id       text,
  primary key (user_id, beat_key)
);

create index if not exists idx_challenge_beat_progress_user on challenge_beat_progress (user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. challenge_step_completions — brief / do / share, per day
-- ─────────────────────────────────────────────────────────────────────────────
-- THE DAY-MISSIONS LANE'S PRIMARY WRITE. day_no 0 is reserved for the DAY-0
-- pre-season first win (which has a single 'share' step), 1-5 are the challenge
-- days. `payload` carries whatever the board collected mid-step (selected
-- tickers, answered questions, filters) so a member can resume a half-done
-- mission instead of restarting it.
create table if not exists challenge_step_completions (
  user_id      uuid not null references profiles(id) on delete cascade,
  day_no       smallint not null check (day_no between 0 and 5),
  step         text not null check (step in ('brief', 'do', 'share')),
  completed_at timestamptz not null default now(),
  payload      jsonb not null default '{}'::jsonb,
  primary key (user_id, day_no, step)
);

create index if not exists idx_challenge_steps_user on challenge_step_completions (user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. challenge_artifacts — the thing they made
-- ─────────────────────────────────────────────────────────────────────────────
-- One artifact per member per day (day_no 0 = the Day-0 first win). `feed_post_id`
-- links the community post the share step created, so "5 artifacts" on the
-- finisher card is a COUNT of real rows and every one is clickable.
create table if not exists challenge_artifacts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  family_id    uuid references families(id) on delete set null,
  day_no       smallint not null check (day_no between 0 and 5),
  kind         text not null check (kind in
                 ('first_pick', 'watchlist', 'research_card', 'vote', 'practice_trade', 'routine')),
  ticker       text,
  company_name text,
  body         text,
  payload      jsonb not null default '{}'::jsonb,
  feed_post_id uuid references feed_posts(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (user_id, day_no)
);

create index if not exists idx_challenge_artifacts_day on challenge_artifacts (day_no, created_at desc);
create index if not exists idx_challenge_artifacts_user on challenge_artifacts (user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. challenge_activity_days — the streak ledger
-- ─────────────────────────────────────────────────────────────────────────────
-- One row per member per ACTIVE DAY, stamped in the cohort timezone so a
-- 10 PM ET action counts for that day and not the next UTC one. The streak is
-- DERIVED by counting backwards from today; nothing stores a streak integer, so
-- it can never drift from the evidence.
create table if not exists challenge_activity_days (
  user_id uuid not null references profiles(id) on delete cascade,
  day     date not null,
  sources text[] not null default '{}',
  primary key (user_id, day)
);

create index if not exists idx_challenge_activity_user_day
  on challenge_activity_days (user_id, day desc);


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. challenge_push_log — push idempotency, enforced in the DATABASE
-- ─────────────────────────────────────────────────────────────────────────────
-- A cron can run twice. The primary key is the dedupe: (user, day, kind). The
-- cron INSERTs here FIRST and only creates the notification if the insert won,
-- so a double run is a no-op rather than a double buzz.
create table if not exists challenge_push_log (
  user_id         uuid not null references profiles(id) on delete cascade,
  day_no          smallint not null check (day_no between 0 and 5),
  kind            text not null check (kind in ('mission', 'session')),
  sent_at         timestamptz not null default now(),
  notification_id uuid references notifications(id) on delete set null,
  primary key (user_id, day_no, kind)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. notifications.type — widen to a TRUE SUPERSET (+ 'challenge')
-- ─────────────────────────────────────────────────────────────────────────────
-- All twelve existing values preserved verbatim from migration 192; 'challenge'
-- is appended. Adding the type without widening this CHECK would make every
-- challenge push fail at insert.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'reply', 'mention', 'announcement', 'support_reply',
    'mention_everyone', 'new_pick', 'new_lesson', 'recording_posted',
    'broadcast', 'alert', 'live_starting', 'guardrail',
    'challenge'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. RLS — read-your-own (+ admin); every write goes through a definer RPC
-- ─────────────────────────────────────────────────────────────────────────────
alter table challenge_cohorts          enable row level security;
alter table challenge_days             enable row level security;
alter table challenge_questions        enable row level security;
alter table challenge_question_options enable row level security;
alter table challenge_beats            enable row level security;
alter table challenge_members          enable row level security;
alter table challenge_answers          enable row level security;
alter table challenge_beat_progress    enable row level security;
alter table challenge_step_completions enable row level security;
alter table challenge_artifacts        enable row level security;
alter table challenge_activity_days    enable row level security;
alter table challenge_push_log         enable row level security;

grant select on challenge_cohorts, challenge_days, challenge_questions,
                challenge_question_options, challenge_beats,
                challenge_members, challenge_answers, challenge_beat_progress,
                challenge_step_completions, challenge_artifacts,
                challenge_activity_days
  to authenticated;

-- Definition tables: readable by every authenticated member (they are the copy).
drop policy if exists "challenge_cohorts read" on challenge_cohorts;
create policy "challenge_cohorts read" on challenge_cohorts
  for select to authenticated using (true);

drop policy if exists "challenge_days read" on challenge_days;
create policy "challenge_days read" on challenge_days
  for select to authenticated using (true);

drop policy if exists "challenge_questions read" on challenge_questions;
create policy "challenge_questions read" on challenge_questions
  for select to authenticated using (true);

drop policy if exists "challenge_question_options read" on challenge_question_options;
create policy "challenge_question_options read" on challenge_question_options
  for select to authenticated using (true);

drop policy if exists "challenge_beats read" on challenge_beats;
create policy "challenge_beats read" on challenge_beats
  for select to authenticated using (true);

-- Member state: own row, or admin.
drop policy if exists "challenge_members own or admin read" on challenge_members;
create policy "challenge_members own or admin read" on challenge_members
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "challenge_answers own or admin read" on challenge_answers;
create policy "challenge_answers own or admin read" on challenge_answers
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "challenge_beat_progress own or admin read" on challenge_beat_progress;
create policy "challenge_beat_progress own or admin read" on challenge_beat_progress
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "challenge_steps own or admin read" on challenge_step_completions;
create policy "challenge_steps own or admin read" on challenge_step_completions
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Artifacts are the COHORT's shared evidence — every member may read them (that
-- is the "see what others chose" surface). Writes stay RPC-only.
drop policy if exists "challenge_artifacts read" on challenge_artifacts;
create policy "challenge_artifacts read" on challenge_artifacts
  for select to authenticated using (true);

drop policy if exists "challenge_activity own read" on challenge_activity_days;
create policy "challenge_activity own read" on challenge_activity_days
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- challenge_push_log: no client policy at all. Cron/service-role only.


-- ═════════════════════════════════════════════════════════════════════════════
-- 12. HELPERS
-- ═════════════════════════════════════════════════════════════════════════════

-- The one active cohort. Every RPC below resolves through this.
create or replace function public.challenge_active_cohort()
returns challenge_cohorts
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from challenge_cohorts where active order by kickoff_at limit 1;
$$;
grant execute on function public.challenge_active_cohort() to authenticated, service_role;

-- Award XP through the EXISTING xp_events ledger, de-duped by ref_id. Returns
-- the amount actually granted (0 when it was already granted). kind='bonus' is
-- an existing allowed value (migration 020) — no constraint is widened.
create or replace function public.challenge_grant_xp(
  p_user uuid, p_amount int, p_ref text
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user is null or p_amount is null or p_amount <= 0 or p_ref is null then
    return 0;
  end if;
  if exists (
    select 1 from xp_events
     where user_id = p_user and kind = 'bonus' and ref_id = p_ref
  ) then
    return 0;
  end if;
  insert into xp_events (user_id, amount, kind, ref_id)
  values (p_user, p_amount, 'bonus', p_ref);
  return p_amount;
exception when unique_violation then
  return 0;
end;
$$;

-- Stamp today (in the cohort's wall clock) on the streak ledger.
create or replace function public.challenge_touch_day(p_user uuid, p_source text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz  text := coalesce((select tz from challenge_active_cohort()), 'America/New_York');
  v_day date := (now() at time zone v_tz)::date;
begin
  if p_user is null then return; end if;
  insert into challenge_activity_days (user_id, day, sources)
  values (p_user, v_day, array[coalesce(p_source, 'app')])
  on conflict (user_id, day) do update
    set sources = (
      select array_agg(distinct s)
        from unnest(challenge_activity_days.sources || excluded.sources) s
    );
end;
$$;

-- Current streak = consecutive days ending today or yesterday. Derived, never
-- stored: a streak that cannot be evidenced does not exist.
create or replace function public.challenge_streak(p_user uuid)
returns int
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz    text := coalesce((select tz from challenge_active_cohort()), 'America/New_York');
  v_today date := (now() at time zone v_tz)::date;
  v_cur   date;
  v_n     int := 0;
begin
  if p_user is null then return 0; end if;
  select max(day) into v_cur from challenge_activity_days where user_id = p_user;
  if v_cur is null or v_cur < v_today - 1 then return 0; end if;
  loop
    exit when not exists (
      select 1 from challenge_activity_days where user_id = p_user and day = v_cur
    );
    v_n := v_n + 1;
    v_cur := v_cur - 1;
  end loop;
  return v_n;
end;
$$;
grant execute on function public.challenge_streak(uuid) to authenticated, service_role;

-- Pre-season badge: at least one beat completed in EACH of the four weeks.
-- Idempotent; safe to call after any beat completion.
create or replace function public.challenge_check_preseason_badge(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_weeks int;
  v_have  timestamptz;
begin
  select preseason_badge_at into v_have from challenge_members where user_id = p_user;
  if v_have is not null then return true; end if;

  select count(distinct b.week) into v_weeks
    from challenge_beat_progress p
    join challenge_beats b on b.key = p.beat_key
   where p.user_id = p_user;

  if coalesce(v_weeks, 0) >= 4 then
    update challenge_members set preseason_badge_at = now(), updated_at = now()
     where user_id = p_user and preseason_badge_at is null;
    perform challenge_grant_xp(p_user, 100, 'challenge:preseason-badge');
    return true;
  end if;
  return false;
end;
$$;

-- Finisher: all five day missions' SHARE steps complete.
create or replace function public.challenge_check_finisher(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_done int;
  v_have timestamptz;
begin
  select finisher_at into v_have from challenge_members where user_id = p_user;
  if v_have is not null then return true; end if;

  select count(*) into v_done
    from challenge_step_completions
   where user_id = p_user and step = 'share' and day_no between 1 and 5;

  if coalesce(v_done, 0) >= 5 then
    update challenge_members set finisher_at = now(), updated_at = now()
     where user_id = p_user and finisher_at is null;
    return true;
  end if;
  return false;
end;
$$;

-- Is this member inside a family-guardrail downtime window right now? Used by
-- the push cron (which has no auth.uid(), so family_writes_allowed() — which
-- keys off auth.uid() — cannot be reused directly). Same predicate, explicit
-- subject. A minor in downtime is never buzzed to "go do your mission".
create or replace function public.challenge_push_blocked(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from family_guardrails g
     where g.child_id = p_user
       and (
         (g.downtime_enabled
           and public.family_in_downtime_window(
                 g.downtime_start_hour, g.downtime_end_hour, g.tz))
         or (
           g.daily_limit_min is not null
           and coalesce((
             select d.minutes from family_activity_days d
              where d.child_id = g.child_id
                and d.day = (now() at time zone g.tz)::date
           ), 0) >= g.daily_limit_min
         )
       )
  );
$$;
grant execute on function public.challenge_push_blocked(uuid) to service_role;


-- ═════════════════════════════════════════════════════════════════════════════
-- 13. COHORT COUNTS — real rows, with an explicit below-floor signal
-- ═════════════════════════════════════════════════════════════════════════════
-- The canvas draws "2,847 in" and "1,942 cohort mates doing this right now".
-- Production is a handful. This RPC never fabricates: it counts challenge_members
-- and reports `below_floor` so the surfaces can render founding copy instead of
-- a number that reads as failure. Floor = 50, the social-proof threshold set in
-- CHALLENGE-FUNNEL-REVIEW P1 item 3.
create or replace function public.challenge_cohort_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_cohort challenge_cohorts;
  v_floor  int := 50;
  v_total  int;
  v_badges int;
  v_finish int;
  v_today  int;
begin
  select * into v_cohort from challenge_active_cohort();
  if v_cohort.id is null then
    return jsonb_build_object('members', 0, 'below_floor', true, 'floor', v_floor);
  end if;

  select count(*) into v_total  from challenge_members where cohort_id = v_cohort.id;
  select count(*) into v_badges from challenge_members
   where cohort_id = v_cohort.id and preseason_badge_at is not null;
  select count(*) into v_finish from challenge_members
   where cohort_id = v_cohort.id and finisher_at is not null;
  select count(distinct user_id) into v_today
    from challenge_activity_days
   where day = (now() at time zone v_cohort.tz)::date;

  return jsonb_build_object(
    'members',          v_total,
    'preseason_badges', v_badges,
    'finishers',        v_finish,
    'active_today',     v_today,
    'floor',            v_floor,
    'below_floor',      v_total < v_floor
  );
end;
$$;
grant execute on function public.challenge_cohort_counts() to authenticated, service_role;


-- ═════════════════════════════════════════════════════════════════════════════
-- 14. challenge_join — lazily provision the journey row
-- ═════════════════════════════════════════════════════════════════════════════
-- Called on first load of any challenge surface. Grants the +20 "free account
-- created" XP exactly once (ref-deduped), so a registrant provisioned before
-- this migration is picked up the next time they open the app.
create or replace function public.challenge_join(p_src text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_cohort challenge_cohorts;
  v_family uuid;
  v_xp     int := 0;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select * into v_cohort from challenge_active_cohort();
  if v_cohort.id is null then raise exception 'no active cohort'; end if;

  select family_id into v_family from profiles where id = v_uid;

  insert into challenge_members (user_id, cohort_id, family_id, src)
  values (v_uid, v_cohort.id, v_family, p_src)
  on conflict (user_id) do update
    set family_id = coalesce(challenge_members.family_id, excluded.family_id),
        updated_at = now();

  -- "Free account created ⚡ +20" — granted once, ever. Its return value is also
  -- the honest "is this the first time" signal: 0 means the grant already
  -- existed, so this is a revisit, not a new join.
  v_xp := challenge_grant_xp(v_uid, 20, 'challenge:account');
  perform challenge_touch_day(v_uid, 'join');

  return jsonb_build_object('ok', true, 'new', v_xp > 0, 'xp_awarded', v_xp);
end;
$$;
grant execute on function public.challenge_join(text) to authenticated;


-- ═════════════════════════════════════════════════════════════════════════════
-- 15. challenge_state — THE ONE READ every challenge surface uses
-- ═════════════════════════════════════════════════════════════════════════════
-- Returns the entire journey for the calling member, INCLUDING the server clock
-- and every boundary timestamp, so the client can tick a countdown without ever
-- being the authority on what is unlocked. The day-missions lane consumes
-- `days[]` — each element carries its own state and step flags.
--
-- PHASE (server-derived):
--   'pre_open'   before the cohort's pre-season opens
--   'preseason'  Aug 1 → Aug 24
--   'forming'    Aug 25 → kickoff
--   'live'       kickoff → ends_at
--   'aftermath'  ends_at → access_ends_at
--   'closed'     after access_ends_at
--
-- DAY STATE (per day, server-derived):
--   'locked'   now < unlock_at
--   'open'     unlocked, incomplete, session not yet imminent
--   'live'     within [session_at, session_at + session_minutes)
--   'complete' the share step is done
--   'missed'   past the session window, still incomplete
--              (late_ok = true ⇒ still completable; a missed day is a catch-up
--               screen, never a dead end)
create or replace function public.challenge_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_now    timestamptz := now();
  v_cohort challenge_cohorts;
  v_member challenge_members;
  v_phase  text;
  v_days   jsonb;
  v_beats  jsonb;
  v_answers jsonb;
  v_xp     int;
  v_ready_done  int;
  v_ready_total int;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select * into v_cohort from challenge_active_cohort();
  if v_cohort.id is null then return jsonb_build_object('ok', false, 'reason', 'no_cohort'); end if;
  select * into v_member from challenge_members where user_id = v_uid;

  v_phase := case
    when v_now < v_cohort.preseason_opens_at then 'pre_open'
    when v_now < v_cohort.cohort_forming_at  then 'preseason'
    when v_now < v_cohort.kickoff_at         then 'forming'
    when v_now < v_cohort.ends_at            then 'live'
    when v_now < v_cohort.access_ends_at     then 'aftermath'
    else 'closed'
  end;

  select coalesce(jsonb_agg(row_to_json(t) order by t.day_no), '[]'::jsonb)
    into v_days
    from (
      select d.day_no, d.title, d.theme, d.tag, d.est_minutes, d.xp_award,
             d.artifact_kind, d.brief_headline, d.brief_body, d.do_headline,
             d.share_headline, d.unlock_at, d.session_at, d.session_minutes,
             d.live_event_id, d.late_ok,
             (sb.user_id is not null) as brief_done,
             (sd.user_id is not null) as do_done,
             (ss.user_id is not null) as share_done,
             a.id  as artifact_id,
             a.feed_post_id,
             case
               when ss.user_id is not null then 'complete'
               when v_now < d.unlock_at then 'locked'
               when v_now >= d.session_at
                and v_now <  d.session_at + (d.session_minutes || ' minutes')::interval then 'live'
               when v_now >= d.session_at + (d.session_minutes || ' minutes')::interval then 'missed'
               else 'open'
             end as state
        from challenge_days d
        left join challenge_step_completions sb
               on sb.user_id = v_uid and sb.day_no = d.day_no and sb.step = 'brief'
        left join challenge_step_completions sd
               on sd.user_id = v_uid and sd.day_no = d.day_no and sd.step = 'do'
        left join challenge_step_completions ss
               on ss.user_id = v_uid and ss.day_no = d.day_no and ss.step = 'share'
        left join challenge_artifacts a
               on a.user_id = v_uid and a.day_no = d.day_no
       where d.cohort_id = v_cohort.id
    ) t;

  select coalesce(jsonb_agg(row_to_json(t) order by t.week, t.sort), '[]'::jsonb)
    into v_beats
    from (
      select b.key, b.week, b.kind, b.label, b.sub, b.xp, b.href,
             b.est_minutes, b.opens_at, b.sort,
             p.completed_at,
             (b.opens_at <= v_now) as open
        from challenge_beats b
        left join challenge_beat_progress p
               on p.user_id = v_uid and p.beat_key = b.key
       where b.cohort_id = v_cohort.id and b.active
    ) t;

  select count(*) filter (where p.user_id is not null), count(*)
    into v_ready_done, v_ready_total
    from challenge_beats b
    left join challenge_beat_progress p on p.user_id = v_uid and p.beat_key = b.key
   where b.cohort_id = v_cohort.id and b.active;

  select coalesce(jsonb_object_agg(question_key,
           jsonb_build_object('answer_key', answer_key, 'answer_text', answer_text)),
         '{}'::jsonb)
    into v_answers
    from challenge_answers where user_id = v_uid;

  select coalesce(sum(amount), 0) into v_xp from xp_events where user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'now', v_now,
    'phase', v_phase,
    'cohort', jsonb_build_object(
      'id', v_cohort.id, 'slug', v_cohort.slug, 'name', v_cohort.name,
      'tz', v_cohort.tz,
      'preseason_opens_at', v_cohort.preseason_opens_at,
      'cohort_forming_at', v_cohort.cohort_forming_at,
      'kickoff_at', v_cohort.kickoff_at,
      'ends_at', v_cohort.ends_at,
      'access_ends_at', v_cohort.access_ends_at
    ),
    'member', case when v_member.user_id is null then null else jsonb_build_object(
      'joined_at', v_member.joined_at,
      'sms_opt_in', v_member.sms_opt_in,
      'sms_opt_in_at', v_member.sms_opt_in_at,
      'calendar_added_at', v_member.calendar_added_at,
      'intro_posted_at', v_member.intro_posted_at,
      'day0_completed_at', v_member.day0_completed_at,
      'preseason_badge_at', v_member.preseason_badge_at,
      'finisher_at', v_member.finisher_at
    ) end,
    'days', v_days,
    'beats', v_beats,
    'answers', v_answers,
    'challenge_ready', jsonb_build_object('done', coalesce(v_ready_done, 0),
                                          'total', coalesce(v_ready_total, 0)),
    'streak', challenge_streak(v_uid),
    'xp', v_xp,
    'cohort_counts', challenge_cohort_counts()
  );
end;
$$;
grant execute on function public.challenge_state() to authenticated;


-- ═════════════════════════════════════════════════════════════════════════════
-- 16. WRITES
-- ═════════════════════════════════════════════════════════════════════════════

-- MINUTE 2 — one answer. The +15 grant lands once, when the last required
-- question is answered (not per keystroke, not per question).
create or replace function public.challenge_save_answer(
  p_key text, p_answer_key text default null, p_answer_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_req  int;
  v_have int;
  v_xp   int := 0;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if not exists (select 1 from challenge_questions where key = p_key) then
    raise exception 'unknown question %', p_key;
  end if;

  insert into challenge_answers (user_id, question_key, answer_key, answer_text)
  values (v_uid, p_key, nullif(p_answer_key, ''), nullif(left(coalesce(p_answer_text, ''), 2000), ''))
  on conflict (user_id, question_key) do update
    set answer_key  = excluded.answer_key,
        answer_text = excluded.answer_text,
        answered_at = now();

  select count(*) into v_req from challenge_questions where required;
  select count(*) into v_have
    from challenge_answers a join challenge_questions q on q.key = a.question_key
   where a.user_id = v_uid and q.required
     and (a.answer_key is not null or a.answer_text is not null);

  if v_have >= v_req then
    v_xp := challenge_grant_xp(v_uid, 15, 'challenge:questions');
  end if;
  perform challenge_touch_day(v_uid, 'questions');

  return jsonb_build_object('ok', true, 'answered', v_have, 'required', v_req, 'xp_awarded', v_xp);
end;
$$;
grant execute on function public.challenge_save_answer(text, text, text) to authenticated;

-- A beat. Idempotent, ref-deduped XP, stamps the streak, re-checks the badge.
create or replace function public.challenge_complete_beat(p_key text, p_ref text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_beat challenge_beats;
  v_xp   int := 0;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select * into v_beat from challenge_beats where key = p_key and active;
  if v_beat.key is null then raise exception 'unknown beat %', p_key; end if;
  if v_beat.opens_at > now() then raise exception 'beat not open yet'; end if;

  insert into challenge_beat_progress (user_id, beat_key, ref_id)
  values (v_uid, p_key, p_ref)
  on conflict (user_id, beat_key) do nothing;

  v_xp := challenge_grant_xp(v_uid, v_beat.xp, 'challenge:beat:' || p_key);
  perform challenge_touch_day(v_uid, 'beat');
  perform challenge_check_preseason_badge(v_uid);

  return jsonb_build_object('ok', true, 'xp_awarded', v_xp);
end;
$$;
grant execute on function public.challenge_complete_beat(text, text) to authenticated;

-- A mission STEP (brief / do / share). THE DAY-MISSIONS LANE'S MAIN WRITE.
--   • day_no 0 is the pre-season Day-0 first win (share only).
--   • The 'share' step is what completes a day: it grants challenge_days.xp_award
--     (day 0 grants 50), stamps the streak, and re-checks finisher status.
--   • Ordering is enforced for days 1-5: 'do' requires 'brief', 'share' requires
--     'do'. Idempotent — re-completing a step is a no-op that returns ok.
--   • A LOCKED day is refused server-side (the client clock cannot unlock it).
--     A MISSED day with late_ok = true is accepted: the streak is the product.
create or replace function public.challenge_complete_step(
  p_day int, p_step text, p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_cohort challenge_cohorts;
  v_day    challenge_days;
  v_xp     int := 0;
  v_amount int;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if p_step not in ('brief', 'do', 'share') then raise exception 'bad step %', p_step; end if;
  if p_day < 0 or p_day > 5 then raise exception 'bad day %', p_day; end if;

  select * into v_cohort from challenge_active_cohort();

  if p_day = 0 then
    if p_step <> 'share' then raise exception 'day 0 has a single share step'; end if;
    v_amount := 50;                                   -- DAY-0 first win
  else
    select * into v_day from challenge_days
     where cohort_id = v_cohort.id and day_no = p_day;
    if v_day.day_no is null then raise exception 'day % not defined', p_day; end if;

    -- Server-authoritative unlock. Never trust the device clock.
    if now() < v_day.unlock_at then
      raise exception 'day % is locked until %', p_day, v_day.unlock_at;
    end if;
    -- Late completion: allowed when late_ok, refused when the owner turns it off.
    if not v_day.late_ok
       and now() >= v_day.session_at + (v_day.session_minutes || ' minutes')::interval then
      raise exception 'day % is closed', p_day;
    end if;

    if p_step = 'do' and not exists (
      select 1 from challenge_step_completions
       where user_id = v_uid and day_no = p_day and step = 'brief'
    ) then raise exception 'finish the brief first'; end if;

    if p_step = 'share' and not exists (
      select 1 from challenge_step_completions
       where user_id = v_uid and day_no = p_day and step = 'do'
    ) then raise exception 'finish the exercise first'; end if;

    v_amount := v_day.xp_award;
  end if;

  insert into challenge_step_completions (user_id, day_no, step, payload)
  values (v_uid, p_day, p_step, coalesce(p_payload, '{}'::jsonb))
  on conflict (user_id, day_no, step) do update
    set payload = coalesce(excluded.payload, challenge_step_completions.payload);

  if p_step = 'share' then
    v_xp := challenge_grant_xp(v_uid, v_amount, 'challenge:day' || p_day || ':share');
    if p_day = 0 then
      update challenge_members set day0_completed_at = coalesce(day0_completed_at, now()),
                                   updated_at = now()
       where user_id = v_uid;
    else
      perform challenge_check_finisher(v_uid);
    end if;
  end if;

  perform challenge_touch_day(v_uid, 'mission');

  return jsonb_build_object('ok', true, 'day', p_day, 'step', p_step, 'xp_awarded', v_xp);
end;
$$;
grant execute on function public.challenge_complete_step(int, text, jsonb) to authenticated;

-- The ARTIFACT. Creates the community post (kind='post' — the real feed, not a
-- shadow one), records the artifact, completes the share step and grants XP in
-- one call. Idempotent per (user, day): a re-post updates the artifact rather
-- than duplicating the feed.
create or replace function public.challenge_post_artifact(
  p_day int,
  p_kind text,
  p_body text,
  p_ticker text default null,
  p_company text default null,
  p_payload jsonb default '{}'::jsonb,
  p_post_to_community boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_family uuid;
  v_post   uuid;
  v_art    uuid;
  v_step   jsonb;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'say something about it'; end if;

  select family_id into v_family from profiles where id = v_uid;

  select id, feed_post_id into v_art, v_post
    from challenge_artifacts where user_id = v_uid and day_no = p_day;

  if p_post_to_community and v_post is null then
    insert into feed_posts (author_id, family_id, kind, body)
    values (v_uid, v_family, 'post', left(p_body, 2000))
    returning id into v_post;
  elsif p_post_to_community and v_post is not null then
    update feed_posts set body = left(p_body, 2000) where id = v_post;
  end if;

  insert into challenge_artifacts
    (user_id, family_id, day_no, kind, ticker, company_name, body, payload, feed_post_id)
  values (v_uid, v_family, p_day, p_kind, nullif(upper(trim(coalesce(p_ticker, ''))), ''),
          nullif(trim(coalesce(p_company, '')), ''), left(p_body, 4000),
          coalesce(p_payload, '{}'::jsonb), v_post)
  on conflict (user_id, day_no) do update
    set kind = excluded.kind, ticker = excluded.ticker,
        company_name = excluded.company_name, body = excluded.body,
        payload = excluded.payload,
        feed_post_id = coalesce(challenge_artifacts.feed_post_id, excluded.feed_post_id)
  returning id into v_art;

  -- DAY-0 first win: the pick becomes a REAL watchlist row, not a screenshot of
  -- one. "Pick your first watchlist stock" has to leave a watchlist behind or
  -- the mission was theatre. Guarded so a re-post never duplicates the ticker.
  if p_day = 0 and v_family is not null
     and nullif(upper(trim(coalesce(p_ticker, ''))), '') is not null then
    insert into family_watchlist (family_id, company_name, ticker, champion_id, why_we_picked)
    select v_family,
           coalesce(nullif(trim(coalesce(p_company, '')), ''), upper(trim(p_ticker))),
           upper(trim(p_ticker)),
           v_uid,
           left(p_body, 500)
     where not exists (
       select 1 from family_watchlist w
        where w.family_id = v_family and upper(w.ticker) = upper(trim(p_ticker))
     );
  end if;

  v_step := challenge_complete_step(p_day, 'share',
              jsonb_build_object('artifact_id', v_art));

  return jsonb_build_object('ok', true, 'artifact_id', v_art,
                            'feed_post_id', v_post, 'step', v_step);
end;
$$;
grant execute on function public.challenge_post_artifact(int, text, text, text, text, jsonb, boolean)
  to authenticated;

-- SMS reminder opt-in. Stores the CONSENT FACT and the number. It does not
-- promise a send — the surface labels this honestly (see the lane report: no
-- Twilio credentials are configured, so sendSms() returns
-- "Twilio credentials not configured" and nothing goes out today).
create or replace function public.challenge_set_sms_opt_in(
  p_on boolean, p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_e164  text;
  v_digits text;
begin
  if v_uid is null then raise exception 'auth required'; end if;

  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_e164 := case
    when length(v_digits) = 10 then '+1' || v_digits
    when length(v_digits) = 11 and left(v_digits, 1) = '1' then '+' || v_digits
    when length(v_digits) between 10 and 15 then '+' || v_digits
    else null
  end;

  update challenge_members
     set sms_opt_in    = p_on,
         sms_opt_in_at = case when p_on then coalesce(sms_opt_in_at, now()) else null end,
         phone_e164    = coalesce(v_e164, phone_e164),
         updated_at    = now()
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'sms_opt_in', p_on, 'phone', v_e164);
end;
$$;
grant execute on function public.challenge_set_sms_opt_in(boolean, text) to authenticated;

-- "Say hi in the community ⚡ +10" — VERIFIED, not claimed. The button only
-- deep-links to the composer; this RPC is called when the member comes back and
-- grants the XP ONLY if a real feed post exists that they wrote after joining.
-- A step that pays out on a click rather than on the artifact is a lie the
-- leaderboard then repeats.
create or replace function public.challenge_claim_intro()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_joined timestamptz;
  v_post   uuid;
  v_xp     int := 0;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select joined_at into v_joined from challenge_members where user_id = v_uid;
  if v_joined is null then return jsonb_build_object('ok', false, 'posted', false); end if;

  select id into v_post
    from feed_posts
   where author_id = v_uid and kind = 'post' and created_at >= v_joined
   order by created_at
   limit 1;

  if v_post is null then
    return jsonb_build_object('ok', true, 'posted', false, 'xp_awarded', 0);
  end if;

  update challenge_members
     set intro_posted_at = coalesce(intro_posted_at, now()), updated_at = now()
   where user_id = v_uid;
  v_xp := challenge_grant_xp(v_uid, 10, 'challenge:intro');
  perform challenge_touch_day(v_uid, 'intro');

  return jsonb_build_object('ok', true, 'posted', true, 'xp_awarded', v_xp);
end;
$$;
grant execute on function public.challenge_claim_intro() to authenticated;

-- Calendar commitment step — stamped when the .ics is actually served.
create or replace function public.challenge_mark_calendar_added()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth required'; end if;
  update challenge_members
     set calendar_added_at = coalesce(calendar_added_at, now()), updated_at = now()
   where user_id = v_uid;
  perform challenge_touch_day(v_uid, 'calendar');
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.challenge_mark_calendar_added() to authenticated;


-- ═════════════════════════════════════════════════════════════════════════════
-- 17. THE PUSH CRON'S QUERY — who is due, right now
-- ═════════════════════════════════════════════════════════════════════════════
-- service_role ONLY (no `authenticated` grant): this reads across all members.
--
--   kind='mission'  the morning assignment nudge for the day that is OPEN now
--   kind='session'  the "class starts soon" nudge, fired inside the 90 minutes
--                   before session_at
--
-- Excluded: members who already completed that day (never nudge a finished
-- mission), members already logged for that (day, kind), and minors inside a
-- family-guardrail downtime window or over their daily limit.
create or replace function public.challenge_due_pushes(p_kind text)
returns table (
  user_id uuid,
  day_no  smallint,
  title   text,
  theme   text,
  session_at timestamptz,
  live_event_id uuid
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_cohort challenge_cohorts;
  v_now    timestamptz := now();
begin
  select * into v_cohort from challenge_active_cohort();
  if v_cohort.id is null then return; end if;
  if p_kind not in ('mission', 'session') then raise exception 'bad kind %', p_kind; end if;

  return query
    select m.user_id, d.day_no, d.title, d.theme, d.session_at, d.live_event_id
      from challenge_members m
      join challenge_days d on d.cohort_id = m.cohort_id
     where m.cohort_id = v_cohort.id
       and (
         (p_kind = 'mission'
           and v_now >= d.unlock_at
           and v_now <  d.session_at)
         or
         (p_kind = 'session'
           and v_now >= d.session_at - interval '90 minutes'
           and v_now <  d.session_at + (d.session_minutes || ' minutes')::interval)
       )
       -- never nudge a mission that is already done
       and not exists (
         select 1 from challenge_step_completions s
          where s.user_id = m.user_id and s.day_no = d.day_no and s.step = 'share'
       )
       -- database-enforced idempotency
       and not exists (
         select 1 from challenge_push_log l
          where l.user_id = m.user_id and l.day_no = d.day_no and l.kind = p_kind
       )
       -- family guardrails: never buzz a minor in downtime / over their limit
       and not challenge_push_blocked(m.user_id);
end;
$$;
revoke all on function public.challenge_due_pushes(text) from public, authenticated;
grant execute on function public.challenge_due_pushes(text) to service_role;

-- Claim + send in one atomic step. Inserts the log row FIRST; if the insert is
-- a no-op (already logged) it returns null and NO notification is created — so a
-- double cron run cannot double-buzz. Returns the notification id on success.
create or replace function public.challenge_send_push(
  p_user uuid, p_day int, p_kind text, p_body text, p_link text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows  int := 0;
  v_notif uuid;
begin
  insert into challenge_push_log (user_id, day_no, kind)
  values (p_user, p_day, p_kind)
  on conflict (user_id, day_no, kind) do nothing;
  get diagnostics v_rows = row_count;
  -- 0 rows ⇒ this (user, day, kind) was already sent. Create NOTHING.
  if v_rows = 0 then return null; end if;

  insert into notifications (user_id, type, body, link)
  values (p_user, 'challenge', p_body, p_link)
  returning id into v_notif;

  update challenge_push_log set notification_id = v_notif
   where user_id = p_user and day_no = p_day and kind = p_kind;

  return v_notif;
end;
$$;
revoke all on function public.challenge_send_push(uuid, int, text, text, text) from public, authenticated;
grant execute on function public.challenge_send_push(uuid, int, text, text, text) to service_role;


-- ═════════════════════════════════════════════════════════════════════════════
-- 18. ADMIN — journey funnel for the existing /admin/crm/challenge dashboard
-- ═════════════════════════════════════════════════════════════════════════════
-- Additive: a SEPARATE RPC rather than another rewrite of admin_challenge_cohort()
-- (which has been re-declared four times already). The admin page is not this
-- lane's to edit; this is here so it can adopt it whenever it wants.
create or replace function public.admin_challenge_journey()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;

  select jsonb_build_object(
    'counts', challenge_cohort_counts(),
    'journey', jsonb_build_object(
      'joined',        (select count(*) from challenge_members),
      'answered',      (select count(distinct user_id) from challenge_answers),
      'calendar',      (select count(*) from challenge_members where calendar_added_at is not null),
      'sms_opt_in',    (select count(*) from challenge_members where sms_opt_in),
      'day0',          (select count(*) from challenge_members where day0_completed_at is not null),
      'preseason_badge',(select count(*) from challenge_members where preseason_badge_at is not null),
      'finishers',     (select count(*) from challenge_members where finisher_at is not null)
    ),
    'beats', coalesce((
      select jsonb_agg(row_to_json(t) order by t.week, t.sort) from (
        select b.key, b.week, b.sort, b.label,
               (select count(*) from challenge_beat_progress p where p.beat_key = b.key) as done
          from challenge_beats b where b.active
      ) t), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(row_to_json(t) order by t.day_no) from (
        select d.day_no, d.title,
               (select count(*) from challenge_step_completions s
                 where s.day_no = d.day_no and s.step = 'brief') as brief,
               -- NB: "do" is reserved in SQL, so the key is `do_step`.
               (select count(*) from challenge_step_completions s
                 where s.day_no = d.day_no and s.step = 'do')    as do_step,
               (select count(*) from challenge_step_completions s
                 where s.day_no = d.day_no and s.step = 'share')  as share
          from challenge_days d
      ) t), '[]'::jsonb),
    'pushes', coalesce((
      select jsonb_agg(row_to_json(t) order by t.day_no, t.kind) from (
        select day_no, kind, count(*) as sent from challenge_push_log group by 1, 2
      ) t), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;
grant execute on function public.admin_challenge_journey() to authenticated;
