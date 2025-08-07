create table public.listing_metrics (
  listing_id text not null,
  client_name text null,
  engaged_users integer null default 0,
  inquiries integer null default 0,
  unacknowledged_hot_leads integer null default 0,
  lead_score_distribution_hot integer null default 0,
  lead_score_distribution_warm integer null default 0,
  lead_score_distribution_cold integer null default 0,
  updated_at timestamp with time zone null default now(),
  conversion_rate numeric null,
  total_conversions integer null default 0,
  client_id text not null default 'client-abc'::text,
  constraint listing_metrics_pkey primary key (listing_id),
  constraint listing_metrics_listing_id_fkey foreign KEY (listing_id) references listings (id) ON DELETE CASCADE
) TABLESPACE pg_default;