-- 087 — Team Picks teaser for free-tier families
--
-- Free families see the FULL pick grid (live prices — it must look alive), but
-- detail pages are gated: the ONE free pick (the seeded AAPL) is the full
-- experience; every other pick shows logo/price/headline then a locked thesis +
-- "unlock with FIC" CTA. The gate is SERVER-ENFORCED — thesis_long (and the rest
-- of the guidance) is never shipped to a free client for a locked pick. CSS
-- blur alone would leak the text in the payload.
--
-- Mechanism: `is_free` on fic_picks + a SECURITY DEFINER RPC `pick_detail` that
-- strips the guidance fields for a locked (viewer=free AND pick not free) pick
-- before they leave the database. The grid never selects thesis, so it needs no
-- RPC — trimming its select is enough.

alter table fic_picks add column if not exists is_free boolean not null default false;

-- The seeded, published AAPL pick is the free sampler pick.
update fic_picks set is_free = true
where id = '0f9b5e1f-c23c-45cb-ba9c-c29e202b61ec';

-- ── pick_detail(p_id) — the server-enforced detail read ──────────────────────
-- Returns the pick's public fields always, and the GUIDANCE fields
-- (thesis_short, thesis_long, video, article_links, closed_note) only when the
-- viewer may see them. `locked` tells the client to render the upsell instead of
-- the (nulled) guidance. SECURITY DEFINER, so it also re-enforces the published-
-- only visibility that fic_picks RLS gives non-admins.
create or replace function public.pick_detail(p_id uuid)
returns table (
  id            uuid,
  ticker        text,
  company_name  text,
  status        text,
  headline      text,
  thesis_short  text,
  thesis_long   text,
  picked_at     date,
  picked_price  numeric,
  video_path    text,
  video_kind    text,
  article_links jsonb,
  tags          text[],
  created_by    uuid,
  closed_note   text,
  created_at    timestamptz,
  updated_at    timestamptz,
  is_free       boolean,
  locked        boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_role  text;
  v_tier  text;
  v_free  boolean;
  v_p     fic_picks%rowtype;
  v_lock  boolean;
begin
  if v_uid is null then
    return;
  end if;

  select p.* into v_p from fic_picks p where p.id = p_id;
  if not found then
    return;
  end if;

  select role into v_role from profiles where profiles.id = v_uid;

  -- Non-admins only see published picks (mirrors the fic_picks RLS read policy).
  if v_p.status = 'draft' and coalesce(v_role, '') <> 'admin' then
    return;
  end if;

  -- Viewer tier (free is the only gated tier). family_tiers view (029/060).
  select ft.tier into v_tier
  from family_tiers ft
  where ft.family_id = (select family_id from profiles where profiles.id = v_uid);
  v_free := coalesce(v_tier, 'fic') = 'free';

  -- Locked = a free viewer looking at a pick that is not the free sampler pick.
  v_lock := v_free and not coalesce(v_p.is_free, false);

  return query select
    v_p.id,
    v_p.ticker,
    v_p.company_name,
    v_p.status,
    v_p.headline,                                             -- headline shown even when locked
    case when v_lock then null else v_p.thesis_short end,
    case when v_lock then null else v_p.thesis_long end,
    v_p.picked_at,
    v_p.picked_price,
    case when v_lock then null else v_p.video_path end,
    case when v_lock then null else v_p.video_kind end,
    case when v_lock then '[]'::jsonb else v_p.article_links end,
    v_p.tags,
    v_p.created_by,
    case when v_lock then null else v_p.closed_note end,
    v_p.created_at,
    v_p.updated_at,
    coalesce(v_p.is_free, false),
    v_lock;
end;
$$;

grant execute on function public.pick_detail(uuid) to authenticated;
