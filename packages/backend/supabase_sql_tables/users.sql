create table public.users (
  id uuid not null default gen_random_uuid (),
  client_id uuid not null,
  email text not null,
  password_hash text not null,
  role text not null default 'promoter'::text,
  agent_name text not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_client_id_fkey foreign KEY (client_id) references clients (client_id)
) TABLESPACE pg_default;