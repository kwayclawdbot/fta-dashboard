-- ============================================================================
-- 116 — onboard_create_family: defer onboarding_complete to the wizard end
--       (Lane 8R — every entry path routes through the wizard until finished)
--
-- The signup wizard (Lane 8R) is now the new-account process for EVERY entry
-- path — funnel, admin invite claim, Stripe-webhook claim, family invite. The
-- dashboard layout gates on profiles.onboarding_complete: a false value routes
-- the member to /onboarding. For that gate to hold the member in the wizard
-- until they actually FINISH (goals, focus, knowledge checks, avatar, invite),
-- onboarding_complete must be stamped only at the very last step.
--
-- onboard_create_family (075) previously set onboarding_complete = true the
-- moment the family was created (the old flow claimed membership early and
-- treated family-creation as "done"). It still must create the family, link the
-- parent, and CLAIM the pending paid/invited membership immediately — none of
-- that should wait — but it must NO LONGER complete onboarding. The wizard's
-- final step writes onboarding_complete = true itself.
--
-- Net effect: a parent whose membership is claimed mid-wizard but who drops off
-- before finishing is routed back into the wizard on next login (complete still
-- false) — exactly the "mandatory until finished" posture the lane requires —
-- while their paid access is already active. Only caller is the onboarding page.
-- ============================================================================

create or replace function onboard_create_family(
  p_name         text,
  p_display_name text default null,
  p_avatar_url   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_family_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Idempotent: a parent who already owns a family (resume / back-and-forth)
  -- gets that family back — never a duplicate.
  select family_id into v_existing from profiles where id = v_uid;
  if v_existing is not null then
    return v_existing;
  end if;

  insert into families (name)
  values (nullif(trim(p_name), ''))
  returning id into v_family_id;

  -- Link the parent + save their chosen name/avatar. NOTE (Lane 8R): we no
  -- longer set onboarding_complete here — the wizard stamps it on its final
  -- step so the gate keeps the member in the flow until they finish.
  update profiles set
    family_id = v_family_id,
    role = 'parent',
    age_group = 'adults',
    track = 'adults',
    display_name = coalesce(nullif(trim(p_display_name), ''), display_name, 'Parent'),
    avatar_url = coalesce(p_avatar_url, avatar_url)
  where id = v_uid;

  -- Auto-activate a paid/invited membership if one is pending (no-op otherwise).
  -- Kept immediate so paid access is never blocked by the profile questions.
  perform claim_pending_membership(v_family_id);

  return v_family_id;
end;
$$;

grant execute on function onboard_create_family(text, text, text) to authenticated;
