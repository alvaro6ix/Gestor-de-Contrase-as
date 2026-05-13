-- =====================================================================
-- Gestor de Contraseñas — Migración: Grupos, Categorías y Perfiles
-- Aplicar en: Supabase Studio > SQL Editor > New query > Run
-- Es idempotente: se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- 1. PROFILES — para guardar el rol del usuario (admin, soporte, etc.)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  display_name text,
  role text,                    -- ej: "Administrador TI", "Soporte N1"
  role_color text default '#ffd300',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);


-- 2. GROUPS — un grupo representa un software/sistema (Oscar CRM, SAP, etc.)
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  image_url text,               -- logo del software
  url text,                     -- URL principal del sistema
  color text default '#ffd300',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_groups_user_id on public.groups(user_id);

alter table public.groups enable row level security;

drop policy if exists "groups_select_own" on public.groups;
create policy "groups_select_own" on public.groups
  for select using (auth.uid() = user_id);

drop policy if exists "groups_insert_own" on public.groups;
create policy "groups_insert_own" on public.groups
  for insert with check (auth.uid() = user_id);

drop policy if exists "groups_update_own" on public.groups;
create policy "groups_update_own" on public.groups
  for update using (auth.uid() = user_id);

drop policy if exists "groups_delete_own" on public.groups;
create policy "groups_delete_own" on public.groups
  for delete using (auth.uid() = user_id);


-- 3. CATEGORIES — categorías/roles dentro de un grupo (Admin, Ventas, Soporte...)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  color text default '#ffd300',
  created_at timestamptz default now()
);

create index if not exists idx_categories_group_id on public.categories(group_id);
create index if not exists idx_categories_user_id on public.categories(user_id);

alter table public.categories enable row level security;

drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);


-- 4. PASSWORDS — añadir group_id (opcional) y url (opcional)
alter table public.passwords add column if not exists group_id uuid references public.groups(id) on delete set null;
alter table public.passwords add column if not exists url text;
create index if not exists idx_passwords_group_id on public.passwords(group_id);


-- 5. PASSWORD_CATEGORIES — junction many-to-many (un acceso puede estar en varias categorías)
create table if not exists public.password_categories (
  password_id uuid not null references public.passwords(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (password_id, category_id)
);

create index if not exists idx_password_categories_password on public.password_categories(password_id);
create index if not exists idx_password_categories_category on public.password_categories(category_id);

alter table public.password_categories enable row level security;

drop policy if exists "password_categories_select_own" on public.password_categories;
create policy "password_categories_select_own" on public.password_categories
  for select using (auth.uid() = user_id);

drop policy if exists "password_categories_insert_own" on public.password_categories;
create policy "password_categories_insert_own" on public.password_categories
  for insert with check (auth.uid() = user_id);

drop policy if exists "password_categories_delete_own" on public.password_categories;
create policy "password_categories_delete_own" on public.password_categories
  for delete using (auth.uid() = user_id);


-- 6. Trigger para actualizar updated_at automáticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_groups_updated_at on public.groups;
create trigger trg_groups_updated_at before update on public.groups
  for each row execute function public.set_updated_at();

-- =====================================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================================
