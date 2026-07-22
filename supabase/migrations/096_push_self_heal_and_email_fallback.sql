-- ============================================
-- 096 — Push self-heal columns + email-fallback queue.
--
-- Two independent pieces, both in service of "notifications reach every user
-- with zero user effort":
--
-- 1. push_subscriptions gains liveness/identity columns so the client can
--    self-heal silently and the server can prune the truly dead:
--      last_seen_at  — bumped every heal-check + resubscribe (client-driven).
--      device_label  — human label parsed from the UA ("iPhone · Safari") for
--                      the Settings device list + per-device remove.
--    Existing rows backfill last_seen_at = created_at so nothing looks stale
--    on day one. Dispatch (028) already prunes 404/410 on send; the client
--    heal path adds proactive re-subscribe, and a >60-day last_seen sweep
--    (run from the dispatch route) drops abandoned devices.
--
-- 2. notification_email_queue — the email FALLBACK lane. For high-value
--    notification types ONLY (announcement, broadcast, new_lesson,
--    recording_posted), the dispatch route enqueues a row here when the
--    recipient has ZERO push subscriptions, so those users still get reached.
--    A processor route (/api/push/email-fallback) reuses the marketing Resend
--    single-send path to deliver and marks status. While the Resend domain is
--    unverified every send records status='failed' with the 403 captured —
--    the pipeline is complete and starts delivering the moment the domain
--    verifies, still with no user action required.
--
-- Service-role only: neither piece is client-writable beyond the existing
-- owner-only push_subscriptions policy (028). The queue has no user policies.
-- ============================================

-- 1. push_subscriptions liveness + identity
alter table push_subscriptions
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists device_label text;

-- Backfill: existing rows were last "seen" when created (one-time, all rows).
update push_subscriptions set last_seen_at = created_at;

create index if not exists idx_push_subscriptions_last_seen
  on push_subscriptions(last_seen_at);

-- 2. notification_email_queue — fallback lane for zero-push-subscription users
create table if not exists notification_email_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  notification_id uuid references notifications(id) on delete set null,
  type text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Only ever one email per (notification, user) — dispatch may fire more than
-- once (pg_net retries, manual sweep). The partial unique index de-dupes on the
-- notification while still allowing many rows with a null notification_id.
create unique index if not exists uq_email_queue_notification_user
  on notification_email_queue(notification_id, user_id)
  where notification_id is not null;

create index if not exists idx_email_queue_queued
  on notification_email_queue(created_at)
  where status = 'queued';

alter table notification_email_queue enable row level security;
-- No policies: service role only (dispatch + processor). Users never touch it.
revoke all on notification_email_queue from authenticated, anon;
