-- 196 — CANVAS V2 · LANE M4 (You: profile · progress · leaderboard · referrals · settings)
--
-- ONE read RPC: member_participation(user_id) — the numbers a profile is allowed
-- to publish about a member.
--
-- WHY IT EXISTS AT ALL. The profile surfaces were counting participation with
-- direct client reads, and two of those reads are wrong-by-RLS rather than
-- wrong-by-code:
--
--   · feed_posts SELECT is family-scoped (034/161). A member without a family,
--     or a viewer outside the author's family, counts SOME of the author's posts
--     and prints the result as if it were all of them. An undercount presented as
--     a total is a fabricated number by a slower route.
--   · research_objects is openly readable, but the /u/[username] page had no way
--     to count anything at all — it rendered `profile.contributions` from the
--     public_profile RPC and nothing else, so the public profile and the member's
--     own profile disagreed about the same member.
--
-- SECURITY DEFINER fixes both: one authority answers the question, every viewer
-- gets the same answer, and the answer is a COUNT — never a row, never a body,
-- never who-reacted-to-what. Safe for a minor's page for the same reason: an
-- integer carries no family name, no email, no join date.
--
-- ══ WHAT IS DELIBERATELY ABSENT ═══════════════════════════════════════════════
-- The canvas (App board 07, Club Screens board 09) draws `Accuracy 74%`,
-- `Accuracy 71%`, an `87 OPINION SCORE` dial, `Influence 1.8x`, and
-- `People Influenced 382` on this exact surface. NONE of them are computed here
-- and none may be added to this function later without a compliance ruling:
-- publishing a member's hit-rate or a scored rating of their opinions is a
-- performance / testimonial claim, and the profile is the most shareable surface
-- in the app. The data to compute a hit-rate partly exists (stance_events has a
-- timestamp and screener_metrics has a price) — the point is that it is not
-- computed, not that it could not be.
--
-- What IS published is conviction and PARTICIPATION: how many companies a member
-- has taken a position on, how many times they changed their mind in public, how
-- many notes and posts they wrote, how many weeks they showed up, and how much
-- respect other members gave their updates. Every one of those is a behaviour the
-- member performed, not a judgement of whether they were right.
--
-- `bull_stances` is returned so the client can render CONVICTION (the share of a
-- member's positions that are bullish) — a sentiment measure, lime by colour law,
-- and explicitly not a market number.
--
-- No writes. No XP. Re-runnable.

create or replace function public.member_participation(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    -- Positions held right now (ticker_stances is a per-member current state).
    'stances', coalesce((
      select count(*)::int from ticker_stances where user_id = p_user_id
    ), 0),
    'bull_stances', coalesce((
      select count(*)::int from ticker_stances
      where user_id = p_user_id and stance = 'bull'
    ), 0),
    -- Changed minds — a BEHAVIOUR count. "The Club rewards the update, not the
    -- ego": this counts the updates, and says nothing about which side was right.
    'flips', coalesce((
      select count(*)::int from stance_events
      where user_id = p_user_id and is_flip
    ), 0),
    -- Respect other members gave those updates. A reaction tally, the same class
    -- of number as an upvote — not a rating of the member's calls.
    'respect', coalesce((
      select count(*)::int
      from object_reactions r
      join stance_events se on se.id = r.target_id
      where r.target_type = 'stance_event'
        and r.reaction = 'respect'
        and se.user_id = p_user_id
    ), 0),
    'research', coalesce((
      select count(*)::int from research_objects
      where author_id = p_user_id and status = 'published'
    ), 0),
    'posts', coalesce((
      select count(*)::int from feed_posts
      where author_id = p_user_id and kind = 'post'
    ), 0),
    -- Weeks the member earned anything at all. Monday-anchored to match the
    -- trailing-streak arithmetic the profile renders beside it.
    'weeks_active', coalesce((
      select count(distinct date_trunc('week', created_at))::int
      from xp_events where user_id = p_user_id
    ), 0)
  );
$$;

comment on function public.member_participation(uuid) is
  'Participation counts for a member profile (canvas v2, lane M4). Conviction and participation ONLY — no accuracy, no hit-rate, no opinion score. See the migration header before adding a field.';

grant execute on function public.member_participation(uuid) to authenticated;

-- Recent public flips for a member profile. stance_events is already readable by
-- every authenticated member (151), so this adds no exposure — it exists so the
-- profile can render "changed their mind" as a dated ledger in ONE round trip
-- instead of a select + a join the client would have to assemble.
create or replace function public.member_flips(p_user_id uuid, p_limit int default 5)
returns table (
  id uuid,
  ticker text,
  from_stance text,
  to_stance text,
  reason text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select se.id, se.ticker, se.from_stance, se.to_stance, se.reason, se.created_at
  from stance_events se
  where se.user_id = p_user_id and se.is_flip
  order by se.created_at desc
  limit greatest(1, least(coalesce(p_limit, 5), 25));
$$;

comment on function public.member_flips(uuid, int) is
  'A member''s recent public stance flips, newest first (canvas v2, lane M4). Note text is NOT returned — the profile shows that a view changed and on what, not the member''s private reasoning body.';

grant execute on function public.member_flips(uuid, int) to authenticated;
