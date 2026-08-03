-- 207 — KID SAFETY GUARDS AT THE DATABASE LINE
--
-- Everything the app calls "kid mode" — Kai's kid persona (resolveKaiProfile),
-- viewer_is_kid() on the feed/screener/watchlist, the parent-only surfaces,
-- family guardrails — reads ONE row: profiles. And until this migration the
-- only UPDATE policy standing between a child and that row was
--
--     create policy "Users can update own profile" on profiles
--       for update using (auth.uid() = id);        -- 001_initial_schema.sql:286
--
-- USING with no WITH CHECK and no column guard. A child holding their own
-- session could PATCH /rest/v1/profiles?id=eq.<self> with {"role":"parent",
-- "age_group":"adults"} and walk out of every one of those gates at once —
-- and set family_id to any household they could name. The whole kid-safety
-- model was one HTTP request deep.
--
-- The fix is a BEFORE UPDATE trigger rather than policy surgery, because the
-- rule is per-COLUMN and per-TRANSITION ("age_group may be written once, while
-- it is still null"), which a row predicate cannot express. The trigger is the
-- floor; the policies stay as the outer door.
--
-- This migration also:
--   • gives the own-profile UPDATE policy the WITH CHECK it never had;
--   • teaches the two SECURITY DEFINER joins (redeem_invite,
--     onboard_create_family) to announce themselves to the trigger, since they
--     legitimately write role/family_id on the caller's own row;
--   • enforces the profanity wordlist on chat_messages in the database, where
--     src/lib/profanity.ts admits it cannot reach;
--   • confines kid-register members to the Main Circle room in RLS, backing
--     the UI restriction rather than trusting it;
--   • corrects two teenagers who were configured as adults.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PROFILES — the privileged columns
-- ═══════════════════════════════════════════════════════════════════════════

-- WHO LEGITIMATELY WRITES role / family_id / age_group / track TODAY
--
--   a) handle_new_user()            INSERT on signup (role defaults 'parent')
--   b) onboard_create_family()      definer RPC — solo owner links their new
--                                   family and stamps parent/adults/adults
--   c) redeem_invite()              definer RPC — invited member takes the
--                                   family_id + role carried by the invite
--                                   (this is how a SECOND PARENT is made)
--   d) /onboarding (browser)        kid branch self-sets age_group + track,
--                                   once, on a row where both are still null
--   e) /family/members (browser)    a parent sets another member's role, or
--                                   clears their family_id to remove them —
--                                   permitted by "Parents update family
--                                   profiles" (039) and left working here
--   f) service-role routes          /api/free-class/register,
--                                   /api/challenge/register-email,
--                                   lib/server/challenge-vip, seed scripts
--
-- (a) is an INSERT and never reaches this trigger. (f) carries no auth.uid()
-- and is waved through. (b) and (c) set a transaction-local flag below. (d)
-- survives as the "first write wins" rule. (e) survives as the parent
-- exception. Everything else is refused.

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid    uuid := auth.uid();
  v_role   text;
  v_family uuid;
begin
  -- SERVICE ROLE / MIGRATIONS / BACKGROUND JOBS. A service-role JWT carries no
  -- `sub`, so auth.uid() is null; so does a direct psql session. Those callers
  -- are our own server code and are trusted by construction. An ANONYMOUS
  -- caller also has no auth.uid(), but no UPDATE policy on profiles admits
  -- anon in the first place, so nothing reaches this branch from the outside.
  if v_uid is null then
    return new;
  end if;

  -- THE TWO DEFINER JOINS. set_config(..., true) is transaction-local and
  -- PostgREST gives every request its own transaction, so the flag cannot
  -- outlive the RPC that set it. It is unreachable from a client: set_config
  -- lives in pg_catalog, which PostgREST does not expose.
  if coalesce(current_setting('app.profile_guard_bypass', true), '') = 'on' then
    return new;
  end if;

  -- Nothing privileged moved (display_name, avatar, prefs, streak flags …).
  -- This is the overwhelmingly common UPDATE and it costs one comparison.
  if new.role      is not distinct from old.role
 and new.family_id is not distinct from old.family_id
 and new.age_group is not distinct from old.age_group
 and new.track     is not distinct from old.track then
    return new;
  end if;

  -- The trigger is SECURITY DEFINER and owned by the table owner, so this read
  -- sees profiles directly and cannot recurse through the RLS policies that
  -- are themselves asking about this row.
  select p.role, p.family_id into v_role, v_family
    from public.profiles p
   where p.id = v_uid;

  -- Site admin keeps the reach the admin CRM already has ("Admins update any
  -- profile", 039). No child is ever an admin.
  if v_role = 'admin' then
    return new;
  end if;

  -- ── THE MEMBER'S OWN ROW ────────────────────────────────────────────────
  if v_uid = new.id then
    if new.role is distinct from old.role then
      raise exception 'profiles: role cannot be changed on your own account'
        using errcode = '42501';
    end if;
    if new.family_id is distinct from old.family_id then
      raise exception 'profiles: family cannot be changed on your own account'
        using errcode = '42501';
    end if;
    -- age_group / track are the onboarding self-declaration, and the ONE thing
    -- that declaration must never say is "adult". /onboarding's kid branch
    -- offers exactly two bands (KidAgeStep: kids | teens) and pre-fills from
    -- whatever the invite already carried, so a member may move between the
    -- minor registers as often as the wizard asks — but 'adults' is the escape
    -- hatch out of Kai's kid persona, viewer_is_kid() and every gate built on
    -- them, so it is a PARENT's word, never your own.
    --
    -- (A "writable once, while null" rule would not have held: an invited kid
    -- starts with age_group null, so their very first write could have been
    -- 'adults' — which is exactly the shape of the two mis-filed teenagers this
    -- migration corrects at the bottom.)
    if new.age_group is distinct from old.age_group
       and coalesce(new.age_group, '') not in ('kids', 'teens') then
      raise exception 'profiles: only a parent can set the adult register'
        using errcode = '42501';
    end if;
    if new.track is distinct from old.track
       and coalesce(new.track, '') not in ('kids', 'teens') then
      raise exception 'profiles: only a parent can set the adult track'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- ── SOMEBODY ELSE'S ROW ─────────────────────────────────────────────────
  -- Only a parent of the SAME household, and only over the household's own
  -- vocabulary.
  if v_role is distinct from 'parent'
     or v_family is null
     or old.family_id is distinct from v_family then
    raise exception 'profiles: only a parent of this family can change that member'
      using errcode = '42501';
  end if;

  -- A parent hands out household roles — never site admin, never coach. The
  -- household vocabulary is the one profiles_role_check already allows a
  -- family to use: parent or child. (Teen is not a role; it is age_group
  -- 'teens' on a child — see the invite section below.)
  if new.role is distinct from old.role
     and new.role not in ('parent', 'child') then
    raise exception 'profiles: % is not a household role', new.role
      using errcode = '42501';
  end if;

  -- family_id on another member may only be CLEARED (remove from household).
  -- A parent cannot pull somebody into their family, or push them into
  -- another one, by writing an id.
  if new.family_id is distinct from old.family_id and new.family_id is not null then
    raise exception 'profiles: a member can only be removed from this family'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- The WITH CHECK the own-profile policy never had. USING alone decides which
-- rows you may touch; WITH CHECK decides what they may look like afterwards —
-- without it the post-image was unconstrained, including the primary key.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. THE TWO DEFINER JOINS — announce themselves to the trigger
-- ═══════════════════════════════════════════════════════════════════════════

-- THE SECOND PARENT COULD NOT BE INVITED. /family/members inserted invites
-- with no role at all, so family_invites.role fell to its default 'child' and
-- the roster's own invite flow could only ever make children; the one path
-- that let you choose (AddFamily.tsx) self-gates to households that have no
-- members yet. A household with one parent had no way to add a second.
--
-- The roster now chooses, and the choice is Parent / Teen / Kid — which is the
-- register the app actually reasons in. But family_invites.role is CHECKed
-- against ('parent','child'), and profiles_role_check likewise: there is no
-- 'teen' role and never has been. Every teenager in production is stored the
-- same way — role 'child', age_group 'teens' — because age_group is where the
-- register lives (viewer_is_kid, Kai's persona, deriveRegister). So the invite
-- carries the register alongside the role, and redeem_invite lands both.
alter table public.family_invites
  add column if not exists age_group text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.family_invites'::regclass
       and conname = 'family_invites_age_group_check'
  ) then
    alter table public.family_invites
      add constraint family_invites_age_group_check
      check (age_group is null or age_group in ('kids', 'teens', 'adults'));
  end if;
end;
$$;

comment on column public.family_invites.age_group is
  'Register the invited member lands in (kids | teens | adults). Null keeps the'
  ' old behaviour: the member declares it themselves during onboarding.';

-- redeem_invite: same join, plus the bypass flag and the register. This is the
-- ONLY path that sets a member''s family_id and role, and it takes all of it
-- from the invite row, never from the client.
create or replace function public.redeem_invite(p_code text, p_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_family_id uuid; v_role text; v_expires timestamptz; v_used uuid; v_age text;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'no_session'); end if;
  select family_id, role, expires_at, used_by, age_group
    into v_family_id, v_role, v_expires, v_used, v_age
    from family_invites where code = p_code for update;
  if v_family_id is null then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if v_expires < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if v_used is not null and v_used <> v_uid then return jsonb_build_object('ok', false, 'reason', 'used'); end if;

  -- The join writes family_id and role on the caller's own row — exactly what
  -- the guard refuses from a browser. The invite row is the authority, so this
  -- transaction is allowed through it.
  perform set_config('app.profile_guard_bypass', 'on', true);

  -- age_group/track only when the invite said so; a null invite leaves the
  -- member to declare their own band in onboarding, exactly as before.
  insert into profiles (id, family_id, role, age_group, track, display_name, onboarding_complete)
  values (v_uid, v_family_id, coalesce(v_role, 'child'), v_age, v_age,
          coalesce(nullif(trim(p_display_name), ''), 'Explorer'), false)
  on conflict (id) do update
    set family_id = excluded.family_id,
        role      = excluded.role,
        age_group = coalesce(excluded.age_group, profiles.age_group),
        track     = coalesce(excluded.track, profiles.track),
        onboarding_complete = false;
  update family_invites set used_by = v_uid where code = p_code;

  perform set_config('app.profile_guard_bypass', 'off', true);
  return jsonb_build_object('ok', true, 'family_id', v_family_id,
                            'role', coalesce(v_role, 'child'), 'age_group', v_age);
end;
$$;

-- onboard_create_family: the solo-owner join. Same logic, plus the flag —
-- AND one new refusal. This RPC is callable by any authenticated user and it
-- stamped role='parent', age_group='adults' on whoever called it, guarded only
-- by "you have no family yet". A child whose parent had removed them from the
-- household could call it and come back an adult. The household identity now
-- survives the move: they get their own family, they do not get promoted.
create or replace function public.onboard_create_family(
  p_name text,
  p_display_name text default null,
  p_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_family_id uuid;
  v_role text;
  v_is_minor boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Idempotent: a parent who already owns a family (resume / back-and-forth)
  -- gets that family back — never a duplicate.
  select family_id, role into v_existing, v_role from profiles where id = v_uid;
  if v_existing is not null then
    return v_existing;
  end if;

  v_is_minor := v_role in ('child', 'teen');

  insert into families (name)
  values (nullif(trim(p_name), ''))
  returning id into v_family_id;

  -- Link the parent + save their chosen name/avatar. NOTE (Lane 8R): we no
  -- longer set onboarding_complete here — the wizard stamps it on its final
  -- step so the gate keeps the member in the flow until they finish.
  perform set_config('app.profile_guard_bypass', 'on', true);
  update profiles set
    family_id    = v_family_id,
    role         = case when v_is_minor then role else 'parent' end,
    age_group    = case when v_is_minor then age_group else 'adults' end,
    track        = case when v_is_minor then track else 'adults' end,
    display_name = coalesce(nullif(trim(p_display_name), ''), display_name, 'Parent'),
    avatar_url   = coalesce(p_avatar_url, avatar_url)
  where id = v_uid;
  perform set_config('app.profile_guard_bypass', 'off', true);

  -- Auto-activate a paid/invited membership if one is pending (no-op otherwise).
  -- Kept immediate so paid access is never blocked by the profile questions.
  perform claim_pending_membership(v_family_id);

  return v_family_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. PROFANITY — the same wordlist, one layer lower
-- ═══════════════════════════════════════════════════════════════════════════
--
-- src/lib/profanity.ts says it plainly in its own header: "it is NOT an
-- unbypassable filter … and it does not run server-side". Anything speaking
-- PostgREST directly skipped it entirely. The list below is that file's BLOCKED
-- array, unchanged.
--
-- DELIBERATELY NARROWER THAN THE CLIENT. The TS version also folds leetspeak
-- and collapses spacing ("f u c k"), which is right for a submit-time nudge but
-- wrong for a hard floor: the collapsed pass turns "Dickinson" and "cocktail"
-- into rejections, and a database-level refusal is not a nudge, it is a lost
-- message. Here we match whole words only, case-insensitively — \m and \M are
-- Postgres's word boundaries. The client keeps the wider net; the database
-- refuses only what is unambiguous.

create or replace function public.chat_message_profanity_guard()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_pattern constant text :=
    '\m(fuck|fucker|fucking|motherfucker|shit|bullshit|bitch|bastard|asshole'
    '|dickhead|cunt|slut|whore|faggot|fag|nigger|nigga|retard|retarded|cock'
    '|pussy|dick|prick|wanker|twat|jackass|dumbass|goddamn)\M';
begin
  if new.content is not null and new.content ~* v_pattern then
    raise exception 'Let''s keep it kind — kids are in the club too. Please reword that and try again.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists chat_messages_profanity on public.chat_messages;
create trigger chat_messages_profanity
  before insert or update of content on public.chat_messages
  for each row execute function public.chat_message_profanity_guard();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. KID CHAT SCOPE — Main Circle only, enforced in RLS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The SELECT policy was a flat list of the six community room ids, identical
-- for a nine-year-old and a day trader: FIC Club, FTA Traders, Free Lounge,
-- Semis & AI infra, Macro & rates, First 100 days. The UI is being narrowed to
-- Main Circle for kid-register members, but a UI is not a boundary — the same
-- publishable key reads every room over REST.
--
-- viewer_is_kid() is the app's existing definition of the kid register
-- (age_group first, then role, then track, defaulting to adults) — the same
-- predicate migrations 137/139/140/151/152/153/161/201 gate on, so a member
-- cannot be a kid in the feed and an adult in chat. Teens and adults are
-- untouched: for them the predicate is false and the policy is the old list.
--
-- Also closed here: the policy carried no authentication test at all, and anon
-- holds a SELECT grant on chat_messages, so an unauthenticated caller could
-- read every community room — including the kids'. Reading the club now
-- requires being in the club.

drop policy if exists "Read community messages" on public.chat_messages;
create policy "Read community messages" on public.chat_messages
  for select
  using (
    auth.uid() is not null
    and room_id = any (array[
      'c0000000-0000-4000-a000-000000000001'::uuid,  -- FIC Club (Main Circle)
      'c0000000-0000-4000-a000-000000000002'::uuid,  -- FTA Traders
      'c0000000-0000-4000-a000-000000000003'::uuid,  -- Free Lounge
      'c0000000-0000-4000-a000-000000000004'::uuid,  -- Semis & AI infra
      'c0000000-0000-4000-a000-000000000005'::uuid,  -- Macro & rates
      'c0000000-0000-4000-a000-000000000006'::uuid   -- First 100 days
    ])
    and (
      not coalesce(public.viewer_is_kid(), false)
      or room_id = 'c0000000-0000-4000-a000-000000000001'::uuid
    )
  );

-- Writing follows reading. "Post to general rooms" (033) admits any room of
-- type 'general', which is all six — a kid could put a message into a room
-- they cannot open. RESTRICTIVE so it ANDs with the existing permissive INSERT
-- policies instead of adding a new way in.
drop policy if exists "Kid chat scope on writes" on public.chat_messages;
create policy "Kid chat scope on writes" on public.chat_messages
  as restrictive for insert to authenticated
  with check (
    not coalesce(public.viewer_is_kid(), false)
    or room_id = 'c0000000-0000-4000-a000-000000000001'::uuid
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. DATA — two teenagers filed as adults
-- ═══════════════════════════════════════════════════════════════════════════
-- role='child' with age_group='adults' resolved to the ADULT register in
-- viewer_is_kid() and in Kai's persona: two real teenagers were being handed
-- the adult experience. They are teens; say so.
update public.profiles
   set age_group = 'teens',
       track     = 'teens'
 where email in ('malachigraham@gmail.com', 'dwelethemcoffie2012@gmail.com')
   and age_group = 'adults';
