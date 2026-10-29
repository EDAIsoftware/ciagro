-- EDAI · Catálogo de clientes para las rutas de servicio (con sus máquinas). Seguro de repetir.
-- Al escribir un cliente en una solicitud aparece para elegirlo y se completan sus datos (editables).
-- Cada solicitud nueva agrega o actualiza el cliente y sus máquinas automáticamente.
create table if not exists rt_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null default '',
  zone text not null default '',
  meeting_point text not null default '',
  machines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists rt_clients_name_uq on rt_clients (lower(name));
alter table rt_clients enable row level security;
drop policy if exists "rutas usa clientes" on rt_clients;
create policy "rutas usa clientes" on rt_clients for all to authenticated using (has_module('rutas')) with check (has_module('rutas'));

-- Clientes de la planilla HOJA DE RUTA - SEMANA 42 (solo se agregan los que no existen)
insert into rt_clients (name, contact, zone, meeting_point, machines) values
  ('FAMOSA(CIA.IND. COMERCIAL HNOS. VICENTE SRL)', '67712572 - MARCIAL', 'Norte', 'PROPIEDAD HUALTACO', '[{"brand": "DEVELON", "machine": "EXCAVADORA", "model": "DX225 LCA"}]'::jsonb),
  ('ANTONIO ANTELO', '74754615', 'Este', 'SAN PABLO', '[{"brand": "DEVELON", "machine": "EXCAVADORA", "model": "DX225LCA-7M"}]'::jsonb),
  ('CLAROS FLORENCIO', '67717855', 'Este', 'SAN PABLO', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "T6.130"}]'::jsonb),
  ('MORALES CONDORI SABINA', '67763915 - SABINA', 'Este', 'SAN PABLO', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "T7.180"}]'::jsonb),
  ('JHONNY ESTRADA', '67882494', 'Este', 'SAN PABLO - COMUNIDAD 19 DE MARZO', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "T6.130"}]'::jsonb),
  ('DOMINGO BAUTISTA', '73646308 - VICENTE', 'Este', 'GUARAYOS - NUEVA JERUZALEN', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "T7.180"}]'::jsonb),
  ('KERIGMA INVERSIONES S.A.', '', 'Este', 'QUIMOME', '[{"brand": "DEVELON", "machine": "EXCAVADORA", "model": "DX225LCA"}]'::jsonb),
  ('AGROPECUARIA ALGARROBAL', '71033233', 'Este', 'POZO DEL TIGRE', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "T5070"}]'::jsonb),
  ('INDUSTRIA DE FIBRA DE MADERA SCHWARTZ VRENA S.R.L.', '62244837 - SHRILEY', 'Norte', 'PORTACHUELO', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "8030"}]'::jsonb),
  ('MADRILES DF&R', '78513262--FEDERICO', 'Este', 'PAILON', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "T7.200"}]'::jsonb),
  ('BJ RANCHO', '', 'Este', 'POZO DEL TIGRE', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "TM150"}]'::jsonb),
  ('JOSE LUIS VARGAS ORTEGA', '77640029', 'Este', 'SAN PABLO', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "6630"}]'::jsonb),
  ('PABLO RIOJA', '72919502 - PABLO', 'Este', 'SAN PABLO', '[{"brand": "NEW HOLLAND", "machine": "TRACTOR", "model": "T7.150"}]'::jsonb),
  ('CIAGRO', '-', 'Norte', 'EXPOVIDAS', '[{"brand": "VARIOS", "machine": "VARIOS", "model": "VARIOS"}]'::jsonb)
on conflict (lower(name)) do nothing;
