-- EDAI · Rutas de servicio (hoja de ruta) + permisos por módulo
-- Ejecutar UNA vez en SQL Editor (después de schema.sql, taller.sql y panel.sql).

-- 1. PERMISOS POR MÓDULO: el administrador decide quién puede entrar a Rutas
create table if not exists user_modules (
  user_id uuid not null references auth.users on delete cascade,
  module text not null check (module in ('rutas')),
  primary key (user_id, module)
);
alter table user_modules enable row level security;
drop policy if exists "ver mis modulos" on user_modules;
drop policy if exists "admin asigna modulos" on user_modules;
drop policy if exists "admin quita modulos" on user_modules;
create policy "ver mis modulos" on user_modules for select to authenticated using (user_id = auth.uid() or is_admin());
create policy "admin asigna modulos" on user_modules for insert to authenticated with check (is_admin());
create policy "admin quita modulos" on user_modules for delete to authenticated using (is_admin());

create or replace function has_module(m text) returns boolean
language sql security definer stable set search_path = '' as $$
  select public.is_admin() or exists (select 1 from public.user_modules where user_id = auth.uid() and module = m);
$$;

-- 2. TÉCNICOS
create table if not exists rt_technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  area text not null default '',
  phone text not null default '',
  active boolean not null default true,
  off_from date,
  off_to date,
  off_reason text not null default '',
  created_at timestamptz not null default now()
);

-- 3. RUTAS (una por salida)
create sequence if not exists rt_route_number_seq start 384;
create table if not exists rt_routes (
  id uuid primary key default gen_random_uuid(),
  number int not null default nextval('rt_route_number_seq'),
  year int not null,
  week int not null,
  tech_id uuid references rt_technicians on delete set null,
  support uuid[] not null default '{}',
  vehicle_id uuid references insp_vehicles on delete set null,
  depart_date date not null,
  depart_time time,
  return_date date,
  cash numeric not null default 0,
  work_days int,
  status text not null default 'borrador' check (status in ('borrador','confirmada','cerrada')),
  notes text not null default '',
  created_by uuid default auth.uid(),
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists rt_routes_dates on rt_routes (depart_date);

-- 4. SOLICITUDES / VISITAS (una solicitud pasa a ser visita al asignarla a una ruta)
create table if not exists rt_requests (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references rt_routes on delete set null,
  client text not null,
  brand text not null default '',
  machine text not null default '',
  model text not null default '',
  call_date date,
  zone text not null default '',
  contact text not null default '',
  meeting_point text not null default '',
  job text not null default '',
  warranty boolean not null default false,
  credit boolean not null default false,
  priority int not null default 2 check (priority between 1 and 3),
  status text not null default 'pendiente' check (status in ('pendiente','asignada','hecha','cancelada')),
  visit_date date,
  amount numeric,
  paid_date date,
  notes text not null default '',
  created_by uuid default auth.uid(),
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists rt_requests_route on rt_requests (route_id);

-- 5. HISTORIAL DE CAMBIOS DE CADA RUTA
create table if not exists rt_changes (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references rt_routes on delete cascade,
  who text not null default '',
  what text not null,
  at timestamptz not null default now()
);

-- 6. SEGURIDAD: solo usuarios con el módulo (y administradores)
alter table rt_technicians enable row level security;
alter table rt_routes enable row level security;
alter table rt_requests enable row level security;
alter table rt_changes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['rt_technicians','rt_routes','rt_requests','rt_changes'] loop
    execute format('drop policy if exists "ver %1$s" on %1$s', t);
    execute format('drop policy if exists "crear %1$s" on %1$s', t);
    execute format('drop policy if exists "editar %1$s" on %1$s', t);
    execute format('drop policy if exists "borrar %1$s" on %1$s', t);
    execute format('create policy "ver %1$s" on %1$s for select to authenticated using (has_module(''rutas''))', t);
    execute format('create policy "crear %1$s" on %1$s for insert to authenticated with check (has_module(''rutas''))', t);
    execute format('create policy "borrar %1$s" on %1$s for delete to authenticated using (is_admin())', t);
  end loop;
  foreach t in array array['rt_technicians','rt_routes','rt_requests'] loop
    execute format('create policy "editar %1$s" on %1$s for update to authenticated using (has_module(''rutas'')) with check (has_module(''rutas''))', t);
  end loop;
end $$;

-- 7. Técnicos de tu hoja RRHH (sin teléfonos; se completan después)
insert into rt_technicians (name, area) values
  ('Jaime Alvarado','Tractores'),('Raul Sosa','Tractores'),('Milton Ollisco','Tractores'),('Liber Vargas','Tractores'),
  ('Marcelo Soquere','Cosechadoras'),('Marco Rueda','Cosechadoras'),('Yery Salazar','Cosechadoras'),
  ('Gerson Cruz','Maq. pesadas'),('Hociel Zuñiga','Maq. pesadas'),
  ('Alfredo Chipana','Electricidad'),('Willian Soruco','Electricidad'),('Carlos Velasco','Electricidad'),
  ('Mario Seña','Otros'),('Ignacio Tosube','Equipos livianos'),('Sergio Tacahua','Equipos livianos'),
  ('Gabriel Ojeda','Ayudante'),('Oliver Miranda','Ayudante'),('Jorge Arteaga','Ayudante'),('Renan Yllescas','Ayudante'),
  ('Franco Rueda','Ayudante'),('Aurelio Supayabe','Ayudante'),('Franz Vallejos','Ayudante')
on conflict (name) do nothing;
