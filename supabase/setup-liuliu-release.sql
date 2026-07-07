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

alter table public.users
  alter column role_type drop default;

create unique index if not exists users_phone_unique_idx
  on public.users (phone)
  where phone is not null;

create unique index if not exists users_auth_id_key_idx
  on public.users (auth_id)
  where auth_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_auth_id_key'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users add constraint users_auth_id_key unique (auth_id);
  end if;
exception
  when duplicate_table then null;
  when duplicate_object then null;
end $$;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null check (char_length(content) >= 5 and char_length(content) <= 500),
  phone varchar(20),
  is_read boolean not null default false,
  reply text,
  created_at timestamptz not null default now()
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

alter table public.users enable row level security;
alter table public.orders enable row level security;
alter table public.pets enable row level security;
alter table public.user_addresses enable row level security;
alter table public.complaints enable row level security;
alter table public.reviews enable row level security;
alter table public.order_tracks enable row level security;
alter table public.order_checkpoints enable row level security;
alter table public.order_media enable row level security;
alter table public.walker_auth enable row level security;
alter table public.feedback enable row level security;
alter table public.walker_verification enable row level security;

drop policy if exists "users_select_own_or_admin" on public.users;
create policy "users_select_own_or_admin"
on public.users for select
using (auth_id = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
on public.users for insert
with check (auth_id = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "users_update_own_or_admin" on public.users;
create policy "users_update_own_or_admin"
on public.users for update
using (auth_id = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check (auth_id = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "pets_select_own_or_admin" on public.pets;
create policy "pets_select_own_or_admin"
on public.pets for select
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = pets.user_id and u.auth_id = auth.uid())
);

drop policy if exists "pets_insert_own_or_admin" on public.pets;
create policy "pets_insert_own_or_admin"
on public.pets for insert
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = pets.user_id and u.auth_id = auth.uid())
);

drop policy if exists "pets_update_own_or_admin" on public.pets;
create policy "pets_update_own_or_admin"
on public.pets for update
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = pets.user_id and u.auth_id = auth.uid())
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = pets.user_id and u.auth_id = auth.uid())
);

drop policy if exists "user_addresses_select_own_or_admin" on public.user_addresses;
create policy "user_addresses_select_own_or_admin"
on public.user_addresses for select
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = user_addresses.user_id and u.auth_id = auth.uid())
);

drop policy if exists "user_addresses_insert_own_or_admin" on public.user_addresses;
create policy "user_addresses_insert_own_or_admin"
on public.user_addresses for insert
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = user_addresses.user_id and u.auth_id = auth.uid())
);

drop policy if exists "user_addresses_update_own_or_admin" on public.user_addresses;
create policy "user_addresses_update_own_or_admin"
on public.user_addresses for update
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = user_addresses.user_id and u.auth_id = auth.uid())
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = user_addresses.user_id and u.auth_id = auth.uid())
);

drop policy if exists "orders_select_participant_pending_or_admin" on public.orders;
create policy "orders_select_participant_pending_or_admin"
on public.orders for select
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or (auth.uid() is not null and order_status = 10)
  or exists (select 1 from public.users u where u.id = orders.owner_id and u.auth_id = auth.uid())
  or exists (select 1 from public.users u where u.id = orders.walker_id and u.auth_id = auth.uid())
);

drop policy if exists "orders_insert_owner_or_admin" on public.orders;
create policy "orders_insert_owner_or_admin"
on public.orders for insert
with check (
  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or exists (select 1 from public.users u where u.id = orders.owner_id and u.auth_id = auth.uid()))
  and (orders.walker_id is null or orders.owner_id <> orders.walker_id)
);

drop policy if exists "orders_update_participant_or_admin" on public.orders;
create policy "orders_update_participant_or_admin"
on public.orders for update
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = orders.owner_id and u.auth_id = auth.uid())
  or exists (select 1 from public.users u where u.id = orders.walker_id and u.auth_id = auth.uid())
)
with check (
  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or exists (select 1 from public.users u where u.id = orders.owner_id and u.auth_id = auth.uid())
    or exists (select 1 from public.users u where u.id = orders.walker_id and u.auth_id = auth.uid()))
  and (orders.walker_id is null or orders.owner_id <> orders.walker_id)
);

drop policy if exists "complaints_select_owner_participant_or_admin" on public.complaints;
create policy "complaints_select_owner_participant_or_admin"
on public.complaints for select
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = complaints.complainant_user_id and u.auth_id = auth.uid())
  or exists (
    select 1
    from public.orders o
    join public.users u on u.id in (o.owner_id, o.walker_id)
    where o.id = complaints.order_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists "complaints_insert_own" on public.complaints;
create policy "complaints_insert_own"
on public.complaints for insert
with check (
  exists (select 1 from public.users u where u.id = complaints.complainant_user_id and u.auth_id = auth.uid())
);

drop policy if exists "complaints_update_admin" on public.complaints;
create policy "complaints_update_admin"
on public.complaints for update
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "reviews_select_participant_or_admin" on public.reviews;
create policy "reviews_select_participant_or_admin"
on public.reviews for select
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id in (reviews.from_user_id, reviews.to_user_id) and u.auth_id = auth.uid())
  or exists (
    select 1
    from public.orders o
    join public.users u on u.id in (o.owner_id, o.walker_id)
    where o.id = reviews.order_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists "reviews_insert_from_self" on public.reviews;
create policy "reviews_insert_from_self"
on public.reviews for insert
with check (
  reviews.from_user_id <> reviews.to_user_id
  and exists (select 1 from public.users u where u.id = reviews.from_user_id and u.auth_id = auth.uid())
);

drop policy if exists "order_tracks_select_order_participant_or_admin" on public.order_tracks;
create policy "order_tracks_select_order_participant_or_admin"
on public.order_tracks for select
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (
    select 1
    from public.orders o
    join public.users u on u.id in (o.owner_id, o.walker_id)
    where o.id = order_tracks.order_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists "order_tracks_insert_assigned_walker_or_admin" on public.order_tracks;
create policy "order_tracks_insert_assigned_walker_or_admin"
on public.order_tracks for insert
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (
    select 1
    from public.orders o
    join public.users u on u.id = order_tracks.walker_user_id
    where o.id = order_tracks.order_id
      and o.walker_id = order_tracks.walker_user_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists "order_checkpoints_select_order_participant_or_admin" on public.order_checkpoints;
create policy "order_checkpoints_select_order_participant_or_admin"
on public.order_checkpoints for select
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (
    select 1
    from public.orders o
    join public.users u on u.id in (o.owner_id, o.walker_id)
    where o.id = order_checkpoints.order_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists "order_checkpoints_insert_assigned_walker_or_admin" on public.order_checkpoints;
create policy "order_checkpoints_insert_assigned_walker_or_admin"
on public.order_checkpoints for insert
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (
    select 1
    from public.orders o
    join public.users u on u.id = order_checkpoints.walker_user_id
    where o.id = order_checkpoints.order_id
      and o.walker_id = order_checkpoints.walker_user_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists "order_media_select_order_participant_or_admin" on public.order_media;
create policy "order_media_select_order_participant_or_admin"
on public.order_media for select
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (
    select 1
    from public.orders o
    join public.users u on u.id in (o.owner_id, o.walker_id)
    where o.id = order_media.order_id
      and u.auth_id = auth.uid()
  )
);

drop policy if exists "order_media_insert_participant_or_admin" on public.order_media;
create policy "order_media_insert_participant_or_admin"
on public.order_media for insert
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (
    select 1
    from public.orders o
    join public.users u on u.id = order_media.uploader_user_id
    where o.id = order_media.order_id
      and u.id in (o.owner_id, o.walker_id)
      and u.auth_id = auth.uid()
  )
);

drop policy if exists "walker_auth_select_own_or_admin" on public.walker_auth;
create policy "walker_auth_select_own_or_admin"
on public.walker_auth for select
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = walker_auth.user_id and u.auth_id = auth.uid())
);

drop policy if exists "walker_auth_insert_own_or_admin" on public.walker_auth;
create policy "walker_auth_insert_own_or_admin"
on public.walker_auth for insert
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = walker_auth.user_id and u.auth_id = auth.uid())
);

drop policy if exists "walker_auth_update_own_or_admin" on public.walker_auth;
create policy "walker_auth_update_own_or_admin"
on public.walker_auth for update
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = walker_auth.user_id and u.auth_id = auth.uid())
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = walker_auth.user_id and u.auth_id = auth.uid())
);

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own"
on public.feedback for insert
with check (
  exists (select 1 from public.users u where u.id = feedback.user_id and u.auth_id = auth.uid())
);

drop policy if exists "feedback_select_own_or_admin" on public.feedback;
create policy "feedback_select_own_or_admin"
on public.feedback for select
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = feedback.user_id and u.auth_id = auth.uid())
);

drop policy if exists "feedback_update_admin" on public.feedback;
create policy "feedback_update_admin"
on public.feedback for update
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "walker_verification_select_own_or_admin" on public.walker_verification;
create policy "walker_verification_select_own_or_admin"
on public.walker_verification for select
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = walker_verification.user_id and u.auth_id = auth.uid())
);

drop policy if exists "walker_verification_insert_own" on public.walker_verification;
create policy "walker_verification_insert_own"
on public.walker_verification for insert
with check (
  exists (select 1 from public.users u where u.id = walker_verification.user_id and u.auth_id = auth.uid())
);

drop policy if exists "walker_verification_update_own_or_admin" on public.walker_verification;
create policy "walker_verification_update_own_or_admin"
on public.walker_verification for update
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = walker_verification.user_id and u.auth_id = auth.uid())
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = walker_verification.user_id and u.auth_id = auth.uid())
);

drop policy if exists "verification_images_select_owner_or_admin" on storage.objects;
create policy "verification_images_select_owner_or_admin"
on storage.objects for select
using (
  bucket_id = 'verification-images'
  and (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists "verification_images_insert_owner" on storage.objects;
create policy "verification_images_insert_owner"
on storage.objects for insert
with check (
  bucket_id = 'verification-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "verification_images_update_owner_or_admin" on storage.objects;
create policy "verification_images_update_owner_or_admin"
on storage.objects for update
using (
  bucket_id = 'verification-images'
  and (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (storage.foldername(name))[1] = auth.uid()::text
  )
)
with check (
  bucket_id = 'verification-images'
  and (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);
