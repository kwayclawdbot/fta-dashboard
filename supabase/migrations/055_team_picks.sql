-- ============================================================================
-- 055 — Team Picks: the FIC team's investing picks, in card format.
--
-- A community-admin "picks" surface (owner ask 2026-07-22): a highly visual,
-- education-first dashboard of the companies the FIC team studies. Each pick is
-- a card — company logo + LIVE price (Polygon delayed layer) + status — that
-- opens a rich detail view: the full "why we study this" thesis, an uploaded /
-- YouTube / external video, article links, and member likes + comments.
--
-- Mirrors the clubhouse feed engagement model (migration 034): flat comments +
-- simple likes, both own-row INSERT/DELETE with bare `true` SELECT. Admin writes
-- to fic_picks go through RLS admin-write policies (the same direct-write pattern
-- the /admin/fic-weeks + /admin/live-sessions consoles already use — an admin's
-- authenticated client writes the row; role='admin' is enforced in the policy).
--
-- Uploaded pick videos live in the existing public `community-media` bucket
-- (migration 027) under a `picks/{uuid}` prefix; a dedicated admin INSERT policy
-- allows that prefix (the base bucket INSERT policy is uid-prefixed only). DELETE
-- is already covered by the bucket's owner-or-admin delete policy.
-- ============================================================================

-- ── 1. fic_picks ─────────────────────────────────────────────────────────────
create table if not exists fic_picks (
  id            uuid primary key default gen_random_uuid(),
  ticker        text not null,
  company_name  text not null,
  status        text not null default 'draft'
                  check (status in ('draft', 'active', 'watching', 'closed')),
  headline      text,
  thesis_short  text,
  thesis_long   text,                    -- the full "why we picked it"
  picked_at     date not null default current_date,
  picked_price  numeric,
  video_path    text,                    -- community-media object path (upload)
  video_kind    text check (video_kind in ('upload', 'youtube', 'external')),
  article_links jsonb not null default '[]'::jsonb,  -- [{title,url}, ...]
  tags          text[] not null default '{}',
  created_by    uuid references profiles(id) on delete set null,
  closed_note   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_fic_picks_status   on fic_picks(status);
create index if not exists idx_fic_picks_picked_at on fic_picks(picked_at desc);
create index if not exists idx_fic_picks_created   on fic_picks(created_at desc);

-- keep updated_at fresh
create or replace function public.fic_picks_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_fic_picks_touch on fic_picks;
create trigger trg_fic_picks_touch
  before update on fic_picks
  for each row execute function public.fic_picks_touch_updated_at();

alter table fic_picks enable row level security;

-- Read: any authenticated member sees published picks (status != 'draft').
-- Admins additionally see drafts so the console can edit unpublished rows.
drop policy if exists "Read published picks" on fic_picks;
create policy "Read published picks" on fic_picks
  for select to authenticated
  using (
    status <> 'draft'
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Admin writes (create / edit / delete). Same direct-RLS admin-write pattern as
-- the fic-weeks + live-sessions admin consoles.
drop policy if exists "Admins insert picks" on fic_picks;
create policy "Admins insert picks" on fic_picks
  for insert to authenticated
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

drop policy if exists "Admins update picks" on fic_picks;
create policy "Admins update picks" on fic_picks
  for update to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

drop policy if exists "Admins delete picks" on fic_picks;
create policy "Admins delete picks" on fic_picks
  for delete to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- ── 2. pick_likes ────────────────────────────────────────────────────────────
create table if not exists pick_likes (
  pick_id    uuid not null references fic_picks(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pick_id, user_id)
);

create index if not exists idx_pick_likes_pick on pick_likes(pick_id);
create index if not exists idx_pick_likes_user on pick_likes(user_id);

alter table pick_likes enable row level security;

drop policy if exists "Read pick likes" on pick_likes;
create policy "Read pick likes" on pick_likes
  for select to authenticated using (true);

drop policy if exists "Like pick as self" on pick_likes;
create policy "Like pick as self" on pick_likes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Unlike own pick" on pick_likes;
create policy "Unlike own pick" on pick_likes
  for delete to authenticated using (user_id = auth.uid());

-- ── 3. pick_comments (flat threads) ──────────────────────────────────────────
create table if not exists pick_comments (
  id         uuid primary key default gen_random_uuid(),
  pick_id    uuid not null references fic_picks(id) on delete cascade,
  user_id    uuid references profiles(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pick_comments_pick on pick_comments(pick_id, created_at);

alter table pick_comments enable row level security;

drop policy if exists "Read pick comments" on pick_comments;
create policy "Read pick comments" on pick_comments
  for select to authenticated using (true);

drop policy if exists "Author own pick comment" on pick_comments;
create policy "Author own pick comment" on pick_comments
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Delete own or admin pick comment" on pick_comments;
create policy "Delete own or admin pick comment" on pick_comments
  for delete to authenticated
  using (
    user_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- ── 4. Storage: admin uploads under community-media/picks/{uuid} ─────────────
-- The base bucket INSERT policy (027) only permits a {uid}/ prefix; picks are a
-- shared team surface written by admins, so allow the `picks/` prefix for admin.
-- DELETE of these objects is already covered by community_media_owner_admin_delete
-- (admins may delete any object in the bucket).
drop policy if exists "community_media_admin_picks_insert" on storage.objects;
create policy "community_media_admin_picks_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = 'picks'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );
