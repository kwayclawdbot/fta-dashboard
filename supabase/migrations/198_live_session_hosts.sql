-- ============================================================================
-- 198 — LIVE SESSION HOSTS (lane M6)
--
-- WHY: /live-sessions rendered "Hosted by Coach" for every class in the app.
-- `live_sessions` has no host column, so the page hardcoded
--   host: "Coach", hostAvatar: "C"
-- and painted it as if it came from the record. That is a fabricated value on a
-- real surface — the exact thing the adoption plan forbids. This migration adds
-- the real columns so the host line is either TRUE or ABSENT.
--
-- Deliberately nullable with NO backfill: we do not know who hosted the
-- historical rows, and inventing "Coach" in the database would only move the
-- fabrication one layer down. A null host renders no host line at all.
--
-- `host_title` is the role beside the name ("Coach", "Guest speaker"); it is
-- only rendered when a host_name exists, so it can never stand in for one.
-- ============================================================================

alter table live_sessions add column if not exists host_name text;
alter table live_sessions add column if not exists host_title text;
alter table live_sessions add column if not exists host_avatar_url text;

comment on column live_sessions.host_name is
  'Who runs the class. NULL = unknown; the UI renders no host line rather than a placeholder.';
comment on column live_sessions.host_title is
  'Role shown beside host_name (Coach, Guest speaker). Only rendered when host_name is present.';
comment on column live_sessions.host_avatar_url is
  'Optional host portrait. Falls back to initials derived from host_name.';
