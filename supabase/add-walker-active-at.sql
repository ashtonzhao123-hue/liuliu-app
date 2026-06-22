alter table public.users
  add column if not exists walker_last_active_at timestamptz;

comment on column public.users.walker_last_active_at is
  'Walker last activity timestamp, updated on key walker actions.';

create or replace function public.get_active_walker_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.users u
  join public.walker_auth wa on wa.user_id = u.id
  where u.walker_last_active_at > now() - interval '15 minutes'
    and wa.walker_service_status = 1;
$$;

revoke all on function public.get_active_walker_count() from public;
revoke all on function public.get_active_walker_count() from anon;
grant execute on function public.get_active_walker_count() to authenticated;
