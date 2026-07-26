-- 140 — ClubHome v2 cached aggregates + Club Score pipeline + Club invite code.
--
-- Home must load with FAST READS ONLY. The one genuinely expensive computation —
-- the per-ticker Club Score over the whole community (scanning watchlists, feed
-- reactions/comments, sentiment, and club_events) — is precomputed here into
-- cached tables by refresh_club_metrics(), a SECURITY DEFINER function that
-- bypasses RLS. pg_cron is NOT enabled on this project (see COMMUNITY-WATCHLIST
-- plan), so the refresh is driven exactly like the app's other periodic work:
-- a Vercel Cron → secret-guarded API route (/api/club/refresh). The read
-- endpoints also lazily trigger a refresh when the cache is stale, so local dev
-- and the very first request are never empty.
--
-- CLUB SCORE = weighted community ATTENTION per ticker over a 14-day window.
--   weighted action sum + 5 x (distinct participants)
-- Weights (single source of truth — mirrored in src/lib/club/score.ts):
--   watchlist_add 4 | research_view 3 | comment 3 | post 3 | sentiment 2 |
--   kai_question 2  | save 2         | reaction 1 | search 1
-- Participant breadth (5x distinct members touching the ticker) dominates so a
-- ticker that many members engage with outranks one a single member spams.
-- change = score(last 14d) − score(prior 14d)  → direction/delta for the UI.

-- ── Cached tables ────────────────────────────────────────────────────────────
create table if not exists club_trending (
  ticker text primary key,
  score numeric not null default 0,
  prev_score numeric not null default 0,
  change numeric not null default 0,
  rank int,
  participants int not null default 0,
  components jsonb,
  computed_at timestamptz not null default now()
);

create table if not exists club_metrics_kv (
  key text primary key,
  value jsonb not null,
  computed_at timestamptz not null default now()
);

alter table club_trending enable row level security;
alter table club_metrics_kv enable row level security;

-- Aggregates carry NO per-member PII (just tickers + tallies), so they are
-- readable by every authenticated member. Writes are service-role only (the
-- refresh function / cron), so there is deliberately no INSERT/UPDATE policy.
drop policy if exists "Read club trending" on club_trending;
create policy "Read club trending" on club_trending
  for select to authenticated using (true);
drop policy if exists "Read club metrics kv" on club_metrics_kv;
create policy "Read club metrics kv" on club_metrics_kv
  for select to authenticated using (true);

-- ── The refresh: recompute all cached aggregates from real rows ──────────────
create or replace function public.refresh_club_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_win14 timestamptz := v_now - interval '14 days';
  v_win28 timestamptz := v_now - interval '28 days';
  v_today timestamptz := date_trunc('day', v_now);
  v_rows int;
  v_minds int;
  v_actions int;
  v_collective jsonb;
begin
  -- Single-flight: if another refresh holds the lock, skip (cache stays warm).
  if not pg_try_advisory_xact_lock(hashtext('refresh_club_metrics')) then
    return jsonb_build_object('ok', true, 'skipped', 'locked');
  end if;

  -- Unified attention stream over the last 28d, materialized once: every source
  -- normalized to (ticker, member, weight, at). Both windows + the collective
  -- counts read from this single temp table.
  create temporary table _ev on commit drop as
    select ticker, member, w, at, kind from (
      select upper(cw.ticker) as ticker, cw.promoted_by as member, 4::numeric as w, cw.created_at as at, 'watchlist_add'::text as kind
        from community_watchlist cw where cw.ticker is not null and cw.created_at >= v_win28
      union all
      select upper(fw.ticker), fw.champion_id, 4, fw.created_at, 'watchlist_add'
        from family_watchlist fw where fw.ticker is not null and fw.created_at >= v_win28
      union all
      select upper(ctc.ticker), ctc.user_id, 3, ctc.created_at, 'comment'
        from community_ticker_comments ctc where ctc.ticker is not null and ctc.created_at >= v_win28
      union all
      select upper(ts.ticker), ts.user_id, 2, coalesce(ts.updated_at, ts.created_at), 'sentiment'
        from ticker_sentiment ts where ts.ticker is not null and coalesce(ts.updated_at, ts.created_at) >= v_win28
      union all
      select upper(tag), fp.author_id, 3, fp.created_at, 'post'
        from feed_posts fp, unnest(fp.ticker_tags) as tag
        where fp.ticker_tags is not null and fp.created_at >= v_win28
      union all
      select upper(tag), pl.user_id, 1, pl.created_at, 'reaction'
        from post_likes pl join feed_posts fp on fp.id = pl.post_id, unnest(fp.ticker_tags) as tag
        where fp.ticker_tags is not null and pl.created_at >= v_win28
      union all
      select upper(tag), pc.author_id, 3, pc.created_at, 'comment'
        from post_comments pc join feed_posts fp on fp.id = pc.post_id, unnest(fp.ticker_tags) as tag
        where fp.ticker_tags is not null and pc.created_at >= v_win28
      union all
      select upper(ce.ticker), ce.member_id,
             case ce.kind when 'research_view' then 3 when 'kai_question' then 2 when 'save' then 2 else 1 end,
             ce.created_at,
             ce.kind
        from club_events ce where ce.ticker is not null and ce.created_at >= v_win28
    ) u
    where ticker is not null and ticker <> '';

  delete from club_trending;

  insert into club_trending (ticker, score, prev_score, change, rank, participants, components, computed_at)
  select ticker, score_now, score_prev, score_now - score_prev,
         row_number() over (order by score_now desc, participants desc),
         participants, components, v_now
  from (
    select
      ticker,
      coalesce(sum(w) filter (where at >= v_win14), 0)
        + 5 * count(distinct member) filter (where at >= v_win14 and member is not null) as score_now,
      coalesce(sum(w) filter (where at >= v_win28 and at < v_win14), 0)
        + 5 * count(distinct member) filter (where at >= v_win28 and at < v_win14 and member is not null) as score_prev,
      count(distinct member) filter (where at >= v_win14 and member is not null) as participants,
      jsonb_build_object(
        'weightedActions', coalesce(sum(w) filter (where at >= v_win14), 0),
        'participants', count(distinct member) filter (where at >= v_win14 and member is not null)
      ) as components
    from _ev
    group by ticker
    having coalesce(sum(w) filter (where at >= v_win14), 0) > 0
  ) s;

  get diagnostics v_rows = row_count;

  -- ── Collective KV (cheap counts; used by /api/club/collective) ─────────────
  select count(*) into v_minds from profiles;
  select count(*) into v_actions from _ev where at >= v_today;

  v_collective := jsonb_build_object(
    'connectedMinds', v_minds,
    'actionsToday', v_actions,
    'breakdown', (
      select jsonb_build_object(
        'watches',      count(*) filter (where at >= v_today and kind = 'watchlist_add'),
        'reactions',    count(*) filter (where at >= v_today and kind = 'reaction'),
        'comments',     count(*) filter (where at >= v_today and kind in ('comment', 'post')),
        'saves',        count(*) filter (where at >= v_today and kind = 'save'),
        'kaiQuestions', count(*) filter (where at >= v_today and kind = 'kai_question')
      )
      from _ev
    )
  );

  insert into club_metrics_kv (key, value, computed_at)
  values ('collective', v_collective, v_now)
  on conflict (key) do update set value = excluded.value, computed_at = excluded.computed_at;

  return jsonb_build_object('ok', true, 'tickers', v_rows, 'connectedMinds', v_minds, 'at', v_now);
end;
$$;
grant execute on function public.refresh_club_metrics() to authenticated, service_role;

-- ── Club invite code — adults + teens (non-kid), not just parents ────────────
-- The v1 referral RPC (get_or_create_referral_code, migration 036) is parent/
-- admin only. ClubHome's Build-the-Club mechanics open invites to teens too, so
-- this variant gates on the SAME kid-wall as the screener (viewer_is_kid) and
-- reuses referral_codes + _referral_slug — so /r/[code] click tracking and
-- attach_referral() attribution/XP all keep working unchanged.
create or replace function public.get_or_create_club_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if auth.uid() is null then return null; end if;
  if coalesce(public.viewer_is_kid(), false) then return null; end if;  -- kids excluded

  select code into v_code from referral_codes where user_id = auth.uid();
  if v_code is not null then return v_code; end if;

  v_code := public._referral_slug(auth.uid());
  insert into referral_codes (user_id, code)
  values (auth.uid(), v_code)
  on conflict (user_id) do nothing;

  select code into v_code from referral_codes where user_id = auth.uid();
  return v_code;
end;
$$;
grant execute on function public.get_or_create_club_invite_code() to authenticated;

-- Top-inviters leaderboard: activated (signup) invites per member. SECURITY
-- DEFINER so it can read across referral_events/codes without widening RLS, and
-- it exposes only display names + counts (no emails/ids).
create or replace function public.club_top_inviters(p_limit int default 10)
returns table (name text, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.display_name, p.username, 'A member') as name, cnt.count
  from (
    select rc.user_id, count(*) as count
    from referral_events re
    join referral_codes rc on rc.code = re.code
    where re.kind = 'signup'
    group by rc.user_id
  ) cnt
  join profiles p on p.id = cnt.user_id
  order by cnt.count desc, name asc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;
grant execute on function public.club_top_inviters(int) to authenticated;
