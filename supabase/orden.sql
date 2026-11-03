-- EDAI · Orden manual de las visitas dentro de una ruta (0 = automático por prioridad). Seguro de repetir.
alter table rt_requests add column if not exists pos int not null default 0;
