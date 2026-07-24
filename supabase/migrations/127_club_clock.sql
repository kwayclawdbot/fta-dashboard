-- 127 — FTA year-1 Club clock (Challenge $1,500 offer)
--
-- Owner decision (2026-07-24): the $1,500 Challenge FTA offer grants FTA academy
-- access for LIFE plus Cheat Code Club membership for 12 MONTHS. After 12 months
-- the member either pays $99/mo to keep Club-level surfaces (community, watchlist,
-- Kai, alerts, screener) OR keeps FTA academy access only (courses / recordings /
-- FTA chat / the /fta hub) with Club surfaces gated at the free tier.
--
-- MECHANISM (least-invasive, mirrors 126's derived approach):
--   • enrollments gains `club_until timestamptz` (NULL = unlimited Club, the
--     posture of EVERY existing/legacy fta enrollment — the $2,997 buyers and
--     admin-granted grants like Coffie). Only the Stripe webhook, ONLY for
--     metadata kind=fta_challenge, stamps club_until = purchase + 12 months.
--   • family_tiers gains a derived `club_lapsed` boolean. Tier resolution is
--     UNCHANGED (an fta enrollment still reads tier 'fta'); club_lapsed is a
--     SEPARATE signal that the Club window on an fta-only family has closed.
--     Because it is derived from now(), expiry needs no row mutation — time
--     alone flips it. The app strips fic-level access to free while preserving
--     all FTA hub access (see src/lib/tier.ts effectiveClubTier).
--
-- LEGACY SAFETY: club_lapsed is TRUE only when EVERY active fta enrollment has a
-- club_until in the PAST. A NULL club_until (all legacy rows) means "unlimited",
-- so any family holding a NULL-club_until fta is never lapsed. Verified: the two
-- existing fta families (Coffie, Jamia) both get club_until NULL and stay
-- unlimited.

-- ── 1. enrollments.club_until (null = unlimited Club) ────────────────────────
alter table enrollments add column if not exists club_until timestamptz;

comment on column enrollments.club_until is
  'FTA Challenge ($1,500) year-1 Club clock. NULL = unlimited Club (all legacy '
  '/ admin-granted / $2,997 fta enrollments). A future/past timestamp only ever '
  'stamped by the Stripe webhook for metadata kind=fta_challenge (purchase + 12 '
  'months). Past + no other Club source => family_tiers.club_lapsed.';

-- ── 2. family_tiers — add derived club_lapsed (tier logic unchanged) ─────────
-- Tier ladder is byte-for-byte the migration-126 ladder. club_lapsed is a new,
-- independent column: an active fta family whose Club window has ended AND has
-- no other source of Club access (no still-open fta club window, no active fic,
-- no unexpired challenge_pass). Any of those keeps Club alive, so the paid-$99
-- (fic) restore path just works — adding a fic enrollment flips club_lapsed off.
create or replace view family_tiers as
  select f.id as family_id,
         case
           when exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'fta' and e.status = 'active'
           ) then 'fta'
           when exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'fic' and e.status = 'active'
           ) then 'fic'
           when exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'challenge_pass'
               and e.status = 'active'
               and (e.expires_at is null or e.expires_at > now())
           ) then 'fic'
           when exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'free' and e.status = 'active'
           ) then 'free'
           when exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'challenge_pass' and e.status = 'active'
           ) then 'free'
           else 'fic'
         end as tier,
         (
           -- at least one active fta whose Club window has already closed …
           exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'fta' and e.status = 'active'
               and e.club_until is not null and e.club_until <= now()
           )
           -- … and NO active fta still granting Club (unlimited or future window)
           and not exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'fta' and e.status = 'active'
               and (e.club_until is null or e.club_until > now())
           )
           -- … and no active fic membership paying for Club
           and not exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'fic' and e.status = 'active'
           )
           -- … and no unexpired challenge_pass granting Club
           and not exists (
             select 1 from enrollments e
             where e.family_id = f.id and e.program = 'challenge_pass'
               and e.status = 'active'
               and (e.expires_at is null or e.expires_at > now())
           )
         ) as club_lapsed
  from families f;

grant select on family_tiers to authenticated;

-- ── 3. index for the daily club-clock cron scan ─────────────────────────────
create index if not exists idx_enrollments_club_clock
  on enrollments (club_until)
  where program = 'fta' and status = 'active' and club_until is not null;

-- ── 4. club_clock_notices — de-dupe warning / lapse emails ───────────────────
-- Sibling of challenge_pass_notices (126): keeps the two lifecycles cleanly
-- separated. One row per (enrollment, kind); the cron never re-sends a kind.
--   warn_14d — Club window closes within 14 days
--   warn_3d  — Club window closes within 3 days
--   lapsed   — window has closed; academy stays, Club continues at $99
create table if not exists club_clock_notices (
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  kind text not null check (kind in ('warn_14d', 'warn_3d', 'lapsed')),
  sent_at timestamptz not null default now(),
  resend_id text,
  primary key (enrollment_id, kind)
);

alter table club_clock_notices enable row level security;
grant select on club_clock_notices to authenticated;

drop policy if exists "club_clock_notices admin read" on club_clock_notices;
create policy "club_clock_notices admin read" on club_clock_notices
  for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ── 5. admin_member_activity — surface club_until + club_lapsed ──────────────
-- Rebuild of the migration-037 RPC with two extra columns so the CRM member
-- list + detail can show the Club clock. Tier logic unchanged; club_lapsed
-- mirrors the family_tiers derivation (fta-only family past its Club window).
create or replace function admin_member_activity()
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

  select coalesce(
    jsonb_agg(row_to_json(t) order by t.last_seen desc nulls last, t.display_name),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      p.id,
      p.display_name,
      p.email,
      p.avatar_url,
      p.role,
      p.age_group,
      p.track,
      p.family_id,
      f.name as family_name,
      case when exists (
        select 1 from enrollments e
        where e.family_id = p.family_id and e.program = 'fta' and e.status = 'active'
      ) then 'fta' else 'fic' end as tier,
      (
        select min(e.club_until) from enrollments e
        where e.family_id = p.family_id and e.program = 'fta' and e.status = 'active'
          and e.club_until is not null
      ) as club_until,
      (
        exists (
          select 1 from enrollments e
          where e.family_id = p.family_id and e.program = 'fta' and e.status = 'active'
            and e.club_until is not null and e.club_until <= now()
        )
        and not exists (
          select 1 from enrollments e
          where e.family_id = p.family_id and e.program = 'fta' and e.status = 'active'
            and (e.club_until is null or e.club_until > now())
        )
        and not exists (
          select 1 from enrollments e
          where e.family_id = p.family_id and e.program = 'fic' and e.status = 'active'
        )
        and not exists (
          select 1 from enrollments e
          where e.family_id = p.family_id and e.program = 'challenge_pass'
            and e.status = 'active' and (e.expires_at is null or e.expires_at > now())
        )
      ) as club_lapsed,
      p.onboarding_complete,
      p.created_at as joined_at,
      coalesce(xp.xp_total, 0)          as xp_total,
      coalesce(lp.lessons_completed, 0) as lessons_completed,
      coalesce(qa.quizzes_taken, 0)     as quizzes_taken,
      coalesce(qa.quizzes_passed, 0)    as quizzes_passed,
      coalesce(fp.posts, 0)             as posts,
      coalesce(pc.comments, 0)          as comments,
      coalesce(mc.missions, 0)          as missions,
      coalesce(wl.watchlist_adds, 0)    as watchlist_adds,
      coalesce(rs.rsvps, 0)             as rsvps,
      coalesce(ba.badges, 0)            as badges,
      coalesce(cm.chat_messages, 0)     as chat_messages,
      greatest(
        xp.last_at, lp.last_at, qa.last_at, fp.last_at, pc.last_at,
        mc.last_at, rs.last_at, cm.last_at, pl.last_at, ba.last_at, wl.last_at
      ) as last_seen
    from profiles p
    left join families f on f.id = p.family_id
    left join (select user_id, sum(amount) xp_total, max(created_at) last_at
                 from xp_events group by user_id) xp on xp.user_id = p.id
    left join (select user_id,
                      count(*) filter (where status = 'completed' or completed_at is not null) lessons_completed,
                      max(updated_at) last_at
                 from lesson_progress group by user_id) lp on lp.user_id = p.id
    left join (select user_id, count(*) quizzes_taken,
                      count(*) filter (where passed) quizzes_passed,
                      max(created_at) last_at
                 from quiz_attempts group by user_id) qa on qa.user_id = p.id
    left join (select author_id, count(*) posts, max(created_at) last_at
                 from feed_posts group by author_id) fp on fp.author_id = p.id
    left join (select author_id, count(*) comments, max(created_at) last_at
                 from post_comments group by author_id) pc on pc.author_id = p.id
    left join (select user_id, count(*) missions, max(completed_at) last_at
                 from mission_completions group by user_id) mc on mc.user_id = p.id
    left join (select champion_id, count(*) watchlist_adds, max(created_at) last_at
                 from family_watchlist where champion_id is not null
                 group by champion_id) wl on wl.champion_id = p.id
    left join (select user_id, count(*) rsvps, max(created_at) last_at
                 from session_rsvps group by user_id) rs on rs.user_id = p.id
    left join (select user_id, count(*) badges, max(awarded_at) last_at
                 from badge_awards group by user_id) ba on ba.user_id = p.id
    left join (select user_id, count(*) chat_messages, max(created_at) last_at
                 from chat_messages group by user_id) cm on cm.user_id = p.id
    left join (select user_id, max(created_at) last_at
                 from post_likes group by user_id) pl on pl.user_id = p.id
  ) t;

  return v_result;
end;
$$;
grant execute on function admin_member_activity() to authenticated;

-- ── 6. pending_memberships.club_months — carries the Club clock to claim ──────
-- The $1,500 fta_challenge buyer is usually a NEW user: their enrollment is
-- created at onboarding via claim_pending_membership, not by the webhook. Stash
-- the Club window length (12) on the pending row so the claim stamps club_until.
-- NULL = unlimited Club (every regular fta / fic pending row).
alter table pending_memberships add column if not exists club_months int;

-- ── 7. claim_pending_membership — stamp club_until from club_months ───────────
-- Byte-for-byte the live RPC plus: when the pending row carries club_months, the
-- new enrollment's club_until is now() + that many months (the FTA Challenge
-- year-1 clock). A NULL club_months keeps club_until NULL (unlimited).
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
  update pending_memberships set claimed_at = now() where id = v_row.id;
  return v_row.program;
end;
$function$;
