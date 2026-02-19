-- ============================================================
-- Montana Notes – Supabase Schema
-- ============================================================
-- Run this SQL in the Supabase Dashboard → SQL Editor
-- (Project → SQL Editor → New Query → Run)
-- ============================================================

-- 1. Create the notes table
-- id/parent_id are TEXT (not uuid) because legacy nodes may have short IDs like '1','2','3'
create table if not exists public.notes (
  id         text        primary key,
  parent_id  text,
  name       text        not null,
  type       text        not null check (type in ('FILE', 'FOLDER')),
  content    text,
  is_open    boolean     default false,
  created_at bigint      not null,
  updated_at bigint      not null default (extract(epoch from now()) * 1000)::bigint,
  user_id    uuid        not null references auth.users(id) on delete cascade
);

-- 2. Create index for faster parent lookups
create index if not exists idx_notes_parent on public.notes(parent_id);
create index if not exists idx_notes_user   on public.notes(user_id);

-- 3. Enable Row Level Security
alter table public.notes enable row level security;

-- 4. RLS Policies – users can only access their own notes
create policy "Users can select own notes"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "Users can insert own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notes"
  on public.notes for update
  using (auth.uid() = user_id);

create policy "Users can delete own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

-- 5. Enable Realtime for the notes table
-- Go to Database → Replication in the dashboard and enable
-- the "notes" table, OR run:
alter publication supabase_realtime add table public.notes;

-- ============================================================
-- Setup Instructions:
-- 1. Create a free Supabase project at https://supabase.com
-- 2. Go to SQL Editor and run this entire script
-- 3. Go to Project Settings → API to get your URL and anon key
-- 4. Paste them into Montana Settings → Data & Sync → Supabase 설정
-- 5. Sign up / Log in and start syncing!
-- ============================================================
