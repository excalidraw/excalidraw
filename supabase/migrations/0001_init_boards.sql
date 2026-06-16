-- 0001_init_boards.sql
-- Supabase sync: single working board per user, with private file storage.
-- NOTE: the LWW conflict key is the integer `version` column, bumped by a guarded UPDATE
--       in the application (boardRepository.pushBoard). `updated_at` below is for DISPLAY /
--       human tiebreak ONLY and must never drive conflict resolution.

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
-- gen_random_uuid() is built in on Supabase (pgcrypto is pre-installed), but we
-- ensure the extension is present so this migration is safe on any Postgres.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. boards table
-- ---------------------------------------------------------------------------
create table if not exists public.boards (
  id          uuid          primary key default gen_random_uuid(),
  user_id     uuid          not null references auth.users(id) on delete cascade,
  name        text          not null default 'Untitled',
  document    jsonb         not null default '[]'::jsonb,
  app_state   jsonb         not null default '{}'::jsonb,
  version     integer       not null default 0,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

-- one board per user for this deployment (relax to unique(user_id, name) for multi-board later)
create unique index if not exists boards_user_id_key on public.boards (user_id);

-- ---------------------------------------------------------------------------
-- 2. updated_at trigger (DISPLAY ONLY — not used for LWW; version is)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
  before update on public.boards
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Row Level Security: a user may only read/write their own row
-- ---------------------------------------------------------------------------
alter table public.boards enable row level security;

-- Table-level privileges. RLS gates WHICH rows; the role still needs base
-- table privileges to reach the table at all. Supabase's automatic grants for
-- the `public` schema do not reliably apply to tables created inside a
-- migration, so we grant explicitly. Only the logged-in (`authenticated`) role
-- is granted — this deployment requires login, and RLS restricts each user to
-- their own row. (`anon` is intentionally NOT granted.)
grant select, insert, update, delete on public.boards to authenticated;

drop policy if exists "boards_select_own" on public.boards;
create policy "boards_select_own"
  on public.boards for select
  using (auth.uid() = user_id);

drop policy if exists "boards_insert_own" on public.boards;
create policy "boards_insert_own"
  on public.boards for insert
  with check (auth.uid() = user_id);

drop policy if exists "boards_update_own" on public.boards;
create policy "boards_update_own"
  on public.boards for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "boards_delete_own" on public.boards;
create policy "boards_delete_own"
  on public.boards for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Storage bucket for scene image files (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('scene-files', 'scene-files', false)
on conflict (id) do nothing;

-- Storage RLS: objects live under `{user_id}/{fileId}`. Each policy restricts BOTH to this
-- bucket AND to the caller's own top-level folder (= their auth.uid()).
drop policy if exists "scene_files_select_own" on storage.objects;
create policy "scene_files_select_own"
  on storage.objects for select
  using (
    bucket_id = 'scene-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "scene_files_insert_own" on storage.objects;
create policy "scene_files_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'scene-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "scene_files_update_own" on storage.objects;
create policy "scene_files_update_own"
  on storage.objects for update
  using (
    bucket_id = 'scene-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'scene-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "scene_files_delete_own" on storage.objects;
create policy "scene_files_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'scene-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
