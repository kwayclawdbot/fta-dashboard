-- 151 — SOCIAL OBJECTS S1: "Changed My Mind" — the signature feature.
-- SOCIAL-OBJECTS.md §CROSS-CUTTING ("changing your mind = intelligence").
--
-- A member holds a STANCE on a ticker (bull / bear / neutral). They can FLIP it
-- with a reason from a closed taxonomy (valuation / thesis_broken / new_evidence
-- / risk_increased / better_opportunity) + an optional note. Every flip is stored
-- as an append-only stance_event so the platform can render "changed their mind"
-- moments and the Kai Intelligence Layer reads clean structured rows (this feeds
-- user_ticker_theses / intel Phase 4 ticker memory).
--
--   ticker_stances  — current stance per (member, ticker). Upserted on set/flip.
--   stance_events   — append-only history of every set + flip (from → to + why).
--
-- Members who ALREADY have positioning (ticker_sentiment 👍/👎 from migration 110)
-- get an implied starting stance the first time they flip, so the flow works for
-- existing participants without a separate "set stance" step.
--
-- Kid-wall: the FLOW (set/flip) is adults+teens only, enforced inside the
-- SECURITY DEFINER RPC (mirrors club_debate_vote / viewer_is_kid, migration 137).
-- No XP anywhere.

create table if not exists ticker_stances (
  user_id    uuid not null references profiles(id) on delete cascade,
  ticker     text not null,
  stance     text not null check (stance in ('bull', 'bear', 'neutral')),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, ticker)
);
create index if not exists idx_ticker_stances_ticker on ticker_stances(ticker);

create table if not exists stance_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  ticker     text not null,
  from_stance text check (from_stance is null or from_stance in ('bull', 'bear', 'neutral')),
  to_stance  text not null check (to_stance in ('bull', 'bear', 'neutral')),
  reason     text check (reason is null or reason in
                ('valuation', 'thesis_broken', 'new_evidence', 'risk_increased', 'better_opportunity')),
  note       text,
  is_flip    boolean not null default false,   -- true when from_stance <> to_stance
  created_at timestamptz not null default now()
);
create index if not exists idx_stance_events_ticker on stance_events(ticker, created_at desc);
create index if not exists idx_stance_events_flip on stance_events(ticker, created_at desc) where is_flip;
create index if not exists idx_stance_events_user on stance_events(user_id, ticker);

alter table ticker_stances enable row level security;
alter table stance_events enable row level security;

-- Current stances + flip history are readable by every member (they render as
-- public "changed their mind" moments on posts/ticker pages). Writes flow ONLY
-- through the kid-walled RPC below — no direct INSERT/UPDATE policy.
drop policy if exists "Read ticker stances" on ticker_stances;
create policy "Read ticker stances" on ticker_stances
  for select to authenticated using (true);

drop policy if exists "Read stance events" on stance_events;
create policy "Read stance events" on stance_events
  for select to authenticated using (true);

-- ── set_ticker_stance — set or flip a stance (kid-walled) ─────────────────────
-- Derives the "from" stance from an existing ticker_stances row, or (first time)
-- from ticker_sentiment positioning (👍→bull, 👎→bear). A change from a known
-- prior requires a reason (is_flip=true); the initial set records to_stance only.
create or replace function public.set_ticker_stance(
  p_ticker text,
  p_stance text,
  p_reason text default null,
  p_note   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticker text := upper(nullif(trim(p_ticker), ''));
  v_to     text := lower(nullif(trim(p_stance), ''));
  v_reason text := lower(nullif(trim(p_reason), ''));
  v_from   text;
  v_existing boolean;
  v_flip   boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;
  if coalesce(public.viewer_is_kid(), false) then
    return jsonb_build_object('ok', false, 'reason', 'kid_walled');
  end if;
  if v_ticker is null or v_to not in ('bull', 'bear', 'neutral') then
    return jsonb_build_object('ok', false, 'reason', 'bad_input');
  end if;
  if v_reason is not null and v_reason not in
     ('valuation', 'thesis_broken', 'new_evidence', 'risk_increased', 'better_opportunity') then
    return jsonb_build_object('ok', false, 'reason', 'bad_reason');
  end if;

  -- Resolve the prior stance: explicit row wins, else implied from sentiment.
  select stance into v_from from ticker_stances
    where user_id = auth.uid() and ticker = v_ticker;
  v_existing := v_from is not null;
  if v_from is null then
    select case when vote = 1 then 'bull' when vote = -1 then 'bear' else null end
      into v_from from ticker_sentiment
      where user_id = auth.uid() and ticker = v_ticker;
  end if;

  v_flip := v_from is not null and v_from is distinct from v_to;

  -- A genuine flip must carry a reason.
  if v_flip and v_reason is null then
    return jsonb_build_object('ok', false, 'reason', 'reason_required');
  end if;

  insert into ticker_stances (user_id, ticker, stance, note, updated_at)
  values (auth.uid(), v_ticker, v_to, nullif(trim(coalesce(p_note, '')), ''), now())
  on conflict (user_id, ticker)
  do update set stance = excluded.stance, note = excluded.note, updated_at = now();

  -- Record the event when it's a flip, or the first-ever explicit stance.
  if v_flip or not v_existing then
    insert into stance_events (user_id, ticker, from_stance, to_stance, reason, note, is_flip)
    values (auth.uid(), v_ticker, v_from, v_to, v_reason,
            nullif(trim(coalesce(p_note, '')), ''), coalesce(v_flip, false));
  end if;

  return jsonb_build_object('ok', true, 'stance', v_to, 'flipped', coalesce(v_flip, false));
end;
$$;
grant execute on function public.set_ticker_stance(text, text, text, text) to authenticated;

-- ── get_ticker_stance_summary — my stance + recent flips + flip count ─────────
-- Rendered on the ticker research page. `mind_changes` counts DISTINCT members
-- who have flipped on this ticker (the "N people changed their mind" signal —
-- the app applies the scale floor). `recent` lists the latest flip moments with
-- author identity for the "changed their mind" cards.
create or replace function public.get_ticker_stance_summary(p_ticker text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with tk as (select upper(p_ticker) as t)
  select jsonb_build_object(
    'my_stance', (select stance from ticker_stances, tk
                    where user_id = auth.uid() and ticker = tk.t),
    'mind_changes', coalesce((
      select count(distinct user_id)::int from stance_events, tk
      where ticker = tk.t and is_flip), 0),
    'bull', coalesce((select count(*)::int from ticker_stances, tk where ticker = tk.t and stance = 'bull'), 0),
    'bear', coalesce((select count(*)::int from ticker_stances, tk where ticker = tk.t and stance = 'bear'), 0),
    'neutral', coalesce((select count(*)::int from ticker_stances, tk where ticker = tk.t and stance = 'neutral'), 0),
    'recent', coalesce((
      select jsonb_agg(x order by x.created_at desc)
      from (
        select se.id, se.from_stance, se.to_stance, se.reason, se.note, se.created_at,
               p.display_name, p.username, p.avatar_url, p.role, p.age_group
        from stance_events se
        join profiles p on p.id = se.user_id, tk
        where se.ticker = tk.t and se.is_flip
        order by se.created_at desc
        limit 8
      ) x
    ), '[]'::jsonb)
  );
$$;
grant execute on function public.get_ticker_stance_summary(text) to authenticated;
