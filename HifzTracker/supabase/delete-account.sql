-- Hifz Tracker: lets people delete their own account (Settings → Delete my account).
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- Deletes the signed-in person's login. Their saved progress (hifz_snapshots)
-- and AI usage (hifz_ai_usage) go with it automatically ("on delete cascade").

create or replace function public.hifz_delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.hifz_delete_account() from public, anon;
grant execute on function public.hifz_delete_account() to authenticated;
