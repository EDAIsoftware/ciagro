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
