-- ============================================================================
-- 090 — Announcements + notification infrastructure widening.
--
-- Owner ask (2026-07-22): admins post announcements to the community; they fan
-- out as push notifications to a chosen audience; they render in the feed as a
-- distinct gold "megaphone" AnnouncementCard (latest one pinned above the feed
-- for 7 days, older ones flow in-feed).
--
-- This migration lays the shared notification foundation used by 090-093:
--   * notifications gains `link` (deep-link target) + `ref_id` (source object,
--     e.g. the announcement post id — powers per-announcement delivery counts).
--   * notifications.type constraint widened for every new event type shipped in
--     090-093 (announcement, mention_everyone, new_pick, new_lesson,
--     recording_posted, broadcast) — done ONCE here so later migrations only add
--     triggers, never re-touch the constraint.
--   * feed_posts.kind gains 'announcement' + columns (title, link, audience).
--   * notif_audience_ids / notif_audience_count — the ONE place that maps an
--     audience token to a set of recipient user_ids (reused by the announcement
--     RPC, the admin push composer in 093, and the live recipient-count preview).
--   * admin_post_announcement — SECURITY DEFINER: admin-only insert of the feed
--     card + BATCH insert-select of 'announcement' notification rows to the
--     audience. (Push itself is best-effort via the 028 pg_net → /api/push
--     dispatch pipeline; notification_prefs gate PUSH at dispatch time, not the
--     in-app row — see 093 + /api/push/dispatch. In-app rows always create.)
--
-- SCALE: fan-outs are single batch INSERT-SELECTs (never row-by-row from JS).
-- The 028 AFTER-INSERT pg_net dispatch trigger still fires once PER ROW — fine
-- at current scale (hundreds of members). At thousands, replace the per-row
-- pg_net trigger with a single POST to a batch dispatch endpoint that pages
-- through the batch (grouped by ref_id) — see SCALE NOTE in /api/push/dispatch.
--
-- RLS scars (018/019) honored: notifications SELECT policy stays a bare
-- user_id = auth.uid() column comparison (Realtime-safe); all fan-out inserts
-- run through SECURITY DEFINER functions (no INSERT policy for users).
-- ============================================================================

-- ── 1. notifications: deep-link + source-object columns ──────────────────────
alter table notifications add column if not exists link text;
alter table notifications add column if not exists ref_id uuid;

create index if not exists idx_notifications_ref on notifications(ref_id) where ref_id is not null;

-- Widen the type constraint ONCE for all of 090-093.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'reply', 'mention', 'announcement', 'support_reply',
    'mention_everyone', 'new_pick', 'new_lesson', 'recording_posted', 'broadcast'
  ));

-- ── 2. feed_posts: allow kind='announcement' + its display columns ───────────
alter table feed_posts drop constraint if exists feed_posts_kind_check;
alter table feed_posts add constraint feed_posts_kind_check
  check (kind in ('post', 'activity', 'anchor', 'announcement'));

alter table feed_posts add column if not exists title text;
alter table feed_posts add column if not exists link text;
alter table feed_posts add column if not exists audience text;

create index if not exists idx_feed_posts_announcement
  on feed_posts(created_at desc) where kind = 'announcement';

-- The 034 "Author own feed posts" INSERT policy already restricts members to
-- kind='post' authored by themselves, so members STILL cannot forge an
-- announcement card. Announcement rows are written exclusively by the
-- SECURITY DEFINER RPC below (which bypasses RLS). No policy change needed.

-- ── 3. Audience resolver — one source of truth ───────────────────────────────
-- Maps an audience token → recipient user_ids. Tier comes from the family_tiers
-- view (029/060). Only real members (family_id set) are ever targeted.
--   all    → everyone
--   free   → free-tier families
--   fic    → paying club members (fic + fta; FTA is a superset of FIC)
--   fta    → FTA families only
--   members→ alias for fic (any paying member)
--   role:admin|parent|child → by profiles.role (used by the push composer, 093)
create or replace function public.notif_audience_ids(p_audience text)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from profiles p
  left join family_tiers ft on ft.family_id = p.family_id
  where p.family_id is not null
    and (
      p_audience = 'all'
      or (p_audience = 'free'    and coalesce(ft.tier, 'fic') = 'free')
      or (p_audience = 'fic'     and coalesce(ft.tier, 'fic') in ('fic', 'fta'))
      or (p_audience = 'fta'     and coalesce(ft.tier, 'fic') = 'fta')
      or (p_audience = 'members' and coalesce(ft.tier, 'fic') in ('fic', 'fta'))
      or (p_audience = 'role:admin'  and p.role = 'admin')
      or (p_audience = 'role:parent' and p.role = 'parent')
      or (p_audience = 'role:child'  and p.role = 'child')
    );
$$;

grant execute on function public.notif_audience_ids(text) to authenticated;

-- Live recipient + push-subscription counts for the admin composer preview.
-- Admin-guarded (returns nulls for non-admins) since it aggregates membership.
create or replace function public.notif_audience_count(p_audience text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_recipients int;
  v_push int;
begin
  if (select role from profiles where id = auth.uid()) is distinct from 'admin' then
    return jsonb_build_object('recipients', null, 'push_subs', null);
  end if;

  select count(*) into v_recipients from public.notif_audience_ids(p_audience);
  select count(distinct ps.user_id) into v_push
  from push_subscriptions ps
  where ps.user_id in (select user_id from public.notif_audience_ids(p_audience));

  return jsonb_build_object('recipients', v_recipients, 'push_subs', v_push);
end;
$$;

grant execute on function public.notif_audience_count(text) to authenticated;

-- ── 4. admin_post_announcement — the announce action ─────────────────────────
-- Admin-only. Inserts the feed AnnouncementCard, then BATCH inserts announcement
-- notification rows to the audience (self excluded). Returns {post_id,
-- recipients, audience}. The 028 pg_net trigger fires push per inserted row;
-- notification_prefs gate push at dispatch (in-app rows always create).
create or replace function public.admin_post_announcement(
  p_title    text,
  p_body     text,
  p_audience text default 'all',
  p_link     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_family  uuid;
  v_post_id uuid;
  v_link    text;
  v_count   int;
begin
  if (select role from profiles where id = v_uid) is distinct from 'admin' then
    raise exception 'admin only';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'title required';
  end if;
  if p_audience not in ('all', 'fic', 'fta', 'free') then
    p_audience := 'all';
  end if;

  v_link := nullif(trim(coalesce(p_link, '')), '');
  select family_id into v_family from profiles where id = v_uid;

  insert into feed_posts (author_id, family_id, kind, body, title, link, audience)
  values (v_uid, v_family, 'announcement', coalesce(p_body, ''),
          trim(p_title), v_link, p_audience)
  returning id into v_post_id;

  insert into notifications (user_id, actor_id, type, body, link, ref_id)
  select a.user_id, v_uid, 'announcement',
         left(trim(p_title), 140),
         coalesce(v_link, '/community'),
         v_post_id
  from public.notif_audience_ids(p_audience) a
  where a.user_id <> v_uid;

  get diagnostics v_count = row_count;

  return jsonb_build_object('post_id', v_post_id, 'recipients', v_count, 'audience', p_audience);
end;
$$;

grant execute on function public.admin_post_announcement(text, text, text, text) to authenticated;

-- ── 5. admin_announcement_history — feed announcements + delivery counts ─────
-- notifications RLS only lets a user read their OWN rows, so the admin console
-- cannot count deliveries client-side. This definer RPC returns each
-- announcement with delivered / read counts (admin-guarded).
create or replace function public.admin_announcement_history(p_limit int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if (select role from profiles where id = auth.uid()) is distinct from 'admin' then
    raise exception 'admin only';
  end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select fp.id, fp.title, fp.body, fp.link, fp.audience, fp.created_at,
           pr.display_name as author_name,
           (select count(*) from notifications n where n.ref_id = fp.id and n.type = 'announcement') as delivered,
           (select count(*) from notifications n where n.ref_id = fp.id and n.type = 'announcement' and n.read_at is not null) as read_count,
           (select count(*) from notifications n where n.ref_id = fp.id and n.type = 'announcement' and n.dispatched_at is not null) as dispatched
    from feed_posts fp
    left join profiles pr on pr.id = fp.author_id
    where fp.kind = 'announcement'
    order by fp.created_at desc
    limit greatest(1, least(p_limit, 200))
  ) t;

  return v_result;
end;
$$;

grant execute on function public.admin_announcement_history(int) to authenticated;
