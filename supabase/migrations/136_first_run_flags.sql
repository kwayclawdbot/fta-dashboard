-- 136 — Per-profile first-run flags (unified FirstRun layer)
--
-- Bug: every first-run moment (tour, add-to-home-screen, push opt-in) was gated
-- on DEVICE localStorage (fic-tour-v, fic-push-last-prompt, …). A second account
-- on a device that already completed first-run — the invite case, where an
-- invitee signs up on a family member's phone — was silently suppressed across
-- the board: no walkthrough, no install hint, no push prompt.
--
-- Fix: move first-run state onto the PROFILE. tour_completed_at already exists
-- (migration 041); add the two missing markers so the FirstRun orchestrator can
-- key every step per-user, on any device, for every account-creation path.
--
--   install_prompted_at — the add-to-home-screen step was shown (or silently
--                         skipped: standalone/unsupported). NULL = never shown.
--   push_prompted_at    — the push pre-prompt was shown and resolved (enabled or
--                         declined). NULL = never shown. (Kid profiles are never
--                         prompted; parents manage.)
--
-- Legacy users (these columns NULL but the account predates the feature) are
-- gated by account age in the app: > 7 days → skip install/push silently. The
-- tour keeps its own marker (tour_completed_at), so anyone who already toured is
-- never re-toured; only genuinely-never-toured profiles (the suppressed invitees)
-- get it now.

alter table profiles add column if not exists install_prompted_at timestamptz;
alter table profiles add column if not exists push_prompted_at    timestamptz;
