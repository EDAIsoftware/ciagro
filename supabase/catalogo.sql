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
