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
