create table if not exists guests (
  id uuid primary key,
  name text not null,
  phone text not null,
  email text,
  dob date,
  id_type text,
  id_number text,
  room text,
  check_in date,
  check_out date,
  status text not null default 'Active',
  monthly_rent numeric(12,2) not null default 0,
  advance_paid numeric(12,2) not null default 0,
  current_month_paid numeric(12,2) not null default 0,
  emergency text,
  address text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guests_room_idx on guests(room);
create index if not exists guests_phone_idx on guests(phone);
