alter table public.reviews
  add column if not exists is_revealed boolean default false,
  add column if not exists revealed_at timestamptz default null,
  add column if not exists dimension_tags jsonb default '[]'::jsonb,
  add column if not exists private_note text default null;

comment on column public.reviews.is_revealed is 'True after both sides review or after the reveal window expires.';
comment on column public.reviews.dimension_tags is 'Structured review tags.';
