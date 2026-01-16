-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES (Users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  name text,
  age integer,
  weight numeric,
  height numeric,
  gender text,
  goal text,
  experience text,
  somatotype text,
  frequency integer,
  ai_enabled boolean default false,
  streak integer default 0,
  last_workout_date timestamptz,
  avatar_url text,
  subscription jsonb default '{"plan": "free", "status": "active", "startDate": null, "validUntil": null, "autoRenew": false}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PAYMENT AUDIT LOG
create table public.subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  provider text, -- 'mercadopago'
  external_id text,
  plan_id text,
  status text,
  amount numeric,
  currency text,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz default now()
);

-- DONATIONS
create table public.donations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  provider text, -- 'mercadopago'
  external_id text,
  amount numeric not null,
  currency text not null,
  status text not null,
  created_at timestamptz default now()
);

-- RLS for Donations
alter table public.donations enable row level security;

create policy "Users can view own donations" on public.donations
  for select using (auth.uid() = user_id);

-- RLS for Subscriptions (Admin/Service Role only usually, but let's allow read for user)
alter table public.subscriptions enable row level security;

create policy "Users can view own subscription history" on public.subscriptions
  for select using (auth.uid() = user_id);

-- RLS for Profiles
alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- ROUTINES
create table public.routines (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  duration integer, -- minutes
  exercises jsonb not null default '[]'::jsonb,
  tags text[],
  image_url text,
  intensity integer,
  resistance text,
  stats jsonb default '{"strength": 0, "cardio": 0, "technique": 0, "mobility": 0, "impact": 0}'::jsonb,
  is_ai_generated boolean default false,
  is_premium boolean default false,
  created_at timestamptz default now()
);

-- RLS for Routines
alter table public.routines enable row level security;

create policy "Users can view own routines" on public.routines
  for select using (auth.uid() = user_id);

create policy "Users can create own routines" on public.routines
  for insert with check (auth.uid() = user_id);

create policy "Users can update own routines" on public.routines
  for update using (auth.uid() = user_id);

create policy "Users can delete own routines" on public.routines
  for delete using (auth.uid() = user_id);


-- WORKOUT SESSIONS (History)
create table public.sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  routine_id uuid references public.routines(id) on delete set null,
  routine_name text,
  date timestamptz default now(),
  start_time bigint,
  end_time bigint,
  duration_minutes integer,
  total_volume numeric,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

-- RLS for Sessions
alter table public.sessions enable row level security;

create policy "Users can view own sessions" on public.sessions
  for select using (auth.uid() = user_id);

create policy "Users can insert own sessions" on public.sessions
  for insert with check (auth.uid() = user_id);


-- NUTRITION PLANS
create table public.nutrition_plans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  diet_type text,
  description text,
  status text default 'active',
  daily_macros jsonb,
  meals jsonb,
  hydration_goal numeric,
  supplements text[],
  sources text[],
  last_updated timestamptz default now(),
  created_at timestamptz default now()
);

-- RLS for Nutrition Plans
alter table public.nutrition_plans enable row level security;

create policy "Users can view own nutrition plans" on public.nutrition_plans
  for select using (auth.uid() = user_id);

create policy "Users can manage own nutrition plans" on public.nutrition_plans
  for all using (auth.uid() = user_id);

-- DAILY LOGS (Habits)
create table public.daily_logs (
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null default current_date,
  water_intake_liters numeric default 0,
  sleep_hours numeric default 0,
  mood integer check (mood between 1 and 5),
  nutrition_compliance integer default 0,
  notes text,
  created_at timestamptz default now(),
  primary key (user_id, date)
);

alter table public.daily_logs enable row level security;
create policy "Users can manage daily logs" on public.daily_logs for all using (auth.uid() = user_id);

-- BIOMETRICS LOG (History)
create table public.biometrics_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  weight numeric,
  body_fat_percentage numeric,
  muscle_mass_percentage numeric,
  bmi numeric,
  chest_cm numeric,
  waist_cm numeric,
  recorded_at timestamptz default now()
);

alter table public.biometrics_log enable row level security;
create policy "Users can manage biometric logs" on public.biometrics_log for all using (auth.uid() = user_id);

-- STORAGE BUCKETS (If needed)
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public) 
values ('routine-images', 'routine-images', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

create policy "Anyone can upload an avatar"
  on storage.objects for insert
  with check ( bucket_id = 'avatars' );

create policy "Routine images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'routine-images' );
