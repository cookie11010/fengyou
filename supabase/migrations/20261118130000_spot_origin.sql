-- =============================================================================
-- FengYou: official vs. community places
--
-- The map now shows who a place comes from:
--   official   picked and written up by the FengYou team (the default)
--   community  added by a signed-in user with "Add a spot"
-- add_community_spot always writes 'community', so a user can't make their
-- place look official. Editors can still change it, e.g. to adopt a good
-- community spot as an official one.
-- =============================================================================

create type public.spot_origin as enum ('official', 'community');

alter table public.destinations
  add column origin public.spot_origin not null default 'official';

-- Spots already added through the form before this column existed.
update public.destinations set origin = 'community' where source_note = 'Community submission';

-- Same function as before, now also recording origin = 'community'.
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
    (slug, category, status, origin, latitude, longitude, author_id, source_note, last_verified_on)
  values
    ('spot-' || replace(gen_random_uuid()::text, '-', ''), p_category, 'published', 'community',
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

-- Authors may edit their own drafts, but only editors decide what is official.
-- (No signed-in user means a direct database session, e.g. the SQL editor.)
create function public.protect_destination_origin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.origin is distinct from old.origin and auth.uid() is not null and not public.is_editor() then
    new.origin := old.origin;
  end if;
  return new;
end;
$$;

create trigger destinations_protect_origin
  before update of origin on public.destinations
  for each row execute function public.protect_destination_origin();
