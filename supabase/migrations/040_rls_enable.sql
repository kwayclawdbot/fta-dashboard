-- 040 — RLS hardening (Part B): flip ENABLE ROW LEVEL SECURITY on the 9 legacy
-- tables. Apply ONLY AFTER 039 is applied AND the app code that uses invite_details/
-- redeem_invite/community_family_count has deployed (so no live surface still does an
-- anon .from() read against these tables). All policies are already in place from 039,
-- so this migration only changes enforcement — it does not add a window of exposure.
-- Rollback: supabase/migrations/ROLLBACK_rls_hardening.sql

alter table public.profiles        enable row level security;
alter table public.families        enable row level security;
alter table public.family_invites  enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.lessons         enable row level security;
alter table public.modules         enable row level security;
alter table public.courses         enable row level security;
alter table public.badges          enable row level security;
alter table public.user_badges     enable row level security;
