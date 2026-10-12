-- EDAI · Módulo de inspecciones (independiente del control de combustible)
-- Ejecutar UNA vez en SQL Editor. Requiere que schema.sql ya esté ejecutado.

create table if not exists insp_vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plate text not null unique,
  area text not null default '',
  driver text not null default 'Sin asignar',
  odometer numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists inspections (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references insp_vehicles on delete cascade,
  kind text not null check (kind in ('inspeccion','recepcion')),
  date date not null,
  place text not null default '',
  inspector text not null,
  driver text not null default '',
  km numeric,
  fuel_level int check (fuel_level between 0 and 4),
  items jsonb not null default '{}',
  photos jsonb not null default '[]',
  signatures jsonb not null default '{}',
  extra jsonb not null default '{}',
  notes text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists inspections_vehicle_date on inspections (vehicle_id, date desc);

alter table insp_vehicles enable row level security;
alter table inspections enable row level security;

drop policy if exists "ver insp_vehicles" on insp_vehicles;
drop policy if exists "admin gestiona insp_vehicles" on insp_vehicles;
create policy "ver insp_vehicles" on insp_vehicles for select to authenticated using (true);
create policy "admin gestiona insp_vehicles" on insp_vehicles for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "ver inspecciones" on inspections;
drop policy if exists "registrar inspecciones" on inspections;
drop policy if exists "admin borra inspecciones" on inspections;
create policy "ver inspecciones" on inspections for select to authenticated using (true);
create policy "registrar inspecciones" on inspections for insert to authenticated with check (created_by = auth.uid());
create policy "admin borra inspecciones" on inspections for delete to authenticated using (is_admin());
-- (sin política de update: una inspección guardada no se edita)

-- El kilometraje de la inspección actualiza el odómetro del vehículo
create or replace function sync_odometer_insp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.km is not null then
    update public.insp_vehicles set odometer = greatest(odometer, new.km) where id = new.vehicle_id;
  end if;
  return new;
end $$;
drop trigger if exists inspections_odometer on inspections;
create trigger inspections_odometer after insert on inspections for each row execute function sync_odometer_insp();

-- Fotos (almacenamiento privado)
insert into storage.buckets (id, name, public) values ('inspecciones', 'inspecciones', false) on conflict (id) do nothing;
drop policy if exists "inspecciones subir" on storage.objects;
drop policy if exists "inspecciones ver" on storage.objects;
drop policy if exists "inspecciones borrar admin" on storage.objects;
create policy "inspecciones subir" on storage.objects for insert to authenticated with check (bucket_id = 'inspecciones');
create policy "inspecciones ver" on storage.objects for select to authenticated using (bucket_id = 'inspecciones');
create policy "inspecciones borrar admin" on storage.objects for delete to authenticated using (bucket_id = 'inspecciones' and public.is_admin());
