-- ============================================================================
-- 216 — THE TEEN DOOR WALL. Teen-authored feed content is FAMILY-MODE ONLY.
--
-- Owner decision, 2026-08-05 (EXPERIENCE-ARCHITECTURE.md §2b, ratified):
--
--   • Kid rows   → family-only, everywhere.        (shipped in 214)
--   • Teen rows  → Family-mode surfaces only.      (THIS MIGRATION)
--   • Adult rows → club-wide.                      (unchanged)
--
-- 214 deliberately left teens in the club — it says so in its own header
-- ("TEENS ARE NOT WALLED … `author_register = 'kid'` is the wall"). That was the
-- correct posture at the time because there was no stored notion of WHICH
-- EXPERIENCE a viewer is in. 215 created one (`families.door`), so the teen band
-- can now be expressed as what it actually is: not a wall around the author, but
-- a property of the VIEWER'S DOOR. A teen's thinking is a normal part of the
-- Family Investing Club — parents, siblings and other family-mode households are
-- exactly the audience it was written for. It is the Club door (adults who
-- bought an individual membership) that should not be reading minors' posts.
--
-- WHAT THIS DOES NOT DO. No row is deleted, no author loses anything, and
-- nothing about writing changes: teens post, comment, earn activity cards and
-- appear on every family surface exactly as before. Only the club-door READ
-- narrows. A teen still sees their own rows, and their household still sees
-- them, regardless of which door that household is on.
--
-- 018/019 RLS LAWS, carried forward from 214 verbatim: a predicate on these
-- tables stays a PURE own-column / stable-helper expression — no subqueries, so
-- the policies remain Realtime-authorizable if these tables are ever added to
-- the publication (they are not today). The only function calls below are
-- `auth.uid()`, `get_my_family_id()` (039) and the new `viewer_door()`, which is
-- declared with the same SECURITY DEFINER + STABLE + locked search_path shape as
-- every other policy helper in the schema.
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. THE VIEWER'S DOOR
-- ═══════════════════════════════════════════════════════════════════════════
-- `families.door` (215) is the stored experience of the caller's household.
-- Reading it inside a policy directly would be a subquery on another table; as
-- with get_my_family_id(), the read is therefore hoisted into a SECURITY DEFINER
-- STABLE helper and the policy calls it as a scalar.
--
-- THE NULL CASE — a member with no family row, or no profile row at all. This
-- happens for a member mid-provisioning (the family is created at onboarding)
-- and for any solo account that has not been through the wizard. The choice made
-- here is 'club', i.e. the STRICTER band:
--
--   • Semantically it is right. A member with no household IS the individual
--     Club door — that is precisely what the door 'club' means, and it is also
--     what the app itself falls back to (src/app/(dashboard)/layout.tsx:
--     `storedDoor ?? (ctx.isSolo ? "club" : "family")`).
--   • It fails CLOSED. Minor content is never exposed by an unknown viewer
--     state; the worst case is a family-mode member briefly not seeing teen rows
--     during the seconds before their family exists — at which point they have
--     no family surfaces to read anyway.
--
-- Note this is the door of the VIEWER, not of the author. Whether a teen's own
-- household is on the club or the family door is irrelevant to who may read the
-- row: their family sees it either way (the family_id clause in the policy), and
-- nobody on the club door sees it.

create or replace function public.viewer_door()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select f.door
      from profiles p
      join families f on f.id = p.family_id
      where p.id = auth.uid()
    ),
    'club'
  );
$$;

comment on function public.viewer_door() is
  'The caller''s stored experience door (families.door, 215) — ''club'' | ''family''. '
  'Policy-safe helper in the get_my_family_id() mould (SECURITY DEFINER, STABLE, '
  'locked search_path) so RLS predicates can read it without a subquery. NULL-safe: '
  'a member with no family (solo / mid-provisioning) resolves to ''club'', the '
  'stricter band, matching the app''s own fallback in the dashboard layout.';

grant execute on function public.viewer_door() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. THE READ WALL — three bands, one predicate
-- ═══════════════════════════════════════════════════════════════════════════
-- Read the predicate top-down; the first two clauses are the "it is mine / it is
-- my household's" escape hatches that apply to EVERY register, and the last two
-- are the register bands for everyone else:
--
--   author_id = auth.uid()             → your own row, always.
--   family_id = get_my_family_id()     → your household's row, always.
--   author_register = 'adult'          → adult rows are club-wide (unchanged).
--   author_register = 'teen'
--     and viewer_door() = 'family'     → teen rows on the family door only.
--   (nothing else matches)             → kid rows are family-only (214 posture,
--                                        preserved exactly).
--
-- FAIL-CLOSED ON AN UNKNOWN REGISTER. 214's predicate was `author_register <>
-- 'kid'`, which admits any value that is not the literal 'kid'. This one names
-- the two registers that may travel and hides everything else, so a future
-- fourth band is invisible until someone deliberately admits it. The column is
-- NOT NULL with a default of 'adult' and is stamped by trigger from
-- profile_register(), which returns only kid|teen|adult, so no existing row is
-- affected by the change in shape.

drop policy if exists "Read feed posts" on feed_posts;
create policy "Read feed posts" on feed_posts
  for select to authenticated
  using (
    author_id = auth.uid()
    or (family_id is not null and family_id = public.get_my_family_id())
    or author_register = 'adult'
    or (author_register = 'teen' and public.viewer_door() = 'family')
  );

drop policy if exists "Read post comments" on post_comments;
create policy "Read post comments" on post_comments
  for select to authenticated
  using (
    author_id = auth.uid()
    or (family_id is not null and family_id = public.get_my_family_id())
    or author_register = 'adult'
    or (author_register = 'teen' and public.viewer_door() = 'family')
  );

comment on table feed_posts is
  'The Club feed. SELECT is register + door scoped: adult rows are club-wide, '
  'teen rows are visible on the FAMILY door only (216), kid rows only to their '
  'author and household (214). Every register always sees its own rows and its '
  'own household''s.';
comment on table post_comments is
  'Flat comment threads on feed posts. Same three-band SELECT as feed_posts '
  '(214 kid wall + 216 teen door wall). Kid INSERT is walled by kid_feed_readonly().';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. WRITES ARE UNCHANGED — including likes
-- ═══════════════════════════════════════════════════════════════════════════
-- No INSERT/UPDATE/DELETE policy is touched by this migration. Teens post and
-- comment exactly as before; the change is purely about who READS.
--
-- post_likes (034) — DELIBERATELY LEFT OPEN, including for kids. The lane brief
-- asked whether the kid wall should be mirrored onto post_likes INSERT
-- (`with check (user_id = auth.uid())`, no register guard). It should not, and
-- this is the reasoning, recorded so the question does not have to be re-asked:
--
--   • The ratified posture is "kids READ and REACT freely, but do not POST"
--     (034: "post_likes — basic likes, visible on everyone's posts, kids
--     included"; 161's header: "Reactions (post_likes) + comments consumers are
--     untouched — read + react stays"). 214 walled kid COMMENTS — text a kid
--     writes into the town square, carrying their voice — and left reactions
--     alone on purpose.
--   • The product PROMISES it in kid-facing copy that is live right now:
--     KID_FEED_READONLY_NOTE = "Kid missions and clubs are coming — for now,
--     explore and react!" Walling likes would make that sentence false.
--   • It leaks nothing. Every consumer of post_likes in the app reads either a
--     COUNT or "did I like this" (src/lib/feed-seed.ts, CommunityClient,
--     /api/club/thinking, /api/club/people) — no surface anywhere renders the
--     identity of a liker. A kid's like publishes no name, no avatar and no age
--     band into the club; it is a silent +1.
--
-- If the owner does want kid reactions closed, it is one policy and the same
-- single flip point the rest of the wall uses:
--
--   create policy "Like as self" on post_likes for insert to authenticated
--     with check (user_id = auth.uid()
--       and not (public.kid_feed_readonly() and coalesce(public.viewer_is_kid(), false)));
--
-- That is a posture change, not a leak fix, so it is not applied here.

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. THE PUBLISHED COUNTS
-- ═══════════════════════════════════════════════════════════════════════════
-- Both functions below are SECURITY DEFINER, so RLS does not scope them and the
-- band has to be written into the query — exactly as 214 did for the kid wall.

-- get_ticker_community_stats() (132, corrected by 214) is granted to ANON and
-- feeds the club-wide sentiment surfaces on a ticker page (watching /
-- discussions this week / the bull-neutral-bear split). It has no viewer and no
-- door — a logged-out visitor has neither — so it publishes the CLUB number, and
-- the club number is adult rows only. A teen's position still shows on every
-- family surface that reads the rows themselves under RLS; it just no longer
-- moves a public, doorless aggregate.
--
-- Only the register predicate changes (`<> 'kid'` → `= 'adult'`).

create or replace function public.get_ticker_community_stats(p_ticker text)
returns table (
  watching int,
  discussions_week int,
  bull int,
  neutral int,
  bear int,
  positioned int
)
language sql
stable
security definer
set search_path = public
as $$
  with tk as (select upper(p_ticker) as t)
  select
    coalesce((
      select count(*)::int
      from ticker_sentiment ts, tk
      where upper(ts.ticker) = tk.t and ts.vote = 1
    ), 0) as watching,
    coalesce((
      select count(*)::int
      from feed_posts fp, tk
      where tk.t = any (array(select upper(x) from unnest(fp.ticker_tags) x))
        and fp.created_at >= now() - interval '7 days'
        and fp.author_register = 'adult'
    ), 0) as discussions_week,
    coalesce((
      select count(*)::int from feed_posts fp, tk
      where fp.position = 'bull'
        and tk.t = any (array(select upper(x) from unnest(fp.ticker_tags) x))
        and fp.author_register = 'adult'
    ), 0) as bull,
    coalesce((
      select count(*)::int from feed_posts fp, tk
      where fp.position = 'neutral'
        and tk.t = any (array(select upper(x) from unnest(fp.ticker_tags) x))
        and fp.author_register = 'adult'
    ), 0) as neutral,
    coalesce((
      select count(*)::int from feed_posts fp, tk
      where fp.position = 'bear'
        and tk.t = any (array(select upper(x) from unnest(fp.ticker_tags) x))
        and fp.author_register = 'adult'
    ), 0) as bear,
    coalesce((
      select count(*)::int from feed_posts fp, tk
      where fp.position is not null
        and tk.t = any (array(select upper(x) from unnest(fp.ticker_tags) x))
        and fp.author_register = 'adult'
    ), 0) as positioned;
$$;

grant execute on function public.get_ticker_community_stats(text) to authenticated, anon;

comment on function public.get_ticker_community_stats(text) is
  'Club-wide sentiment counts for a ticker. Granted to anon, so it counts ADULT '
  'rows only: kid rows are family-only (214) and teen rows are family-door-only '
  '(216), and a doorless caller gets the club number.';

-- member_participation() (196, corrected by 214) is different in kind: it is
-- granted to `authenticated` only and is read WITH a viewer, on a member's
-- profile canvas. So it does not need the blunt club number — it can answer the
-- same three-band question the policy answers, which is what keeps a teen's own
-- profile (and their parents' view of it) honest while a club-door adult sees
-- the club-visible subset. The expression below is the policy predicate, verbatim.

create or replace function public.member_participation(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'stances', coalesce((
      select count(*)::int from ticker_stances where user_id = p_user_id
    ), 0),
    'bull_stances', coalesce((
      select count(*)::int from ticker_stances
      where user_id = p_user_id and stance = 'bull'
    ), 0),
    'flips', coalesce((
      select count(*)::int from stance_events
      where user_id = p_user_id and is_flip
    ), 0),
    'respect', coalesce((
      select count(*)::int
      from object_reactions r
      join stance_events se on se.id = r.target_id
      where r.target_type = 'stance_event'
        and r.reaction = 'respect'
        and se.user_id = p_user_id
    ), 0),
    'research', coalesce((
      select count(*)::int from research_objects
      where author_id = p_user_id and status = 'published'
    ), 0),
    -- KID WALL (214) + TEEN DOOR WALL (216). This function is SECURITY DEFINER,
    -- so the read wall on feed_posts cannot scope it — the predicate is repeated
    -- here so a count can never publish a row the viewer could not open.
    'posts', coalesce((
      select count(*)::int from feed_posts fp
      where fp.author_id = p_user_id
        and fp.kind = 'post'
        and (
          fp.author_id = auth.uid()
          or (fp.family_id is not null and fp.family_id = public.get_my_family_id())
          or fp.author_register = 'adult'
          or (fp.author_register = 'teen' and public.viewer_door() = 'family')
        )
    ), 0),
    'weeks_active', coalesce((
      select count(distinct date_trunc('week', created_at))::int
      from xp_events where user_id = p_user_id
    ), 0)
  );
$$;

comment on function public.member_participation(uuid) is
  'Participation counts for a member profile (canvas v2, lane M4). Conviction and '
  'participation ONLY — no accuracy, no hit-rate, no opinion score. The feed count '
  'mirrors the feed_posts read wall exactly (214 kid + 216 teen door), so it never '
  'publishes a row the viewer could not open. See the 196 migration header before '
  'adding a field.';

grant execute on function public.member_participation(uuid) to authenticated;
