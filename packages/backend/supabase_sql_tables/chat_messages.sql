create table public.chat_messages (
  id uuid not null default gen_random_uuid (),
  visitor_id text null,
  session_id text null,
  client_id uuid not null,
  message_text text null,
  sender_role text null,
  timestamp timestamp with time zone not null default now(),
  listing_id text null,
  development_id uuid null,
  constraint chat_messages_pkey primary key (id),
  constraint chat_messages_client_id_fkey foreign KEY (client_id) references clients (client_id) on delete CASCADE,
  constraint chat_messages_development_id_fkey foreign KEY (development_id) references developments (id) on delete set null,
  constraint chat_messages_listing_id_fkey foreign KEY (listing_id) references listings (id) on delete set null,
  constraint chat_messages_visitor_id_fkey foreign KEY (visitor_id) references visitors (visitor_id) on delete CASCADE
) TABLESPACE pg_default;


