-- =============================================================================
-- FengYou: comments on stories
--
-- Anyone can READ comments on published stories, so visitors and students can
-- see the conversation. Writing a comment needs an account (any role, so
-- visitors can ask students questions). Comments appear straight away;
-- editors can hide ones that break the rules.
--
-- Who can do what:
--   anyone          read visible comments on published stories
--   signed in       post a comment on a published story, delete their own
--   editor / admin  hide or un-hide any comment, delete any comment
-- =============================================================================

create type public.comment_status as enum ('visible', 'hidden');

create table public.story_comments (
  id          uuid primary key default gen_random_uuid(),
  story_id    uuid not null references public.stories (id) on delete cascade,
  -- Deleting an account deletes that person's comments.
  author_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (length(trim(body)) between 1 and 1000),
  status      public.comment_status not null default 'visible',
  hidden_by   uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The page asks for "visible comments on story X, oldest first".
create index story_comments_story_idx on public.story_comments (story_id, created_at) where status = 'visible';
create index story_comments_author_idx on public.story_comments (author_id);

create trigger story_comments_set_updated_at
  before update on public.story_comments
  for each row execute function public.set_updated_at();

-- Records which editor hid a comment (the client can't fill this in itself).
create function public.stamp_comment_moderator()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.hidden_by := case when new.status = 'hidden' then (select auth.uid()) else null end;
  return new;
end;
$$;

create trigger story_comments_stamp_moderator
  before update of status on public.story_comments
  for each row execute function public.stamp_comment_moderator();


-- -----------------------------------------------------------------------------
-- stories.comment_count: the number shown on the "Comments" button
-- -----------------------------------------------------------------------------
-- Like like_count, it lives on the story so the public page can show it
-- without a second query, and only the database may change it.
alter table public.stories
  add column comment_count integer not null default 0 check (comment_count >= 0);

-- Recounts instead of adding/subtracting 1: a comment can be added, deleted,
-- hidden or un-hidden, and recounting is correct in every case.
create function public.update_story_comment_count()
returns trigger
language plpgsql
security definer  -- commenters can't update other people's stories under RLS
set search_path = ''
as $$
declare
  target uuid := coalesce(new.story_id, old.story_id);
begin
  update public.stories
     set comment_count = (
       select count(*) from public.story_comments c
       where c.story_id = target and c.status = 'visible'
     )
   where id = target;
  return null;
end;
$$;

create trigger story_comments_count
  after insert or delete or update of status on public.story_comments
  for each row execute function public.update_story_comment_count();

-- Extend the like_count guard from the previous migration to cover both
-- counts: new stories start at 0 and direct edits are ignored. Only the
-- count triggers (one level deeper, so pg_trigger_depth() > 1) change them.
create or replace function public.protect_story_like_count()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.like_count := 0;
    new.comment_count := 0;
  elsif pg_trigger_depth() = 1 then
    new.like_count := old.like_count;
    new.comment_count := old.comment_count;
  end if;
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- Column privileges: what a client is allowed to send at all
-- -----------------------------------------------------------------------------
-- Even before RLS, a client may only send these columns. So nobody can post a
-- comment that is already "hidden", backdate it, or fake hidden_by, and the
-- only thing anyone can ever change afterwards is status (and RLS limits
-- that to editors). Comments can't be edited, only deleted.
revoke all on public.story_comments from anon, authenticated;
grant select on public.story_comments to anon, authenticated;
grant insert (story_id, author_id, body) on public.story_comments to authenticated;
grant update (status) on public.story_comments to authenticated;
grant delete on public.story_comments to authenticated;


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.story_comments enable row level security;

create policy "Anyone reads visible comments on published stories"
  on public.story_comments for select
  to anon, authenticated
  using (
    status = 'visible'
    and exists (select 1 from public.stories s where s.id = story_id and s.status = 'published')
  );

create policy "Editors read all comments"
  on public.story_comments for select
  to authenticated
  using ((select public.is_editor()));

create policy "Signed-in users comment on published stories"
  on public.story_comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.stories s where s.id = story_id and s.status = 'published')
  );

create policy "Users delete their own comments"
  on public.story_comments for delete
  to authenticated
  using (author_id = (select auth.uid()));

create policy "Editors moderate comments"
  on public.story_comments for update
  to authenticated
  using ((select public.is_editor()))
  with check ((select public.is_editor()));

create policy "Editors delete any comment"
  on public.story_comments for delete
  to authenticated
  using ((select public.is_editor()));


-- -----------------------------------------------------------------------------
-- Commenters' names
-- -----------------------------------------------------------------------------
-- author_profiles is the public list of names (name + avatar, nothing else).
-- It used to list only people who had published something; now it also lists
-- anyone with a visible comment on a published story, so the page can show
-- who wrote each comment. People who have only liked or saved stay private.
create or replace view public.author_profiles
with (security_invoker = false)
as
  select p.id, p.display_name, p.avatar_url
  from public.profiles p
  where (
      p.role in ('contributor', 'editor', 'admin')
      and (
        exists (select 1 from public.destinations d where d.author_id = p.id and d.status = 'published')
        or exists (select 1 from public.stories s where s.author_id = p.id and s.status = 'published')
      )
    )
    or exists (
      select 1
      from public.story_comments c
      join public.stories s on s.id = c.story_id
      where c.author_id = p.id and c.status = 'visible' and s.status = 'published'
    );
