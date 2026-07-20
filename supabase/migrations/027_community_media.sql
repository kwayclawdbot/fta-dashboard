-- ============================================
-- 027 — Community media: image + video attachments on chat messages.
--
-- chat_messages gains attachment columns; content becomes optional so
-- media-only posts work (client enforces "text or attachment" on send;
-- a NOT VALID check documents the invariant for new rows without
-- risking failure on legacy data).
--
-- Storage: public-read `community-media` bucket. Object names are
-- {uid}/{uuid}.{ext} — uuid-random so unguessable. INSERT is restricted
-- to authenticated users writing under their OWN uid prefix. DELETE is
-- owner (uid prefix) or admin (profiles.role = 'admin', same check
-- pattern as 004_admin_policies.sql / 026_class_recordings.sql).
--
-- RLS lesson from 018/019 still applies: Realtime cannot authorize
-- subquery-based SELECT policies on chat_messages. Nothing here touches
-- the simple "Read community messages" SELECT policy; new policies are
-- INSERT/DELETE only (never evaluated by Realtime delivery).
-- ============================================

-- 1. Attachment columns
alter table chat_messages add column if not exists attachment_url text;
alter table chat_messages add column if not exists attachment_type text
  check (attachment_type in ('image', 'video'));
alter table chat_messages add column if not exists attachment_meta jsonb;

-- 2. Media-only posts: content no longer required, defaults to ''
alter table chat_messages alter column content drop not null;
alter table chat_messages alter column content set default '';

-- New rows must carry text or an attachment (NOT VALID: skips legacy rows)
alter table chat_messages drop constraint if exists chat_messages_content_or_attachment;
alter table chat_messages add constraint chat_messages_content_or_attachment
  check (coalesce(content, '') <> '' or attachment_url is not null) not valid;

-- Attachment url and type travel together
alter table chat_messages drop constraint if exists chat_messages_attachment_pair;
alter table chat_messages add constraint chat_messages_attachment_pair
  check ((attachment_url is null) = (attachment_type is null)) not valid;

-- 3. Admins can delete any chat message (moderation — kids use this space)
drop policy if exists "Admins delete chat messages" on chat_messages;
create policy "Admins delete chat messages" on chat_messages
  for delete to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- 4. Bucket: public-read, 50 MB cap (project-wide upload cap is also 50 MB;
--    the client enforces 10 MB images / 50 MB videos with friendly errors)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media',
  'community-media',
  true,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 5. storage.objects RLS for community-media

-- Authenticated read (public bucket already serves anonymous GETs on
-- /object/public/…; this lets signed-in clients use the Storage API too)
drop policy if exists "community_media_member_read" on storage.objects;
create policy "community_media_member_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'community-media');

-- Upload only under your own uid prefix: {uid}/{uuid}.{ext}
drop policy if exists "community_media_own_prefix_insert" on storage.objects;
create policy "community_media_own_prefix_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: owner (uid prefix) or admin
drop policy if exists "community_media_owner_admin_delete" on storage.objects;
create policy "community_media_owner_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );
