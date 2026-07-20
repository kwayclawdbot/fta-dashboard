-- ============================================================================
-- 034 — Clubhouse P1: feed-first community.
--
-- Turns the community from a linear chat into a feed-first "Clubhouse" (design:
-- COMMUNITY-EXPERIENCE-STUDY.md, owner P1 decisions 2026-07-20):
--   * feed_posts  — the town-square feed (human posts + system activity cards +
--                   the weekly "This Week" anchor).
--   * post_comments — flat comment threads on any feed post.
--   * post_likes    — basic likes (visible on everyone's posts, kids included).
--   * Activity cards — SECURITY DEFINER triggers on the app's learning-event
--                   exhaust (badges, watchlist, missions, RSVPs, level-ups) that
--                   auto-insert kind='activity' posts. This is the anti-stale-feed
--                   engine: the feed is alive even with zero human posts.
--   * This Week anchor — a pinned kind='anchor' post auto-refreshed from the
--                   current published fic_weeks row, + a one-shot 'announcement'
--                   push fan-out to every member on the publish transition.
--   * History migration — existing FIC-Club chat_messages copied in as posts.
--
-- RLS SCARS (018/019): Supabase Realtime evaluates a table's SELECT policy per
-- row and cannot authorize a subquery/self-referential policy. We DO NOT add
-- feed tables to the realtime publication (P1 uses fetch-on-load + light
-- polling — cleaner, no delivery hazard). SELECT policies are still kept as bare
-- `true` conditions so realtime COULD be enabled later without a rewrite.
-- INSERT/UPDATE/DELETE policies may safely subquery profiles (never realtime).
--
-- Live Rooms keeps using chat_messages untouched — this migration is additive.
-- ============================================================================

-- ── Constants ────────────────────────────────────────────────────────────────
-- FIC Club room  = c0000000-0000-4000-a000-000000000001  (source of feed history)

-- ── 1. feed_posts ────────────────────────────────────────────────────────────
create table if not exists feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete set null,
  family_id uuid references families(id) on delete set null,
  kind text not null default 'post' check (kind in ('post', 'activity', 'anchor')),
  body text not null default '',
  attachment_url text,
  attachment_type text check (attachment_type in ('image', 'video')),
  attachment_meta jsonb,
  activity_payload jsonb,               -- rich card data for kind='activity'/'anchor'
  anchor_week_id uuid references fic_weeks(id) on delete cascade, -- for kind='anchor'
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_feed_posts_created on feed_posts(created_at desc);
create index if not exists idx_feed_posts_pinned on feed_posts(pinned) where pinned;
create index if not exists idx_feed_posts_kind on feed_posts(kind);
create index if not exists idx_feed_posts_anchor_week on feed_posts(anchor_week_id);

alter table feed_posts enable row level security;

-- Read: any authenticated member (bare, realtime-safe — 019 scar).
drop policy if exists "Read feed posts" on feed_posts;
create policy "Read feed posts" on feed_posts
  for select to authenticated using (true);

-- Insert: members may author only their OWN regular posts. Activity/anchor
-- posts are written exclusively by the SECURITY DEFINER functions below (which
-- bypass RLS), so users can never forge a system card.
drop policy if exists "Author own feed posts" on feed_posts;
create policy "Author own feed posts" on feed_posts
  for insert to authenticated
  with check (author_id = auth.uid() and kind = 'post');

-- Update/Delete: own rows, or admin (moderation). Not realtime → subquery ok.
drop policy if exists "Edit own feed posts" on feed_posts;
create policy "Edit own feed posts" on feed_posts
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "Delete own or admin feed posts" on feed_posts;
create policy "Delete own or admin feed posts" on feed_posts
  for delete to authenticated
  using (
    author_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- ── 2. post_comments (flat threads) ──────────────────────────────────────────
create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references feed_posts(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_post_comments_post on post_comments(post_id, created_at);

alter table post_comments enable row level security;

drop policy if exists "Read post comments" on post_comments;
create policy "Read post comments" on post_comments
  for select to authenticated using (true);

drop policy if exists "Author own comments" on post_comments;
create policy "Author own comments" on post_comments
  for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "Delete own or admin comments" on post_comments;
create policy "Delete own or admin comments" on post_comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- ── 3. post_likes ────────────────────────────────────────────────────────────
create table if not exists post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references feed_posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists idx_post_likes_post on post_likes(post_id);
create index if not exists idx_post_likes_user on post_likes(user_id);

alter table post_likes enable row level security;

drop policy if exists "Read post likes" on post_likes;
create policy "Read post likes" on post_likes
  for select to authenticated using (true);

drop policy if exists "Like as self" on post_likes;
create policy "Like as self" on post_likes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Unlike own" on post_likes;
create policy "Unlike own" on post_likes
  for delete to authenticated using (user_id = auth.uid());

-- ── 4. Activity-card engine (SECURITY DEFINER) ───────────────────────────────
-- One helper builds a rich activity payload (actor identity for the age icon +
-- avatar, family name, target, icon hint) and inserts a kind='activity' post.
create or replace function public._feed_activity(
  p_actor uuid,
  p_family uuid,
  p_type text,
  p_icon text,
  p_target text,
  p_detail text,
  p_extra jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_avatar text;
  v_role text;
  v_age text;
  v_family_name text;
  v_payload jsonb;
begin
  select display_name, avatar_url, role, age_group
    into v_name, v_avatar, v_role, v_age
  from profiles where id = p_actor;

  select name into v_family_name from families where id = p_family;

  v_payload := jsonb_build_object(
    'type', p_type,
    'icon', p_icon,
    'actor_name', coalesce(v_name, 'A member'),
    'actor_avatar', v_avatar,
    'actor_role', v_role,
    'actor_age_group', v_age,
    'family_name', v_family_name,
    'target', p_target,
    'detail', p_detail
  ) || coalesce(p_extra, '{}'::jsonb);

  insert into feed_posts (author_id, family_id, kind, body, activity_payload)
  values (p_actor, p_family, 'activity', '', v_payload);
end;
$$;

-- (a) Badge earned → "X earned the Analyst credential"
create or replace function public.feed_on_badge_award()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_family uuid;
  v_title text;
  v_subtitle text;
begin
  select family_id into v_family from profiles where id = new.user_id;
  select title, subtitle into v_title, v_subtitle from badges where id = new.badge_id;
  perform public._feed_activity(
    new.user_id, v_family, 'badge_earned', 'badge',
    coalesce(v_title, 'a credential'), coalesce(v_subtitle, '')
  );
  return new;
exception when others then
  return new;  -- never block the award
end;
$$;
drop trigger if exists trg_feed_badge_award on badge_awards;
create trigger trg_feed_badge_award
  after insert on badge_awards
  for each row execute function public.feed_on_badge_award();

-- (b) Watchlist add → "the Y family is watching Costco"
create or replace function public.feed_on_watchlist_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._feed_activity(
    new.champion_id, new.family_id, 'watchlist_add', 'eye',
    coalesce(new.company_name, new.ticker), new.ticker,
    jsonb_build_object('ticker', new.ticker, 'company_name', new.company_name)
  );
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists trg_feed_watchlist_insert on family_watchlist;
create trigger trg_feed_watchlist_insert
  after insert on family_watchlist
  for each row execute function public.feed_on_watchlist_insert();

-- (c) Watchlist verdict (status → favorite/avoid) → "finished their research on COST"
create or replace function public.feed_on_watchlist_verdict()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('favorite', 'avoid')
     and coalesce(old.status, '') is distinct from new.status then
    perform public._feed_activity(
      new.champion_id, new.family_id, 'watchlist_verdict', 'check',
      coalesce(new.company_name, new.ticker), new.status,
      jsonb_build_object('ticker', new.ticker, 'verdict', new.status,
                         'company_name', new.company_name)
    );
  end if;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists trg_feed_watchlist_verdict on family_watchlist;
create trigger trg_feed_watchlist_verdict
  after update of status on family_watchlist
  for each row execute function public.feed_on_watchlist_verdict();

-- (d) Mission completion → "Z completed the Money Machine mission"
create or replace function public.feed_on_mission_complete()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_title text;
begin
  select title into v_title from fic_missions where id = new.mission_id;
  perform public._feed_activity(
    new.user_id, new.family_id, 'mission_complete', 'target',
    coalesce(v_title, 'a mission'), ''
  );
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists trg_feed_mission_complete on mission_completions;
create trigger trg_feed_mission_complete
  after insert on mission_completions
  for each row execute function public.feed_on_mission_complete();

-- (e) Session RSVP → "the Y family is going to Tuesday's class"
--     Batch/dedupe: ONE card per family per session (extra members RSVPing to
--     the same class do not spam the feed).
create or replace function public.feed_on_session_rsvp()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_when timestamptz;
  v_exists boolean;
begin
  if new.family_id is null then
    return new;
  end if;

  select exists (
    select 1 from feed_posts
    where kind = 'activity'
      and family_id = new.family_id
      and activity_payload->>'type' = 'session_rsvp'
      and activity_payload->>'session_id' = new.session_id::text
  ) into v_exists;

  if v_exists then
    return new;  -- family already announced for this class
  end if;

  select title, scheduled_at into v_title, v_when
  from live_sessions where id = new.session_id;

  perform public._feed_activity(
    new.user_id, new.family_id, 'session_rsvp', 'calendar',
    coalesce(v_title, 'a live class'), '',
    jsonb_build_object('session_id', new.session_id,
                       'scheduled_at', v_when)
  );
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists trg_feed_session_rsvp on session_rsvps;
create trigger trg_feed_session_rsvp
  after insert on session_rsvps
  for each row execute function public.feed_on_session_rsvp();

-- (f) Level-up → "the Rivera family leveled up to Chart Reader (Level 3)"
--     XP is append-only (xp_events); level is DERIVED from the lifetime sum.
--     The clean trigger point is xp_events INSERT: compute the total before and
--     after this event and fire only when a LEVELS threshold is crossed. Ladder
--     thresholds/names mirror src/lib/xp.ts (keep in sync if that changes).
create or replace function public.feed_on_xp_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_total_after bigint;
  v_total_before bigint;
  v_family uuid;
  mins int[]   := array[0, 150, 400, 800, 1400, 2200, 3200];
  names text[] := array['Explorer','Money Mapper','Chart Reader','Zone Hunter',
                        'Sweep Spotter','Trade Ready','Playbook Pro'];
  lvl_before int := 1;
  lvl_after int := 1;
  i int;
begin
  if coalesce(new.amount, 0) = 0 then
    return new;
  end if;

  select coalesce(sum(amount), 0) into v_total_after
  from xp_events where user_id = new.user_id;
  v_total_before := v_total_after - new.amount;

  for i in reverse array_length(mins, 1)..1 loop
    if v_total_after  >= mins[i] and lvl_after  = 1 and i > 1 then lvl_after  := i; end if;
    if v_total_before >= mins[i] and lvl_before = 1 and i > 1 then lvl_before := i; end if;
  end loop;

  if lvl_after > lvl_before then
    select family_id into v_family from profiles where id = new.user_id;
    perform public._feed_activity(
      new.user_id, v_family, 'level_up', 'trophy',
      names[lvl_after], 'Level ' || lvl_after,
      jsonb_build_object('level', lvl_after, 'level_name', names[lvl_after])
    );
  end if;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists trg_feed_xp_event on xp_events;
create trigger trg_feed_xp_event
  after insert on xp_events
  for each row execute function public.feed_on_xp_event();

-- ── 5. This Week anchor + weekly push fan-out ────────────────────────────────
-- When a fic_weeks row is published AND flagged current, (re)build the single
-- pinned anchor post from its fields. On the PUBLISH TRANSITION (a week newly
-- becoming the live/current week) also fan out a one-shot 'announcement'
-- notification to every member (push pipeline, migration 028). Editing an
-- already-current week refreshes the anchor card WITHOUT re-notifying.
create or replace function public.feed_sync_week_anchor()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_payload jsonb;
  v_body text;
  v_became_current boolean;
begin
  if not (new.published and new.is_current) then
    -- Week no longer the live anchor: unpin any anchor for it.
    update feed_posts set pinned = false
    where kind = 'anchor' and anchor_week_id = new.id;
    return new;
  end if;

  v_payload := jsonb_build_object(
    'week_start', new.week_start,
    'class_title', new.class_title,
    'company_name', new.company_name,
    'company_ticker', new.company_ticker,
    'discussion_question', new.cotw_discussion_question,
    'family_assignment', new.family_assignment,
    'kid_challenge', new.kid_challenge
  );

  v_body := coalesce('This week: ' || new.class_title, 'This week in the club');

  -- Only one pinned anchor at a time.
  update feed_posts set pinned = false where kind = 'anchor' and anchor_week_id <> new.id;

  if exists (select 1 from feed_posts where kind = 'anchor' and anchor_week_id = new.id) then
    update feed_posts
      set body = v_body, activity_payload = v_payload, pinned = true, created_at = now()
    where kind = 'anchor' and anchor_week_id = new.id;
  else
    insert into feed_posts (author_id, family_id, kind, body, activity_payload, anchor_week_id, pinned)
    values (null, null, 'anchor', v_body, v_payload, new.id, true);
  end if;

  -- Publish transition? (fresh insert as current, or a week flipping into
  -- published+current). Guard against re-notifying on routine content edits.
  v_became_current := (tg_op = 'INSERT')
    or (coalesce(old.published, false) is distinct from true)
    or (coalesce(old.is_current, false) is distinct from true);

  if v_became_current then
    insert into notifications (user_id, actor_id, type, message_id, body)
    select p.id, null, 'announcement', null,
           'This Week is live: ' || coalesce(new.company_name, new.class_title)
             || '. Post your family''s pick in the club.'
    from profiles p
    where p.family_id is not null;
  end if;

  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists trg_feed_week_anchor on fic_weeks;
create trigger trg_feed_week_anchor
  after insert or update on fic_weeks
  for each row execute function public.feed_sync_week_anchor();

-- ── 6. Feed notifications: comment-replies + @mentions ───────────────────────
-- Mirrors the chat_messages notifier (028) for the feed surface. Reuses the
-- same stripped-display-name mention rule and the notifications table (whose
-- AFTER INSERT push-dispatch trigger fires Web Push automatically). message_id
-- is null (that FK targets chat_messages); the bell deep-links to /community.

-- Shared mention fan-out helper.
create or replace function public._feed_notify_mentions(
  p_text text, p_actor uuid, p_already uuid[]
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_uid uuid;
  v_snippet text;
  v_notified uuid[] := coalesce(p_already, '{}');
begin
  v_snippet := coalesce(nullif(left(coalesce(p_text, ''), 140), ''), '[post]');
  for v_token in
    select distinct lower(m[1])
    from regexp_matches(coalesce(p_text, ''), '@([A-Za-z0-9_.''-]+)', 'g') as m
  loop
    v_uid := null;
    select id into v_uid from profiles
    where lower(replace(display_name, ' ', '')) = v_token
    order by created_at asc limit 1;
    if v_uid is not null and v_uid <> p_actor and not (v_uid = any (v_notified)) then
      insert into notifications (user_id, actor_id, type, message_id, body)
      values (v_uid, p_actor, 'mention', null, v_snippet);
      v_notified := array_append(v_notified, v_uid);
    end if;
  end loop;
end;
$$;

-- Top-level post → mentions only (kind='post' authored by a human).
create or replace function public.notify_on_feed_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'post' and new.author_id is not null then
    perform public._feed_notify_mentions(new.body, new.author_id, '{}');
  end if;
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists trg_feed_post_notify on feed_posts;
create trigger trg_feed_post_notify
  after insert on feed_posts
  for each row execute function public.notify_on_feed_post();

-- Comment → reply notification to the post author + mentions.
create or replace function public.notify_on_post_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_post_author uuid;
  v_snippet text;
  v_notified uuid[] := '{}';
begin
  v_snippet := coalesce(nullif(left(coalesce(new.body, ''), 140), ''), '[comment]');
  select author_id into v_post_author from feed_posts where id = new.post_id;

  if v_post_author is not null and v_post_author <> new.author_id then
    insert into notifications (user_id, actor_id, type, message_id, body)
    values (v_post_author, new.author_id, 'reply', null, v_snippet);
    v_notified := array_append(v_notified, v_post_author);
  end if;

  perform public._feed_notify_mentions(new.body, new.author_id, v_notified);
  return new;
exception when others then
  return new;
end;
$$;
drop trigger if exists trg_post_comment_notify on post_comments;
create trigger trg_post_comment_notify
  after insert on post_comments
  for each row execute function public.notify_on_post_comment();

-- ── 7. History migration: FIC-Club chat_messages → feed_posts (additive) ─────
-- The existing categorized chat rows ARE the first feed posts. Copy them
-- (authors, timestamps, attachments preserved) as kind='post'. Chat data is NOT
-- deleted — Live Rooms keeps using chat_messages. Idempotent via NOT EXISTS on
-- (author, created_at) so re-applying on a fresh DB never double-inserts.
insert into feed_posts (author_id, family_id, kind, body, attachment_url, attachment_type, attachment_meta, created_at)
select cm.user_id, p.family_id, 'post',
       coalesce(cm.content, ''),
       cm.attachment_url, cm.attachment_type, cm.attachment_meta, cm.created_at
from chat_messages cm
join profiles p on p.id = cm.user_id
where cm.room_id = 'c0000000-0000-4000-a000-000000000001'::uuid
  and not exists (
    select 1 from feed_posts f
    where f.kind = 'post'
      and f.author_id = cm.user_id
      and f.created_at = cm.created_at
  );

-- ── 8. Seed the anchor from the current published week (if any) ──────────────
-- Fire the anchor sync once for the already-current week so the feed opens with
-- a pinned This Week card immediately (no-op notification guard: this touch
-- counts as a publish transition only if it wasn't current — it is, so a
-- content-neutral update won't spam; we call the builder directly instead).
do $$
declare
  v fic_weeks%rowtype;
  v_payload jsonb;
begin
  select * into v from fic_weeks where published and is_current order by week_start desc limit 1;
  if found then
    v_payload := jsonb_build_object(
      'week_start', v.week_start,
      'class_title', v.class_title,
      'company_name', v.company_name,
      'company_ticker', v.company_ticker,
      'discussion_question', v.cotw_discussion_question,
      'family_assignment', v.family_assignment,
      'kid_challenge', v.kid_challenge
    );
    if not exists (select 1 from feed_posts where kind = 'anchor' and anchor_week_id = v.id) then
      insert into feed_posts (author_id, family_id, kind, body, activity_payload, anchor_week_id, pinned)
      values (null, null, 'anchor', 'This week: ' || v.class_title, v_payload, v.id, true);
    end if;
  end if;
end $$;
