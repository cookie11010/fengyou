-- =============================================================================
-- FengYou: like and save stories
--
-- LIKE: public. Everyone sees how many likes a story has, but not who liked it.
-- SAVE: private. A personal bookmark list only its owner can see.
--
-- Both are rows in story_reactions. The public like count is kept on
-- stories.like_count by a trigger, so visitors can see the number without
-- being able to read who liked what.
-- =============================================================================

create type public.story_reaction as enum ('like', 'save');

create table public.story_reactions (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  story_id    uuid not null references public.stories (id) on delete cascade,
  kind        public.story_reaction not null,
  created_at  timestamptz not null default now(),
  -- One like and one save per person per story.
  primary key (user_id, story_id, kind)
);

create index story_reactions_story_idx on public.story_reactions (story_id, kind);

alter table public.stories
  add column like_count integer not null default 0 check (like_count >= 0);


-- -----------------------------------------------------------------------------
-- Keeping like_count correct
-- -----------------------------------------------------------------------------

-- Adjusts the count when a like is added or removed. SECURITY DEFINER because
-- the person liking isn't the story's author, so RLS wouldn't let them update it.
create function public.update_story_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.kind = 'like' then
    update public.stories set like_count = like_count + 1 where id = new.story_id;
  elsif tg_op = 'DELETE' and old.kind = 'like' then
    update public.stories set like_count = greatest(like_count - 1, 0) where id = old.story_id;
  end if;
  return null;
end;
$$;

create trigger story_reactions_like_count
  after insert or delete on public.story_reactions
  for each row execute function public.update_story_like_count();

-- Nobody can type in a like count: new stories start at 0, and direct edits
-- are ignored. Only the trigger above (which runs one trigger level deeper,
-- so pg_trigger_depth() > 1) may change it.
create function public.protect_story_like_count()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.like_count := 0;
  elsif new.like_count is distinct from old.like_count and pg_trigger_depth() = 1 then
    new.like_count := old.like_count;
  end if;
  return new;
end;
$$;

create trigger stories_protect_like_count
  before insert or update on public.stories
  for each row execute function public.protect_story_like_count();


-- -----------------------------------------------------------------------------
-- Row Level Security: you only ever see and change your own reactions
-- -----------------------------------------------------------------------------
alter table public.story_reactions enable row level security;
revoke all on public.story_reactions from anon;

create policy "Users read their own reactions"
  on public.story_reactions for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Only published stories can be liked or saved.
create policy "Users react to published stories"
  on public.story_reactions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.stories s where s.id = story_id and s.status = 'published')
  );

create policy "Users remove their own reactions"
  on public.story_reactions for delete
  to authenticated
  using (user_id = (select auth.uid()));
-- No UPDATE policy: a reaction is either there or not.
