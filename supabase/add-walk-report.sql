alter table public.orders
  add column if not exists report_photos jsonb default '[]'::jsonb,
  add column if not exists has_poop boolean default null,
  add column if not exists has_pee boolean default null,
  add column if not exists walker_note text default null,
  add column if not exists walk_distance double precision default null,
  add column if not exists walk_duration integer default null,
  add column if not exists report_submitted_at timestamptz default null;

comment on column public.orders.report_photos is 'Walk report photo URLs stored as a JSONB array.';
comment on column public.orders.report_submitted_at is 'Walk report submission time. NULL means no report yet.';
