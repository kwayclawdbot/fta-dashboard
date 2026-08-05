-- ============================================================================
-- 215 — families.door: the EXPERIENCE axis, stored instead of inferred
--       (EXPERIENCE-ARCHITECTURE.md, Phase E1)
--
-- Until now the app INFERRED which experience a member was in — Club vs Family —
-- from the shape of their household plus the URL prefix
-- (DashboardShell.tsx: `pathname.startsWith("/fta") ? "fta" : isSolo ? "club"
-- : "family"`). That made branding a side effect of a questionnaire answer, and
-- it made a second entry domain (app.cheatcode.com) impossible to serve.
--
-- The door is now an explicit, stored fact on the FAMILY — the membership /
-- tenant unit, so every member of a household shares one door and `register`
-- (kid / teen / adult, src/lib/register.ts) still differentiates individuals
-- inside it. Kid is NEVER a door: kids enter via a family invite and inherit the
-- family's door.
--
-- The backfill below REPRODUCES TODAY'S INFERRED VALUE EXACTLY, so shipping this
-- changes nothing for an existing member. It mirrors, in SQL, the TypeScript
-- verdict in src/lib/register.ts `isSoloAccount()`:
--   • the roster is the fact  — 2+ profiles on the family is NEVER solo;
--   • the questionnaire only breaks the one-row tie — a COMPLETED
--     family_profiles row (completed_at set) whose household reads
--     adults ≤ 1, kids = 0, no kid age ranges;
--   • JSONB defaults match the TS defaults: a missing/non-numeric `adults`
--     counts as 1, a missing/non-numeric `kids` as 0, a non-array
--     `kid_age_ranges` as empty. An unfinished or absent profile is NOT solo —
--     unknown always keeps the family framing.
-- ============================================================================

-- ── 1. the column ───────────────────────────────────────────────────────────
alter table families
  add column if not exists door text not null default 'family'
    check (door in ('club', 'family'));

comment on column families.door is
  'Experience the household entered through: club (Cheat Code Club, individual '
  'door) | family (Family Investing Club). Stamped once at provisioning from the '
  'entry domain; changed only by an explicit product action (Add your family), '
  'NEVER by which URL someone happened to visit. See EXPERIENCE-ARCHITECTURE.md.';

-- ── 2. backfill — today's inferred mode, made explicit ──────────────────────
update families f
set door = 'club'
where exists (
  select 1
  from family_profiles fp
  where fp.family_id = f.id
    and fp.completed_at is not null
    and (case when jsonb_typeof(fp.household -> 'adults') = 'number'
              then (fp.household ->> 'adults')::numeric else 1 end) <= 1
    and (case when jsonb_typeof(fp.household -> 'kids') = 'number'
              then (fp.household ->> 'kids')::numeric else 0 end) = 0
    and (case when jsonb_typeof(fp.household -> 'kid_age_ranges') = 'array'
              then jsonb_array_length(fp.household -> 'kid_age_ranges') else 0 end) = 0
)
and (select count(*) from profiles p where p.family_id = f.id) <= 1;

-- ── 3. invite_details() — carry the door to the pre-auth invite screen ──────
-- A family invite can never cross doors (the joiner inherits the family's), so
-- the signup screen needs the door only to BRAND itself correctly before the
-- account exists. Additive: one extra key on the same jsonb contract.
create or replace function public.invite_details(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_family_id uuid;
  v_role text;
  v_expires timestamptz;
  v_used uuid;
  v_family_name text;
  v_door text;
  v_inviter text;
begin
  select family_id, role, expires_at, used_by
    into v_family_id, v_role, v_expires, v_used
    from family_invites where code = p_code;

  if v_family_id is null or v_used is not null or v_expires < now() then
    return jsonb_build_object('valid', false);
  end if;

  select name, door into v_family_name, v_door from families where id = v_family_id;
  if v_family_name is null then
    return jsonb_build_object('valid', false);
  end if;

  select display_name into v_inviter
    from profiles
    where family_id = v_family_id and role = 'parent'
    order by created_at asc
    limit 1;

  return jsonb_build_object(
    'valid', true,
    'family_id', v_family_id,
    'family_name', v_family_name,
    'door', coalesce(v_door, 'family'),
    'inviter_name', coalesce(v_inviter, 'A family member'),
    'role', coalesce(v_role, 'child')
  );
end;
$$;

grant execute on function public.invite_details(text) to anon, authenticated;

-- ── 4. kai_personalization() — carry the door for Kai persona selection ─────
-- src/lib/kai/persona.ts resolves the guardrail profile (kid | family-adult |
-- club) SERVER-SIDE. It used to read the solo verdict out of the household JSON;
-- it now reads the stored door. Returned here (top level, not nested under
-- `family`, which is null until the family fills its profile) so neither Kai
-- caller pays an extra round trip. Everything else is byte-identical to 121.
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
  v_door   text;
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

  select door into v_door from families where id = v_family;

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
    'door', v_door,          -- null when the member has no family yet
    'family', v_family_json  -- null when the family hasn't filled the profile
  );
end;
$$;

grant execute on function public.kai_personalization() to authenticated;

-- ── 5. pending_memberships.door — carry the PAID door to the claim ──────────
-- A Stripe buyer is usually a brand-new user: the webhook has the door (from the
-- checkout metadata, itself stamped from the entry host) but there is no family
-- to write it to yet — the family is created at onboarding. Stash it on the
-- pending row so the claim can stamp it. NULL = "no door was purchased", and the
-- onboarding answer decides.
alter table pending_memberships add column if not exists door text
  check (door is null or door in ('club', 'family'));

-- claim_pending_membership — byte-for-byte the 127 definition plus: stamp the
-- family's door from the pending row when one was purchased.
create or replace function public.claim_pending_membership(p_family_id uuid)
  returns text
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  v_email text;
  v_row pending_memberships%rowtype;
  v_club_until timestamptz;
begin
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then return null; end if;
  select * into v_row from pending_memberships
    where lower(email) = v_email and claimed_at is null
    order by created_at desc limit 1;
  if v_row.id is null then return null; end if;
  -- family must belong to the caller
  if not exists (select 1 from profiles where id = auth.uid() and family_id = p_family_id) then
    return null;
  end if;
  v_club_until := case
    when v_row.club_months is not null
    then now() + make_interval(months => v_row.club_months)
    else null
  end;
  insert into enrollments (family_id, program, status, club_until)
  values (p_family_id, v_row.program, 'active', v_club_until)
  on conflict do nothing;
  if v_row.door is not null then
    update families set door = v_row.door where id = p_family_id;
  end if;
  update pending_memberships set claimed_at = now() where id = v_row.id;
  return v_row.program;
end;
$function$;

-- ── 6. onboard_create_family(p_door) — stamp the door at family creation ────
-- Overload, NOT a replacement: the 3-arg signature stays live (207 is the
-- current definition, and PostgREST selects an overload by the argument NAMES
-- sent) and this one simply delegates, then stamps the door.
--
-- THE PAID DOOR WINS. The delegate runs claim_pending_membership, which stamps
-- any door that was purchased; this only writes when the family was genuinely
-- created by this call AND nothing has moved the door off its 'family' default.
-- So a Club buyer who walks the wizard keeps the door they paid for, and a
-- returning parent (the idempotent "you already have a family" path) can never
-- have their door rewritten by re-entering onboarding.
create or replace function public.onboard_create_family(
  p_name text,
  p_display_name text,
  p_avatar_url text,
  p_door text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing uuid;
  v_family uuid;
  v_door text := case when p_door = 'club' then 'club' else 'family' end;
begin
  select family_id into v_existing from profiles where id = auth.uid();
  v_family := public.onboard_create_family(p_name, p_display_name, p_avatar_url);
  if v_existing is null and v_family is not null then
    update families set door = v_door where id = v_family and door = 'family';
  end if;
  return v_family;
end;
$$;

grant execute on function public.onboard_create_family(text, text, text, text) to authenticated;
