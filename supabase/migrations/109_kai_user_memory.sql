-- ============================================================================
-- 109 — Kai personalization: per-request context + rolling cross-thread memory
--       (Lane 8B)
--
-- Two things ship here:
--   1. kai_user_memory — a compact, bounded "what Kai knows about this user"
--      summary, refreshed by a cheap Haiku pass in the chat route. Injected into
--      future system prompts so Kai remembers topics, followed tickers, stated
--      goals, and comprehension level ACROSS threads (individual threads already
--      persist via migration 100; this adds continuity between them).
--   2. kai_personalization() — a SECURITY DEFINER accessor the chat route calls
--      to assemble the per-request injection (display name, age register inputs,
--      lifetime XP for the belt, and the family_profiles answers). Definer so a
--      KID account can receive its family's learning context even though the
--      family_profiles RLS (migration 075) is parent-only — the function only
--      ever returns the CALLER's own row, so there is no cross-user leak.
--
-- RLS posture (matches the repo scars):
--   * kai_user_memory — strict OWN-ROW select + delete keyed on auth.uid(). No
--     member INSERT/UPDATE policy: the summary is written by the chat route with
--     the service role (bypasses RLS), exactly like kai_reports generation.
--   * Parent cross-row (view/clear a kid's memory) goes through the definer RPCs
--     kai_memory_view()/kai_memory_clear(), which verify the caller is a parent
--     in the same family — the same pattern as child_report_stats (migration 022).
-- ============================================================================

-- ── 1. kai_user_memory — one rolling summary row per user ────────────────────
create table if not exists kai_user_memory (
  user_id         uuid primary key references profiles(id) on delete cascade,
  -- Bounded, compact prose summary (route caps at ~1200 chars before writing).
  summary         text not null default '',
  -- How many of this user's own chat messages have already been folded into the
  -- summary — the cheap trigger the route uses to decide when to re-summarize.
  msgs_summarized integer not null default 0,
  updated_at      timestamptz not null default now()
);

alter table kai_user_memory enable row level security;
grant select, delete on kai_user_memory to authenticated;

-- Read own memory (the transparency panel on /kai reads this directly).
drop policy if exists "Own kai memory select" on kai_user_memory;
create policy "Own kai memory select" on kai_user_memory
  for select to authenticated using (user_id = auth.uid());

-- Clear own memory (the "Clear what Kai remembers" button).
drop policy if exists "Own kai memory delete" on kai_user_memory;
create policy "Own kai memory delete" on kai_user_memory
  for delete to authenticated using (user_id = auth.uid());

-- No INSERT/UPDATE policy: summary writes are service-role only (chat route).

-- ── 2. kai_personalization() — per-request injection context (caller only) ───
-- Returns the CALLER's display name, register inputs (role/age_group/track),
-- lifetime XP (so the route derives the belt), and their family's profile
-- answers (experience, goals, trading-vs-investing interest, household).
-- SECURITY DEFINER so a kid can receive family learning context past the
-- parent-only family_profiles RLS — but it is hard-scoped to auth.uid(), so a
-- member can only ever fetch their OWN personalization.
create or replace function public.kai_personalization()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_family uuid;
  v_prof   record;
  v_xp     integer;
  v_family_json jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  select display_name, role, age_group, track, family_id
    into v_prof
  from profiles where id = v_uid;

  if not found then
    return null;
  end if;
  v_family := v_prof.family_id;

  select coalesce(sum(amount), 0)::int into v_xp
  from xp_events where user_id = v_uid;

  -- Family learning context — non-sensitive fields only (experience, goals,
  -- interest, household counts). Null when no profile row exists yet.
  select to_jsonb(t) into v_family_json
  from (
    select fp.experience, fp.goals, fp.market_interest, fp.household
    from family_profiles fp
    where fp.family_id = v_family
  ) t;

  return jsonb_build_object(
    'display_name', v_prof.display_name,
    'role', v_prof.role,
    'age_group', v_prof.age_group,
    'track', v_prof.track,
    'xp', v_xp,
    'family', v_family_json  -- null when the family hasn't filled the profile
  );
end;
$$;

grant execute on function public.kai_personalization() to authenticated;

-- ── 3. kai_memory_view(target) — self OR parent-of-same-family ───────────────
-- The transparency panel on /kai reads own memory via the SELECT policy above;
-- this RPC is what lets a PARENT view a kid's memory from the family surface.
create or replace function public.kai_memory_view(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ok  boolean := false;
  v_row record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_user = v_uid then
    v_ok := true;
  else
    -- Caller must be a parent in the SAME family as the target (same guard as
    -- child_report_stats in migration 022).
    v_ok := exists (
      select 1
      from profiles caller
      join profiles target on target.id = p_user
      where caller.id = v_uid
        and caller.role = 'parent'
        and caller.family_id = target.family_id
        and target.family_id is not null
    );
  end if;

  if not v_ok then
    raise exception 'forbidden';
  end if;

  select summary, updated_at into v_row
  from kai_user_memory where user_id = p_user;

  if not found then
    return jsonb_build_object('summary', '', 'updated_at', null);
  end if;
  return jsonb_build_object('summary', v_row.summary, 'updated_at', v_row.updated_at);
end;
$$;

grant execute on function public.kai_memory_view(uuid) to authenticated;

-- ── 4. kai_memory_clear(target) — self OR parent-of-same-family ──────────────
-- Own clear also works through the DELETE policy; this RPC additionally lets a
-- parent clear a kid's memory from the family surface.
create or replace function public.kai_memory_clear(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ok  boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_user = v_uid then
    v_ok := true;
  else
    v_ok := exists (
      select 1
      from profiles caller
      join profiles target on target.id = p_user
      where caller.id = v_uid
        and caller.role = 'parent'
        and caller.family_id = target.family_id
        and target.family_id is not null
    );
  end if;

  if not v_ok then
    raise exception 'forbidden';
  end if;

  delete from kai_user_memory where user_id = p_user;
  return true;
end;
$$;

grant execute on function public.kai_memory_clear(uuid) to authenticated;
