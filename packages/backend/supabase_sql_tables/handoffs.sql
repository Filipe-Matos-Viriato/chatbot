create table public.handoffs (
  id uuid not null default gen_random_uuid (),
  visitor_id text null,
  listing_id text null,
  reason text null,
  handoff_at timestamp with time zone null default now(),
  client_id text null,
  constraint handoffs_pkey primary key (id)
) TABLESPACE pg_default;