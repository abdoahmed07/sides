-- Streak: version 1 schema.
-- Run once in Supabase → SQL Editor. Safe to re-run: it only creates what is missing
-- and replaces the policies.
-- Streaks are never stored: they are computed from check-in history in the app.

-- ---------- habits ----------
create table if not exists public.habits (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                text not null check (char_length(btrim(name)) between 1 and 80),
  schedule_type       text not null default 'daily' check (schedule_type in ('daily', 'weekly')),
  weekly_target       smallint check (weekly_target between 1 and 7),
  minimum_version     text check (minimum_version is null or char_length(minimum_version) <= 140),
  rest_days_per_month smallint not null default 0 check (rest_days_per_month between 0 and 31),
  start_date          date not null default current_date,
  sort_order          int not null default 0,
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  constraint weekly_needs_target check (schedule_type <> 'weekly' or weekly_target is not null)
);

create index if not exists habits_user_idx on public.habits (user_id);

-- ---------- checkins ----------
create table if not exists public.checkins (
  id         uuid primary key default gen_random_uuid(),
  habit_id   uuid not null references public.habits (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null, -- the user's local calendar day
  -- 'rescued' is reserved for the later coach feature.
  status     text not null check (status in ('done', 'rest', 'excused', 'rescued')),
  note       text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now(),
  -- An excused day needs a short reason.
  constraint excused_needs_note check (status <> 'excused' or char_length(btrim(coalesce(note, ''))) > 0),
  -- One entry per habit per day. The unique index also serves lookups on (habit_id, date).
  constraint checkins_habit_date_key unique (habit_id, date)
);

create index if not exists checkins_user_idx on public.checkins (user_id);

-- ---------- row-level security ----------
alter table public.habits   enable row level security;
alter table public.checkins enable row level security;

drop policy if exists habits_select on public.habits;
drop policy if exists habits_insert on public.habits;
drop policy if exists habits_update on public.habits;
drop policy if exists habits_delete on public.habits;

create policy habits_select on public.habits for select to authenticated
  using (user_id = (select auth.uid()));
create policy habits_insert on public.habits for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy habits_update on public.habits for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy habits_delete on public.habits for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists checkins_select on public.checkins;
drop policy if exists checkins_insert on public.checkins;
drop policy if exists checkins_update on public.checkins;
drop policy if exists checkins_delete on public.checkins;

create policy checkins_select on public.checkins for select to authenticated
  using (user_id = (select auth.uid()));
-- Writes must also point at a habit the same user owns.
create policy checkins_insert on public.checkins for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  );
create policy checkins_update on public.checkins for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  );
create policy checkins_delete on public.checkins for delete to authenticated
  using (user_id = (select auth.uid()));
