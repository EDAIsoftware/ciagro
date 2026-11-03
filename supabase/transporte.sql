-- EDAI · Una ruta puede hacerse en Bus (sin camioneta). Seguro de repetir.
alter table rt_routes add column if not exists transport text not null default '';
