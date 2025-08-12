create table public.listings (
  id text not null,
  name text null,
  address text null,
  type text null,
  price numeric null,
  beds integer null,
  baths integer null,
  amenities text[] null,
  created_at timestamp with time zone null default now(),
  client_id uuid not null,
  development_id uuid null,
  listing_status text not null default 'available'::text,
  current_state text not null default 'project'::text,
  client_name text null,
  user_id uuid null,
  listing_uuid uuid not null default gen_random_uuid (),
  constraint listings_listing_uuid_pkey primary key (listing_uuid),
  constraint fk_user foreign KEY (user_id) references users (id) on delete set null,
  constraint listings_development_id_fkey foreign KEY (development_id) references developments (id) on delete CASCADE,
  constraint listings_current_state_check check (
    (
      current_state = any (
        array[
          'project'::text,
          'building'::text,
          'finished'::text
        ]
      )
    )
  ),
  constraint listings_listing_status_check check (
    (
      listing_status = any (
        array['available'::text, 'reserved'::text, 'sold'::text]
      )
    )
  )
) TABLESPACE pg_default;



