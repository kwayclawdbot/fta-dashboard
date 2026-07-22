-- 075 — family_profiles: profile-building onboarding data
--
-- WHY: when a parent registers a FIC account we run a warm, multi-step
-- onboarding that asks who the family is (household size, ages), where they are
-- (investing experience) and what they want (goals). Two jobs at once:
--   1. UNDERSTAND them (CRM value — surfaced to admins via admin_family_profile).
--   2. Make the platform feel BUILT for them — the answers immediately drive a
--      personalized welcome + a "recommended next" card on the dashboard home.
--
-- SHAPE: one row per family (family_id PK). Every field is optional so the
-- onboarding can write PARTIAL data as the parent goes and never block claiming
-- a paid membership. `completed_at` is stamped only when the parent finishes.
--
-- RLS: own-row. A parent reads/writes only their own family's row; kids never
-- see it. Admins read via the SECURITY DEFINER helper below (mirrors the
-- admin_family_detail pattern in migration 037) so the CRM pages need no direct
-- table grant. Helpers get_my_family_id()/get_my_role()/is_admin() come from 039.

-- ── 1. table ─────────────────────────────────────────────────────────────────
create table if not exists family_profiles (
  family_id  uuid primary key references families(id) on delete cascade,

  -- { adults:int, kids:int, kid_age_ranges:text[] } — counts + friendly age
  -- bands (under5 | 5-8 | 9-12 | 13-17). jsonb so the household shape can grow
  -- (e.g. per-kid names later) without a migration.
  household  jsonb not null default '{}'::jsonb,

  -- Investing experience — non-judgmental ladder. Beginners are the point.
  experience text check (experience in ('none', 'beginner', 'some', 'active')),

  -- Multi-select goals: teach_kids | family_habit | build_wealth |
  -- learn_trading | prep_college | other. Free-text for 'other' in goals_other.
  goals       text[] not null default '{}'::text[],
  goals_other text,

  -- Optional context.
  hear_about text,   -- friend | social | search | podcast | event | other
  motivation text,   -- "what would make this a win for your family" (free text)

  completed_at timestamptz,                        -- set only when finished
  updated_at   timestamptz not null default now()
);

-- ── 2. RLS ───────────────────────────────────────────────────────────────────
alter table family_profiles enable row level security;
grant select, insert, update on family_profiles to authenticated;

-- Parent of the family reads their own row; admins read any (for the select
-- policy path — the definer RPC below is the CRM's real entry point).
drop policy if exists "family_profiles read own or admin" on family_profiles;
create policy "family_profiles read own or admin" on family_profiles
  for select to authenticated
  using (
    (family_id = public.get_my_family_id() and public.get_my_role() = 'parent')
    or public.is_admin()
  );

drop policy if exists "family_profiles parent insert" on family_profiles;
create policy "family_profiles parent insert" on family_profiles
  for insert to authenticated
  with check (
    family_id = public.get_my_family_id() and public.get_my_role() = 'parent'
  );

drop policy if exists "family_profiles parent update" on family_profiles;
create policy "family_profiles parent update" on family_profiles
  for update to authenticated
  using (
    family_id = public.get_my_family_id() and public.get_my_role() = 'parent'
  )
  with check (
    family_id = public.get_my_family_id() and public.get_my_role() = 'parent'
  );

-- ── 3. admin_family_profile(family_id) — CRM read ────────────────────────────
-- Clean, admin-only accessor so the CRM member/family detail pages (owned by
-- another module — NOT edited here) can surface household/experience/goals
-- without a direct table grant. Returns the row as jsonb, or null if none.
create or replace function admin_family_profile(p_family_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;

  select to_jsonb(fp) into v_result
  from family_profiles fp
  where fp.family_id = p_family_id;

  return v_result;  -- null when the family has not filled a profile yet
end;
$$;

grant execute on function admin_family_profile(uuid) to authenticated;

-- ── 4. onboard_create_family — atomic family creation for the parent flow ────
-- WHY a definer RPC instead of client inserts: a browser `families.insert()
-- .select()` (return=representation) re-reads the new row under the families
-- SELECT policy (`id IN (my family_ids)`) — which fails because the caller's
-- profile is not linked to the family YET. PostgREST surfaces that as
-- "new row violates row-level security policy", so the original client-side
-- family creation could not actually create a family for a UI signup (only the
-- service-role funnel path worked). This RPC does the three writes atomically
-- under one auth.uid(), so the paid membership claim can never be blocked and
-- the flow works end to end.
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

  -- Idempotent: a parent who already owns a family (retry / back-and-forth)
  -- gets that family back — never a duplicate.
  select family_id into v_existing from profiles where id = v_uid;
  if v_existing is not null then
    return v_existing;
  end if;

  insert into families (name)
  values (nullif(trim(p_name), ''))
  returning id into v_family_id;

  update profiles set
    family_id = v_family_id,
    role = 'parent',
    age_group = 'adults',
    track = 'adults',
    display_name = coalesce(nullif(trim(p_display_name), ''), display_name, 'Parent'),
    avatar_url = coalesce(p_avatar_url, avatar_url),
    onboarding_complete = true
  where id = v_uid;

  -- Auto-activate a paid/invited membership if one is pending (no-op otherwise).
  perform claim_pending_membership(v_family_id);

  return v_family_id;
end;
$$;

grant execute on function onboard_create_family(text, text, text) to authenticated;
