-- =============================================================================
-- FengYou: Supabase Storage for media files
--
-- public.media stores metadata; the files themselves go in the 'media'
-- bucket. Each contributor uploads into a folder named after their user id:
--   media/<user uuid>/<file name>
-- so "is this my file?" is a simple path check.
--
-- Trade-off: the bucket is PUBLIC, so anyone with a file's URL can view it
-- (fast CDN delivery, no signed URLs). Listing and writing are still
-- controlled by the policies below. Don't upload anything private here.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  20 * 1024 * 1024,  -- 20 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'audio/mpeg']
)
on conflict (id) do nothing;

create policy "Contributors upload to their own media folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_contributor())
  );

create policy "Contributors update files in their own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Contributors delete files in their own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Editors manage all media files"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'media' and (select public.is_editor()))
  with check (bucket_id = 'media' and (select public.is_editor()));
