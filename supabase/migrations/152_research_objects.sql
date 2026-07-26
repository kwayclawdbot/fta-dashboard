-- 152 — SOCIAL OBJECTS S1: Research Object v1 (structured thesis).
-- SOCIAL-OBJECTS.md object #2 + MONETIZATION-GATES.md "Publish research → Structured
-- thesis". ONE build serves: the paid structured-publishing feature, the social
-- object, and the intel ticker-memory feed. This is a PERSISTENT OBJECT, not a
-- feed post.
--
--   research_objects         — the thesis: ticker, stance, one-line hook, author,
--                              time_horizon (reuses 142's vocab), price_at_publish
--                              (captured from screener_metrics), body sections
--                              (thesis/catalysts/risks/valuation), lifecycle status.
--   research_object_updates  — THESIS UPDATE lifecycle entries: strengthened /
--                              weakened / changed, each stamped with the price at
--                              update so the object tracks its move over time.
--   research_object_comments — section-anchored responses (which section they
--                              reply to). Informational reactions ride migration 150
--                              (target_type='research_object').
--
-- GATING: full structured publishing is a PAID feature. This migration provides
-- the DATA + kid-wall only. The monetization-gates lane wraps the SINGLE publish
-- entry point (POST /api/social/research) with can(user,'research_publish'); this
-- migration does not implement paid-tier gating (one source of truth — the gate).
--
-- Kid-wall: publishing + updating are adults+teens only, enforced inside the
-- SECURITY DEFINER RPCs (viewer_is_kid, migration 137). Reading is open. No XP.

create table if not exists research_objects (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references profiles(id) on delete cascade,
  ticker        text not null,
  company_name  text,
  stance        text not null check (stance in ('bull', 'bear', 'neutral')),
  headline      text not null,                 -- one-line hook
  time_horizon  text check (time_horizon is null or time_horizon in ('near', '1yr', '3-5yr')),
  price_at_publish numeric,                     -- screener_metrics.price at publish
  thesis        text not null default '',
  catalysts     text not null default '',
  risks         text not null default '',
  valuation     text not null default '',
  status        text not null default 'published' check (status in ('published', 'archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_research_objects_ticker on research_objects(upper(ticker), created_at desc);
create index if not exists idx_research_objects_author on research_objects(author_id, created_at desc);
create index if not exists idx_research_objects_recent on research_objects(created_at desc) where status = 'published';

create table if not exists research_object_updates (
  id             uuid primary key default gen_random_uuid(),
  object_id      uuid not null references research_objects(id) on delete cascade,
  author_id      uuid not null references profiles(id) on delete cascade,
  kind           text not null check (kind in ('strengthened', 'weakened', 'changed')),
  body           text not null default '',
  price_at_update numeric,
  created_at     timestamptz not null default now()
);
create index if not exists idx_research_object_updates_obj on research_object_updates(object_id, created_at desc);

create table if not exists research_object_comments (
  id         uuid primary key default gen_random_uuid(),
  object_id  uuid not null references research_objects(id) on delete cascade,
  author_id  uuid references profiles(id) on delete set null,
  section    text not null default 'general'
               check (section in ('general', 'thesis', 'catalysts', 'risks', 'valuation')),
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_research_object_comments_obj on research_object_comments(object_id, created_at);

alter table research_objects enable row level security;
alter table research_object_updates enable row level security;
alter table research_object_comments enable row level security;

-- Reads: any member (a thesis is public inside the Club). Writes to objects +
-- updates flow through the kid-walled RPCs only (no direct insert policy). The
-- author may edit/archive their own object.
drop policy if exists "Read research objects" on research_objects;
create policy "Read research objects" on research_objects
  for select to authenticated using (true);
drop policy if exists "Edit own research objects" on research_objects;
create policy "Edit own research objects" on research_objects
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "Delete own research objects" on research_objects;
create policy "Delete own research objects" on research_objects
  for delete to authenticated using (author_id = auth.uid());

drop policy if exists "Read research object updates" on research_object_updates;
create policy "Read research object updates" on research_object_updates
  for select to authenticated using (true);

-- Section-anchored comments: read open; author their own; delete own or admin.
drop policy if exists "Read research object comments" on research_object_comments;
create policy "Read research object comments" on research_object_comments
  for select to authenticated using (true);
drop policy if exists "Author own research object comments" on research_object_comments;
create policy "Author own research object comments" on research_object_comments
  for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "Delete own or admin research object comments" on research_object_comments;
create policy "Delete own or admin research object comments" on research_object_comments
  for delete to authenticated using (
    author_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- ── publish_research_object — the ONE write path (kid-walled) ─────────────────
-- Captures price_at_publish + company_name from screener_metrics at publish time.
-- Paid-tier gating is applied ONE level up (the API route the gates lane wraps).
create or replace function public.publish_research_object(
  p_ticker text,
  p_stance text,
  p_headline text,
  p_time_horizon text default null,
  p_thesis text default '',
  p_catalysts text default '',
  p_risks text default '',
  p_valuation text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticker text := upper(nullif(trim(p_ticker), ''));
  v_stance text := lower(nullif(trim(p_stance), ''));
  v_headline text := nullif(trim(coalesce(p_headline, '')), '');
  v_price numeric;
  v_company text;
  v_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;
  if coalesce(public.viewer_is_kid(), false) then
    return jsonb_build_object('ok', false, 'reason', 'kid_walled');
  end if;
  if v_ticker is null or v_headline is null or v_stance not in ('bull', 'bear', 'neutral') then
    return jsonb_build_object('ok', false, 'reason', 'bad_input');
  end if;
  if p_time_horizon is not null and p_time_horizon not in ('near', '1yr', '3-5yr') then
    return jsonb_build_object('ok', false, 'reason', 'bad_horizon');
  end if;

  select price, name into v_price, v_company from screener_metrics where ticker = v_ticker;
  if v_company is null then
    select company_name into v_company from research_fundamentals where ticker = v_ticker;
  end if;

  insert into research_objects (
    author_id, ticker, company_name, stance, headline, time_horizon,
    price_at_publish, thesis, catalysts, risks, valuation
  ) values (
    auth.uid(), v_ticker, v_company, v_stance, left(v_headline, 200),
    nullif(p_time_horizon, ''), v_price,
    coalesce(p_thesis, ''), coalesce(p_catalysts, ''), coalesce(p_risks, ''), coalesce(p_valuation, '')
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'price_at_publish', v_price);
end;
$$;
grant execute on function public.publish_research_object(text, text, text, text, text, text, text, text) to authenticated;

-- ── add_thesis_update — lifecycle entry (author-only, kid-walled) ─────────────
create or replace function public.add_thesis_update(
  p_object_id uuid,
  p_kind text,
  p_body text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_ticker text;
  v_price numeric;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;
  if coalesce(public.viewer_is_kid(), false) then
    return jsonb_build_object('ok', false, 'reason', 'kid_walled');
  end if;
  if p_kind not in ('strengthened', 'weakened', 'changed') then
    return jsonb_build_object('ok', false, 'reason', 'bad_kind');
  end if;

  select author_id, ticker into v_author, v_ticker from research_objects where id = p_object_id;
  if v_author is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_object');
  end if;
  if v_author <> auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'not_author');
  end if;

  select price into v_price from screener_metrics where ticker = v_ticker;

  insert into research_object_updates (object_id, author_id, kind, body, price_at_update)
  values (p_object_id, auth.uid(), p_kind, coalesce(p_body, ''), v_price);

  update research_objects set updated_at = now() where id = p_object_id;

  return jsonb_build_object('ok', true, 'price_at_update', v_price);
end;
$$;
grant execute on function public.add_thesis_update(uuid, text, text) to authenticated;

-- ── get_research_object — full object payload (object + updates + author) ─────
-- Reactions come from get_object_reactions(150). % move is computed in the app
-- from price_at_publish vs the live quote (never stored/stale).
create or replace function public.get_research_object(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'object', (
      select to_jsonb(o) || jsonb_build_object(
        'author', (select jsonb_build_object(
          'id', p.id, 'display_name', p.display_name, 'username', p.username,
          'avatar_url', p.avatar_url, 'role', p.role, 'age_group', p.age_group)
          from profiles p where p.id = o.author_id)
      )
      from research_objects o where o.id = p_id
    ),
    'updates', coalesce((
      select jsonb_agg(to_jsonb(u) order by u.created_at desc)
      from research_object_updates u where u.object_id = p_id
    ), '[]'::jsonb)
  );
$$;
grant execute on function public.get_research_object(uuid) to authenticated;

-- ── get_ticker_research_objects — cards for a ticker page / feed ──────────────
create or replace function public.get_ticker_research_objects(p_ticker text, p_limit int default 10)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)
  from (
    select o.id, o.ticker, o.company_name, o.stance, o.headline, o.time_horizon,
           o.price_at_publish, o.created_at, o.updated_at,
           jsonb_build_object('id', p.id, 'display_name', p.display_name,
             'username', p.username, 'avatar_url', p.avatar_url,
             'role', p.role, 'age_group', p.age_group) as author,
           (select count(*)::int from research_object_updates u where u.object_id = o.id) as update_count
    from research_objects o
    join profiles p on p.id = o.author_id
    where upper(o.ticker) = upper(p_ticker) and o.status = 'published'
    order by o.created_at desc
    limit greatest(p_limit, 1)
  ) x;
$$;
grant execute on function public.get_ticker_research_objects(text, integer) to authenticated;
