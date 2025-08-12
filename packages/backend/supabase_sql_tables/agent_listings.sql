create table public.agent_listings (
  user_id uuid not null,
  listing_id text not null,
  created_at timestamp with time zone null default now(),
  listing_uuid uuid not null,
  constraint agent_listings_pkey primary key (user_id, listing_id),
  constraint agent_listings_user_id_fkey foreign KEY (user_id) references users (id),
  constraint fk_listing_uuid foreign KEY (listing_uuid) references listings (listing_uuid)
) TABLESPACE pg_default;