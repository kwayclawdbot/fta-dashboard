-- 041: first-login app tour completion flag (AppTour component).
-- profiles UPDATE-own-row policy (039) already covers writes.
alter table public.profiles add column if not exists tour_completed_at timestamptz;
