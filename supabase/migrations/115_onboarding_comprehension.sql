-- ============================================================================
-- 115 — Onboarding comprehension seed (Lane 8R — wizard rebuild)
--
-- The signup wizard now runs 3–4 true/false knowledge checks between the
-- profile questions. Their score seeds a per-MEMBER comprehension level that
-- shapes how deep and how simply Kai talks to this person from message one —
-- before they've ever chatted. Two writes are needed and neither is a plain
-- client UPDATE:
--
--   1. profiles.comprehension_level — a member-level field (parents and each kid
--      calibrate separately, so this is NOT the per-family family_profiles row).
--      Additive, nullable; existing rows stay valid.
--
--   2. kai_user_memory seed — kai_user_memory (migration 109) has NO member
--      INSERT/UPDATE policy on purpose (summaries are service-role writes from
--      the chat route). So the wizard cannot upsert it directly. This migration
--      adds a SECURITY DEFINER RPC, hard-scoped to auth.uid(), that writes BOTH
--      the profile field and the initial memory summary in one call — the same
--      "definer accessor for a member-write we deliberately don't grant" pattern
--      as onboard_create_family (075).
--
-- Also extends kai_personalization() (109) to surface comprehension_level in the
-- per-request injection, so Kai's register depth reflects the onboarding result.
-- ============================================================================

-- ── 1. member-level comprehension field ─────────────────────────────────────
alter table public.profiles
  add column if not exists comprehension_level text
    check (comprehension_level in ('beginner', 'developing', 'proficient'));

comment on column public.profiles.comprehension_level is
  'Onboarding knowledge-check calibration (Lane 8R): beginner | developing | '
  'proficient. Seeds Kai''s default depth/register. Per-member (parents + each '
  'kid calibrate separately), NOT per-family. Set once by seed_onboarding_comprehension().';

-- ── 2. seed_onboarding_comprehension() — caller-scoped definer write ─────────
-- Writes the caller's comprehension level AND seeds their kai_user_memory row.
-- SECURITY DEFINER so it can write kai_user_memory (no member policy there), but
-- every write is hard-pinned to auth.uid() — a member can only ever seed their
-- OWN comprehension + memory, so there is no cross-user path.
create or replace function public.seed_onboarding_comprehension(
  p_level   text,
  p_summary text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_level is not null and p_level not in ('beginner', 'developing', 'proficient') then
    raise exception 'invalid comprehension level';
  end if;

  update profiles
    set comprehension_level = coalesce(p_level, comprehension_level)
  where id = v_uid;

  -- Seed the rolling memory only if it does not already carry content (idempotent
  -- across a wizard re-entry; never clobbers a summary the chat route has grown).
  insert into kai_user_memory (user_id, summary, msgs_summarized, updated_at)
  values (v_uid, coalesce(nullif(trim(p_summary), ''), ''), 0, now())
  on conflict (user_id) do update
    set summary = case
          when coalesce(trim(kai_user_memory.summary), '') = '' then excluded.summary
          else kai_user_memory.summary
        end,
        updated_at = now();
end;
$$;

grant execute on function public.seed_onboarding_comprehension(text, text) to authenticated;

-- ── 3. kai_personalization() — surface comprehension_level ───────────────────
-- Re-defines the accessor from 109 to also return comprehension_level so the
-- chat route can shape Kai's default depth from the onboarding calibration.
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

  select display_name, role, age_group, track, family_id, comprehension_level
    into v_prof
  from profiles where id = v_uid;

  if not found then
    return null;
  end if;
  v_family := v_prof.family_id;

  select coalesce(sum(amount), 0)::int into v_xp
  from xp_events where user_id = v_uid;

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
    'comprehension_level', v_prof.comprehension_level,
    'xp', v_xp,
    'family', v_family_json
  );
end;
$$;

grant execute on function public.kai_personalization() to authenticated;
