-- ============================================================================
-- 133 — Challenge VIP Ticket ($197) (Lane C9)
--
-- The 5-Day Investing Challenge gains a paid VIP tier ($197) that is ADDITIVE
-- to the free, no-card challenge pass:
--   • a printed textbook (fulfilled through the existing Lulu shop lane), plus
--   • the first month of Cheat Code Club included (a $99/mo subscription with a
--     30-day trial started at checkout — reminder 3 days before the first
--     charge, cancel in one click), plus
--   • a private VIP room during the challenge window.
--
-- The FREE path is UNCHANGED — everything here is new surface, gated off until
-- the owner flips 'challenge_vip_enabled'.
--
-- Pieces:
--   1. challenge_vips — one row per VIP purchase (idempotent by stripe_session).
--      The tier=vip marker: VIP-room access + the textbook order + the VIP email
--      steps all key off a row here. Club access itself is a normal 'fic'
--      enrollment (provisioned by the webhook), so family_tiers/TIER_ACCESS need
--      no change; challenge_vips is a thin overlay for the VIP-only extras.
--   2. shop_products seed — the printed textbook the VIP order fulfills. Ships
--      with no Lulu package/PDFs yet, so attemptFulfillment() degrades to the
--      existing 'awaiting_fulfillment_setup' manual queue in /admin/shop until
--      the owner uploads the print files + package id (then it auto-fulfills).
--   3. app_settings 'challenge_vip_enabled' (DEFAULT false) — the hard gate for
--      the LIVE VIP checkout path. The button + endpoint exist but refuse until
--      the owner has verified a test-mode checkout and flips this to true.
--   4. admin_challenge_vip_stats() — a small admin-gated RPC for the C7 cohort
--      dashboard (VIP count, textbook fulfillment states).
--
-- All writes to challenge_vips happen via the service role (Stripe webhook). RLS:
-- a member may read their OWN family's VIP row (powers client VIP-room gating);
-- admins read all.
-- ============================================================================

-- ── 1. challenge_vips ────────────────────────────────────────────────────────
create table if not exists challenge_vips (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references profiles(id) on delete set null,
  family_id           uuid references families(id) on delete cascade,
  email               text,
  stripe_session      text unique,            -- idempotency key (webhook retries)
  stripe_subscription text,
  amount_total        int,                    -- cents actually charged
  shipping            jsonb,                  -- normalized shipping snapshot
  textbook_order_id   uuid references shop_orders(id) on delete set null,
  club_until          timestamptz,            -- informational: trial/first-month end
  created_at          timestamptz not null default now()
);

create index if not exists idx_challenge_vips_family on challenge_vips (family_id);
create index if not exists idx_challenge_vips_user   on challenge_vips (user_id);

alter table challenge_vips enable row level security;
grant select on challenge_vips to authenticated;

drop policy if exists "challenge_vips own or admin read" on challenge_vips;
create policy "challenge_vips own or admin read" on challenge_vips
  for select using (
    family_id in (select family_id from profiles where id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── 2. textbook shop product (idempotent seed) ───────────────────────────────
-- The printed textbook the VIP ticket ships. No Lulu package/PDFs yet ⇒ orders
-- land in the /admin/shop manual queue as 'awaiting_fulfillment_setup'. Once the
-- owner sets lulu_pod_package_id + interior/cover PDFs, fulfillment auto-runs.
insert into shop_products (slug, title, subtitle, description, audience, kind, price_cents, active, sort)
values (
  'challenge-textbook',
  'The Investing Textbook',
  'The printed companion to the 5-Day Investing Challenge',
  'A physical, printed textbook that walks through everything the challenge covers — foundations, research, the community method, and building your own repeatable loop. Included with the VIP ticket. Education, not financial advice.',
  'family',
  'textbook',
  0,
  true,
  0
)
on conflict (slug) do nothing;

-- ── 3. LIVE VIP checkout gate (DEFAULT false — off until owner verifies) ─────
insert into app_settings (key, value)
values ('challenge_vip_enabled', 'false'::jsonb)
on conflict (key) do nothing;

-- ── 3b. vip_room_posts — the private VIP room feed (isolated from community) ──
-- A dedicated, self-contained space so VIP content can never bleed into the main
-- community feed. RLS is ON with NO client policies: all reads/writes go through
-- the gated /api/challenge/vip-room routes (service role, after a VIP check),
-- mirroring the funnel_sessions pattern.
create table if not exists vip_room_posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid references profiles(id) on delete set null,
  family_id  uuid references families(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_vip_room_posts_created on vip_room_posts (created_at desc);
alter table vip_room_posts enable row level security;

-- ── 4. admin VIP stats RPC (admin-gated) ─────────────────────────────────────
create or replace function admin_challenge_vip_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;

  select jsonb_build_object(
    'total', (select count(*) from challenge_vips),
    'revenue_cents', coalesce((select sum(amount_total) from challenge_vips), 0),
    'textbook_orders', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        select o.id, o.email, o.customer_name, o.status, o.error,
               o.lulu_job_id, o.created_at
        from shop_orders o
        where o.id in (select textbook_order_id from challenge_vips where textbook_order_id is not null)
      ) t
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        select v.email, v.created_at, v.amount_total, v.club_until,
               v.textbook_order_id, o.status as textbook_status
        from challenge_vips v
        left join shop_orders o on o.id = v.textbook_order_id
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;
grant execute on function admin_challenge_vip_stats() to authenticated;
