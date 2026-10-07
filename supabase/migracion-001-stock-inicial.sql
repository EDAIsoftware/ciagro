-- EDAI FuelOps · Migración 001: stock inicial, capacidad de tanque, tanque lleno
-- Pegar entero en Supabase > SQL Editor > Run. Es seguro repetirlo.

alter table vehicles
  add column if not exists tank_capacity    numeric not null default 0  check (tank_capacity >= 0),
  add column if not exists initial_liters   numeric not null default 0  check (initial_liters >= 0),
  add column if not exists initial_odometer numeric not null default 0  check (initial_odometer >= 0),
  add column if not exists avg_km_per_l     numeric not null default 10 check (avg_km_per_l > 0),
  add column if not exists initial_date     date;

-- Vehículos existentes: el sistema "arranca" en su primera carga (o su fecha de alta)
update vehicles v set initial_date = coalesce((select min(date) from loads l where l.vehicle_id = v.id), v.created_at::date)
where initial_date is null;
alter table vehicles alter column initial_date set default current_date;
alter table vehicles alter column initial_date set not null;

-- ¿Se llenó el tanque completo? (rendimiento real Full-to-Full)
alter table loads add column if not exists full_tank boolean not null default false;

-- Disponible = stock inicial + facturas − salidas
create or replace function check_transfer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare avail numeric; prev numeric := 0;
begin
  perform 1 from public.vehicles where id = new.vehicle_id for update;
  if tg_op = 'UPDATE' and old.vehicle_id = new.vehicle_id then prev := old.liters; end if;
  select coalesce(v.initial_liters, 0)
       + coalesce((select sum(liters) from public.loads where vehicle_id = new.vehicle_id), 0)
       - coalesce((select sum(liters) from public.transfers where vehicle_id = new.vehicle_id), 0)
       + prev
  into avail from public.vehicles v where v.id = new.vehicle_id;
  if new.liters > avail then
    raise exception 'Solo hay % L disponibles (stock inicial + facturas - salidas) en esta camioneta.', avail;
  end if;
  return new;
end $$;
