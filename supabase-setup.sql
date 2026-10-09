-- FODMAP-App: Tabellen im gemeinsamen Supabase-Projekt ("All Other Apps").
-- Kann gefahrlos mehrfach ausgeführt werden.

create table if not exists public.fodmap_foods (
  id           bigint generated always as identity primary key,
  name         text not null unique,
  category     text not null,
  rating       text not null check (rating in ('green', 'amber', 'red')),
  safe_portion numeric,                 -- Gramm/ml pro Mahlzeit; null bei "unlimited"
  unit         text check (unit in ('g', 'ml')),
  unlimited    boolean not null default false,
  tier         text not null default 'basic' check (tier in ('basic', 'additional')),
  verify       boolean not null default false,
  checked      date,
  crossed      boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.fodmap_todos (
  id         bigint generated always as identity primary key,
  term       text not null,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.fodmap_foods enable row level security;
alter table public.fodmap_todos enable row level security;

-- Bewusst ohne Login (private App, unkritische Daten).
drop policy if exists "fodmap_foods_select" on public.fodmap_foods;
drop policy if exists "fodmap_foods_insert" on public.fodmap_foods;
drop policy if exists "fodmap_foods_update" on public.fodmap_foods;
create policy "fodmap_foods_select" on public.fodmap_foods for select to anon using (true);
create policy "fodmap_foods_insert" on public.fodmap_foods for insert to anon with check (true);
create policy "fodmap_foods_update" on public.fodmap_foods for update to anon using (true) with check (true);

drop policy if exists "fodmap_todos_select" on public.fodmap_todos;
drop policy if exists "fodmap_todos_insert" on public.fodmap_todos;
drop policy if exists "fodmap_todos_update" on public.fodmap_todos;
drop policy if exists "fodmap_todos_delete" on public.fodmap_todos;
create policy "fodmap_todos_select" on public.fodmap_todos for select to anon using (true);
create policy "fodmap_todos_insert" on public.fodmap_todos for insert to anon with check (true);
create policy "fodmap_todos_update" on public.fodmap_todos for update to anon using (true) with check (true);
create policy "fodmap_todos_delete" on public.fodmap_todos for delete to anon using (true);

grant select, insert, update on public.fodmap_foods to anon;
grant select, insert, update, delete on public.fodmap_todos to anon;
