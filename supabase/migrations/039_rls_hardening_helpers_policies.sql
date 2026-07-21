-- 039 — RLS hardening (Part A): helper functions, invite/community RPCs, and the
-- corrected policy set for the 9 legacy tables. RLS is DELIBERATELY NOT enabled
-- here — every policy below is inert until 040 flips ENABLE ROW LEVEL SECURITY.
-- Splitting A (policies, safe anytime) from B (enable) lets the app code that
-- calls the new RPCs deploy in between, so there is never a window where a live
-- surface breaks. See .planning/RLS-HARDENING-AUDIT.md for the full access map.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SECURITY DEFINER helpers (bypass RLS → no "policy on profiles subqueries
--    profiles" recursion; search_path locked to satisfy the advisor).
-- ─────────────────────────────────────────────────────────────────────────────

-- Recreate the existing helper with a locked search_path (clears one advisor WARN).
create or replace function public.get_my_family_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select family_id from public.profiles where id = auth.uid(); $$;

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select role from public.profiles where id = auth.uid(); $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select coalesce((select role from public.profiles where id = auth.uid()) = 'admin', false); $$;

grant execute on function public.get_my_family_id() to anon, authenticated;
grant execute on function public.get_my_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Invite RPCs — replace the ANON `.from()` reads and the child's used_by write
--    that RLS on family_invites/families would otherwise block. Invite codes are
--    bearer secrets, so validation must go through a DEFINER function (never a
--    permissive anon policy that would leak every pending invite).
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_inviter text;
begin
  select family_id, role, expires_at, used_by
    into v_family_id, v_role, v_expires, v_used
    from family_invites where code = p_code;

  if v_family_id is null or v_used is not null or v_expires < now() then
    return jsonb_build_object('valid', false);
  end if;

  select name into v_family_name from families where id = v_family_id;
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
    'inviter_name', coalesce(v_inviter, 'A family member'),
    'role', coalesce(v_role, 'child')
  );
end;
$$;

create or replace function public.redeem_invite(p_code text, p_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_family_id uuid;
  v_role text;
  v_expires timestamptz;
  v_used uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;

  select family_id, role, expires_at, used_by
    into v_family_id, v_role, v_expires, v_used
    from family_invites where code = p_code
    for update;

  if v_family_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if v_expires < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  -- idempotent for the same joiner; block if already consumed by someone else
  if v_used is not null and v_used <> v_uid then
    return jsonb_build_object('ok', false, 'reason', 'used');
  end if;

  -- Join the family. handle_new_user() creates the profile row on signup, but
  -- upsert guards against any ordering race. display_name is preserved if the
  -- row already exists (the trigger/onboarding own it).
  insert into profiles (id, family_id, role, display_name, onboarding_complete)
  values (v_uid, v_family_id, coalesce(v_role, 'child'), coalesce(nullif(trim(p_display_name), ''), 'Explorer'), false)
  on conflict (id) do update
    set family_id = excluded.family_id,
        role = excluded.role,
        onboarding_complete = false;

  update family_invites set used_by = v_uid where code = p_code;

  return jsonb_build_object('ok', true, 'family_id', v_family_id, 'role', coalesce(v_role, 'child'));
end;
$$;

grant execute on function public.invite_details(text) to anon, authenticated;
grant execute on function public.redeem_invite(text, text) to authenticated;

-- Community "families" stat without exposing families (billing ids) to members.
create or replace function public.community_family_count()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select count(*) from families; $$;

grant execute on function public.community_family_count() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. profiles — remove the two RECURSIVE admin policies; add parent + admin
--    cross-row UPDATE policies built on the DEFINER helpers. (SELECT for members
--    and admins is already covered by "Authenticated can read profiles".)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "admins_select_profiles" on public.profiles;   -- recursive; redundant with authenticated read
drop policy if exists "admins_update_profiles" on public.profiles;   -- recursive; replaced below

drop policy if exists "Parents update family profiles" on public.profiles;
create policy "Parents update family profiles" on public.profiles
  for update to authenticated
  using (
    public.get_my_role() = 'parent'
    and family_id is not null
    and family_id = public.get_my_family_id()
  )
  with check (
    public.get_my_role() = 'parent'
    and (family_id is null or family_id = public.get_my_family_id())
  );

drop policy if exists "Admins update any profile" on public.profiles;
create policy "Admins update any profile" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. user_badges — allow reading badges of your own family members (family/overview
--    counts), on top of the existing own-only SELECT.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Family reads member badges" on public.user_badges;
create policy "Family reads member badges" on public.user_badges
  for select to authenticated
  using (
    user_id in (select id from public.profiles where family_id = public.get_my_family_id())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Content read policies — retarget from role `public` (which includes ANON) to
--    `authenticated`, so anon is blocked while every logged-in member keeps read
--    access. Admin CRUD policies are untouched (they subquery profiles, a different
--    table → no recursion).
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Anyone can read badges" on public.badges;
create policy "Authenticated can read badges" on public.badges
  for select to authenticated using (true);

drop policy if exists "Authenticated users can read published courses" on public.courses;
create policy "Members read published courses" on public.courses
  for select to authenticated using (published = true);

drop policy if exists "Read modules of visible courses" on public.modules;
create policy "Members read modules of published courses" on public.modules
  for select to authenticated
  using (course_id in (select id from public.courses where published = true));

drop policy if exists "Read lessons of visible courses" on public.lessons;
create policy "Members read lessons of published courses" on public.lessons
  for select to authenticated
  using (module_id in (
    select m.id from public.modules m
    join public.courses c on c.id = m.course_id
    where c.published = true
  ));

-- families / family_invites / lesson_progress keep their existing (correct) policies:
--   families: "Members can read own family" (own-scoped, protects billing), "Authenticated users can create families"
--   family_invites: "Parents manage family invites" (parent INSERT; anon/child paths now via RPC)
--   lesson_progress: "Users manage own progress", "Parents read family progress", "admins_select_lesson_progress"
