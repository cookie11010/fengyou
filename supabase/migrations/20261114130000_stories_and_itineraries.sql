-- =============================================================================
-- FengYou: student stories and personal itineraries
--
-- STORIES: students (contributors) write a story or a quick tip about a
--   published place. An editor approves it before the public sees it.
-- ITINERARIES: any signed-in user keeps one itinerary, an ordered list of
--   places with a personal note per stop. Only the owner can see or edit it.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- stories
-- -----------------------------------------------------------------------------
create type public.story_kind as enum ('story', 'tip');

create table public.stories (
  id              uuid primary key default gen_random_uuid(),
  -- Deleting the account deletes the student's stories: it's their personal writing.
  author_id       uuid not null references public.profiles (id) on delete cascade,
  -- Must be a known place, so readers can find it on the map and save it.
  destination_id  uuid not null references public.destinations (id) on delete cascade,
  kind            public.story_kind not null default 'story',
  locale          text not null references public.locales (code),  -- language it's written in
  title           text not null check (length(trim(title)) between 1 and 120),
  body            text not null check (length(trim(body)) between 20 and 5000),

  status          public.content_status not null default 'in_review',
  reviewed_by     uuid references public.profiles (id) on delete set null,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index stories_published_idx on public.stories (published_at desc) where status = 'published';
create index stories_destination_idx on public.stories (destination_id);
create index stories_author_idx on public.stories (author_id);
create index stories_review_queue_idx on public.stories (created_at) where status = 'in_review';

create trigger stories_set_updated_at
  before update on public.stories
  for each row execute function public.set_updated_at();

create trigger stories_set_published_at
  before insert or update of status on public.stories
  for each row execute function public.set_published_at();

-- The reviewer is always whoever actually published it. It can't be typed in.
create function public.stamp_story_reviewer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.reviewed_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger stories_stamp_reviewer
  before insert or update of status on public.stories
  for each row execute function public.stamp_story_reviewer();


-- -----------------------------------------------------------------------------
-- itineraries: one per user
-- -----------------------------------------------------------------------------
create table public.itineraries (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references public.profiles (id) on delete cascade,
  title       text not null default 'My Hsinchu trip' check (length(trim(title)) between 1 and 80),
  trip_date   date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger itineraries_set_updated_at
  before update on public.itineraries
  for each row execute function public.set_updated_at();

create table public.itinerary_items (
  itinerary_id    uuid not null references public.itineraries (id) on delete cascade,
  destination_id  uuid not null references public.destinations (id) on delete cascade,
  position        smallint not null check (position between 1 and 50),
  note            text check (length(note) <= 300),
  added_at        timestamptz not null default now(),

  primary key (itinerary_id, destination_id),         -- a place appears once
  constraint itinerary_items_position_unique
    unique (itinerary_id, position) deferrable initially deferred
);

create index itinerary_items_destination_idx on public.itinerary_items (destination_id);


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.stories          enable row level security;
alter table public.itineraries      enable row level security;
alter table public.itinerary_items  enable row level security;
revoke insert, update, delete on public.stories, public.itineraries, public.itinerary_items from anon;
revoke select on public.itineraries, public.itinerary_items from anon;

-- stories ------------------------------------------------------------------
create policy "Anyone can read published stories"
  on public.stories for select
  to anon, authenticated
  using (status = 'published');

create policy "Authors read their own stories"
  on public.stories for select
  to authenticated
  using (author_id = (select auth.uid()));

create policy "Contributors submit stories about published places"
  on public.stories for insert
  to authenticated
  with check (
    (select public.is_contributor())
    and author_id = (select auth.uid())
    and status in ('draft', 'in_review')
    and exists (select 1 from public.destinations d where d.id = destination_id and d.status = 'published')
  );

-- Editing an approved story would bypass review, so authors can only edit
-- drafts and stories still waiting for review.
create policy "Contributors edit their unpublished stories"
  on public.stories for update
  to authenticated
  using (
    (select public.is_contributor())
    and author_id = (select auth.uid())
    and status in ('draft', 'in_review')
  )
  with check (
    author_id = (select auth.uid())
    and status in ('draft', 'in_review')
  );

-- Students can always take down their own writing, even after leaving the project.
create policy "Authors delete their own stories"
  on public.stories for delete
  to authenticated
  using (author_id = (select auth.uid()));

create policy "Editors manage all stories"
  on public.stories for all
  to authenticated
  using ((select public.is_editor()))
  with check ((select public.is_editor()));

-- Teachers reviewing a story need to know which student wrote it.
create policy "Editors read all profiles"
  on public.profiles for select
  to authenticated
  using ((select public.is_editor()));

-- itineraries --------------------------------------------------------------
create policy "Owners manage their itinerary"
  on public.itineraries for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners read their itinerary items"
  on public.itinerary_items for select
  to authenticated
  using (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.owner_id = (select auth.uid())));

-- Only published places can be added. Drafts stay private.
create policy "Owners add published places"
  on public.itinerary_items for insert
  to authenticated
  with check (
    exists (select 1 from public.itineraries i where i.id = itinerary_id and i.owner_id = (select auth.uid()))
    and exists (select 1 from public.destinations d where d.id = destination_id and d.status = 'published')
  );

create policy "Owners edit their itinerary items"
  on public.itinerary_items for update
  to authenticated
  using (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.owner_id = (select auth.uid())));

create policy "Owners remove their itinerary items"
  on public.itinerary_items for delete
  to authenticated
  using (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.owner_id = (select auth.uid())));


-- -----------------------------------------------------------------------------
-- Itinerary functions (called from the browser with supabase.rpc)
-- SECURITY INVOKER: they run as the signed-in user, so every RLS rule above
-- still applies. They exist to make multi-step changes atomic.
-- -----------------------------------------------------------------------------

-- Adds a place at the end of the user's itinerary, creating the itinerary on
-- first use. Adding a place that's already there does nothing.
-- Returns the number of stops afterwards.
create function public.add_to_itinerary(p_destination_id uuid)
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

  insert into public.itineraries (owner_id) values (auth.uid())
  on conflict (owner_id) do nothing;
  select id into v_itinerary from public.itineraries where owner_id = auth.uid();

  insert into public.itinerary_items (itinerary_id, destination_id, position)
  select v_itinerary, p_destination_id, coalesce(max(position), 0) + 1
  from public.itinerary_items where itinerary_id = v_itinerary
  on conflict (itinerary_id, destination_id) do nothing;

  select count(*) into v_count from public.itinerary_items where itinerary_id = v_itinerary;
  return v_count;
end;
$$;

-- Replaces the whole itinerary with the edited version in one transaction:
-- title, date, and the stops in their new order with notes.
-- p_items: [{"destination_id": "...", "note": "..."}, ...] in visiting order.
-- Places that are no longer published are dropped instead of failing the save.
create function public.save_itinerary(p_title text, p_trip_date date, p_items jsonb)
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
    raise exception 'Sign in to save your itinerary' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'Itinerary must be a list of at most 50 places' using errcode = '22023';
  end if;

  insert into public.itineraries (owner_id, title, trip_date)
  values (auth.uid(), coalesce(nullif(trim(p_title), ''), 'My Hsinchu trip'), p_trip_date)
  on conflict (owner_id) do update
    set title = excluded.title, trip_date = excluded.trip_date;
  select id into v_itinerary from public.itineraries where owner_id = auth.uid();

  delete from public.itinerary_items where itinerary_id = v_itinerary;

  insert into public.itinerary_items (itinerary_id, destination_id, position, note)
  select v_itinerary, d.id,
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

  select count(*) into v_count from public.itinerary_items where itinerary_id = v_itinerary;
  return v_count;
end;
$$;

revoke execute on function public.add_to_itinerary(uuid), public.save_itinerary(text, date, jsonb) from public, anon;
grant execute on function public.add_to_itinerary(uuid), public.save_itinerary(text, date, jsonb) to authenticated;


-- -----------------------------------------------------------------------------
-- Changes needed now that student names appear publicly on stories
-- -----------------------------------------------------------------------------

-- New accounts no longer get their email's local part as a public name, and
-- an over-long name no longer makes sign-up fail.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(left(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 60), 'Traveller')
  );
  return new;
end;
$$;

-- Only people with something published are listed publicly. Students who
-- haven't published anything can't be enumerated.
create or replace view public.author_profiles
with (security_invoker = false)
as
  select p.id, p.display_name, p.avatar_url
  from public.profiles p
  where p.role in ('contributor', 'editor', 'admin')
    and (
      exists (select 1 from public.destinations d where d.author_id = p.id and d.status = 'published')
      or exists (select 1 from public.stories s where s.author_id = p.id and s.status = 'published')
    );
