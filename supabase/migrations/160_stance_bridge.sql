-- 160 — STANCE BRIDGE: wire ticker_stances / stance_events (mig 151, the
-- "Changed My Mind" signature) INTO the intelligence pipeline.
--
-- BEFORE this migration ticker_stances/stance_events were WRITE-ONLY: the
-- ChangedMyMind flow captured stances + flips but nothing READ them — the intel
-- snapshot's sentiment came only from ticker_sentiment (👍/👎, mig 110) +
-- feed_posts.position (mig 132). Audit P1 DUP-1. This migration bridges them:
--
--   (a) SENTIMENT PRECEDENCE. ticker_stances and ticker_sentiment are the SAME
--       axis — a member's stance on a ticker. So we resolve to ONE row per
--       (member, ticker): an explicit ticker_stance SUPERSEDES that member's
--       older 👍/👎 signal (bull→+1, neutral→0, bear→-1). A member who never used
--       the new stance flow is unchanged (their 👍/👎 still counts). feed_posts.
--       position is a DIFFERENT axis (per-post positioning) and stays ADDITIVE —
--       never deduped against stance. Net effect: the snapshot sentiment now
--       reflects the signature feature, and no member is double-counted.
--
--   (b) MIND-CHANGE AGGREGATES. A `minds` CTE tallies distinct members who FLIPPED
--       per ticker (all-time + last 7d + raw flip count) from stance_events. These
--       land in snapshot.provenance.mindChanges so the "N people changed their
--       mind" signal the spec headlines is grounded in raw counts. /api/club/intel
--       surfaces it FLOOR-GATED at ≥5 distinct members (same scale-floor discipline
--       as the rest of the intel layer — no "3 people changed their mind").
--
-- Everything else in refresh_club_metrics() is IDENTICAL to migration 141 (same
-- lock, cadence, _ev stream, club_trending, collective KV, snapshot columns). Only
-- the `senti` CTE is rewritten and the `minds` CTE + provenance.mindChanges added.
-- Zero LLM. Re-runnable.

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
  -- snapshot windows
  v_win24  timestamptz := v_now - interval '24 hours';
  v_win48  timestamptz := v_now - interval '48 hours';
  v_win7   timestamptz := v_now - interval '7 days';
  v_win15  timestamptz := v_now - interval '15 days';   -- 14d window ending 24h ago
  -- SNAPSHOT SIGNAL FLOORS (mirror src/lib/club/score.ts SNAPSHOT_FLOORS).
  v_unusual_min_24h int := 8;        -- absolute floor: min weighted-ish events in 24h
  v_unusual_mult numeric := 2.0;     -- relative: 24h must be ≥ mult × prior-24h baseline
  v_mind_change_floor int := 5;      -- ≥ this many distinct flippers before the stat surfaces
  v_rows int;
  v_snap int;
  v_minds int;
  v_actions int;
  v_collective jsonb;
begin
  -- Single-flight: if another refresh holds the lock, skip (cache stays warm).
  if not pg_try_advisory_xact_lock(hashtext('refresh_club_metrics')) then
    return jsonb_build_object('ok', true, 'skipped', 'locked');
  end if;

  -- Unified attention stream over the last 28d, materialized once.
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

  -- ── TICKER INTEL SNAPSHOTS (KAI-INTELLIGENCE-LAYER §2a) ────────────────────
  -- Populated from the SAME _ev + the freshly-written club_trending. Active set
  -- = club_trending tickers (14d attention). Everything LEFT-JOINed onto it.
  delete from ticker_intel_snapshots;

  insert into ticker_intel_snapshots (
    ticker, as_of, rank, club_score, club_change_14d, score_change_24h, participants,
    watchers, watch_velocity_24h, research_velocity_24h, comment_velocity_24h,
    sentiment_bullish, sentiment_neutral, sentiment_bearish, sentiment_change_24h,
    unusual_activity, top_topics, top_risks, provenance, computed_at
  )
  with vel as (
    -- Per-ticker velocity slices off the 28d event stream.
    select ticker,
      count(*) filter (where kind = 'watchlist_add' and at >= v_win24)                as watch_24h,
      count(*) filter (where kind = 'watchlist_add' and at >= v_win48 and at < v_win24) as watch_prior24h,
      count(*) filter (where kind = 'watchlist_add' and at >= v_win7)                 as watch_7d,
      count(*) filter (where kind = 'research_view' and at >= v_win24)                as research_24h,
      count(*) filter (where kind = 'research_view' and at >= v_win7)                 as research_7d,
      count(*) filter (where kind in ('comment', 'post') and at >= v_win24)           as comment_24h,
      count(*) filter (where at >= v_win24)                                          as events_24h,
      count(*) filter (where at >= v_win48 and at < v_win24)                          as events_prior24h,
      -- Club Score as-of 24h ago: the 14d window ending 24h ago = [now−15d, now−24h).
      coalesce(sum(w) filter (where at >= v_win15 and at < v_win24), 0)
        + 5 * count(distinct member) filter (where at >= v_win15 and at < v_win24 and member is not null) as score_24h_ago
    from _ev
    group by ticker
  ),
  watchers_tot as (
    -- All-time distinct watchers per ticker (community + family).
    select ticker, count(distinct member) as watchers
    from (
      select upper(cw.ticker) as ticker, cw.promoted_by as member
        from community_watchlist cw where cw.ticker is not null
      union all
      select upper(fw.ticker), fw.champion_id
        from family_watchlist fw where fw.ticker is not null
    ) w
    group by ticker
  ),
  senti as (
    -- Sentiment split. THE STANCE BRIDGE (mig 151): ticker_stances and
    -- ticker_sentiment are the SAME axis (a member's stance on a ticker), so we
    -- resolve to ONE row per (member, ticker) — an explicit ticker_stance
    -- SUPERSEDES that member's older 👍/👎 (bull→+1, neutral→0, bear→-1). A member
    -- who never set an explicit stance still contributes their 👍/👎 unchanged.
    -- feed_posts.position is a DISTINCT axis (per-post positioning) and stays
    -- ADDITIVE — never deduped against the resolved member stance.
    select ticker,
      count(*) filter (where dir > 0)                     as bull,
      count(*) filter (where dir = 0)                     as neu,
      count(*) filter (where dir < 0)                     as bear,
      coalesce(sum(dir), 0)                               as net,
      coalesce(sum(dir) filter (where at >= v_win7), 0)   as net_7d,
      count(*) filter (where dir > 0 and at >= v_win24)   as bull_24h,
      count(*) filter (where dir < 0 and at >= v_win24)   as bear_24h
    from (
      -- Resolved per-member stance: explicit ticker_stance wins, else 👍/👎.
      select
        upper(coalesce(st.ticker, ts.ticker)) as ticker,
        case
          when st.stance = 'bull'    then 1
          when st.stance = 'bear'    then -1
          when st.stance = 'neutral' then 0
          else sign(ts.vote)::int
        end as dir,
        coalesce(st.updated_at, ts.updated_at, ts.created_at) as at
      from ticker_stances st
      full outer join ticker_sentiment ts
        on ts.user_id = st.user_id and upper(ts.ticker) = upper(st.ticker)
      where coalesce(st.ticker, ts.ticker) is not null
      union all
      -- Per-post positioning (additive, never deduped against member stance).
      select upper(tag),
             case fp.position when 'bull' then 1 when 'bear' then -1 else 0 end,
             fp.created_at
        from feed_posts fp, unnest(fp.ticker_tags) as tag
        where fp.ticker_tags is not null and fp.position is not null
    ) s
    group by ticker
  ),
  minds as (
    -- "Changed their mind" aggregates from stance_events flips (mig 151). Distinct
    -- flippers all-time + last 7d + raw flip count → provenance.mindChanges. The
    -- API floor-gates the surfaced stat at v_mind_change_floor distinct members.
    select upper(ticker) as ticker,
      count(distinct user_id)                                     as members,
      count(distinct user_id) filter (where created_at >= v_win7) as members_7d,
      count(*)                                                    as flips
    from stance_events
    where is_flip
    group by upper(ticker)
  )
  select
    ct.ticker,
    v_now,
    ct.rank,
    ct.score,
    ct.change,
    ct.score - coalesce(vel.score_24h_ago, 0),
    ct.participants,
    coalesce(wt.watchers, 0),
    coalesce(vel.watch_24h, 0),
    coalesce(vel.research_24h, 0),
    coalesce(vel.comment_24h, 0),
    coalesce(se.bull, 0),
    coalesce(se.neu, 0),
    coalesce(se.bear, 0),
    (coalesce(se.bull_24h, 0) - coalesce(se.bear_24h, 0))::numeric,
    -- unusual = clears the ABSOLUTE 24h floor AND is a ≥mult spike vs prior 24h.
    (coalesce(vel.events_24h, 0) >= v_unusual_min_24h
       and coalesce(vel.events_24h, 0) >= v_unusual_mult * greatest(coalesce(vel.events_prior24h, 0), 1)),
    null::jsonb,   -- top_topics (Phase 2)
    null::jsonb,   -- top_risks  (Phase 2)
    jsonb_build_object(
      'window', jsonb_build_object('now', v_now, 'score24hAsOf', v_win24, 'sevenDay', v_win7),
      'clubScore', ct.score,
      'score24hAgo', coalesce(vel.score_24h_ago, 0),
      'weightedActions14d', coalesce((ct.components->>'weightedActions')::numeric, 0),
      'participants14d', ct.participants,
      'watchersTotal', coalesce(wt.watchers, 0),
      'watchlistAdds24h', coalesce(vel.watch_24h, 0),
      'watchlistAddsPrior24h', coalesce(vel.watch_prior24h, 0),
      'watchlistAdds7d', coalesce(vel.watch_7d, 0),
      'researchViews24h', coalesce(vel.research_24h, 0),
      'researchViews7d', coalesce(vel.research_7d, 0),
      'comments24h', coalesce(vel.comment_24h, 0),
      'events24h', coalesce(vel.events_24h, 0),
      'eventsPrior24h', coalesce(vel.events_prior24h, 0),
      'sentiment', jsonb_build_object(
        'bullish', coalesce(se.bull, 0),
        'neutral', coalesce(se.neu, 0),
        'bearish', coalesce(se.bear, 0),
        'net', coalesce(se.net, 0),
        'net7d', coalesce(se.net_7d, 0),
        'bullish24h', coalesce(se.bull_24h, 0),
        'bearish24h', coalesce(se.bear_24h, 0),
        'source', 'ticker_stances supersedes ticker_sentiment per member; feed_posts.position additive'
      ),
      -- "Changed their mind" provenance (mig 151 stance flips). floor = the
      -- distinct-member threshold /api/club/intel applies before surfacing.
      'mindChanges', jsonb_build_object(
        'members', coalesce(mc.members, 0),
        'members7d', coalesce(mc.members_7d, 0),
        'flips', coalesce(mc.flips, 0),
        'floor', v_mind_change_floor
      ),
      'floors', jsonb_build_object(
        'unusualMinEvents24h', v_unusual_min_24h,
        'unusualSpikeMult', v_unusual_mult,
        'mindChangeMinMembers', v_mind_change_floor
      )
    ),
    v_now
  from club_trending ct
  left join vel         on vel.ticker = ct.ticker
  left join watchers_tot wt on wt.ticker = ct.ticker
  left join senti       se on se.ticker = ct.ticker
  left join minds       mc on mc.ticker = ct.ticker;

  get diagnostics v_snap = row_count;

  return jsonb_build_object(
    'ok', true, 'tickers', v_rows, 'snapshots', v_snap,
    'connectedMinds', v_minds, 'at', v_now
  );
end;
$$;
grant execute on function public.refresh_club_metrics() to authenticated, service_role;
