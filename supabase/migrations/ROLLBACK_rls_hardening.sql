-- ROLLBACK for the RLS hardening (migrations 039 + 040).
-- One command restores the pre-hardening state: RLS OFF on all 9 legacy tables.
-- The policies + helper functions from 039 are left in place (they are inert while
-- RLS is disabled, exactly as they were before this work). This is the fast
-- "app is broken, get it back NOW" lever — run the whole block.
--
-- Apply via Supabase MCP execute_sql / apply_migration, or psql:
--   psql "$DATABASE_URL" -f supabase/migrations/ROLLBACK_rls_hardening.sql

begin;

alter table public.profiles        disable row level security;
alter table public.families        disable row level security;
alter table public.family_invites  disable row level security;
alter table public.lesson_progress disable row level security;
alter table public.lessons         disable row level security;
alter table public.modules         disable row level security;
alter table public.courses         disable row level security;
alter table public.badges          disable row level security;
alter table public.user_badges     disable row level security;

commit;

-- Verify (all 9 should read rls_enabled = false):
--   select relname, relrowsecurity from pg_class
--   where relnamespace = 'public'::regnamespace
--     and relname in ('profiles','families','family_invites','lesson_progress',
--                     'lessons','modules','courses','badges','user_badges');
--
-- NOTE: this does NOT restore the two dropped recursive policies
-- (admins_select_profiles / admins_update_profiles). They were redundant/broken and
-- are intentionally not brought back. To also revert the app code, redeploy the git
-- commit prior to the RLS-hardening changes (signup/invite + community pages).
