create table public.questions (
  id uuid not null default gen_random_uuid (),
  listing_id text null,
  question_text text null,
  status text null,
  count integer null,
  asked_at timestamp with time zone null,
  visitor_id text null,
  client_id text not null default ''::text,
  chatbot_response text null,
  session_id text null,
  listing_uuid uuid null,
  constraint questions_pkey primary key (id),
  constraint questions_listing_uuid_fkey foreign KEY (listing_uuid) references listings (listing_uuid)
) TABLESPACE pg_default;