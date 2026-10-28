-- EDAI · Agregar las firmas de entrega a una inspección ya guardada (solo si todavía no tiene firmas). Seguro de repetir.
revoke update on inspections from authenticated;
grant update (signatures, extra) on inspections to authenticated;
drop policy if exists "firmar entrega" on inspections;
create policy "firmar entrega" on inspections for update to authenticated
  using (has_module('inspecciones') and signatures = '{}'::jsonb)
  with check (has_module('inspecciones'));
