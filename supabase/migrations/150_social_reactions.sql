-- 150 — SOCIAL OBJECTS S1: informational reactions (replaces the generic like on
-- research-shaped surfaces). SOCIAL-OBJECTS.md §CROSS-CUTTING.
--
-- A member responds to a research-shaped object (a Research Object thesis, a
-- ticker research note, a thesis-tagged feed post) with a TYPED, meaningful
-- reaction instead of a like:
--   🧠 strong_point · ✓ agree · ? needs_evidence · ⚠ missing_risk
--   ↻ changed_mind · 🔖 saved
-- Counts are surfaced PER TYPE; "N people changed their mind after reading this"
-- is the headline signal, gated behind a scale floor (5) in the app.
--
-- Generic by (target_type, target_id) so one table serves every research surface
-- and the intel layer reads structured rows. Regular FEED chatter keeps its
-- existing post_likes (034) untouched — this is additive.
--
-- Kid posture: reactions are VISIBLE-SAFE. Kids may see counts and add the
-- educational reactions like everyone (mirrors post_likes "kids included", 034).
-- The heavier flows (stance flips, thesis publishing, debates) are kid-walled in
-- their own migrations. No XP anywhere (anti-spam, owner rule).

create table if not exists object_reactions (
  target_type text not null check (target_type in ('research_object', 'ticker_comment', 'feed_post')),
  target_id   uuid not null,
  user_id     uuid not null references profiles(id) on delete cascade,
  reaction    text not null check (reaction in
                ('strong_point', 'agree', 'needs_evidence', 'missing_risk', 'changed_mind', 'saved')),
  created_at  timestamptz not null default now(),
  primary key (target_type, target_id, user_id, reaction)   -- one of each type per member
);
create index if not exists idx_object_reactions_target on object_reactions(target_type, target_id);
create index if not exists idx_object_reactions_user on object_reactions(user_id);

alter table object_reactions enable row level security;

drop policy if exists "Read object reactions" on object_reactions;
create policy "Read object reactions" on object_reactions
  for select to authenticated using (true);

drop policy if exists "React as self" on object_reactions;
create policy "React as self" on object_reactions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Unreact own" on object_reactions;
create policy "Unreact own" on object_reactions
  for delete to authenticated using (user_id = auth.uid());

-- ── Aggregate: per-type counts + the caller's own reactions for one object ────
-- SECURITY DEFINER so counts are consistent regardless of the caller's row view;
-- returns only aggregates + the caller's own set (never who-reacted-what).
create or replace function public.get_object_reactions(
  p_target_type text,
  p_target_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'counts', coalesce((
      select jsonb_object_agg(reaction, n)
      from (
        select reaction, count(*)::int as n
        from object_reactions
        where target_type = p_target_type and target_id = p_target_id
        group by reaction
      ) c
    ), '{}'::jsonb),
    'mine', coalesce((
      select jsonb_agg(reaction)
      from object_reactions
      where target_type = p_target_type and target_id = p_target_id
        and user_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;
grant execute on function public.get_object_reactions(text, uuid) to authenticated;

-- ── Batched aggregate for feeds/lists (avoid N+1) ────────────────────────────
-- Returns one row per target id with per-type counts + the caller's own set.
create or replace function public.get_object_reactions_batch(
  p_target_type text,
  p_target_ids uuid[]
)
returns table (
  target_id uuid,
  counts jsonb,
  mine jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.tid as target_id,
    coalesce((
      select jsonb_object_agg(reaction, n)
      from (
        select reaction, count(*)::int as n
        from object_reactions r
        where r.target_type = p_target_type and r.target_id = t.tid
        group by reaction
      ) c
    ), '{}'::jsonb) as counts,
    coalesce((
      select jsonb_agg(reaction)
      from object_reactions r
      where r.target_type = p_target_type and r.target_id = t.tid
        and r.user_id = auth.uid()
    ), '[]'::jsonb) as mine
  from unnest(coalesce(p_target_ids, '{}')) as t(tid);
$$;
grant execute on function public.get_object_reactions_batch(text, uuid[]) to authenticated;
