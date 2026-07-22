-- ============================================================================
-- 091 — @everyone broadcast mention (ADMIN-ONLY).
--
-- Owner ask: an admin can tag @everyone in the community and every member gets
-- a push. For NON-admins, '@everyone' is inert text (no fan-out) — the security
-- gate is a profiles.role check inside the SECURITY DEFINER trigger, so it can
-- never be spoofed from the client.
--
-- Surfaces covered (both reuse the existing notification + pg_net push pipe):
--   * chat_messages (Live Rooms)  — extends 028 notify_on_chat_message
--   * feed_posts / post_comments  — extends 034 notify_on_feed_post +
--                                   notify_on_post_comment
--
-- Behaviour: when the author is an admin AND the text contains '@everyone'
-- (case-insensitive, whole token), fan out ONE 'mention_everyone' notification
-- to every member (family_id set), deduped against the reply/per-user mention
-- recipients and never to self. The existing per-user @mention behaviour is
-- untouched; the reserved token 'everyone' is simply skipped in the per-user
-- loop so it never resolves to a profile literally named "Everyone".
--
-- SCALE: one batch INSERT-SELECT over the audience (not row-by-row). At current
-- scale (hundreds) the 028 per-row pg_net dispatch is fine; see 090 header +
-- /api/push/dispatch SCALE NOTE for the thousands-scale batch-endpoint upgrade.
-- ============================================================================

-- Shared @everyone fan-out. Caller has already verified the actor is an admin.
create or replace function public._notify_everyone(
  p_actor   uuid,
  p_snippet text,
  p_link    text,
  p_already uuid[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, actor_id, type, body, link)
  select p.id, p_actor, 'mention_everyone',
         coalesce(nullif(left(coalesce(p_snippet, ''), 140), ''), '[announcement]'),
         coalesce(p_link, '/community')
  from profiles p
  where p.family_id is not null
    and p.id <> p_actor
    and not (p.id = any (coalesce(p_already, '{}')));
end;
$$;

-- True when text contains a whole-token '@everyone' (case-insensitive).
create or replace function public._has_everyone(p_text text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_text, '') ~* '(^|\s)@everyone(\M|$)';
$$;

-- ── chat_messages: reply + per-user mention + admin @everyone ────────────────
create or replace function public.notify_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_author uuid;
  v_snippet text;
  v_notified uuid[] := '{}';
  v_token text;
  v_mention_user uuid;
  v_is_admin boolean;
begin
  v_snippet := coalesce(nullif(left(coalesce(new.content, ''), 140), ''), '[media]');

  -- (a) Reply → notify the parent message's author (never self)
  if new.reply_to_id is not null then
    select user_id into v_parent_author from chat_messages where id = new.reply_to_id;
    if v_parent_author is not null and v_parent_author <> new.user_id then
      insert into notifications (user_id, actor_id, type, message_id, body)
      values (v_parent_author, new.user_id, 'reply', new.id, v_snippet);
      v_notified := array_append(v_notified, v_parent_author);
    end if;
  end if;

  -- (b) @mentions — reserved token 'everyone' is skipped here (handled below).
  for v_token in
    select distinct lower(m[1])
    from regexp_matches(coalesce(new.content, ''), '@([A-Za-z0-9_.''-]+)', 'g') as m
  loop
    if v_token = 'everyone' then continue; end if;
    v_mention_user := null;
    select id into v_mention_user from profiles
    where lower(replace(display_name, ' ', '')) = v_token
    order by created_at asc limit 1;

    if v_mention_user is not null
       and v_mention_user <> new.user_id
       and not (v_mention_user = any (v_notified)) then
      insert into notifications (user_id, actor_id, type, message_id, body)
      values (v_mention_user, new.user_id, 'mention', new.id, v_snippet);
      v_notified := array_append(v_notified, v_mention_user);
    end if;
  end loop;

  -- (c) @everyone — ADMIN-ONLY. Non-admins: inert (no fan-out).
  if public._has_everyone(new.content) then
    select (role = 'admin') into v_is_admin from profiles where id = new.user_id;
    if coalesce(v_is_admin, false) then
      perform public._notify_everyone(new.user_id, v_snippet, '/community', v_notified);
    end if;
  end if;

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_chat_message_notify on chat_messages;
create trigger trg_chat_message_notify
  after insert on chat_messages
  for each row execute function public.notify_on_chat_message();

-- ── feed post: per-user mention + admin @everyone ────────────────────────────
create or replace function public.notify_on_feed_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_is_admin boolean;
begin
  if new.kind = 'post' and new.author_id is not null then
    perform public._feed_notify_mentions(new.body, new.author_id, '{}');
    if public._has_everyone(new.body) then
      select (role = 'admin') into v_is_admin from profiles where id = new.author_id;
      if coalesce(v_is_admin, false) then
        perform public._notify_everyone(
          new.author_id,
          coalesce(nullif(left(coalesce(new.body, ''), 140), ''), '[post]'),
          '/community', array[new.author_id]
        );
      end if;
    end if;
  end if;
  return new;
exception when others then
  return new;
end;
$$;

-- ── feed comment: reply + per-user mention + admin @everyone ─────────────────
create or replace function public.notify_on_post_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_post_author uuid;
  v_snippet text;
  v_notified uuid[] := '{}';
  v_is_admin boolean;
begin
  v_snippet := coalesce(nullif(left(coalesce(new.body, ''), 140), ''), '[comment]');
  select author_id into v_post_author from feed_posts where id = new.post_id;

  if v_post_author is not null and v_post_author <> new.author_id then
    insert into notifications (user_id, actor_id, type, message_id, body)
    values (v_post_author, new.author_id, 'reply', null, v_snippet);
    v_notified := array_append(v_notified, v_post_author);
  end if;

  perform public._feed_notify_mentions(new.body, new.author_id, v_notified);

  if public._has_everyone(new.body) then
    select (role = 'admin') into v_is_admin from profiles where id = new.author_id;
    if coalesce(v_is_admin, false) then
      perform public._notify_everyone(new.author_id, v_snippet, '/community',
                                      array_append(v_notified, new.author_id));
    end if;
  end if;

  return new;
exception when others then
  return new;
end;
$$;

-- _feed_notify_mentions (034) must skip the reserved 'everyone' token too, so a
-- non-admin's '@everyone' never resolves to a profile named "Everyone".
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
    if v_token = 'everyone' then continue; end if;
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
