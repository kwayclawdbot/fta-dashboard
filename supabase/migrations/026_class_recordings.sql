-- ============================================
-- Class recordings: private storage bucket + live_sessions columns.
--
-- The owner records live Zoom classes and uploads them so members can
-- watch in-app. Recordings live in the PRIVATE `class-recordings` bucket
-- (members stream via short-lived signed URLs), or externally
-- (YouTube unlisted / other host) via recording_url.
--
--   recording_path  storage object path inside class-recordings
--                   (e.g. sessions/{sessionId}/{filename})
--   recording_kind  'upload'   -> stream from bucket via signed URL
--                   'youtube'  -> privacy-enhanced youtube-nocookie embed
--                   'external' -> open recording_url in a new tab
-- ============================================

-- 1. Recording columns on live_sessions
alter table live_sessions add column if not exists recording_path text;
alter table live_sessions add column if not exists recording_kind text
  check (recording_kind in ('upload', 'youtube', 'external'));

-- 2. Teens are a first-class content track everywhere else (modules,
--    profiles — see 013); let live sessions target them too.
alter table live_sessions drop constraint if exists live_sessions_track_check;
alter table live_sessions add constraint live_sessions_track_check
  check (track in ('kids', 'teens', 'adults', 'all'));

-- 3. Private bucket. file_size_limit 2 GiB (effective cap is
--    min(bucket limit, project-wide upload limit in project settings)).
insert into storage.buckets (id, name, public, file_size_limit)
values ('class-recordings', 'class-recordings', false, 2147483648)
on conflict (id) do nothing;

-- 4. storage.objects RLS.
--    Members (any authenticated user) can read -> signed URL playback.
--    Only admins (profiles.role = 'admin', same check as 004) can write.
drop policy if exists "class_recordings_member_read" on storage.objects;
create policy "class_recordings_member_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'class-recordings');

drop policy if exists "class_recordings_admin_insert" on storage.objects;
create policy "class_recordings_admin_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'class-recordings'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "class_recordings_admin_update" on storage.objects;
create policy "class_recordings_admin_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'class-recordings'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  )
  with check (
    bucket_id = 'class-recordings'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "class_recordings_admin_delete" on storage.objects;
create policy "class_recordings_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'class-recordings'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );
