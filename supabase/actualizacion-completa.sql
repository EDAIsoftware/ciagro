-- EDAI · ACTUALIZACIÓN COMPLETA (seguro de ejecutar más de una vez)
-- Pega todo en Supabase > SQL Editor > Run.

-- ============ taller.sql ============
-- EDAI · Inspección de taller, prioridades, cambio de dueño y ajuste de combustible
-- Ejecutar UNA vez en SQL Editor (después de schema.sql e inspecciones.sql).

-- 1. COMBUSTIBLE: rendimiento y saldo inicial por camioneta (no cambia lo cargado ni lo extraído)
alter table vehicles add column if not exists kmpl numeric;
alter table vehicles add column if not exists opening_liters numeric not null default 0;

-- 2. INSPECCIONES: datos del vehículo y mantenimiento
alter table insp_vehicles add column if not exists year text not null default '';
alter table insp_vehicles add column if not exists chassis text not null default '';
alter table insp_vehicles add column if not exists km_next numeric;
alter table insp_vehicles add column if not exists km_interval numeric not null default 8000;

-- Nuevo tipo de formulario: taller
alter table inspections drop constraint if exists inspections_kind_check;
alter table inspections add constraint inspections_kind_check check (kind in ('inspeccion','recepcion','taller'));

-- 3. OBSERVACIONES CON PRIORIDAD (A = alta/rojo, M = media/amarillo, B = baja/verde)
create table if not exists insp_observations (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references insp_vehicles on delete cascade,
  inspection_id uuid not null references inspections on delete cascade,
  text text not null,
  priority text not null check (priority in ('A','M','B')),
  photo text,
  done boolean not null default false,
  done_at timestamptz,
  done_by text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists insp_obs_open on insp_observations (done, priority);
alter table insp_observations enable row level security;
drop policy if exists "ver observaciones" on insp_observations;
drop policy if exists "registrar observaciones" on insp_observations;
drop policy if exists "resolver observaciones" on insp_observations;
drop policy if exists "admin borra observaciones" on insp_observations;
create policy "ver observaciones" on insp_observations for select to authenticated using (true);
create policy "registrar observaciones" on insp_observations for insert to authenticated with check (created_by = auth.uid());
create policy "resolver observaciones" on insp_observations for update to authenticated using (true) with check (true);
create policy "admin borra observaciones" on insp_observations for delete to authenticated using (is_admin());
-- Solo se puede cambiar el estado de resuelta; el texto y la prioridad no se editan
revoke update on insp_observations from authenticated;
grant update (done, done_at, done_by) on insp_observations to authenticated;

-- 4. HISTORIAL DE CAMBIOS DE DUEÑO
create table if not exists insp_owner_log (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references insp_vehicles on delete cascade,
  old_owner text,
  new_owner text not null,
  reason text not null default '',
  date date not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table insp_owner_log enable row level security;
drop policy if exists "ver dueños" on insp_owner_log;
drop policy if exists "admin registra dueños" on insp_owner_log;
drop policy if exists "admin borra dueños" on insp_owner_log;
create policy "ver dueños" on insp_owner_log for select to authenticated using (true);
create policy "admin registra dueños" on insp_owner_log for insert to authenticated with check (is_admin() and created_by = auth.uid());
create policy "admin borra dueños" on insp_owner_log for delete to authenticated using (is_admin());

-- 5. VEHÍCULOS de Maquinaria e Insumos (solo placa, dueño, marca y área; sin historial)
insert into insp_vehicles (name, plate, area, driver) values
  ('Mitsubishi Triton', '5007-LDU', 'Maquinaria', 'ADM'),
  ('Fiat', '5204-RHU', 'Maquinaria', 'ANDRES ROJAS'),
  ('Jeep Suzuki Jimny', '3875-DFL', 'Maquinaria', 'ADM'),
  ('Mitsubishi Triton', '4789-DXF', 'Maquinaria', 'VICTOR RIVERA'),
  ('Toyota Hilux', '1893-UHP', 'Maquinaria', 'LUIS MADRID'),
  ('Fullback', '5300-XCY', 'Maquinaria', 'SHERLIN'),
  ('Toyota Hilux', '5743-BUY', 'Maquinaria', 'RAMIRO FERNANDEZ'),
  ('Toyota Hilux 4x4', '4470-FLA', 'Maquinaria', 'ELVIS TORREZ'),
  ('Camioneta', '6697-HYG', 'Maquinaria', 'LUIS FEENEY'),
  ('Fullback', '5300-XIX', 'Maquinaria', 'FREDDY CAMPO'),
  ('Camioneta', '4692-APB', 'Maquinaria', 'OLIVER MIRANDA'),
  ('Mitsubishi Triton', '6358-KDL', 'Insumos', 'RUDDY FERNADEZ'),
  ('Toyota Hilux', '5743-CAK', 'Insumos', 'MAURICIO LAGUNA'),
  ('Toyota Hilux', '4692-ATL', 'Insumos', 'PEDRO MONTERO'),
  ('Mitsubishi Triton', '4788-UUI', 'Insumos', 'RUBEN TERRAZAS'),
  ('Camioneta', '6646-UYB', 'Insumos', 'RAUL HURTADO'),
  ('Fiat', '5204-RGR', 'Insumos', 'LIMBER GARCIA'),
  ('Mitsubishi Triton', '5005-AZC', 'Insumos', 'ERICK CASTELLÓN'),
  ('Fiat', '5204-REH', 'Insumos', 'WALTER MONTAÑO'),
  ('Mitsubishi L200', '5771-FNB', 'Insumos', 'SHERLYN'),
  ('Camioneta', '6698-DNH', 'Insumos', 'RICARDO ARAUZ'),
  ('Mitsubishi L200', '6326-XSB', 'Insumos', 'FERNADO MUSTAFA'),
  ('Mitsubishi L200', '6326-XZU', 'Insumos', 'JURGEN PINTO'),
  ('Mitsubishi L200', '6326-XTE', 'Insumos', 'EVERTH VALDA'),
  ('Fullback', '5346-SEE', 'Insumos', 'LUIS DAVID VARGAS'),
  ('Camioneta', '6646-YGF', 'Insumos', 'ANUNCIO')
on conflict (plate) do nothing;

-- ============ servicio.sql ============
-- EDAI · Copiar a Inspecciones las camionetas del área de Servicio
-- (las que ya están registradas en el control de combustible).
-- Se puede ejecutar más de una vez: las placas que ya existen no se duplican.
insert into insp_vehicles (name, plate, area, driver, odometer)
select name, plate, 'Servicio', driver, odometer from vehicles
on conflict (plate) do nothing;

-- ============ prioridad.sql ============
-- EDAI · Permitir cambiar la prioridad de una observación
-- (lo puede hacer quien la registró o el administrador). Ejecutar una vez.
grant update (priority) on insp_observations to authenticated;

create or replace function guard_obs_priority() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.priority is distinct from old.priority and not (public.is_admin() or old.created_by = auth.uid()) then
    raise exception 'Solo quien registró la observación o el administrador puede cambiar la prioridad';
  end if;
  return new;
end $$;

drop trigger if exists obs_priority_guard on insp_observations;
create trigger obs_priority_guard before update on insp_observations
  for each row execute function guard_obs_priority();

-- ============ nombre.sql ============
-- EDAI · Cada usuario puede cambiar su propio nombre (no su rol). Ejecutar una vez.
drop policy if exists "editar mi nombre" on profiles;
create policy "editar mi nombre" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Solo la columna del nombre se puede modificar desde la plataforma
revoke update on profiles from authenticated;
grant update (full_name) on profiles to authenticated;

-- ============ panel.sql ============
-- EDAI · Visitas a taller (formulario simple) y seguimiento de la ronda de revisión de 15 días
-- Ejecutar UNA vez en SQL Editor (después de taller.sql).

-- 1. VISITAS A TALLER (se pueden completar después: fecha de salida y trabajos realizados)
create table if not exists insp_workshop (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references insp_vehicles on delete cascade,
  entry_date date not null,
  exit_date date,
  km numeric,
  reason text not null,
  reason_note text not null default '',
  shop text not null default '',
  work text not null default '',
  created_by uuid default auth.uid(),
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists insp_workshop_vehicle on insp_workshop (vehicle_id, entry_date desc);
alter table insp_workshop enable row level security;
drop policy if exists "ver taller" on insp_workshop;
drop policy if exists "registrar taller" on insp_workshop;
drop policy if exists "completar taller" on insp_workshop;
drop policy if exists "admin borra taller" on insp_workshop;
create policy "ver taller" on insp_workshop for select to authenticated using (true);
create policy "registrar taller" on insp_workshop for insert to authenticated with check (created_by = auth.uid());
create policy "completar taller" on insp_workshop for update to authenticated using (true) with check (true);
create policy "admin borra taller" on insp_workshop for delete to authenticated using (is_admin());
-- Solo se pueden completar estos datos; el vehículo, la fecha de ingreso y el motivo no se editan
revoke update on insp_workshop from authenticated;
grant update (exit_date, work, shop, reason_note) on insp_workshop to authenticated;

-- El kilometraje de ingreso actualiza el odómetro del vehículo
create or replace function sync_odometer_work() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.km is not null then
    update public.insp_vehicles set odometer = greatest(odometer, new.km) where id = new.vehicle_id;
  end if;
  return new;
end $$;
drop trigger if exists workshop_odometer on insp_workshop;
create trigger workshop_odometer after insert on insp_workshop for each row execute function sync_odometer_work();

-- 2. RONDA DE REVISIÓN: a quién ya se le pidió la camioneta en cada quincena
create table if not exists insp_requests (
  vehicle_id uuid not null references insp_vehicles on delete cascade,
  period text not null,
  requested_by text not null default '',
  requested_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  primary key (vehicle_id, period)
);
alter table insp_requests enable row level security;
drop policy if exists "ver pedidos" on insp_requests;
drop policy if exists "marcar pedido" on insp_requests;
drop policy if exists "quitar pedido" on insp_requests;
create policy "ver pedidos" on insp_requests for select to authenticated using (true);
create policy "marcar pedido" on insp_requests for insert to authenticated with check (created_by = auth.uid());
create policy "quitar pedido" on insp_requests for delete to authenticated using (true);

-- ============ rutas.sql ============
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

-- ============ preparacion.sql ============
-- EDAI · Preparación de tractores e implementos + permisos por módulo para TODO
-- Ejecutar UNA vez en SQL Editor (después de rutas.sql). Seguro de repetir.

-- 1. MÓDULOS: combustible, inspecciones, rutas, tractores, implementos
alter table user_modules drop constraint if exists user_modules_module_check;
alter table user_modules add constraint user_modules_module_check
  check (module in ('combustible','inspecciones','rutas','tractores','implementos'));

-- Los usuarios que ya existen conservan su acceso actual a combustible e inspecciones
insert into user_modules (user_id, module)
select p.id, m from profiles p, unnest(array['combustible','inspecciones']) as m
on conflict do nothing;

create or replace function my_modules() returns text[]
language sql security definer stable set search_path = '' as $$
  select case when public.is_admin()
    then array['combustible','inspecciones','rutas','tractores','implementos']
    else coalesce((select array_agg(module) from public.user_modules where user_id = auth.uid()), '{}'::text[]) end;
$$;

-- 2. COMBUSTIBLE: solo con el módulo
drop policy if exists "ver vehiculos" on vehicles;
create policy "ver vehiculos" on vehicles for select to authenticated using (has_module('combustible'));
drop policy if exists "ver cargas" on loads;
create policy "ver cargas" on loads for select to authenticated using (has_module('combustible'));
drop policy if exists "registrar cargas" on loads;
create policy "registrar cargas" on loads for insert to authenticated with check (has_module('combustible') and created_by = auth.uid());
drop policy if exists "ver salidas" on transfers;
create policy "ver salidas" on transfers for select to authenticated using (has_module('combustible'));
drop policy if exists "registrar salidas" on transfers;
create policy "registrar salidas" on transfers for insert to authenticated with check (has_module('combustible') and created_by = auth.uid());

-- 3. INSPECCIONES Y TALLER: solo con el módulo (las rutas pueden leer vehículos, taller y pendientes para sus avisos)
drop policy if exists "ver insp_vehicles" on insp_vehicles;
create policy "ver insp_vehicles" on insp_vehicles for select to authenticated using (has_module('inspecciones') or has_module('rutas'));
drop policy if exists "ver inspecciones" on inspections;
create policy "ver inspecciones" on inspections for select to authenticated using (has_module('inspecciones'));
drop policy if exists "registrar inspecciones" on inspections;
create policy "registrar inspecciones" on inspections for insert to authenticated with check (has_module('inspecciones') and created_by = auth.uid());
drop policy if exists "ver observaciones" on insp_observations;
create policy "ver observaciones" on insp_observations for select to authenticated using (has_module('inspecciones') or has_module('rutas'));
drop policy if exists "registrar observaciones" on insp_observations;
create policy "registrar observaciones" on insp_observations for insert to authenticated with check (has_module('inspecciones') and created_by = auth.uid());
drop policy if exists "resolver observaciones" on insp_observations;
create policy "resolver observaciones" on insp_observations for update to authenticated using (has_module('inspecciones')) with check (has_module('inspecciones'));
drop policy if exists "ver dueños" on insp_owner_log;
create policy "ver dueños" on insp_owner_log for select to authenticated using (has_module('inspecciones'));
drop policy if exists "ver taller" on insp_workshop;
create policy "ver taller" on insp_workshop for select to authenticated using (has_module('inspecciones') or has_module('rutas'));
drop policy if exists "registrar taller" on insp_workshop;
create policy "registrar taller" on insp_workshop for insert to authenticated with check (has_module('inspecciones') and created_by = auth.uid());
drop policy if exists "completar taller" on insp_workshop;
create policy "completar taller" on insp_workshop for update to authenticated using (has_module('inspecciones')) with check (has_module('inspecciones'));
drop policy if exists "ver pedidos" on insp_requests;
create policy "ver pedidos" on insp_requests for select to authenticated using (has_module('inspecciones'));
drop policy if exists "marcar pedido" on insp_requests;
create policy "marcar pedido" on insp_requests for insert to authenticated with check (has_module('inspecciones') and created_by = auth.uid());
drop policy if exists "quitar pedido" on insp_requests;
create policy "quitar pedido" on insp_requests for delete to authenticated using (has_module('inspecciones'));

drop policy if exists "inspecciones subir" on storage.objects;
create policy "inspecciones subir" on storage.objects for insert to authenticated with check (bucket_id = 'inspecciones' and public.has_module('inspecciones'));
drop policy if exists "inspecciones ver" on storage.objects;
create policy "inspecciones ver" on storage.objects for select to authenticated using (bucket_id = 'inspecciones' and public.has_module('inspecciones'));

-- 4. PREPARACIÓN: tractores e implementos son independientes (cada uno con su propio módulo)
create table if not exists pr_units (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('tractores','implementos')),
  brand text not null default '',
  model text not null,
  serial text not null default '',
  client text not null default '',
  arrival_date date not null default current_date,
  promised_date date,
  status text not null default 'por_hacer' check (status in ('por_hacer','en_proceso','finalizado')),
  started_at date,
  finished_at date,
  owner_name text not null default '',
  notes text not null default '',
  created_by uuid default auth.uid(),
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists pr_units_area_status on pr_units (area, status);

create table if not exists pr_issues (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references pr_units on delete cascade,
  text text not null,
  resolved boolean not null default false,
  resolved_at timestamptz,
  by_name text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table pr_units enable row level security;
alter table pr_issues enable row level security;
drop policy if exists "ver unidades" on pr_units;
drop policy if exists "crear unidades" on pr_units;
drop policy if exists "editar unidades" on pr_units;
drop policy if exists "borrar unidades" on pr_units;
create policy "ver unidades" on pr_units for select to authenticated using (has_module(area));
create policy "crear unidades" on pr_units for insert to authenticated with check (has_module(area));
create policy "editar unidades" on pr_units for update to authenticated using (has_module(area)) with check (has_module(area));
create policy "borrar unidades" on pr_units for delete to authenticated using (is_admin());

drop policy if exists "ver problemas" on pr_issues;
drop policy if exists "crear problemas" on pr_issues;
drop policy if exists "editar problemas" on pr_issues;
drop policy if exists "borrar problemas" on pr_issues;
create policy "ver problemas" on pr_issues for select to authenticated using (exists (select 1 from pr_units u where u.id = unit_id and has_module(u.area)));
create policy "crear problemas" on pr_issues for insert to authenticated with check (exists (select 1 from pr_units u where u.id = unit_id and has_module(u.area)));
create policy "editar problemas" on pr_issues for update to authenticated using (exists (select 1 from pr_units u where u.id = unit_id and has_module(u.area))) with check (exists (select 1 from pr_units u where u.id = unit_id and has_module(u.area)));
create policy "borrar problemas" on pr_issues for delete to authenticated using (is_admin());
-- Del problema solo se puede cambiar si está resuelto; el texto no se edita
revoke update on pr_issues from authenticated;
grant update (resolved, resolved_at) on pr_issues to authenticated;

-- ============ impresion.sql ============
-- EDAI · Cola de impresión remota de las hojas de ruta. Ejecutar una vez (después de rutas.sql).
create table if not exists rt_print_jobs (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references rt_routes on delete cascade,
  requested_by_name text not null default '',
  requested_at timestamptz not null default now(),
  printed_at timestamptz,
  created_by uuid default auth.uid()
);
alter table rt_print_jobs enable row level security;
drop policy if exists "ver cola de impresion" on rt_print_jobs;
drop policy if exists "pedir impresion" on rt_print_jobs;
drop policy if exists "marcar impreso" on rt_print_jobs;
drop policy if exists "borrar cola de impresion" on rt_print_jobs;
create policy "ver cola de impresion" on rt_print_jobs for select to authenticated using (has_module('rutas'));
create policy "pedir impresion" on rt_print_jobs for insert to authenticated with check (has_module('rutas') and created_by = auth.uid());
create policy "marcar impreso" on rt_print_jobs for update to authenticated using (has_module('rutas')) with check (has_module('rutas'));
create policy "borrar cola de impresion" on rt_print_jobs for delete to authenticated using (is_admin());
revoke update on rt_print_jobs from authenticated;
grant update (printed_at) on rt_print_jobs to authenticated;

-- ============ frecuencia.sql ============
-- EDAI · Frecuencia de inspección por camioneta (quincenal, mensual o sin recordatorio)
-- Seguro de repetir. Las camionetas del área "Total Agro" se marcan mensual solo la primera vez.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'insp_vehicles' and column_name = 'insp_freq') then
    alter table insp_vehicles add column insp_freq text not null default 'quincenal';
    update insp_vehicles set insp_freq = 'mensual' where lower(replace(area, ' ', '')) = 'totalagro';
  end if;
end $$;
alter table insp_vehicles drop constraint if exists insp_vehicles_insp_freq_check;
alter table insp_vehicles add constraint insp_vehicles_insp_freq_check check (insp_freq in ('quincenal','mensual','manual'));

-- ============ firmas.sql ============
-- EDAI · Firmas de entrega y corrección de inspecciones ya guardadas. Seguro de repetir.
-- Cualquier usuario con el módulo puede agregar las firmas UNA vez (mientras no tenga firmas).
-- Solo el administrador puede corregir el contenido (puntos, kilometraje, nombres, etc.).
revoke update on inspections from authenticated;
grant update (date, place, driver, km, fuel_level, items, notes, signatures, extra) on inspections to authenticated;

drop policy if exists "firmar entrega" on inspections;
create policy "firmar entrega" on inspections for update to authenticated
  using (has_module('inspecciones') and signatures = '{}'::jsonb)
  with check (has_module('inspecciones'));

drop policy if exists "admin edita inspecciones" on inspections;
create policy "admin edita inspecciones" on inspections for update to authenticated
  using (is_admin()) with check (is_admin());

-- Un usuario que no es administrador solo puede cambiar las firmas y los datos de la entrega
create or replace function guard_inspection_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.is_admin() and (
       new.date is distinct from old.date or new.place is distinct from old.place or new.driver is distinct from old.driver
    or new.km is distinct from old.km or new.fuel_level is distinct from old.fuel_level
    or new.items is distinct from old.items or new.notes is distinct from old.notes) then
    raise exception 'Solo el administrador puede editar el contenido de una inspección';
  end if;
  return new;
end $$;
drop trigger if exists inspections_guard on inspections;
create trigger inspections_guard before update on inspections for each row execute function guard_inspection_update();

-- ============ clientes.sql ============
-- EDAI · Catálogo de clientes para las rutas de servicio (con sus máquinas). Seguro de repetir.
-- Al escribir un cliente en una solicitud aparece para elegirlo y se completan sus datos (editables).
-- Cada solicitud nueva agrega o actualiza el cliente y sus máquinas automáticamente.
create table if not exists rt_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null default '',
  zone text not null default '',
  meeting_point text not null default '',
  machines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists rt_clients_name_uq on rt_clients (lower(name));
alter table rt_clients enable row level security;
drop policy if exists "rutas usa clientes" on rt_clients;
create policy "rutas usa clientes" on rt_clients for all to authenticated using (has_module('rutas')) with check (has_module('rutas'));

-- Clientes de la planilla HOJA DE RUTA - SEMANA 42 (solo se agregan los que no existen)
insert into rt_clients (name, contact, zone, meeting_point, machines) values
  ('FAMOSA(CIA.IND. COMERCIAL HNOS. VICENTE SRL)', '67712572 - MARCIAL', 'Norte', 'PROPIEDAD HUALTACO', '[{"brand": "DEVELON", "machine": "EXCAVADORA", "model": "DX225 LCA"}]'::jsonb),
  ('ANTONIO ANTELO', '74754615', 'Este', 'SAN PABLO', '[{"brand": "DEVELON", "machine": "EXCAVADORA", "model": "DX225LCA-7M"}]'::jsonb),
  ('CLAROS FLORENCIO', '67717855', 'Este', 'SAN PABLO', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "T6.130"}]'::jsonb),
  ('MORALES CONDORI SABINA', '67763915 - SABINA', 'Este', 'SAN PABLO', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "T7.180"}]'::jsonb),
  ('JHONNY ESTRADA', '67882494', 'Este', 'SAN PABLO - COMUNIDAD 19 DE MARZO', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "T6.130"}]'::jsonb),
  ('DOMINGO BAUTISTA', '73646308 - VICENTE', 'Este', 'GUARAYOS - NUEVA JERUZALEN', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "T7.180"}]'::jsonb),
  ('KERIGMA INVERSIONES S.A.', '', 'Este', 'QUIMOME', '[{"brand": "DEVELON", "machine": "EXCAVADORA", "model": "DX225LCA"}]'::jsonb),
  ('AGROPECUARIA ALGARROBAL', '71033233', 'Este', 'POZO DEL TIGRE', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "T5070"}]'::jsonb),
  ('INDUSTRIA DE FIBRA DE MADERA SCHWARTZ VRENA S.R.L.', '62244837 - SHRILEY', 'Norte', 'PORTACHUELO', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "8030"}]'::jsonb),
  ('MADRILES DF&R', '78513262--FEDERICO', 'Este', 'PAILON', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "T7.200"}]'::jsonb),
  ('BJ RANCHO', '', 'Este', 'POZO DEL TIGRE', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "TM150"}]'::jsonb),
  ('JOSE LUIS VARGAS ORTEGA', '77640029', 'Este', 'SAN PABLO', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "6630"}]'::jsonb),
  ('PABLO RIOJA', '72919502 - PABLO', 'Este', 'SAN PABLO', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "T7.150"}]'::jsonb),
  ('CIAGRO', '-', 'Norte', 'EXPOVIDAS', '[{"brand": "VARIOS", "machine": "VARIOS", "model": "VARIOS"}]'::jsonb)
on conflict (lower(name)) do nothing;

-- ============ catalogo.sql ============
-- EDAI · Catálogo de marcas, máquinas y modelos agregados por los usuarios (rutas de servicio). Seguro de repetir.
-- Lo que se escribe en una solicitud y no está en la lista se guarda aquí y aparece para todos la próxima vez.
create table if not exists rt_catalog (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('marca','maquina','modelo')),
  brand text not null default '',
  name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists rt_catalog_uq on rt_catalog (kind, lower(brand), lower(name));
alter table rt_catalog enable row level security;
drop policy if exists "rutas usa catalogo" on rt_catalog;
create policy "rutas usa catalogo" on rt_catalog for all to authenticated using (has_module('rutas')) with check (has_module('rutas'));
