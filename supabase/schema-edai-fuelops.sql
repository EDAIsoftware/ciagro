-- EDAI FuelOps · Esquema completo (pegar entero en Supabase > SQL Editor > Run)

-- 1. TABLAS
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text not null default 'operador' check (role in ('admin','operador'))
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plate text not null unique,
  type text not null check (type in ('Diésel','Gasolina')),
  driver text not null default 'Sin asignar',
  odometer numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists loads (
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

create table if not exists transfers (
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

create index if not exists loads_vehicle_date on loads (vehicle_id, date);
create index if not exists transfers_vehicle_dt on transfers (vehicle_id, datetime);

-- 2. FUNCIONES Y TRIGGERS
create or replace function is_admin() returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Primer usuario creado = admin; los demás = operador
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case when exists (select 1 from public.profiles) then 'operador' else 'admin' end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- El odómetro del vehículo sube con cada carga
create or replace function sync_odometer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.vehicles set odometer = greatest(odometer, new.odometer) where id = new.vehicle_id;
  return new;
end $$;

drop trigger if exists loads_odometer on loads;
create trigger loads_odometer after insert or update on loads
  for each row execute function sync_odometer();

-- No permitir sacar más litros de los facturados a esa camioneta
create or replace function check_transfer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare avail numeric; prev numeric := 0;
begin
  perform 1 from public.vehicles where id = new.vehicle_id for update;
  if tg_op = 'UPDATE' and old.vehicle_id = new.vehicle_id then prev := old.liters; end if;
  select coalesce((select sum(liters) from public.loads where vehicle_id = new.vehicle_id), 0)
       - coalesce((select sum(liters) from public.transfers where vehicle_id = new.vehicle_id), 0) + prev
  into avail;
  if new.liters > avail then
    raise exception 'Solo hay % L facturados sin transferir en esta camioneta.', avail;
  end if;
  return new;
end $$;

drop trigger if exists transfers_check on transfers;
create trigger transfers_check before insert or update on transfers
  for each row execute function check_transfer();

-- 3. SEGURIDAD (RLS)
alter table profiles enable row level security;
alter table vehicles enable row level security;
alter table loads enable row level security;
alter table transfers enable row level security;

drop policy if exists "ver perfiles" on profiles;
drop policy if exists "admin gestiona perfiles" on profiles;
create policy "ver perfiles" on profiles for select to authenticated using (true);
create policy "admin gestiona perfiles" on profiles for update to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "ver vehiculos" on vehicles;
drop policy if exists "admin gestiona vehiculos" on vehicles;
create policy "ver vehiculos" on vehicles for select to authenticated using (true);
create policy "admin gestiona vehiculos" on vehicles for all to authenticated using (is_admin()) with check (is_admin());

-- Cargas: todos registran; solo el admin edita o borra
drop policy if exists "ver cargas" on loads;
drop policy if exists "registrar cargas" on loads;
drop policy if exists "admin edita cargas" on loads;
drop policy if exists "admin borra cargas" on loads;
create policy "ver cargas" on loads for select to authenticated using (true);
create policy "registrar cargas" on loads for insert to authenticated with check (created_by = auth.uid());
create policy "admin edita cargas" on loads for update to authenticated using (is_admin()) with check (is_admin());
create policy "admin borra cargas" on loads for delete to authenticated using (is_admin());

-- Salidas a maquinaria: igual
drop policy if exists "ver salidas" on transfers;
drop policy if exists "registrar salidas" on transfers;
drop policy if exists "admin edita salidas" on transfers;
drop policy if exists "admin borra salidas" on transfers;
create policy "ver salidas" on transfers for select to authenticated using (true);
create policy "registrar salidas" on transfers for insert to authenticated with check (created_by = auth.uid());
create policy "admin edita salidas" on transfers for update to authenticated using (is_admin()) with check (is_admin());
create policy "admin borra salidas" on transfers for delete to authenticated using (is_admin());

-- 4. TIEMPO REAL (seguro de repetir)
do $$ begin
  begin alter publication supabase_realtime add table public.vehicles; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.loads; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.transfers; exception when duplicate_object then null; end;
end $$;

-- 5. Usuarios creados antes de este script: crear su perfil (el más antiguo = admin si aún no hay admin)
insert into profiles (id, full_name, role)
select u.id, u.email,
  case when row_number() over (order by u.created_at) = 1
        and not exists (select 1 from profiles where role = 'admin') then 'admin' else 'operador' end
from auth.users u
where u.id not in (select id from profiles);
