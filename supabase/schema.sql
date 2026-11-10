-- Supabase の SQL Editor でこのファイルの内容を実行してください。
-- 全テーブルで RLS を有効にし、本人の行だけ読み書きできるようにしています。

create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kcal real not null check (kcal >= 0),
  protein real not null check (protein >= 0),
  fat real not null check (fat >= 0),
  carbs real not null check (carbs >= 0),
  serving_g real,
  created_at timestamptz not null default now()
);
create index if not exists foods_user_idx on public.foods (user_id);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null,
  grams real,
  kcal real not null,
  protein real not null,
  fat real not null,
  carbs real not null,
  created_at timestamptz not null default now()
);
create index if not exists meals_user_date_idx on public.meals (user_id, date);

create table if not exists public.weights (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  kg real not null check (kg > 0),
  primary key (user_id, date)
);

alter table public.profiles enable row level security;
alter table public.foods enable row level security;
alter table public.meals enable row level security;
alter table public.weights enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'foods', 'meals', 'weights'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
