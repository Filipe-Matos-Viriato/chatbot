-- Units
create table if not exists units (
  id uuid primary key,
  project_id uuid not null,
  typology text,
  area_m2 numeric,
  floor integer,
  view text,
  base_price numeric,
  media_urls jsonb,
  features jsonb,
  created_at timestamptz default now()
);

-- Unit status (fresh)
create table if not exists unit_status (
  unit_id uuid references units(id) on delete cascade,
  status text check (status in ('available','reserved','sold')) not null,
  price numeric not null,
  last_update timestamptz default now(),
  primary key (unit_id)
);

-- Build timeline
create table if not exists build_timeline (
  project_id uuid,
  phase text,
  eta_date date,
  notes text
);

-- Price history
create table if not exists price_history (
  unit_id uuid references units(id) on delete cascade,
  dt date,
  price numeric
);

-- Visits
create table if not exists visits (
  id uuid primary key,
  unit_id uuid references units(id) on delete cascade,
  visitor_name text,
  visitor_phone text,
  visitor_email text,
  scheduled_at timestamptz,
  created_at timestamptz default now()
);

-- Short FAQ
create table if not exists faq (
  id serial primary key,
  category text,
  q text,
  a text
);


