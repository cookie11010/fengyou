-- =============================================================================
-- FengYou: several trips per person, and talk on each place
--
-- Part 1  TRIPS. A person used to have exactly one itinerary. Now they can
--         keep several trips, each with a name and a date range
--         (start_date to end_date, both optional). A trip can be made from a
--         half-day route in one step.
-- Part 2  PLACE TALK. Each place gets its own page with two kinds of posts:
--           comment  a discussion thread ("Is it open on Mondays?")
--           food     a food tip: what to eat there ("Pork-ball soup, NT$60")
--         Anyone can read them; anyone signed in can post; editors can hide.
-- =============================================================================


-- =============================================================================
-- Part 1: several trips per person
-- =============================================================================

-- One person may now own many itineraries.
alter table public.itineraries drop constraint if exists itineraries_owner_id_key;

-- A trip runs from start_date to end_date (one-day trip: the same date twice).
-- trip_date is the old single date. It stays (and is kept in step with
-- start_date) so the previous version of the site keeps working while the
-- new version deploys. It can be dropped once nothing reads it.
alter table public.itineraries
  add column if not exists start_date date,
  add column if not exists end_date date;

update public.itineraries
   set start_date = trip_date, end_date = trip_date
 where start_date is null and trip_date is not null;

alter table public.itineraries
  add constraint itineraries_dates_check
  check (start_date is null or end_date is null or end_date >= start_date);

create index if not exists itineraries_owner_idx on public.itineraries (owner_id, updated_at desc);

-- Keeps trip_date = start_date for the old version of the site.
create function public.sync_trip_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.trip_date := new.start_date;
  return new;
end;
$$;

create trigger itineraries_sync_trip_date
  before insert or update of start_date on public.itineraries
  for each row execute function public.sync_trip_date();

-- At most 30 trips per person (stops someone filling the database).
create function public.limit_trips()
returns trigger
language plpgsql
security definer  -- counts all of the owner's trips whatever RLS would show
set search_path = ''
as $$
begin
  if (select count(*) from public.itineraries i where i.owner_id = new.owner_id) >= 30 then
    raise exception 'You can keep up to 30 trips. Delete one to make a new one.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger itineraries_limit
  before insert on public.itineraries
  for each row execute function public.limit_trips();


-- -----------------------------------------------------------------------------
-- Trip functions. SECURITY INVOKER: they run as the signed-in user, so the
-- RLS rules on itineraries and itinerary_items still apply to every step.
-- -----------------------------------------------------------------------------

-- Adds places to the end of one of your trips, in the given order. Places
-- already in the trip, repeated ids and places that aren't published are
-- skipped, so adding a whole route never fails halfway.
-- Returns the number of stops afterwards.
create function public.add_places_to_trip(p_itinerary_id uuid, p_destination_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save places' using errcode = '42501';
  end if;
  if not exists (select 1 from public.itineraries i where i.id = p_itinerary_id and i.owner_id = auth.uid()) then
    raise exception 'Trip not found' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_destination_ids), 0) > 50 then
    raise exception 'A trip can have at most 50 places' using errcode = '22023';
  end if;

  with wanted as (
    select x.id, min(x.ord) as ord
    from unnest(coalesce(p_destination_ids, '{}')) with ordinality as x(id, ord)
    join public.destinations d on d.id = x.id and d.status = 'published'
    where not exists (
      select 1 from public.itinerary_items i where i.itinerary_id = p_itinerary_id and i.destination_id = x.id
    )
    group by x.id
  )
  insert into public.itinerary_items (itinerary_id, destination_id, position)
  select p_itinerary_id, w.id,
         coalesce((select max(position) from public.itinerary_items where itinerary_id = p_itinerary_id), 0)
           + row_number() over (order by w.ord)
  from wanted w;

  select count(*) into v_count from public.itinerary_items where itinerary_id = p_itinerary_id;
  return v_count;
end;
$$;

-- Makes a new trip, optionally already filled with places (e.g. a route).
-- Returns the new trip's id.
create function public.create_trip(
  p_title text,
  p_start_date date default null,
  p_end_date date default null,
  p_destination_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to make a trip' using errcode = '42501';
  end if;

  insert into public.itineraries (owner_id, title, start_date, end_date)
  values (auth.uid(), coalesce(nullif(left(trim(p_title), 80), ''), 'My Hsinchu trip'), p_start_date, p_end_date)
  returning id into v_id;

  perform public.add_places_to_trip(v_id, p_destination_ids);
  return v_id;
end;
$$;

-- Replaces one trip with its edited version in one transaction: name, dates,
-- and the stops in their new order with notes.
-- p_items: [{"destination_id": "...", "note": "..."}, ...] in visiting order.
-- Places that are no longer published are dropped instead of failing the save.
create function public.save_trip(
  p_itinerary_id uuid,
  p_title text,
  p_start_date date,
  p_end_date date,
  p_items jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save your trip' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'A trip must be a list of at most 50 places' using errcode = '22023';
  end if;

  update public.itineraries
     set title = coalesce(nullif(left(trim(p_title), 80), ''), 'My Hsinchu trip'),
         start_date = p_start_date,
         end_date = p_end_date
   where id = p_itinerary_id and owner_id = auth.uid();
  if not found then
    raise exception 'Trip not found' using errcode = '42501';
  end if;

  delete from public.itinerary_items where itinerary_id = p_itinerary_id;

  insert into public.itinerary_items (itinerary_id, destination_id, position, note)
  select p_itinerary_id, d.id,
         row_number() over (order by item.ord),
         nullif(left(trim(item.value ->> 'note'), 300), '')
  from jsonb_array_elements(p_items) with ordinality as item(value, ord)
  join public.destinations d
    on d.id = (item.value ->> 'destination_id')::uuid and d.status = 'published'
  -- if the same place is sent twice, keep its first position
  where not exists (
    select 1 from jsonb_array_elements(p_items) with ordinality as earlier(value, ord)
    where earlier.ord < item.ord and earlier.value ->> 'destination_id' = item.value ->> 'destination_id'
  );

  select count(*) into v_count from public.itinerary_items where itinerary_id = p_itinerary_id;
  return v_count;
end;
$$;

revoke execute on function
  public.add_places_to_trip(uuid, uuid[]),
  public.create_trip(text, date, date, uuid[]),
  public.save_trip(uuid, text, date, date, jsonb)
  from public, anon;
grant execute on function
  public.add_places_to_trip(uuid, uuid[]),
  public.create_trip(text, date, date, uuid[]),
  public.save_trip(uuid, text, date, date, jsonb)
  to authenticated;


-- -----------------------------------------------------------------------------
-- The two old one-trip functions, kept for the previous version of the site.
-- They used "on conflict (owner_id)", which no longer works now that owner_id
-- isn't unique. They now act on your most recently changed trip (or make one).
-- -----------------------------------------------------------------------------
create or replace function public.add_to_itinerary(p_destination_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_itinerary uuid;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save places' using errcode = '42501';
  end if;

  select id into v_itinerary from public.itineraries
   where owner_id = auth.uid() order by updated_at desc limit 1;
  if v_itinerary is null then
    insert into public.itineraries (owner_id) values (auth.uid()) returning id into v_itinerary;
  end if;

  -- A direct insert (not add_places_to_trip), so RLS still refuses an
  -- unpublished place with an error, as before.
  insert into public.itinerary_items (itinerary_id, destination_id, position)
  select v_itinerary, p_destination_id, coalesce(max(position), 0) + 1
  from public.itinerary_items where itinerary_id = v_itinerary
  on conflict (itinerary_id, destination_id) do nothing;

  select count(*) into v_count from public.itinerary_items where itinerary_id = v_itinerary;
  return v_count;
end;
$$;

create or replace function public.save_itinerary(p_title text, p_trip_date date, p_items jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_itinerary uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save your itinerary' using errcode = '42501';
  end if;
  select id into v_itinerary from public.itineraries
   where owner_id = auth.uid() order by updated_at desc limit 1;
  if v_itinerary is null then
    v_itinerary := public.create_trip(p_title);
  end if;
  return public.save_trip(v_itinerary, p_title, p_trip_date, p_trip_date, p_items);
end;
$$;


-- =============================================================================
-- Part 2: comments and food tips on each place
-- =============================================================================
create type public.place_post_kind as enum ('comment', 'food');

create table public.place_posts (
  id              uuid primary key default gen_random_uuid(),
  destination_id  uuid not null references public.destinations (id) on delete cascade,
  -- Deleting an account deletes that person's posts.
  author_id       uuid not null references public.profiles (id) on delete cascade,
  kind            public.place_post_kind not null,
  -- Food tips name a dish ("Pork-ball soup"); comments don't.
  dish            text,
  -- The comment itself, or for a food tip an optional "why / how much".
  body            text,
  status          public.comment_status not null default 'visible',
  hidden_by       uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- The "is not null" parts matter: a CHECK only rejects a row when it is
  -- FALSE, and length(trim(NULL)) is NULL (unknown), which would let a food
  -- tip without a dish, or an empty comment, slip through.
  constraint place_posts_shape check (
    (kind = 'comment' and dish is null
      and body is not null and length(trim(body)) between 1 and 1000)
    or
    (kind = 'food' and dish is not null and length(trim(dish)) between 1 and 80
      and (body is null or length(trim(body)) between 1 and 300))
  )
);

-- The page asks for "visible posts about place X, oldest first".
create index place_posts_place_idx on public.place_posts (destination_id, kind, created_at) where status = 'visible';
create index place_posts_author_idx on public.place_posts (author_id, created_at);

create trigger place_posts_set_updated_at
  before update on public.place_posts
  for each row execute function public.set_updated_at();

-- Records which editor hid a post (same function as story comments).
create trigger place_posts_stamp_moderator
  before update of status on public.place_posts
  for each row execute function public.stamp_comment_moderator();

-- Flood protection: at most 30 posts per person per hour.
create function public.limit_place_posts()
returns trigger
language plpgsql
security definer  -- counts the author's posts whatever RLS would show
set search_path = ''
as $$
begin
  if (select count(*) from public.place_posts p
      where p.author_id = new.author_id and p.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'You have posted a lot in the last hour. Please try again later.' using errcode = '54000';
  end if;
  return new;
end;
$$;

create trigger place_posts_limit
  before insert on public.place_posts
  for each row execute function public.limit_place_posts();

-- Column privileges, as for story comments: a client can only send these
-- columns, so nobody can post something already hidden, backdate it or fake
-- hidden_by, and the only thing anyone can change later is status (editors).
-- Posts can't be edited, only deleted.
revoke all on public.place_posts from anon, authenticated;
grant select on public.place_posts to anon, authenticated;
grant insert (destination_id, author_id, kind, dish, body) on public.place_posts to authenticated;
grant update (status) on public.place_posts to authenticated;
grant delete on public.place_posts to authenticated;

alter table public.place_posts enable row level security;

create policy "Anyone reads visible posts on published places"
  on public.place_posts for select
  to anon, authenticated
  using (
    status = 'visible'
    and exists (select 1 from public.destinations d where d.id = destination_id and d.status = 'published')
  );

create policy "Editors read all place posts"
  on public.place_posts for select
  to authenticated
  using ((select public.is_editor()));

create policy "Signed-in users post on published places"
  on public.place_posts for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.destinations d where d.id = destination_id and d.status = 'published')
  );

create policy "Users delete their own place posts"
  on public.place_posts for delete
  to authenticated
  using (author_id = (select auth.uid()));

create policy "Editors moderate place posts"
  on public.place_posts for update
  to authenticated
  using ((select public.is_editor()))
  with check ((select public.is_editor()));

create policy "Editors delete any place post"
  on public.place_posts for delete
  to authenticated
  using ((select public.is_editor()));


-- -----------------------------------------------------------------------------
-- Public names: also anyone with a visible post on a published place
-- -----------------------------------------------------------------------------
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
     )
     or exists (
       select 1
       from public.place_posts pp
       join public.destinations d on d.id = pp.destination_id
       where pp.author_id = p.id and pp.status = 'visible' and d.status = 'published'
     );
