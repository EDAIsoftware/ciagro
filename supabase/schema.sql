-- EDAI FuelOps · Esquema Supabase. Ejecutar completo en SQL Editor.
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text not null default 'operador' check (role in ('admin','operador'))
);
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plate text not null unique,
  type text not null check (type in ('Diésel','Gasolina')),
  driver text not null default 'Sin asignar',
  odometer numeric not null default 0,
  created_at timestamptz not null default now()
);
create table loads (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles on delete cascade,
  date date not null,
  liters numeric not null check (liters > 0),
  cost numeric not null check (cost >= 0),
  invoice text not null,
  odometer numeric not null,
  driver text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create table transfers (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles on delete cascade,
  datetime timestamp not null,
  liters numeric not null check (liters > 0),
  equipment text not null,
  person text not null,
  notes text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create function is_admin() returns boolean language sql security definer stable as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

-- Primer usuario creado = admin; los demás = operador
create function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email),
          case when exists (select 1 from profiles) then 'operador' else 'admin' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Actualiza odómetro del vehículo al registrar una carga
create function sync_odometer() returns trigger language plpgsql security definer as $$
begin
  update vehicles set odometer = greatest(odometer, new.odometer) where id = new.vehicle_id;
  return new;
end $$;
create trigger loads_odometer after insert on loads for each row execute function sync_odometer();

-- No permitir sacar más litros de los facturados a esa camioneta
create function check_transfer() returns trigger language plpgsql as $$
declare avail numeric;
begin
  select coalesce((select sum(liters) from loads where vehicle_id = new.vehicle_id), 0)
       - coalesce((select sum(liters) from transfers where vehicle_id = new.vehicle_id), 0) into avail;
  if new.liters > avail then raise exception 'Solo hay % L facturados sin transferir', avail; end if;
  return new;
end $$;
create trigger transfers_check before insert on transfers for each row execute function check_transfer();

alter table profiles enable row level security;
alter table vehicles enable row level security;
alter table loads enable row level security;
alter table transfers enable row level security;

create policy "perfil propio" on profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy "admin gestiona perfiles" on profiles for update to authenticated using (is_admin());
create policy "ver vehiculos" on vehicles for select to authenticated using (true);
create policy "admin vehiculos" on vehicles for all to authenticated using (is_admin()) with check (is_admin());
create policy "ver cargas" on loads for select to authenticated using (true);
create policy "registrar cargas" on loads for insert to authenticated with check (true);
create policy "admin borra cargas" on loads for delete to authenticated using (is_admin());
create policy "ver salidas" on transfers for select to authenticated using (true);
create policy "registrar salidas" on transfers for insert to authenticated with check (true);
create policy "admin borra salidas" on transfers for delete to authenticated using (is_admin());

-- Tiempo real
alter publication supabase_realtime add table vehicles, loads, transfers;
