-- packages/backend/supabase_sql_tables/chat_messages.sql
-- This file defines the schema for the chat_messages table, which stores individual chat messages for dashboard display.
-- This table exists to provide a granular, turn-by-turn chat history, separate from the questions table used for common questions and embeddings.
-- Relevant files: packages/backend/src/index.js, packages/frontend/src/dashboard/listing-performance-tab/components/listing-details/ChatHistoryPage.jsx

create table public.chat_messages (
  id uuid not null default gen_random_uuid (),
  visitor_id text null,
  session_id text null,
  client_id uuid not null, -- Corrected to UUID
  message_text text null,
  sender_role text null,
  timestamp timestamp with time zone not null default now(),
  listing_id text null,
  development_id uuid null,
  constraint chat_messages_pkey primary key (id),
  constraint chat_messages_visitor_id_fkey foreign key (visitor_id) references public.visitors (visitor_id) on delete cascade,
  constraint chat_messages_client_id_fkey foreign key (client_id) references public.clients (client_id) on delete cascade, -- Corrected reference
  constraint chat_messages_listing_id_fkey foreign key (listing_id) references public.listings (id) on delete set null,
  constraint chat_messages_development_id_fkey foreign key (development_id) references public.developments (id) on delete set null
) TABLESPACE pg_default;