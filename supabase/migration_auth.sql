-- Reality Shop Ve — Roles de usuario (user_profiles)
-- Ejecutar en Supabase > SQL Editor. Idempotente.
--
-- IMPORTANTE — PASO A MANO (no se puede hacer por SQL):
-- Crea los 4 usuarios en Supabase Dashboard:
--   1. Ve a  Authentication > Users  →  "Add user"
--   2. Marca "Auto Confirm User"
--   3. Crea estos usuarios:
--
--      Email                        Password
--      administrador@reality.com    Realityshop2026.
--      victor@reality.com           123456
--      jeff@reality.com             123456
--      angel@reality.com            123456
--
-- La tabla de abajo le asigna el rol a cada correo.
-- Si un correo no está en user_profiles → rol restringido (sin acceso admin).

create table if not exists public.user_profiles (
  email text primary key,
  role text not null check (role in ('admin','advisor')),
  advisor_name text,
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- Solo lectura desde el cliente (para redirigir tras login).
-- Sin INSERT/UPDATE para anon: los roles se gestionan por SQL o dashboard.
drop policy if exists "user_profiles_select_anon" on public.user_profiles;
create policy "user_profiles_select_anon" on public.user_profiles
  for select to anon using (true);

-- Semilla de usuarios
insert into public.user_profiles (email, role, advisor_name) values
  ('administrador@reality.com', 'admin', null),
  ('victor@reality.com', 'advisor', 'Victor Diaz'),
  ('jeff@reality.com', 'advisor', 'Jeff Carrero'),
  ('angel@reality.com', 'advisor', 'Angel Serrano')
on conflict (email) do nothing;

-- Verificación: debe devolver 4 filas
select * from public.user_profiles order by role, email;
