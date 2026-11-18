-- =============================================================================
-- FengYou: initial schema
--
-- Content model (from the proposal):
--   students research DESTINATIONS (據點) and write them up in several
--   languages (DESTINATION_TRANSLATIONS). Editors (teachers) review them.
--   Destinations are strung together into half-day ROUTES (ROUTE_DESTINATIONS).
--   MEDIA holds photos/videos; EVENTS are dated happenings (festivals, markets).
--   PROFILES extends Supabase's auth.users with a display name and a role.
--
-- Translation strategy: two patterns on purpose.
--   * Destinations: a separate translations table, because each language
--     goes through its own review workflow (AI draft -> human review), and the
--     story text is long.
--   * Routes, events, media: short labels stored as JSONB objects keyed by
--     locale, e.g. {"zh-TW": "舊城小吃散步", "en": "Old Town Food Walk"}.
--     Same shape as the frontend's Localized<T> type.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Enum types: fixed vocabularies, enforced by the database
-- -----------------------------------------------------------------------------

-- Who can do what. Ordered from least to most privileged.
create type public.user_role as enum ('visitor', 'contributor', 'editor', 'admin');

-- Shared publishing workflow for destinations, routes and events.
create type public.content_status as enum ('draft', 'in_review', 'published', 'archived');

create type public.destination_category as enum (
  'food', 'temple', 'history', 'market', 'nature', 'family', 'shopping', 'culture'
);

-- Proposal p.9: AI may write a first draft, but a human must review it.
create type public.translation_status as enum ('machine_draft', 'human_draft', 'reviewed');

-- 'panorama' = 360° image for the virtual "walk before you go" preview.
create type public.media_type as enum ('image', 'video', 'audio', 'panorama');


-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------

-- Keeps updated_at current on every UPDATE.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- True when a JSONB value is an object whose keys look like locale codes
-- ('en', 'zh-TW') and whose values are all non-empty strings.
-- (CHECK constraints can't query other tables, so this checks the format
-- rather than looking codes up in public.locales.)
create function public.is_localized_text(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(value) = 'object'
     and not exists (
       select 1
       from jsonb_each(value) as e(key, val)
       where e.key !~ '^[a-z]{2}(-[A-Z]{2})?$'
          or jsonb_typeof(e.val) <> 'string'
          or length(trim(e.val #>> '{}')) = 0
     );
$$;


-- Stamps published_at the first time a row's status becomes 'published'.
create function public.set_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- locales: the languages the site supports (reference data)
-- A table rather than an enum, so adding a language is an INSERT, not a schema change.
-- -----------------------------------------------------------------------------
create table public.locales (
  code        text primary key check (code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  name        text not null,          -- name in its own language, e.g. 'Tiếng Việt'
  is_enabled  boolean not null default false,
  sort_order  smallint not null default 0
);

insert into public.locales (code, name, is_enabled, sort_order) values
  ('zh-TW', '繁體中文',          true,  1),
  ('en',    'English',          true,  2),
  ('id',    'Bahasa Indonesia', false, 3),
  ('vi',    'Tiếng Việt',       false, 4),
  ('th',    'ไทย',              false, 5),
  ('ms',    'Bahasa Melayu',    false, 6),
  ('tl',    'Filipino',         false, 7);


-- -----------------------------------------------------------------------------
-- profiles: one row per signed-up user (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  -- Same id as auth.users. Deleting the auth user deletes the profile.
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text not null check (length(trim(display_name)) between 1 and 60),
  avatar_url        text,
  role              public.user_role not null default 'visitor',
  school            text,                         -- private: never shown publicly
  preferred_locale  text not null default 'zh-TW' references public.locales (code),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when someone signs up.
-- SECURITY DEFINER: runs with the function owner's rights, because the new
-- user has no rights on public.profiles yet.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1),
      'Traveller'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- destinations: language-neutral facts about a place
-- -----------------------------------------------------------------------------
create table public.destinations (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category          public.destination_category not null,
  status            public.content_status not null default 'draft',

  latitude          double precision check (latitude between -90 and 90),
  longitude         double precision check (longitude between -180 and 180),
  phone             text,
  website_url       text check (website_url ~ '^https?://'),

  -- Optional cover photo. FK added below, after the media table exists.
  cover_media_id    uuid,

  author_id         uuid references public.profiles (id) on delete set null,
  -- Proposal p.12: every published spot needs a verifiable source and a last-checked date.
  source_note       text,
  last_verified_on  date,

  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint destinations_coordinates_together
    check ((latitude is null) = (longitude is null)),
  constraint destinations_published_needs_verification
    check (status <> 'published' or (last_verified_on is not null and source_note is not null))
);

create index destinations_status_idx   on public.destinations (status);
create index destinations_category_idx on public.destinations (category) where status = 'published';
create index destinations_author_idx   on public.destinations (author_id);

create trigger destinations_set_updated_at
  before update on public.destinations
  for each row execute function public.set_updated_at();

create trigger destinations_set_published_at
  before insert or update of status on public.destinations
  for each row execute function public.set_published_at();


-- -----------------------------------------------------------------------------
-- destination_translations: one row per destination per language
-- -----------------------------------------------------------------------------
create table public.destination_translations (
  destination_id      uuid not null references public.destinations (id) on delete cascade,
  locale              text not null references public.locales (code),

  name                text not null check (length(trim(name)) > 0),
  summary             text not null,         -- one or two sentences for cards
  story               text,                  -- the student's long-form local story
  tips                text[] not null default '{}',  -- menu translations, etiquette…
  address             text,
  opening_hours       text,                  -- free text: hours vary too much for a fixed format

  translation_status  public.translation_status not null default 'human_draft',
  translated_by       uuid references public.profiles (id) on delete set null,
  reviewed_by         uuid references public.profiles (id) on delete set null,
  reviewed_at         timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Composite key: a destination has at most one translation per language.
  primary key (destination_id, locale),

  constraint translations_reviewed_has_reviewer
    check (translation_status <> 'reviewed' or (reviewed_by is not null and reviewed_at is not null))
);

create index destination_translations_locale_idx on public.destination_translations (locale);

create trigger destination_translations_set_updated_at
  before update on public.destination_translations
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- media: photos, videos, audio and 360° panoramas
-- The file itself lives in Supabase Storage; this row is its metadata.
-- -----------------------------------------------------------------------------
create table public.media (
  id              uuid primary key default gen_random_uuid(),
  -- Gallery owner. Null = not tied to one destination (e.g. a route cover).
  destination_id  uuid references public.destinations (id) on delete cascade,

  media_type      public.media_type not null default 'image',
  -- Path inside the 'media' Storage bucket: '<uploader uuid>/<file name>'.
  -- Or an external https URL for openly licensed images (e.g. Wikimedia Commons).
  storage_path    text not null unique,
  alt_text        jsonb not null default '{}' check (public.is_localized_text(alt_text)),
  caption         jsonb not null default '{}' check (public.is_localized_text(caption)),
  width           integer check (width > 0),
  height          integer check (height > 0),
  sort_order      smallint not null default 0,

  -- Credit/licence. Required for Creative Commons photos.
  credit_author   text,
  license         text,
  source_url      text,

  uploaded_by     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),

  -- Images must describe themselves to screen readers in at least one language.
  constraint media_images_need_alt_text
    check (media_type not in ('image', 'panorama') or alt_text <> '{}'::jsonb)
);

create index media_destination_idx on public.media (destination_id, sort_order);
create index media_uploaded_by_idx on public.media (uploaded_by);

alter table public.destinations
  add constraint destinations_cover_media_fk
  foreign key (cover_media_id) references public.media (id) on delete set null;


-- -----------------------------------------------------------------------------
-- routes: curated half-day itineraries
-- -----------------------------------------------------------------------------
create table public.routes (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title             jsonb not null check (public.is_localized_text(title) and title ? 'zh-TW'),
  theme             jsonb not null default '{}' check (public.is_localized_text(theme)),
  description       jsonb not null default '{}' check (public.is_localized_text(description)),
  duration_minutes  integer not null check (duration_minutes between 15 and 24 * 60),
  cover_media_id    uuid references public.media (id) on delete set null,
  status            public.content_status not null default 'draft',
  author_id         uuid references public.profiles (id) on delete set null,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index routes_status_idx on public.routes (status);

create trigger routes_set_updated_at
  before update on public.routes
  for each row execute function public.set_updated_at();

create trigger routes_set_published_at
  before insert or update of status on public.routes
  for each row execute function public.set_published_at();


-- -----------------------------------------------------------------------------
-- route_destinations: the ordered stops of a route (junction table, many-to-many)
-- -----------------------------------------------------------------------------
create table public.route_destinations (
  route_id           uuid not null references public.routes (id) on delete cascade,
  -- RESTRICT: you can't delete a destination that a route still uses.
  destination_id     uuid not null references public.destinations (id) on delete restrict,
  position           smallint not null check (position > 0),
  suggested_minutes  smallint check (suggested_minutes > 0),
  note               jsonb not null default '{}' check (public.is_localized_text(note)),

  primary key (route_id, destination_id),
  -- Deferred so stops can be reordered (swap 1 and 2) inside one transaction.
  constraint route_destinations_position_unique
    unique (route_id, position) deferrable initially deferred
);

create index route_destinations_destination_idx on public.route_destinations (destination_id);


-- -----------------------------------------------------------------------------
-- events: dated happenings, optionally at a destination
-- -----------------------------------------------------------------------------
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title           jsonb not null check (public.is_localized_text(title) and title ? 'zh-TW'),
  description     jsonb not null default '{}' check (public.is_localized_text(description)),
  -- Where it happens: a known destination, or a free-text venue.
  destination_id  uuid references public.destinations (id) on delete set null,
  venue           jsonb not null default '{}' check (public.is_localized_text(venue)),

  starts_at       timestamptz not null,
  ends_at         timestamptz,
  is_all_day      boolean not null default false,
  external_url    text check (external_url ~ '^https?://'),
  cover_media_id  uuid references public.media (id) on delete set null,

  status          public.content_status not null default 'draft',
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint events_end_after_start check (ends_at is null or ends_at >= starts_at)
);

-- "What's on soon" lists published events by start time.
create index events_upcoming_idx on public.events (starts_at) where status = 'published';
create index events_destination_idx on public.events (destination_id);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();
