-- 095 — Public member profiles: url-safe usernames + kid-minimized read RPCs.
--
-- OWNER ASK (2026-07-22): every user (adult AND kid) gets a public profile that
-- shows badges + basic info, clickable from the feed / comments / @mentions. But
-- NO public personal info about kids. "Public" here = visible to any
-- AUTHENTICATED member of any tier (the community itself is auth-gated), NOT the
-- open internet. The profile page lives at /u/[username].
--
-- This migration ships the DATA layer:
--   1. profiles.username — a unique, url-safe handle for every profile. Backfilled
--      from the display_name slug (with a numeric suffix on collision) and kept
--      populated for all future rows by a BEFORE trigger, so the app never has to
--      remember to set it (onboarding is owned by another module and untouched).
--   2. public_profile(username) — the SOLE safe read for a profile page. A
--      SECURITY DEFINER function that returns ONLY safe fields and enforces kid
--      MINIMIZATION SERVER-SIDE: minors (age_group kids/teens) never get a family
--      name or a parent/member role, and nobody ever gets email or an exact join
--      date (member_since is month/year only). The client is never trusted to hide
--      these — the function simply never emits them for a minor.
--   3. public_usernames(ids[]) — batched id→username map for building profile
--      links from author ids with no N+1.
--   4. public_profile_mentions(handles[]) — batched resolver that maps an
--      @mention handle (display_name, spaces stripped, case-insensitive — the same
--      rule the composer autocomplete uses) to a username, so mention text can be
--      rendered as a profile link in one lookup.
--
-- NOTE on level/XP: lifetime XP is summed here from xp_events (the existing XP
-- source, mirroring src/lib/xp.getUserXp). The LEVEL LADDER stays in
-- src/lib/xp.ts (single source of truth); the page derives level + progress from
-- the returned xp, so the SQL never duplicates (and never drifts from) the ladder.

-- ── 1. username column ───────────────────────────────────────────────────────

alter table public.profiles add column if not exists username text;

-- Slugify a display name into a url-safe handle: lowercase, every run of
-- non-alphanumerics collapses to a single hyphen, trimmed. NULL when empty.
create or replace function public.slugify_username(p text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', '-', 'g'),
        '-+', '-', 'g'
      ),
      '-'
    ),
    ''
  );
$$;

-- Backfill every existing profile with a unique username (slug + -N on collision).
do $$
declare
  r    record;
  base text;
  cand text;
  n    int;
begin
  for r in
    select id, display_name from public.profiles
    where username is null or btrim(username) = ''
    order by created_at, id
  loop
    base := coalesce(public.slugify_username(r.display_name), 'member');
    base := left(base, 40);
    base := btrim(base, '-');
    if base = '' then base := 'member'; end if;

    cand := base;
    n := 1;
    while exists (select 1 from public.profiles where lower(username) = lower(cand)) loop
      n := n + 1;
      cand := base || '-' || n;
    end loop;

    update public.profiles set username = cand where id = r.id;
  end loop;
end $$;

-- Unique, case-insensitive. NOT NULL now that every row is backfilled.
create unique index if not exists idx_profiles_username_lower on public.profiles (lower(username));
alter table public.profiles alter column username set not null;

-- Keep username populated for every future row without touching onboarding code.
-- Fires only when username was left blank (insert, or a display_name update on a
-- pre-username row), so an existing handle is NEVER churned when a name changes.
create or replace function public.ensure_username()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  base text;
  cand text;
  n    int;
begin
  if new.username is not null and btrim(new.username) <> '' then
    new.username := lower(btrim(new.username));
    return new;
  end if;

  base := coalesce(public.slugify_username(new.display_name), 'member');
  base := left(base, 40);
  base := btrim(base, '-');
  if base = '' then base := 'member'; end if;

  cand := base;
  n := 1;
  while exists (
    select 1 from public.profiles
    where lower(username) = lower(cand) and id <> new.id
  ) loop
    n := n + 1;
    cand := base || '-' || n;
  end loop;

  new.username := cand;
  return new;
end $$;

drop trigger if exists trg_ensure_username on public.profiles;
create trigger trg_ensure_username
  before insert or update of display_name, username on public.profiles
  for each row
  when (new.username is null or btrim(new.username) = '')
  execute function public.ensure_username();

-- ── 2. public_profile(username) — the SOLE safe profile read ─────────────────
-- Returns ONLY safe fields. Kid minimization is enforced HERE, server-side:
-- minors (kids/teens) never receive family_name or role_kind; nobody receives
-- email or an exact join date. Returns NULL for a missing username → the page
-- renders a friendly "member not found".

create or replace function public.public_profile(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v        record;
  v_age    text;
  v_minor  boolean;
  v_tier   text;
  v_xp     bigint;
  v_badges jsonb;
  v_family text;
  v_result jsonb;
begin
  -- Authenticated-only surface (the community is auth-gated).
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

  -- Resolve age band exactly like src/lib/feed.ageGroupOf (age_group wins; role
  -- 'child' → teens; else adults). Minors = kids OR teens.
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

  -- Earned professional-title credentials only (criteria_key non-null).
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

  -- Fields safe for EVERY member (adult and kid). No email; join date is
  -- month/year only; age band drives the public AgeBadge icon (already public).
  v_result := jsonb_build_object(
    'id',           v.id,
    'username',     v.username,
    'display_name', v.display_name,
    'avatar_url',   v.avatar_url,
    'age_group',    v_age,
    'tier',         v_tier,
    'xp',           v_xp,
    'badges',       v_badges,
    'member_since', to_char(v.created_at, 'Mon YYYY'),
    'is_minor',     v_minor
  );

  -- ADULTS ONLY — family display name + parent/member distinction. Deliberately
  -- NOT emitted for minors: no family name, no role, no real-name leakage.
  if not v_minor then
    select f.name into v_family from public.families f where f.id = v.family_id;
    v_result := v_result || jsonb_build_object(
      'family_name', v_family,
      'role_kind',   case when v.role = 'parent' then 'parent' else 'member' end
    );
  end if;

  return v_result;
end $$;

grant execute on function public.public_profile(text) to authenticated;

-- ── 3. public_usernames(ids[]) — batched id→username for author links ────────

create or replace function public.public_usernames(p_ids uuid[])
returns table(id uuid, username text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.username
  from public.profiles p
  where auth.uid() is not null and p.id = any(p_ids);
$$;

grant execute on function public.public_usernames(uuid[]) to authenticated;

-- ── 4. public_profile_mentions(handles[]) — batched @mention → username ──────
-- handle = display_name with all whitespace removed, lowercased (the composer's
-- rule). Multiple names can strip to the same handle; the caller keeps the first.

create or replace function public.public_profile_mentions(p_handles text[])
returns table(handle text, username text, display_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select lower(regexp_replace(coalesce(p.display_name, ''), '\s+', '', 'g')) as handle,
         p.username,
         p.display_name
  from public.profiles p
  where auth.uid() is not null
    and lower(regexp_replace(coalesce(p.display_name, ''), '\s+', '', 'g')) = any (
      select lower(h) from unnest(p_handles) as h
    );
$$;

grant execute on function public.public_profile_mentions(text[]) to authenticated;
