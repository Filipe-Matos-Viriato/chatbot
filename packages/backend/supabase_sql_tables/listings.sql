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
  client_id text not null default 'client-abc'::text,
  development_id uuid null,
  listing_status text not null default 'available'::text,
  current_state text not null default 'project'::text,
  client_name text null,
  constraint listings_pkey primary key (id),
  constraint listings_development_id_fkey foreign KEY (development_id) references developments (id) ON DELETE CASCADE,
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