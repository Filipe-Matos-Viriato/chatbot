create table public.clustered_questions (
  id bigint generated always as identity not null,
  client_id text not null,
  listing_id text null,
  cluster_id text not null,
  question_text text not null,
  count integer null default 1,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint clustered_questions_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_clustered_questions_client_id on public.clustered_questions using btree (client_id) TABLESPACE pg_default;

create index IF not exists idx_clustered_questions_listing_id on public.clustered_questions using btree (listing_id) TABLESPACE pg_default;

create unique INDEX IF not exists idx_clustered_questions_cluster_id_listing_id on public.clustered_questions using btree (cluster_id, listing_id) TABLESPACE pg_default;