-- Hifz Tracker: sync table (version 1).
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- Each account has one row holding a snapshot of the whole app (the same
-- format as Settings → Export JSON). `rev` goes up by one on every upload; the
-- app only overwrites the row if it still has the revision it last saw, so two
-- devices can't silently overwrite each other.

create table if not exists public.hifz_snapshots (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  rev        integer not null check (rev > 0),
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  -- A few years of daily use is well under 5 MB; this stops runaway uploads.
  constraint hifz_snapshot_size check (pg_column_size(data) < 20000000)
);

alter table public.hifz_snapshots enable row level security;

-- Needed when "Automatically expose new tables" is off. Signed-out visitors get nothing.
revoke all on public.hifz_snapshots from anon;
grant select, insert, update, delete on public.hifz_snapshots to authenticated;

-- Each person can only see and change their own row.
drop policy if exists "hifz own select" on public.hifz_snapshots;
drop policy if exists "hifz own insert" on public.hifz_snapshots;
drop policy if exists "hifz own update" on public.hifz_snapshots;
drop policy if exists "hifz own delete" on public.hifz_snapshots;

create policy "hifz own select" on public.hifz_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "hifz own insert" on public.hifz_snapshots
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "hifz own update" on public.hifz_snapshots
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "hifz own delete" on public.hifz_snapshots
  for delete to authenticated using ((select auth.uid()) = user_id);
