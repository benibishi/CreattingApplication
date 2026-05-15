-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users Table (Extends Supabase Auth)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  role text check (role in ('it_admin', 'supervisor', 'tradesperson')),
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Sites Table
create table public.sites (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  address text,
  supervisor_id uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Tradespeople / Check-ins Table
create table public.site_logs (
  id uuid default uuid_generate_v4() primary key,
  site_id uuid references public.sites(id) on delete cascade,
  user_id uuid references public.profiles(id),
  full_name text, -- Stored for quick display if user deletes account
  company text,
  trade text,
  check_in_time timestamp with time zone default timezone('utc'::text, now()),
  check_out_time timestamp with time zone,
  status text default 'checked_in' check (status in ('checked_in', 'checked_out')),
  photo_url text
);

-- 4. Issues / Reports Table
create table public.issues (
  id uuid default uuid_generate_v4() primary key,
  site_id uuid references public.sites(id) on delete cascade,
  reported_by uuid references public.profiles(id),
  description text not null,
  status text default 'open' check (status in ('open', 'resolved')),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Row Level Security (RLS) Policies
alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.site_logs enable row level security;
alter table public.issues enable row level security;

-- Simple Policies (Allow all for now for testing, tighten later)
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "Sites are viewable by authenticated users" on public.sites for select using (auth.role() = 'authenticated');
create policy "IT Admins and Supervisors can insert sites" on public.sites for insert with check (auth.role() = 'authenticated');

create policy "Logs are viewable by authenticated users" on public.site_logs for select using (auth.role() = 'authenticated');
create policy "Users can insert logs" on public.site_logs for insert with check (auth.role() = 'authenticated');
create policy "Users can update their own logs" on public.site_logs for update using (auth.uid() = user_id);

create policy "Issues are viewable by authenticated users" on public.issues for select using (auth.role() = 'authenticated');
create policy "Users can insert issues" on public.issues for insert with check (auth.role() = 'authenticated');

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'role', new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
