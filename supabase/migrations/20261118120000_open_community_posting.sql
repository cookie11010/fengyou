-- =============================================================================
-- FengYou: open community posting
--
-- Until now only student contributors could write, and every story waited
-- for a teacher. From here on, ANYONE WHO IS SIGNED IN can:
--   * share a story or tip, with an optional photo. It is public at once.
--   * add a new spot to the map (with an optional cover photo). Public at once.
--   * upload photos into their own folder of the 'media' bucket.
-- Editors keep the final say: they can still archive any story or spot and
-- hide any comment, so the moderation tools all keep working.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Stories: optional photo, and anyone signed in may publish directly
-- -----------------------------------------------------------------------------
alter table public.stories
  add column image_path text
    -- '<uploader uuid>/<file name>' inside the 'media' bucket
    check (image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,120}$');

drop policy "Contributors submit stories about published places" on public.stories;

create policy "Signed-in users share stories about published places"
  on public.stories for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and status in ('draft', 'in_review', 'published')
    and exists (select 1 from public.destinations d where d.id = destination_id and d.status = 'published')
    -- a photo must be one the author uploaded themselves
    and (image_path is null or split_part(image_path, '/', 1) = (select auth.uid())::text)
  );


-- -----------------------------------------------------------------------------
-- Storage: every signed-in user may upload into their own folder
-- -----------------------------------------------------------------------------
drop policy "Contributors upload to their own media folder" on storage.objects;

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
create function public.add_community_spot(
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
  if p_image_path is not null and (
       split_part(p_image_path, '/', 1) <> v_user::text
       or p_image_path !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'
     ) then
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
