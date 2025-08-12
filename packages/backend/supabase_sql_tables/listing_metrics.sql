create table public.listing_metrics (
  listing_id text not null,
  engaged_users integer null default 0,
  inquiries integer null default 0,
  unacknowledged_hot_leads integer null default 0,
  lead_score_distribution_hot integer null default 0,
  lead_score_distribution_warm integer null default 0,
  lead_score_distribution_cold integer null default 0,
  updated_at timestamp with time zone null default now(),
  conversion_rate numeric null,
  total_conversions integer null default 0,
  client_id uuid not null,
  client_name text null,
  listing_uuid uuid null,
  constraint listing_metrics_pkey primary key (listing_id),
  constraint listing_metrics_listing_uuid_fkey foreign KEY (listing_uuid) references listings (listing_uuid)
) TABLESPACE pg_default;