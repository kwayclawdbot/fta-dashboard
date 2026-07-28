-- ============================================================================
-- 201 — YOUR OWN POST IS YOURS: edit + delete, honestly marked.
--
-- The community card offered Like and Reply and nothing else, so a member who
-- fat-fingered a ticker or wanted to withdraw a call had no way to do either.
-- The write side was already there: migration 034 shipped an own-row UPDATE
-- policy ("Edit own feed posts") and an own-or-admin DELETE policy, and both
-- survive 161/192 untouched (those re-scope INSERT only). So this migration is
-- NOT "add the missing policies" — it is the two things that were genuinely
-- missing behind them:
--
--   1. edited_at — an edit that isn't disclosed is a rewrite of the record.
--      The club reads calls; a call whose words changed after the fact must say
--      so on the card. NULL means never edited.
--
--   2. A BEFORE UPDATE guard. RLS cannot express "you may change THESE columns"
--      — a policy's WITH CHECK sees only NEW, never OLD, so an own-row UPDATE
--      policy is by construction an own-row UPDATE-ANYTHING policy: a member
--      could repoint ticker_tags, flip `position`, forge activity_payload, or
--      pin their own post. The guard restores every column except `body` to its
--      old value and stamps edited_at, so the granted permission matches the
--      permission the UI offers.
--
-- Deliberately NOT touched: the SELECT policy (bare `true` — 019 realtime
-- scar), the INSERT policies (034/161/192 own the kid + guardrail rules), and
-- the DELETE policy (already own-or-admin — admins keep moderation reach).
-- ============================================================================

-- ── 1. The disclosure column ────────────────────────────────────────────────
alter table feed_posts
  add column if not exists edited_at timestamptz;

comment on column feed_posts.edited_at is
  'When the author last rewrote the body. NULL = never edited. Set by the '
  'feed_posts_member_edit_guard trigger, never by the client.';


-- ── 2. The policies, asserted rather than rewritten ─────────────────────────
-- Created only if absent. If 034 is already applied (it is, in every live
-- environment) this block is a no-op and the existing definitions stand.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feed_posts'
      and policyname = 'Edit own feed posts'
  ) then
    create policy "Edit own feed posts" on feed_posts
      for update to authenticated
      using (author_id = auth.uid())
      with check (author_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feed_posts'
      and policyname = 'Delete own or admin feed posts'
  ) then
    create policy "Delete own or admin feed posts" on feed_posts
      for delete to authenticated
      using (
        author_id = auth.uid()
        or (select role from public.profiles where id = auth.uid()) = 'admin'
      );
  end if;
end $$;


-- ── 3. The guard RLS cannot write ───────────────────────────────────────────
-- SECURITY INVOKER on purpose: it must see the CALLER, not an owner.
--
-- It engages for exactly one case — an authenticated non-admin updating a row
-- they authored. Everything else returns NEW untouched:
--   · system cards (kind='activity'/'anchor') have author_id null, and the
--     This Week refresh + activity triggers are SECURITY DEFINER — they never
--     match author_id = auth.uid() and are never constrained here;
--   · admin moderation (pin, unpin, redact) keeps its full reach;
--   · service-role / migration writes have no auth.uid() at all.
create or replace function public.feed_posts_member_edit_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_is_admin boolean;
begin
  if caller is null or old.author_id is null or old.author_id <> caller then
    return new;
  end if;

  select (role = 'admin') into caller_is_admin
  from public.profiles where id = caller;
  if coalesce(caller_is_admin, false) then
    return new;
  end if;

  -- A frozen kid account cannot rewrite history either. 161/192 froze INSERT;
  -- leaving UPDATE open would have been the same hole through a different door.
  if public.kid_feed_readonly() and coalesce(public.viewer_is_kid(), false) then
    raise exception 'Posting is paused on this account'
      using errcode = 'check_violation';
  end if;

  -- Sane bounds: an edit is a rewrite of the WORDS. It cannot empty the record,
  -- and it cannot exceed what the composer itself allows (2,000 body chars plus
  -- the 120-char hook the Share Your Call composer folds into the same field —
  -- 4,000 is deliberate headroom over both).
  if btrim(coalesce(new.body, '')) = '' then
    raise exception 'An edited post still needs something in it'
      using errcode = 'check_violation';
  end if;
  if char_length(new.body) > 4000 then
    raise exception 'A post is limited to 4000 characters'
      using errcode = 'check_violation';
  end if;

  -- Everything that is not the body is restored. Identity, provenance, the
  -- declared call (ticker_tags / position / horizon / type), the attachment,
  -- the system payloads, and pinning are all out of a member's reach.
  new.id                := old.id;
  new.author_id         := old.author_id;
  new.family_id         := old.family_id;
  new.kind              := old.kind;
  new.created_at        := old.created_at;
  new.pinned            := old.pinned;
  new.anchor_week_id    := old.anchor_week_id;
  new.activity_payload  := old.activity_payload;
  new.attachment_url    := old.attachment_url;
  new.attachment_type   := old.attachment_type;
  new.attachment_meta   := old.attachment_meta;
  new.title             := old.title;
  new.link              := old.link;
  new.audience          := old.audience;
  new.ticker_tags       := old.ticker_tags;
  new."position"        := old."position";
  new.time_horizon      := old.time_horizon;
  new.content_type      := old.content_type;

  -- The disclosure is the trigger's, not the client's: a member cannot edit
  -- quietly by omitting the field, and cannot forge an older edit stamp.
  if new.body is distinct from old.body then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_feed_posts_member_edit_guard on feed_posts;
create trigger trg_feed_posts_member_edit_guard
  before update on feed_posts
  for each row execute function public.feed_posts_member_edit_guard();
