create table public.question_embeddings (
  id bigint generated always as identity not null,
  question_id uuid not null,
  listing_id text null,
  embedding public.vector not null,
  created_at timestamp with time zone null default now(),
  client_id text not null default 'client-abc'::text,
  constraint question_embeddings_pkey primary key (id),
  constraint question_embeddings_question_id_fkey foreign KEY (question_id) references questions (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_question_embeddings_question_id on public.question_embeddings using btree (question_id) TABLESPACE pg_default;