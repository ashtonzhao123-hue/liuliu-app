alter table public.orders
  add column if not exists payment_method varchar(20) default 'offline',
  add column if not exists payment_status varchar(20) default 'pending',
  add column if not exists platform_fee_rate numeric(5,4) default 0,
  add column if not exists platform_fee numeric(10,2) default 0,
  add column if not exists walker_income numeric(10,2) default 0,
  add column if not exists transaction_id varchar(100);

alter table public.users
  add column if not exists phone varchar(20),
  add column if not exists is_verified boolean default false;

create unique index if not exists users_phone_unique_idx
  on public.users (phone)
  where phone is not null;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null check (char_length(content) >= 5 and char_length(content) <= 500),
  phone varchar(20),
  is_read boolean not null default false,
  reply text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own"
on public.feedback
for insert
with check (
  exists (
    select 1 from public.users u
    where u.id = feedback.user_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists "feedback_select_own" on public.feedback;
create policy "feedback_select_own"
on public.feedback
for select
using (
  exists (
    select 1 from public.users u
    where u.id = feedback.user_id
      and u.auth_id = auth.uid()
  )
);

create table if not exists public.walker_verification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  student_card_image_url text not null,
  school varchar(50) not null default '西安文理学院',
  grade varchar(20),
  status varchar(20) not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason varchar(100),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.walker_verification enable row level security;

drop policy if exists "walker_verification_select_own" on public.walker_verification;
create policy "walker_verification_select_own"
on public.walker_verification
for select
using (
  exists (
    select 1 from public.users u
    where u.id = walker_verification.user_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists "walker_verification_insert_own" on public.walker_verification;
create policy "walker_verification_insert_own"
on public.walker_verification
for insert
with check (
  exists (
    select 1 from public.users u
    where u.id = walker_verification.user_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists "walker_verification_update_own" on public.walker_verification;
create policy "walker_verification_update_own"
on public.walker_verification
for update
using (
  exists (
    select 1 from public.users u
    where u.id = walker_verification.user_id
      and u.auth_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = walker_verification.user_id
      and u.auth_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-images',
  'verification-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
