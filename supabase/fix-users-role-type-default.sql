-- Verify the current default before changing it.
select column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'users'
  and column_name = 'role_type';

-- New users must enter /role-select first. Do not default them to Owner.
alter table public.users
  alter column role_type drop default;
