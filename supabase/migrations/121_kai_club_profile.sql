-- ============================================================================
-- 121 — Kai guardrail profiles (Cheat Code Club, Lane C2)
--
-- Two small pieces of server-side plumbing for the 3-profile Kai system
-- (kid | family-adult | club). All guardrail LOGIC lives in code
-- (src/lib/kai/persona.ts); this migration only exposes the two signals the
-- chat route needs to SELECT a profile server-side (never from client input):
--
--   1. profiles.kai_deep_mode — the optional "Deeper analysis mode" opt-in for
--      Family-Mode ADULTS. Default false. A kid/teen account can never flip this
--      into effect (the code gates club on register === "adult" first), but we
--      still keep it own-row writable via the existing profiles UPDATE policy so
--      the /kai settings toggle can persist it. Kids never escalate.
--
--   2. kai_personalization() now also returns hh_completed_at (family_profiles
--      .completed_at) so the route can resolve SOLO reliably via isSoloProfile()
--      — a COMPLETED family-of-one, not a half-finished default-shaped draft.
--      SECURITY DEFINER + hard-scoped to auth.uid(), same as before: no leak.
-- ============================================================================

-- ── 1. kai_deep_mode opt-in ─────────────────────────────────────────────────
alter table profiles
  add column if not exists kai_deep_mode boolean not null default false;

comment on column profiles.kai_deep_mode is
  'Family-Mode adults opt-in to club-level Kai depth ("Deeper analysis mode"). '
  'Kids/teens never escalate — the chat route gates club on adult register first.';

-- Own-row UPDATE is already permitted by the profiles policy
-- "on profiles for update using (auth.uid() = id)" (001), so the /kai toggle can
-- persist this with no new policy.

-- ── 2. kai_personalization() — add hh_completed_at for solo resolution ───────
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
  -- interest, household counts) PLUS the profile completion timestamp so the
  -- caller can distinguish a deliberate solo household from a default-shaped
  -- unfinished draft. Null when no profile row exists yet.
  select to_jsonb(t) into v_family_json
  from (
    select fp.experience, fp.goals, fp.market_interest, fp.household,
           fp.completed_at as hh_completed_at
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
