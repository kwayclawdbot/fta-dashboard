-- 118 — Lane 11A: batched belt XP + richer public profile
--
-- Two pieces, both SECURITY DEFINER so cross-user data can be shown WITHOUT
-- widening the per-row RLS on xp_events / ticker_sentiment / comments:
--
--   1. xp_for_users(uuid[]) — one grouped SUM over xp_events keyed by user, so a
--      feed / comment list / chat / family strip can resolve everyone's belt in
--      ONE round trip (never an N+1). xp_events is the single source of truth
--      (no denormalised lifetime_xp column to drift); idx_xp_events_user keeps
--      the aggregate cheap. Own-row RLS on xp_events would otherwise hide other
--      members' totals — the definer is what makes cross-user belts possible.
--
--   2. public_profile(text) — extended with the member's community footprint:
--      liked tickers (ticker_sentiment 👍), their promoted community picks with
--      performance since they were added, and a public contributions count.
--      Everyone (kids included) surfaces these — they are already-public
--      community actions (owner rule: kid likes are visible). The existing
--      kid-MINIMISATION (no family name / role / exact join date for minors) is
--      preserved unchanged; nothing new here leaks a minor's private data.

-- ── 1. batched belt XP ───────────────────────────────────────────────────────
create or replace function public.xp_for_users(p_user_ids uuid[])
returns table (user_id uuid, xp bigint)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select x.user_id, coalesce(sum(x.amount), 0)::bigint as xp
  from public.xp_events x
  where x.user_id = any(p_user_ids)
  group by x.user_id
$$;

revoke all on function public.xp_for_users(uuid[]) from public;
grant execute on function public.xp_for_users(uuid[]) to authenticated;

-- ── 2. richer public profile ─────────────────────────────────────────────────
create or replace function public.public_profile(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v          record;
  v_age      text;
  v_minor    boolean;
  v_tier     text;
  v_xp       bigint;
  v_badges   jsonb;
  v_family   text;
  v_liked    jsonb;
  v_picks    jsonb;
  v_contribs integer;
  v_result   jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;

  select p.id, p.username, p.display_name, p.avatar_url, p.role, p.age_group,
         p.family_id, p.created_at
    into v
    from public.profiles p
    where lower(p.username) = lower(btrim(p_username))
    limit 1;

  if not found then
    return null;
  end if;

  v_age := case
    when v.age_group in ('kids', 'teens', 'adults') then v.age_group
    when v.role = 'child' then 'teens'
    else 'adults'
  end;
  v_minor := v_age in ('kids', 'teens');

  select coalesce(ft.tier, 'fic') into v_tier
    from public.family_tiers ft where ft.family_id = v.family_id;
  if v_tier is null then v_tier := 'fic'; end if;

  select coalesce(sum(x.amount), 0) into v_xp
    from public.xp_events x where x.user_id = v.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'slug', b.slug,
           'title', b.title,
           'subtitle', b.subtitle,
           'sort', b.sort,
           'awarded_at', ba.awarded_at
         ) order by b.sort), '[]'::jsonb)
    into v_badges
    from public.badge_awards ba
    join public.badges b on b.id = ba.badge_id
    where ba.user_id = v.id and b.criteria_key is not null;

  -- Favourite stocks: tickers this member likes (👍), newest first, with the
  -- company name (from screener_metrics when we have it).
  select coalesce(jsonb_agg(t order by t->>'liked_at' desc), '[]'::jsonb)
    into v_liked
  from (
    select jsonb_build_object(
             'ticker', ts.ticker,
             'company_name', sm.name,
             'liked_at', ts.updated_at
           ) as t
    from public.ticker_sentiment ts
    left join public.screener_metrics sm on sm.ticker = ts.ticker
    where ts.user_id = v.id and ts.vote = 1
    order by ts.updated_at desc
    limit 24
  ) q;

  -- Community picks: companies this member promoted to the shared board, with
  -- performance since the pick was snapshotted (current price from screener).
  select coalesce(jsonb_agg(p order by p->>'created_at' desc), '[]'::jsonb)
    into v_picks
  from (
    select jsonb_build_object(
             'ticker', cw.ticker,
             'company_name', cw.company_name,
             'headline', cw.headline,
             'snapshot_price', cw.snapshot_price,
             'current_price', sm.price,
             'pct_since', case
               when cw.snapshot_price is not null and cw.snapshot_price > 0 and sm.price is not null
               then round(((sm.price - cw.snapshot_price) / cw.snapshot_price * 100)::numeric, 2)
               else null end,
             'created_at', cw.created_at
           ) as p
    from public.community_watchlist cw
    left join public.screener_metrics sm on sm.ticker = cw.ticker
    where cw.promoted_by = v.id
      and coalesce(cw.status, 'active') = 'active'
    order by cw.created_at desc
    limit 24
  ) q;

  select count(*) into v_contribs
    from public.community_ticker_comments c where c.user_id = v.id;

  v_result := jsonb_build_object(
    'id',            v.id,
    'username',      v.username,
    'display_name',  v.display_name,
    'avatar_url',    v.avatar_url,
    'age_group',     v_age,
    'tier',          v_tier,
    'xp',            v_xp,
    'badges',        v_badges,
    'member_since',  to_char(v.created_at, 'Mon YYYY'),
    'is_minor',      v_minor,
    'liked_tickers', v_liked,
    'community_picks', v_picks,
    'contributions', coalesce(v_contribs, 0)
  );

  if not v_minor then
    select f.name into v_family from public.families f where f.id = v.family_id;
    v_result := v_result || jsonb_build_object(
      'family_name', v_family,
      'role_kind',   case when v.role = 'parent' then 'parent' else 'member' end
    );
  end if;

  return v_result;
end $function$;
