-- =============================================================================
-- FengYou: story photos + open community posting
--
-- Part 1 records the story-photo setup that was first made by hand in the
-- production database (stories.images, the 'story-images' bucket and its
-- checks), so a fresh database built from these files matches production.
-- Every statement in part 1 is safe to run on a database that already has it.
--
-- Part 2 opens posting up. ANYONE WHO IS SIGNED IN can now:
--   * share a story or tip with up to 3 photos. It is public at once.
--   * add a new spot to the map (with an optional cover photo). Public at once.
-- Editors keep the final say: they can still archive any story or spot and
-- hide any comment.
-- =============================================================================


-- =============================================================================
-- Part 1: story photos (as already in production)
-- =============================================================================

-- Up to 3 photos per story: [{"path": "<author id>/<uuid>.jpg", "alt": "..."}]
alter table public.stories
  add column if not exists images jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stories_images_check'
                 and conrelid = 'public.stories'::regclass) then
    alter table public.stories add constraint stories_images_check
      check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 3);
  end if;
end;
$$;

-- Each photo must be a file the author uploaded to their own folder. Also
-- drops any extra keys, so only {path, alt} is ever stored.
create or replace function public.check_story_images()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
  cleaned jsonb := '[]'::jsonb;
begin
  for item in select * from jsonb_array_elements(new.images) loop
    if jsonb_typeof(item) <> 'object'
       or coalesce(item->>'path', '') !~ ('^' || new.author_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
    then
      raise exception 'Each photo must be one of your own uploaded files.' using errcode = 'check_violation';
    end if;
    if length(coalesce(item->>'alt', '')) > 200 then
      raise exception 'A photo description can be at most 200 characters.' using errcode = 'check_violation';
    end if;
    cleaned := cleaned || jsonb_build_array(jsonb_build_object(
      'path', item->>'path',
      'alt',  nullif(trim(coalesce(item->>'alt', '')), '')
    ));
  end loop;
  new.images := cleaned;
  return new;
end;
$$;

drop trigger if exists stories_check_images on public.stories;
create trigger stories_check_images
  before insert or update of images, author_id on public.stories
  for each row execute function public.check_story_images();

-- At most 5 stories per person waiting for review (only matters for stories
-- that are sent for review rather than published straight away).
create or replace function public.limit_pending_stories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'in_review'
     and (tg_op = 'INSERT' or old.status is distinct from 'in_review')
     and not public.is_editor()
     and (select count(*) from public.stories s
          where s.author_id = new.author_id and s.status = 'in_review' and s.id <> new.id) >= 5
  then
    raise exception 'You already have 5 stories waiting for review. Please wait for a teacher to review them.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists stories_limit_pending on public.stories;
create trigger stories_limit_pending
  before insert or update of status on public.stories
  for each row execute function public.limit_pending_stories();

-- The bucket for story photos: public to view, 5 MB per photo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-images', 'story-images', true, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Users upload story photos to their own folder" on storage.objects;
create policy "Users upload story photos to their own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'story-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users see their own story photo files" on storage.objects;
create policy "Users see their own story photo files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'story-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete their own story photos" on storage.objects;
create policy "Users delete their own story photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'story-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Editors manage story photos" on storage.objects;
create policy "Editors manage story photos"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'story-images' and (select public.is_editor()))
  with check (bucket_id = 'story-images' and (select public.is_editor()));


-- =============================================================================
-- Part 2: open community posting
-- =============================================================================

-- Stories: anyone signed in may publish directly (photos are checked above).
-- The old insert policy had a different name in this repo and in production.
drop policy if exists "Contributors submit stories about published places" on public.stories;
drop policy if exists "Signed-in users submit stories about published places" on public.stories;

create policy "Signed-in users share stories about published places"
  on public.stories for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and status in ('draft', 'in_review', 'published')
    and exists (select 1 from public.destinations d where d.id = destination_id and d.status = 'published')
  );

-- Spot cover photos go in the 'media' bucket: any signed-in user may upload
-- into their own folder there too.
drop policy if exists "Contributors upload to their own media folder" on storage.objects;
drop policy if exists "Signed-in users upload to their own media folder" on storage.objects;

create policy "Signed-in users upload to their own media folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );


-- -----------------------------------------------------------------------------
-- Public names: anyone who has published something or commented
-- -----------------------------------------------------------------------------
-- Visitors can now publish, so the role filter goes. Still only name + avatar,
-- and still only people with something public.
create or replace view public.author_profiles
with (security_invoker = false)
as
  select p.id, p.display_name, p.avatar_url
  from public.profiles p
  where exists (select 1 from public.destinations d where d.author_id = p.id and d.status = 'published')
     or exists (select 1 from public.stories s where s.author_id = p.id and s.status = 'published')
     or exists (
       select 1
       from public.story_comments c
       join public.stories s on s.id = c.story_id
       where c.author_id = p.id and c.status = 'visible' and s.status = 'published'
     );


-- -----------------------------------------------------------------------------
-- add_community_spot: add a place to the map in one step
-- -----------------------------------------------------------------------------
-- A public place needs three rows (destination, a reviewed translation, and
-- optionally a cover photo) and some of them have checks that only editors may
-- satisfy. This function does all of it atomically after validating every
-- input itself. SECURITY DEFINER, so every check below matters.
-- Returns the new destination's id.
create or replace function public.add_community_spot(
  p_name       text,
  p_summary    text,
  p_category   public.destination_category,
  p_latitude   double precision,
  p_longitude  double precision,
  p_locale     text,
  p_address    text default null,
  p_image_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_name  text := trim(p_name);
  v_sum   text := trim(p_summary);
  v_addr  text := nullif(trim(p_address), '');
  v_dest  uuid;
  v_media uuid;
begin
  if v_user is null then
    raise exception 'Sign in to add a spot' using errcode = '42501';
  end if;
  if v_name is null or length(v_name) not between 1 and 80 then
    raise exception 'Name must be 1-80 characters' using errcode = '22023';
  end if;
  if v_sum is null or length(v_sum) not between 10 and 500 then
    raise exception 'Description must be 10-500 characters' using errcode = '22023';
  end if;
  if v_addr is not null and length(v_addr) > 200 then
    raise exception 'Address must be at most 200 characters' using errcode = '22023';
  end if;
  -- Taiwan and its outlying islands, so a typo doesn't put a pin in the ocean.
  if p_latitude is null or p_longitude is null
     or p_latitude not between 21.5 and 26.5 or p_longitude not between 118 and 122.5 then
    raise exception 'The location must be in Taiwan' using errcode = '22023';
  end if;
  if not exists (select 1 from public.locales l where l.code = p_locale and l.is_enabled) then
    raise exception 'Unsupported language' using errcode = '22023';
  end if;
  if p_image_path is not null
     and p_image_path !~ ('^' || v_user::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then
    raise exception 'The photo must be one you uploaded' using errcode = '42501';
  end if;
  -- Simple flood protection.
  if (select count(*) from public.destinations d
      where d.author_id = v_user and d.created_at > now() - interval '1 day') >= 20 then
    raise exception 'You have added a lot of spots today. Please try again tomorrow' using errcode = '54000';
  end if;

  insert into public.destinations
    (slug, category, status, latitude, longitude, author_id, source_note, last_verified_on)
  values
    ('spot-' || replace(gen_random_uuid()::text, '-', ''), p_category, 'published',
     p_latitude, p_longitude, v_user, 'Community submission', current_date)
  returning id into v_dest;

  insert into public.destination_translations
    (destination_id, locale, name, summary, address,
     translation_status, translated_by, reviewed_by, reviewed_at)
  values
    (v_dest, p_locale, v_name, v_sum, v_addr, 'reviewed', v_user, v_user, now());

  if p_image_path is not null then
    insert into public.media (destination_id, media_type, storage_path, alt_text, uploaded_by)
    values (v_dest, 'image', p_image_path, jsonb_build_object(p_locale, v_name), v_user)
    returning id into v_media;
    update public.destinations set cover_media_id = v_media where id = v_dest;
  end if;

  return v_dest;
end;
$$;

revoke execute on function public.add_community_spot(text, text, public.destination_category, double precision, double precision, text, text, text) from public, anon;
grant execute on function public.add_community_spot(text, text, public.destination_category, double precision, double precision, text, text, text) to authenticated;
