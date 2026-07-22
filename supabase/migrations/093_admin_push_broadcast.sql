-- ============================================================================
-- 093 — Admin push broadcast composer (free-form "notify at will").
--
-- Owner ask: the admin dashboard can generate push notifications at will —
-- title, body, deep link, audience — a PURE notification (no feed card, unlike
-- an announcement). Each send is logged so the console can show history +
-- delivery counts.
--
--   admin_broadcasts        — one row per send (audit + history + counts).
--   admin_push_broadcast()  — admin-only. p_test=true sends ONLY to the caller
--                             ("send test to me first"); otherwise BATCH
--                             insert-selects 'broadcast' notification rows over
--                             the audience (self excluded), logs the broadcast,
--                             and returns the recipient count.
--   admin_broadcast_history() — recent broadcasts + delivered/read/dispatched.
--
-- Audience tokens reuse notif_audience_ids (090): all | fic | fta | free |
-- members | role:admin | role:parent | role:child.
--
-- SCALE: one batch INSERT-SELECT; per-row pg_net dispatch (028) is fine at
-- hundreds. See 090 header + /api/push/dispatch SCALE NOTE for thousands.
-- ============================================================================

create table if not exists admin_broadcasts (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid references profiles(id) on delete set null,
  title      text not null,
  body       text not null default '',
  link       text,
  audience   text not null default 'all',
  recipients int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_broadcasts_created on admin_broadcasts(created_at desc);

alter table admin_broadcasts enable row level security;

-- Admins may read the log directly (history RPC also gathers counts).
drop policy if exists "Admins read broadcasts" on admin_broadcasts;
create policy "Admins read broadcasts" on admin_broadcasts
  for select to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- No client INSERT/UPDATE/DELETE — writes go through the definer RPC only.
revoke insert, update, delete on admin_broadcasts from authenticated, anon;

create or replace function public.admin_push_broadcast(
  p_title    text,
  p_body     text,
  p_link     text default null,
  p_audience text default 'all',
  p_test     boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_link  text;
  v_bid   uuid;
  v_count int;
begin
  if (select role from profiles where id = v_uid) is distinct from 'admin' then
    raise exception 'admin only';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'title required';
  end if;

  v_link := nullif(trim(coalesce(p_link, '')), '');

  -- Test send: only the caller gets the push (no log row).
  if p_test then
    insert into notifications (user_id, actor_id, type, body, link)
    values (v_uid, v_uid, 'broadcast', left(trim(p_title) || ' — ' || coalesce(p_body,''), 140),
            coalesce(v_link, '/community'));
    return jsonb_build_object('test', true, 'recipients', 1);
  end if;

  insert into admin_broadcasts (admin_id, title, body, link, audience)
  values (v_uid, trim(p_title), coalesce(p_body, ''), v_link, p_audience)
  returning id into v_bid;

  insert into notifications (user_id, actor_id, type, body, link, ref_id)
  select a.user_id, v_uid, 'broadcast',
         left(trim(p_title) || case when coalesce(p_body,'') <> '' then ' — ' || p_body else '' end, 140),
         coalesce(v_link, '/community'),
         v_bid
  from public.notif_audience_ids(p_audience) a
  where a.user_id <> v_uid;

  get diagnostics v_count = row_count;
  update admin_broadcasts set recipients = v_count where id = v_bid;

  return jsonb_build_object('broadcast_id', v_bid, 'recipients', v_count, 'audience', p_audience);
end;
$$;

grant execute on function public.admin_push_broadcast(text, text, text, text, boolean) to authenticated;

create or replace function public.admin_broadcast_history(p_limit int default 50)
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
    select b.id, b.title, b.body, b.link, b.audience, b.recipients, b.created_at,
           pr.display_name as author_name,
           (select count(*) from notifications n where n.ref_id = b.id and n.type = 'broadcast' and n.read_at is not null) as read_count,
           (select count(*) from notifications n where n.ref_id = b.id and n.type = 'broadcast' and n.dispatched_at is not null) as dispatched
    from admin_broadcasts b
    left join profiles pr on pr.id = b.admin_id
    order by b.created_at desc
    limit greatest(1, least(p_limit, 200))
  ) t;

  return v_result;
end;
$$;

grant execute on function public.admin_broadcast_history(int) to authenticated;
