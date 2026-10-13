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
