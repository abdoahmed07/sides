-- Hifz Tracker: daily AI message limit per account.
-- Run once in Supabase → SQL Editor (after schema.sql). Safe to re-run.
--
-- The hosted app's AI route calls hifz_ai_take() as the signed-in person
-- before every assistant message. It adds one to today's count and returns
-- the new count, or null when the limit is already reached. Nobody can read
-- or change the table directly.

create table if not exists public.hifz_ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  count   integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

alter table public.hifz_ai_usage enable row level security;
revoke all on public.hifz_ai_usage from anon, authenticated;

create or replace function public.hifz_ai_take(p_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  n integer;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  insert into public.hifz_ai_usage as u (user_id, day, count)
  values (uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = u.count + 1 where u.count < p_limit
  returning count into n;
  return n; -- null: limit reached
end;
$$;

revoke all on function public.hifz_ai_take(integer) from public, anon;
grant execute on function public.hifz_ai_take(integer) to authenticated;
