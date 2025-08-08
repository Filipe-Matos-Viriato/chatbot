create table if not exists public.documents (
  id uuid not null default gen_random_uuid(),
  client_id text not null,
  document_name text not null,
  document_category text null,
  listing_id text null,
  development_id uuid null,
  created_at timestamp with time zone null default now(),
  constraint documents_pkey primary key (id)
) TABLESPACE pg_default;


