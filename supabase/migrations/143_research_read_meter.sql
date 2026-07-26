-- 143 — Research premium-read meter (MONETIZATION-GATES.md).
--
-- Free tier gets 3 PREMIUM research reads per rolling week, then a contextual
-- wall ("You've used your weekly research passes…"). Club/FTA = unlimited.
-- "Normal discussion" is never metered — only the premium research aggregate
-- (/research/[ticker]) consumes a pass.
--
-- MECHANISM (server-authoritative; never UI-only — the screener lesson):
--   • research_reads(user_id, ticker, week_key) — one row per distinct ticker a
--     member opens in a given ISO week. The (user, ticker, week) PK makes
--     re-opening the SAME ticker in the same week FREE (idempotent) — a member
--     is only ever charged for distinct names, never for revisiting.
--   • consume_research_read(p_ticker) SECURITY DEFINER RPC is the ONLY writer.
--     It resolves the caller's effective Club tier from family_tiers (folding the
--     Club clock: a lapsed FTA family meters like free), and:
--       - Club/FTA (unlimited)         → {allowed:true, unlimited:true}
--       - already read this week        → {allowed:true, used, cap} (no charge)
--       - free, under the weekly cap    → insert, {allowed:true, used, cap}
--       - free, at/over the cap         → {allowed:false, used, cap}  (wall)
--   Because time alone rolls the week_key, no cron is needed to reset the meter.

create table if not exists research_reads (
  user_id   uuid not null references auth.users(id) on delete cascade,
  ticker    text not null,
  week_key  text not null,          -- ISO year-week, e.g. '2026-W31'
  created_at timestamptz not null default now(),
  primary key (user_id, ticker, week_key)
);

create index if not exists idx_research_reads_user_week
  on research_reads (user_id, week_key);

alter table research_reads enable row level security;

-- Members may READ their own meter rows (for a "2 of 3 reads left" affordance).
drop policy if exists "own research reads" on research_reads;
create policy "own research reads" on research_reads
  for select to authenticated using (user_id = auth.uid());

-- No direct writes — the RPC (definer) is the only writer, so the cap can never
-- be bypassed by inserting rows via PostgREST.
revoke insert, update, delete on research_reads from authenticated, anon;

-- ISO-week key for a timestamp (matches JS getUTC-based weeks closely enough for
-- a weekly meter; Postgres IYYY-IW is the canonical ISO week-numbering year).
create or replace function public.iso_week_key(ts timestamptz default now())
returns text
language sql
immutable
as $$
  select to_char(ts at time zone 'UTC', 'IYYY') || '-W' ||
         to_char(ts at time zone 'UTC', 'IW');
$$;

create or replace function public.consume_research_read(p_ticker text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_fam   uuid;
  v_tier  text;
  v_lapsed boolean;
  v_week  text := public.iso_week_key();
  v_cap   int := 3;               -- RESEARCH_FREE_WEEKLY_READS
  v_ticker text := upper(regexp_replace(coalesce(p_ticker,''), '[^A-Za-z0-9.\-]', '', 'g'));
  v_used  int;
  v_exists boolean;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthorized');
  end if;
  if v_ticker = '' then
    return jsonb_build_object('allowed', false, 'reason', 'bad_ticker');
  end if;

  select p.family_id into v_fam from profiles p where p.id = v_uid;

  select ft.tier, coalesce(ft.club_lapsed, false)
    into v_tier, v_lapsed
    from family_tiers ft where ft.family_id = v_fam;

  -- Effective Club access: Club/FTA and NOT lapsed => unlimited research.
  if v_fam is not null and v_tier in ('fic','fta') and not v_lapsed then
    return jsonb_build_object('allowed', true, 'unlimited', true);
  end if;

  -- Free (or lapsed) — meter it. Already read this week? No new charge.
  select exists (
    select 1 from research_reads
     where user_id = v_uid and ticker = v_ticker and week_key = v_week
  ) into v_exists;

  select count(*) into v_used
    from research_reads
   where user_id = v_uid and week_key = v_week;

  if v_exists then
    return jsonb_build_object('allowed', true, 'unlimited', false,
                              'used', v_used, 'cap', v_cap);
  end if;

  if v_used >= v_cap then
    return jsonb_build_object('allowed', false, 'unlimited', false,
                              'used', v_used, 'cap', v_cap, 'reason', 'metered');
  end if;

  insert into research_reads (user_id, ticker, week_key)
  values (v_uid, v_ticker, v_week)
  on conflict do nothing;

  return jsonb_build_object('allowed', true, 'unlimited', false,
                            'used', v_used + 1, 'cap', v_cap);
end;
$$;

grant execute on function public.consume_research_read(text) to authenticated;
grant execute on function public.iso_week_key(timestamptz) to authenticated;
