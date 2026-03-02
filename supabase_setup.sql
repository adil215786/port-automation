-- Run this entire script in Supabase > SQL Editor > New Query

-- Users table
create table if not exists users (
  user_id text primary key,
  username text unique not null,
  pin_hash text not null,
  display_name text,
  store_name text,
  is_admin boolean default false,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Orders table
create table if not exists orders (
  order_id text primary key,
  user_id text not null,
  username text,
  store_name text,
  np_order_id text,
  item_id text,
  area_code text,
  status text default 'pending',
  phone_number text,
  account_id text,
  pin text,
  cost numeric,
  requested_at timestamptz default now(),
  completed_at timestamptz
);

-- Config table
create table if not exists config (
  setting_name text primary key,
  setting_value text
);

-- Config history
create table if not exists config_history (
  id bigserial primary key,
  changed_at timestamptz default now(),
  changed_by text,
  product_type text,
  allowed_area_codes text
);

-- Auth table (stores NP token, always 1 row)
create table if not exists auth (
  id integer primary key default 1,
  np_token text,
  token_obtained_at timestamptz
);

-- Default config rows
insert into config (setting_name, setting_value) values
  ('product_type', 'METRO_CUSTOM_NUMBER'),
  ('allowed_area_codes', '215,267,732,856,609,908,973,201')
on conflict (setting_name) do nothing;

-- IMPORTANT: Disable Row Level Security so your service key can read/write freely
alter table users disable row level security;
alter table orders disable row level security;
alter table config disable row level security;
alter table config_history disable row level security;
alter table auth disable row level security;

-- Done! Now create your first admin user by running this (replace values):
-- insert into users (user_id, username, pin_hash, display_name, store_name, is_admin, is_active)
-- values (
--   'admin001',
--   'admin',
--   encode(sha256('1234'::bytea), 'hex'),   -- PIN is 1234, change this
--   'Admin User',
--   'HQ',
--   true,
--   true
-- );
