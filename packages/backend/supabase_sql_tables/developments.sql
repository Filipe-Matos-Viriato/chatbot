create table public.developments (
  id uuid not null default extensions.uuid_generate_v4 (),
  client_id uuid not null,
  name text not null,
  location text null,
  amenities jsonb null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint developments_pkey primary key (id)
) TABLESPACE pg_default;