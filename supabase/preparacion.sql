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
