-- =============================================================================
-- FengYou: Row Level Security (RLS)
--
-- Why RLS matters here: the browser talks to Supabase directly with the
-- publishable (anon) key. That key is public by design, so the database itself
-- must decide which rows each request may see or change. These policies are
-- the real security boundary.
--
-- Who's who (public.profiles.role):
--   anon         not signed in     → reads published content only
--   visitor      signed-in traveller → same, plus their own profile
--   contributor  student           → drafts their own destinations, media, translations
--   editor       teacher/reviewer  → reviews and publishes everything
--   admin        project lead      → editor rights + changes user roles
--
-- The service role key bypasses RLS entirely. Use it only in server code
-- (never in the browser) and only when there's no other way.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Role helpers
-- SECURITY DEFINER lets them read profiles without triggering the profiles
-- policies again (which would recurse). STABLE lets Postgres call them once
-- per query rather than once per row.
-- -----------------------------------------------------------------------------
create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.is_contributor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('contributor', 'editor', 'admin'), false);
$$;

create function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('editor', 'admin'), false);
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

-- These helpers are only for policies.
revoke execute on function public.current_user_role(), public.is_contributor(),
  public.is_editor(), public.is_admin() from public;
grant execute on function public.current_user_role(), public.is_contributor(),
  public.is_editor(), public.is_admin() to anon, authenticated;


-- -----------------------------------------------------------------------------
-- Turn RLS on for every table. With RLS on and no policy, nobody gets any rows.
-- -----------------------------------------------------------------------------
alter table public.locales                  enable row level security;
alter table public.profiles                 enable row level security;
alter table public.destinations             enable row level security;
alter table public.destination_translations enable row level security;
alter table public.media                    enable row level security;
alter table public.routes                   enable row level security;
alter table public.route_destinations       enable row level security;
alter table public.events                   enable row level security;

-- Defence in depth: signed-out visitors can never write, whatever the policies say.
revoke insert, update, delete on all tables in schema public from anon;

-- Note: (select auth.uid()) instead of auth.uid() is deliberate. The
-- sub-select lets Postgres evaluate it once per query instead of per row.


-- -----------------------------------------------------------------------------
-- locales
-- -----------------------------------------------------------------------------
create policy "Anyone can read locales"
  on public.locales for select
  to anon, authenticated
  using (true);

create policy "Admins manage locales"
  on public.locales for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));


-- -----------------------------------------------------------------------------
-- profiles
-- Profiles may belong to high-school students, so the table itself is private.
-- Public pages show author names through the author_profiles view below,
-- which exposes only a display name and avatar.
-- -----------------------------------------------------------------------------
create policy "Users read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Admins read all profiles"
  on public.profiles for select
  to authenticated
  using ((select public.is_admin()));

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Column-level privileges: RLS picks the ROWS, grants pick the COLUMNS.
-- Users may edit their own name, avatar, school and language, but never their
-- own role. That would let anyone make themselves an admin.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, school, preferred_locale)
  on public.profiles to authenticated;
-- No INSERT/DELETE policies: the signup trigger inserts, and deleting the
-- auth user cascades.

-- Public, minimal view of people who write content.
-- This view intentionally runs with its owner's rights (security_invoker off),
-- so it can show these three columns of other users' profiles without opening
-- the whole table.
create view public.author_profiles
with (security_invoker = false)
as
  select id, display_name, avatar_url
  from public.profiles
  where role in ('contributor', 'editor', 'admin');

revoke all on public.author_profiles from anon, authenticated;
grant select on public.author_profiles to anon, authenticated;

-- Admins change roles through this function, not by updating the table directly.
create function public.set_user_role(target_user uuid, new_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;
  if target_user = auth.uid() and new_role <> 'admin' then
    raise exception 'Admins cannot remove their own admin role' using errcode = '42501';
  end if;
  update public.profiles set role = new_role where id = target_user;
end;
$$;

revoke execute on function public.set_user_role(uuid, public.user_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;


-- -----------------------------------------------------------------------------
-- destinations
-- Several permissive policies on one command are OR-ed together.
-- -----------------------------------------------------------------------------
create policy "Anyone can read published destinations"
  on public.destinations for select
  to anon, authenticated
  using (status = 'published');

create policy "Authors read their own destinations"
  on public.destinations for select
  to authenticated
  using (author_id = (select auth.uid()));

create policy "Contributors create draft destinations"
  on public.destinations for insert
  to authenticated
  with check (
    (select public.is_contributor())
    and author_id = (select auth.uid())
    and status in ('draft', 'in_review')
  );

-- Authors can edit until it's published, and can only move it between
-- draft and in_review. Publishing is an editor's decision (proposal p.9).
create policy "Authors update their unpublished destinations"
  on public.destinations for update
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

create policy "Authors delete their drafts"
  on public.destinations for delete
  to authenticated
  using (author_id = (select auth.uid()) and status = 'draft');

create policy "Editors manage all destinations"
  on public.destinations for all
  to authenticated
  using ((select public.is_editor()))
  with check ((select public.is_editor()));


-- -----------------------------------------------------------------------------
-- destination_translations
-- Public sees a translation only when it's human-reviewed AND its destination
-- is published. Any contributor (e.g. an Indonesian student) may add a
-- translation, but only editors can mark one 'reviewed'.
-- -----------------------------------------------------------------------------
create policy "Anyone can read reviewed translations of published destinations"
  on public.destination_translations for select
  to anon, authenticated
  using (
    translation_status = 'reviewed'
    and exists (
      select 1 from public.destinations d
      where d.id = destination_id and d.status = 'published'
    )
  );

create policy "Contributors read translations they wrote or own"
  on public.destination_translations for select
  to authenticated
  using (
    translated_by = (select auth.uid())
    or exists (
      select 1 from public.destinations d
      where d.id = destination_id and d.author_id = (select auth.uid())
    )
  );

create policy "Contributors add unreviewed translations"
  on public.destination_translations for insert
  to authenticated
  with check (
    (select public.is_contributor())
    and translated_by = (select auth.uid())
    and translation_status <> 'reviewed'
    and reviewed_by is null
  );

create policy "Contributors edit their unreviewed translations"
  on public.destination_translations for update
  to authenticated
  using (
    (select public.is_contributor())
    and translation_status <> 'reviewed'
    and (
      translated_by = (select auth.uid())
      or exists (
        select 1 from public.destinations d
        where d.id = destination_id and d.author_id = (select auth.uid())
      )
    )
  )
  with check (
    translation_status <> 'reviewed'
    and reviewed_by is null
  );

create policy "Editors manage all translations"
  on public.destination_translations for all
  to authenticated
  using ((select public.is_editor()))
  with check ((select public.is_editor()));


-- -----------------------------------------------------------------------------
-- media
-- -----------------------------------------------------------------------------
create policy "Anyone can read media of published or unattached content"
  on public.media for select
  to anon, authenticated
  using (
    destination_id is null
    or exists (
      select 1 from public.destinations d
      where d.id = destination_id and d.status = 'published'
    )
  );

create policy "Uploaders read their own media"
  on public.media for select
  to authenticated
  using (uploaded_by = (select auth.uid()));

-- Contributors may attach media only to destinations they wrote.
create policy "Contributors upload media"
  on public.media for insert
  to authenticated
  with check (
    (select public.is_contributor())
    and uploaded_by = (select auth.uid())
    and (
      destination_id is null
      or exists (
        select 1 from public.destinations d
        where d.id = destination_id and d.author_id = (select auth.uid())
      )
    )
  );

create policy "Uploaders update their own media"
  on public.media for update
  to authenticated
  using (uploaded_by = (select auth.uid()))
  with check (
    uploaded_by = (select auth.uid())
    and (
      destination_id is null
      or exists (
        select 1 from public.destinations d
        where d.id = destination_id and d.author_id = (select auth.uid())
      )
    )
  );

create policy "Uploaders delete their own media"
  on public.media for delete
  to authenticated
  using (uploaded_by = (select auth.uid()));

create policy "Editors manage all media"
  on public.media for all
  to authenticated
  using ((select public.is_editor()))
  with check ((select public.is_editor()));


-- -----------------------------------------------------------------------------
-- routes and route_destinations: curated by editors
-- -----------------------------------------------------------------------------
create policy "Anyone can read published routes"
  on public.routes for select
  to anon, authenticated
  using (status = 'published');

create policy "Editors manage routes"
  on public.routes for all
  to authenticated
  using ((select public.is_editor()))
  with check ((select public.is_editor()));

-- A stop is public only if both its route and its destination are published,
-- so an unpublished destination never shows up through a route.
create policy "Anyone can read stops of published routes"
  on public.route_destinations for select
  to anon, authenticated
  using (
    exists (select 1 from public.routes r where r.id = route_id and r.status = 'published')
    and exists (select 1 from public.destinations d where d.id = destination_id and d.status = 'published')
  );

create policy "Editors manage route stops"
  on public.route_destinations for all
  to authenticated
  using ((select public.is_editor()))
  with check ((select public.is_editor()));


-- -----------------------------------------------------------------------------
-- events
-- -----------------------------------------------------------------------------
create policy "Anyone can read published events"
  on public.events for select
  to anon, authenticated
  using (status = 'published');

create policy "Editors manage events"
  on public.events for all
  to authenticated
  using ((select public.is_editor()))
  with check ((select public.is_editor()));
