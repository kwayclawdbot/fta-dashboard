-- ============================================================================
-- 065 — Shop: physical products (books/bundles) + Lulu print-on-demand orders.
--
-- Public storefront reads shop_products / shop_bundle_items (RLS: active only).
-- Orders + order_items are SERVICE-SIDE ONLY (RLS on, zero client policies) —
-- written by the Stripe shop webhook and read by the admin console via the
-- service role. Print-ready PDFs live in a PRIVATE `print-files` bucket; Lulu
-- pulls them via short-lived service-side signed URLs.
-- ============================================================================

-- ── Catalog ────────────────────────────────────────────────────────────────
create table if not exists public.shop_products (
  id                 uuid primary key default gen_random_uuid(),
  slug               text unique not null,
  title              text not null,
  subtitle           text,
  description        text,
  audience           text check (audience in ('kids','teens','adults','family')),
  kind               text check (kind in ('textbook','guidebook','workbook','lesson_plans','teacher_guide','bundle')),
  price_cents        integer not null,
  compare_at_cents   integer,
  cover_image_path   text,
  gallery            jsonb not null default '[]'::jsonb,
  lulu_pod_package_id text,
  interior_pdf_path  text,
  cover_pdf_path     text,
  page_count         integer,
  active             boolean not null default false,
  sort               integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists shop_products_active_sort_idx on public.shop_products (active, sort);
create index if not exists shop_products_kind_idx on public.shop_products (kind);

-- Bundle membership: which products a bundle contains.
create table if not exists public.shop_bundle_items (
  id          uuid primary key default gen_random_uuid(),
  bundle_id   uuid not null references public.shop_products(id) on delete cascade,
  product_id  uuid not null references public.shop_products(id) on delete cascade,
  sort        integer not null default 0,
  unique (bundle_id, product_id)
);
create index if not exists shop_bundle_items_bundle_idx on public.shop_bundle_items (bundle_id);

-- ── Orders (service-side only) ──────────────────────────────────────────────
create table if not exists public.shop_orders (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  customer_name     text,
  stripe_session_id text unique not null,
  amount_total      integer,
  currency          text not null default 'usd',
  shipping          jsonb,
  status            text not null default 'paid'
                      check (status in ('paid','submitted','in_production','shipped','canceled','fulfillment_error')),
  lulu_job_id       text,
  lulu_status       jsonb,
  tracking          jsonb,
  error             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists shop_orders_status_idx on public.shop_orders (status);
create index if not exists shop_orders_created_idx on public.shop_orders (created_at desc);

create table if not exists public.shop_order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.shop_orders(id) on delete cascade,
  product_id uuid references public.shop_products(id),
  quantity   integer not null default 1,
  unit_cents integer not null
);
create index if not exists shop_order_items_order_idx on public.shop_order_items (order_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.shop_products     enable row level security;
alter table public.shop_bundle_items enable row level security;
alter table public.shop_orders       enable row level security;
alter table public.shop_order_items  enable row level security;

-- Storefront: anyone (anon + signed-in) can read ACTIVE products.
drop policy if exists "shop_products_public_read" on public.shop_products;
create policy "shop_products_public_read" on public.shop_products
  for select to anon, authenticated
  using (active = true);

-- Bundle membership rows for active bundles are readable so the bundle page can
-- list what's inside. (Only reveals product↔bundle links; product visibility is
-- still gated by shop_products.active above.)
drop policy if exists "shop_bundle_items_public_read" on public.shop_bundle_items;
create policy "shop_bundle_items_public_read" on public.shop_bundle_items
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.shop_products p
      where p.id = shop_bundle_items.bundle_id and p.active = true
    )
  );

-- shop_orders + shop_order_items: NO client policies. RLS-on with zero policies
-- means anon/authenticated get nothing; only the service role (bypasses RLS)
-- touches them, via the webhook + admin API.

-- ── Private print-file bucket (interior + cover PDFs for Lulu) ───────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'print-files',
  'print-files',
  false,
  524288000, -- 500 MB (print interiors can be large)
  array['application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Admins manage print files directly from the console (service role also has
-- full access for signed-URL minting, bypassing RLS).
drop policy if exists "print_files_admin_read" on storage.objects;
create policy "print_files_admin_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'print-files'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "print_files_admin_write" on storage.objects;
create policy "print_files_admin_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'print-files'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "print_files_admin_update" on storage.objects;
create policy "print_files_admin_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'print-files'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "print_files_admin_delete" on storage.objects;
create policy "print_files_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'print-files'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Admins can also write shop cover art into the existing public community-media
-- bucket under the shop/ prefix (community-media's default insert policy is
-- uid-prefixed; this adds an admin-only escape hatch for shop assets).
drop policy if exists "community_media_admin_shop_write" on storage.objects;
create policy "community_media_admin_shop_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = 'shop'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );
