-- 161 — KID FEED READ-ONLY: kids cannot POST into the shared adult community.
--
-- Ratified kid-safety posture (SOCIAL-OBJECTS.md REGISTER POLICY + FIC-LEARNING-
-- WORLD P8): kid social is structured, cohort-scoped, moderated — NOT the open
-- adult feed. Kids READ + REACT freely, but do not post top-level entries into
-- the shared feed. Flows-audit P2: kids currently see a "Post" button on the
-- adult /community feed. This closes the server door (the composer UI is gated in
-- parallel, src/lib/social/kid-posting.ts KID_FEED_READONLY).
--
-- SINGLE FLIP POINT (server): kid_feed_readonly() returns the flag. Set it to
-- `false` (owner's call, if they disagree with the posture) and kid posting is
-- immediately re-enabled server-side with NO other change. The UI has a matching
-- KID_FEED_READONLY constant (documented in the handoff) — flip BOTH to fully
-- re-open. Teens + adults are never affected (viewer_is_kid() = kids only, mirrors
-- the screener/debate/stance walls).
--
-- Reactions (post_likes) + comments consumers are untouched — read + react stays.

create or replace function public.kid_feed_readonly()
returns boolean
language sql
immutable
as $$
  -- KID_FEED_READONLY flag. Owner flips to `false` to let kids post to the shared
  -- adult feed. Keep in sync with src/lib/social/kid-posting.ts.
  select true;
$$;
grant execute on function public.kid_feed_readonly() to authenticated;

-- Re-scope the member INSERT policy: members may author their own 'post' rows,
-- but NOT when they are a kid AND the read-only flag is on. Activity/anchor cards
-- are still service-definer-only (they never match kind = 'post' here).
drop policy if exists "Author own feed posts" on feed_posts;
create policy "Author own feed posts" on feed_posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and kind = 'post'
    and not (public.kid_feed_readonly() and coalesce(public.viewer_is_kid(), false))
  );
