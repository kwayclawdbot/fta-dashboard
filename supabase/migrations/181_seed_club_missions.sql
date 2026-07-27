-- ============================================================================
-- 181 · SEED CLUB MISSIONS — the canvas "10 · Missions" weekly rep set
-- ----------------------------------------------------------------------------
-- Five club-register missions, all trackable through tables that already exist:
--   rate/stance 5 tickers  → stances / watch_states  (category 'rate', hero)
--   publish 1 thesis       → theses / posts          (category 'thesis')
--   attend a live event    → live_event_attendance   (category 'event')
--   complete a lesson      → lesson_progress         (category 'lesson')
--   invite 1 member        → referrals / invites     (category 'invite')
-- Weekly cadence (resets Sunday); XP flows through the existing ledger.
-- Idempotent: upsert on slug so re-running the migration is safe.
-- ============================================================================

insert into fic_missions
  (slug, title, description, kid_prompt, xp_reward, sort, register, cadence, category, target_count, action_href, accent, is_weekly_hero)
values
  (
    'club-rate-five',
    'Rate five tickers you actually own',
    'Put a conviction stance on five names you hold. Reps build the track record the leaderboard scores.',
    null, 150, 1, 'club', 'weekly', 'rate', 5, '/watchlist', 'volt', true
  ),
  (
    'club-write-bear-case',
    'Write one bear case',
    'On a name you''re long. The strongest members can argue the other side.',
    null, 80, 2, 'club', 'weekly', 'thesis', 1, '/club', 'teal', false
  ),
  (
    'club-backtest-breakout',
    'Backtest a breakout',
    'In the practice portfolio. Prove the setup before you trust it live.',
    null, 120, 3, 'club', 'weekly', 'lesson', 1, '/practice', 'kai', false
  ),
  (
    'club-attend-live-room',
    'Attend a live room',
    'Show up for one live session this week and stay for the Q&A.',
    null, 60, 4, 'club', 'weekly', 'event', 1, '/club', 'gold', false
  ),
  (
    'club-invite-member',
    'Invite one member',
    'Bring one person into the club. Conviction compounds in a room.',
    null, 90, 5, 'club', 'weekly', 'invite', 1, '/club', 'volt', false
  )
on conflict (slug) do update set
  title          = excluded.title,
  description    = excluded.description,
  xp_reward      = excluded.xp_reward,
  sort           = excluded.sort,
  register       = excluded.register,
  cadence        = excluded.cadence,
  category       = excluded.category,
  target_count   = excluded.target_count,
  action_href    = excluded.action_href,
  accent         = excluded.accent,
  is_weekly_hero = excluded.is_weekly_hero;
